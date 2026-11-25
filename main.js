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

  try {
    // Vérifier l'identité de la personne connectée
    const userId = req.headers["x-appwrite-user-id"];
    const userJWT = req.headers["x-appwrite-user-jwt"];

    if (!userId || !userJWT) {
      return res.json({
        success: false,
        message: "Connexion obligatoire."
      }, 401);
    }

    // Vérifier le profil du PDG
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

    if (
      userId !== PDG_ID ||
      profilPDG.total !== 1 ||
      profilPDG.rows[0].role !== "pdg" ||
      profilPDG.rows[0].statut !== "actif"
    ) {
      return res.json({
        success: false,
        message: "Accès réservé au PDG."
      }, 403);
    }

    // Lire les informations du formulaire
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

    // Vérifier les permissions demandées
    const permissionsDemandees = Array.isArray(body.permissions)
      ? body.permissions
      : [];

    const permissions = {};

    for (const module of permissionsDemandees) {
      if (MODULES_AUTORISES.includes(module)) {
        permissions[module] = true;
      }
    }

    // Client serveur
    const clientServeur = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(req.headers["x-appwrite-key"] || "");

    const users = new Users(clientServeur);
    const tables = new TablesDB(clientServeur);

    // Vérifier si l'identifiant existe déjà
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

    // Créer le véritable compte Appwrite
    const nouvelUtilisateur = await users.create({
      userId: ID.unique(),
      email,
      password,
      name: nom
    });

    nouvelUtilisateurId = nouvelUtilisateur.$id;

    // Créer le profil dans la base de données
    await tables.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLE_PROFILS,
      rowId: nouvelUtilisateurId,
      data: {
        user_id: nouvelUtilisateurId,
        nom_complet: nom,
        identifiant,
        fonction,
        role,
        statut,
        permissions: JSON.stringify(permissions),
        date_creation: new Date().toISOString()
      },
      permissions: [
        Permission.read(Role.user(nouvelUtilisateurId)),
        Permission.read(Role.user(PDG_ID))
      ]
    });

    log("Utilisateur créé : " + nouvelUtilisateurId);

    return res.json({
      success: true,
      message: "Le compte utilisateur a été créé avec succès.",
      userId: nouvelUtilisateurId
    }, 201);

  } catch (err) {
    error("Erreur création utilisateur : " + err.message);

    // Supprimer le compte si la création du profil échoue
    if (nouvelUtilisateurId) {
      try {
        const clientServeur = new Client()
          .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
          .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
          .setKey(req.headers["x-appwrite-key"] || "");

        const users = new Users(clientServeur);
        await users.delete({
          userId: nouvelUtilisateurId
        });
      } catch (deleteError) {
        error("Erreur lors du nettoyage : " + deleteError.message);
      }
    }

    return res.json({
      success: false,
      message: "Impossible de créer le compte. Vérifiez les informations et les permissions de la fonction."
    }, 500);
  }
};
