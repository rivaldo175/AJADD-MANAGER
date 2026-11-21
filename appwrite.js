// ==========================================
 // AJADD MANAGER - CONFIGURATION APPWRITE
 // ==========================================

const client = new Appwrite.Client();

client
    .setEndpoint("https://fra.cloud.appwrite.io/v1")
    .setProject("6b0096e30015da183bae");

// Services Appwrite
window.ajaddAppwriteClient = client;
window.ajaddAccount = new Appwrite.Account(client);
window.ajaddTablesDB = new Appwrite.TablesDB(client);

// Base de données
window.AJADD_DATABASE_ID = "6b0099250002370a019c";

// Identifiants des 18 tables
window.AJADD_TABLES = {
    profils_utilisateurs: "6b009a0a000779bd5b71",
    membres: "6b00a402000b1a1d4119",
    directions: "6b00a5b0001fd4b33961",
    bureau_executif: "6b00a6e3002c08100f5a",
    departements: "6b00a807000ae4c66e54",
    responsables: "6b00a8f600067166f008",
    regions: "6b00aa080030e0bcc944",
    responsables_regionaux: "6b00e172000f861d33a5",
    evenements: "6b00e2b3003b40a2f8f8",
    projets_evenements: "6b00e53a001e70d63240",
    budgets_evenements: "6b00e6b300089fe470dc",
    formations: "6b00e846002935362070",
    commerces: "6b00e9e6000fb2193a60",
    partenaires: "6b00eb7a002705ffcc84",
    finance: "6b00ecc0003b2c801750",
    budgets: "6b00ee66003146b65758",
    documents: "6b00efb0003240a50ba1",
    communications: "6b00f12c00374a5087c7"
};

console.log("AJADD MANAGER : configuration Appwrite chargée.");
console.log("18 tables configurées.");