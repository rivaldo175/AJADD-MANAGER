import {
    Client,
    Users,
    TablesDB,
    Query,
    ID,
    Permission,
    Role
} from "node-appwrite";

const DATABASE_ID = "6b0099250002370a019c";
const TABLE_PROFILS = "6b009a0a000779bd5b71";
const PDG_ID = "6b009e4600271168f8e2";

const ROLES_AUTORISES = [
    "dg",
    "responsable",
    "membre",
    "agent"
];

const MODULES_AUTORISES = [
    "direction",
    "bureau",
    "departements",
    "responsables",
    "membres",
    "regions",
    "responsablesregionaux",
    "evenements",
    "projetsevenementiels",
    "budgetevenements",
    "formations",
    "commerces",
    "partenaires",
    "finance",
    "documents",
    "communication"
];

export default async ({ req, res, log, error }) => {

    try {

        // 1. Vérifier l'identité de la personne connectée
        const userId = req.headers["x-appwrite-user-id"];
        const userJWT = req.headers["x-appwrite-user-jwt"];

        if (!userId || !userJWT) {
            return res.json({
                success: false,
                message: "Connexion obligatoire."
            });
        }

        // 2. Vérifier le rôle PDG avec le profil Appwrite
        const clientUtilisateur = new Client()
            .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
            .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
            .setJWT(userJWT);

        const tablesUtilisateur = new TablesDB(clientUtilisateur);

        const resultats = await tablesUtilisateur.listRows({
            databaseId: DATABASE_ID,
            tableId: TABLE_PROFILS,
            queries: [
                Query.equal("user_id", [userId])
            ]
        });

        const profilPDG = resultats.rows.find(
            profil => profil.user_id === userId
        );

        if (
            userId !== PDG_ID ||
            !profilPDG ||
            profilPDG.role !== "pdg" ||
            profilPDG.statut !== "actif"
        ) {
            return res.json({
                success: false,
                message: "Accès refusé. Seul le PDG actif peut créer des comptes."
            });
        }

        // 3. Vérifier les données reçues
        const donnees = req.bodyJson || {};

        const nom = String(donnees.nom || "").trim();
        const identifiant = String(donnees.identifiant || "").trim();
        const email = String(donnees.email || "").trim().toLowerCase();
        const fonction = String(donnees.fonction || "").trim();
        const role = String(donnees.role || "").toLowerCase();
        const statut = String(donnees.statut || "actif");
        const motDePasse = String(donnees.motDePasse || "");

        const permissions = donnees.permissions;

        if (
            !nom ||
            !identifiant ||
            !email ||
            !fonction ||
            !role ||
            !motDePasse
        ) {
            return res.json({
                success: false,
                message: "Tous les champs obligatoires doivent être remplis."
            });
        }

        if (motDePasse.length < 8) {
            return res.json({
                success: false,
                message: "Le mot de passe doit contenir au moins 8 caractères."
            });
        }

        if (!ROLES_AUTORISES.includes(role)) {
            return res.json({
                success: false,
                message: "Ce rôle n'est pas autorisé."
            });
        }

        if (!["actif", "suspendu"].includes(statut)) {
            return res.json({
                success: false,
                message: "Statut invalide."
            });
        }

        if (
            !Array.isArray(permissions) ||
            permissions.some(p => !MODULES_AUTORISES.includes(p))
        ) {
            return res.json({
                success: false,
                message: "Les permissions fournies sont invalides."
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.json({
                success: false,
                message: "Adresse e-mail invalide."
            });
        }

        // 4. Initialiser le client sécurisé Appwrite
        const clientAdmin = new Client()
            .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
            .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
            .setKey(req.headers["x-appwrite-key"] || "");

        const users = new Users(clientAdmin);
        const tablesDB = new TablesDB(clientAdmin);

        // 5. Vérifier si l'identifiant existe déjà
        const doublons = await tablesDB.listRows({
            databaseId: DATABASE_ID,
            tableId: TABLE_PROFILS,
            queries: [
                Query.equal("identifiant", [identifiant])
            ]
        });

        if (doublons.rows.length > 0) {
            return res.json({
                success: false,
                message: "Cet identifiant existe déjà."
            });
        }

        // 6. Créer le véritable compte Appwrite
        const nouvelUtilisateur = await users.create({
            userId: ID.unique(),
            email: email,
            password: motDePasse,
            name: nom
        });

        try {

            // 7. Enregistrer le profil dans la base de données
            await tablesDB.createRow({
                databaseId: DATABASE_ID,
                tableId: TABLE_PROFILS,
                rowId: nouvelUtilisateur.$id,

                data: {
                    user_id: nouvelUtilisateur.$id,
                    nom_complet: nom,
                    identifiant: identifiant,
                    fonction: fonction,
                    role: role,
                    statut: statut,
                    permissions: JSON.stringify(permissions),
                    date_creation: new Date().toISOString()
                },

                permissions: [
                    Permission.read(Role.user(nouvelUtilisateur.$id)),
                    Permission.read(Role.user(PDG_ID))
                ]
            });

        } catch (erreurProfil) {

            // Supprimer le compte si le profil n'a pas pu être créé
            await users.delete({
                userId: nouvelUtilisateur.$id
            });

            throw erreurProfil;
        }

        log("Nouveau compte AJADD créé : " + nouvelUtilisateur.$id);

        return res.json({
            success: true,
            message: "Compte utilisateur créé avec succès.",
            userId: nouvelUtilisateur.$id,
            email: email
        });

    } catch (erreur) {

        error("Erreur AJADD CREATE USER : " + erreur.message);

        return res.json({
            success: false,
            message: "Impossible de créer le compte. Vérifiez les paramètres Appwrite."
        });
    }
};