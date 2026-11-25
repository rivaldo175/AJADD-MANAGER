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
  "budgetsevenements",
  "formations",
  "commerces",
  "partenaires",
  "finance",
  "budgets",
  "documents",
  "communications"
];

export default async ({ req, res, log, error }) => {
  let nouvelUtilisateurId = null;
  let etape = "Initialisation";

  try {
    // 1. Vérifier la connexion
    etape = "Vérification de la connexion";

    const userId = req.headers["x-appwrite-user-id"];
    const userJWT = req.headers["x-appwrite-user-jwt"];

    if (!userId || !userJWT) {
      return res.json({
        success: false,
        message: "Connexion obligatoire. Reconnectez-vous."
      }, 401);
    }

    // 2. Vérifier le PDG
    etape = "Vérification du profil PDG";

    const clientPDG = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setJWT(userJWT);

    const tablesPDG = new TablesDB(clientPDG);

    const profilPDG = await tablesPDG.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLE_PROFILS,
      queries: [
        Query.equal("user_id", [userId])
      ]
    });

   const rolePDG = String(profilPDG.rows[0]?.role || "")
  .trim()
  .toLowerCase();

const statutPDG = String(profilPDG.rows[0]?.statut || "")
  .trim()
  .toLowerCase();

if (
  userId !== PDG_ID ||
  profilPDG.rows.length !== 1 ||
  rolePDG !== "pdg" ||
  statutPDG !== "actif"
) {
  return res.json({
    success: false,
    message: "Accès réservé au PDG."
  }, 403);
}

// 3. Lire les informations
etape = "Lecture du formulaire";

const body = req.bodyJson || {};

    const nom = String(body.nom_complet || "").trim();
    const identifiant = String(body.identifiant || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const fonction = String(body.fonction || "").trim();
    const role = String(body.role || "").trim().toLowerCase();
    const statut = String(body.statut || "actif").trim().toLowerCase();
    const password = String(body.password || "");

    if (!nom || !identifiant || !email || !fonction || !role || !password) {
      return res.json({
        success: false,
        message: "Veuillez remplir tous les champs obligatoires."
      }, 400);
    }

    if (password.length < 8) {
      return res.json({
        success: false,
        message: "Le mot de passe doit contenir au moins 8 caractères."
      }, 400);
    }

    if (!ROLES_AUTORISES.includes(role)) {
      return res.json({
        success: false,
        message: "Rôle non autorisé."
      }, 400);
    }

    if (!["actif", "suspendu"].includes(statut)) {
      return res.json({
        success: false,
        message: "Statut non valide."
      }, 400);
    }

    // 4. Vérifier les permissions
    etape = "Vérification des permissions";

    const permissionsDemandees = Array.isArray(body.permissions)
      ? body.permissions
      : [];

    const permissions = {};

    for (const module of permissionsDemandees) {
      if (MODULES_AUTORISES.includes(module)) {
        permissions[module] = true;
      }
    }

    // 5. Préparer le client serveur
    etape = "Connexion au serveur Appwrite";

    const apiKey = req.headers["x-appwrite-key"];

    if (!apiKey) {
      throw new Error(
        "Clé API temporaire absente. Vérifiez les autorisations de la fonction."
      );
    }

    const clientServeur = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(apiKey);

    const users = new Users(clientServeur);
    const tables = new TablesDB(clientServeur);

    // 6. Vérifier les doublons
    etape = "Vérification de l'identifiant";

    const doublons = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLE_PROFILS,
      queries: [
        Query.equal("identifiant", [identifiant])
      ]
    });

    if (doublons.total > 0) {
      return res.json({
        success: false,
        message: "Cet identifiant est déjà utilisé."
      }, 409);
    }

    // 7. Créer le compte Appwrite Auth
    etape = "Création du compte Appwrite Auth";

    const nouvelUtilisateur = await users.create({
      userId: ID.unique(),
      email: email,
      password: password,
      name: nom
    });

    nouvelUtilisateurId = nouvelUtilisateur.$id;

    // 8. Enregistrer le profil
    etape = "Enregistrement du profil dans la base de données";

    await tables.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLE_PROFILS,
      rowId: nouvelUtilisateurId,
      data: {
        user_id: nouvelUtilisateurId,
        nom_complet: nom,
        identifiant: identifiant,
        fonction: fonction,
        role: role,
        statut: statut,
        permissions: JSON.stringify(permissions),
        date_creation: new Date().toISOString()
      },
      permissions: [
        Permission.read(Role.user(nouvelUtilisateurId)),
        Permission.read(Role.user(PDG_ID))
      ]
    });

    log("Utilisateur créé avec succès : " + nouvelUtilisateurId);

    return res.json({
      success: true,
      message: "Compte créé avec succès.",
      userId: nouvelUtilisateurId
    }, 201);

  } catch (err) {

    const detailErreur = err?.message || String(err);

    error("ÉCHEC À L'ÉTAPE : " + etape);
    error("DÉTAIL DE L'ERREUR : " + detailErreur);

    // Supprimer le compte Auth si le profil n'a pas pu être enregistré
    if (nouvelUtilisateurId) {
      try {
        const apiKey = req.headers["x-appwrite-key"];

        if (apiKey) {
          const clientNettoyage = new Client()
            .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
            .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
            .setKey(apiKey);

          const usersNettoyage = new Users(clientNettoyage);

          await usersNettoyage.delete({
            userId: nouvelUtilisateurId
          });
        }
      } catch (deleteError) {
        error("ÉCHEC DU NETTOYAGE : " + deleteError.message);
      }
    }

    return res.json({
      success: false,
      message: "Échec à l'étape : " + etape + ". Détail : " + detailErreur
    }, 500);
  }
};
