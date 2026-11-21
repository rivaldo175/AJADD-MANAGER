(function () {
    "use strict";

    function rediriger() {
        sessionStorage.removeItem("ajaddSession");
        window.location.replace("index.html");
    }

    let session;

    try {
        session = JSON.parse(
            sessionStorage.getItem("ajaddSession") || "null"
        );
    } catch (erreur) {
        rediriger();
        return;
    }

    // Vérifier la session AJADD
    if (!session || !session.userId || !session.role) {
        rediriger();
        return;
    }

    // Récupérer le rôle directement depuis le profil Appwrite
    const role = String(session.role).toLowerCase();

    const estPDG = role === "pdg";
    const estDG = role === "dg";

    const accesTotal = estPDG || estDG;

    const page = window.location.pathname
        .split("/")
        .pop()
        .toLowerCase();

    if (page === "index.html" || page === "") {
        return;
    }

    // Gestion des utilisateurs : PDG uniquement
    if (page === "utilisateurs.html" && !estPDG) {
        alert("Accès réservé au PDG.");
        window.location.replace("dashboard.html");
        return;
    }

    // Correspondance des modules
    const alias = {
        "direction.html": ["direction"],
        "bureau.html": ["bureau"],
        "departements.html": ["departements"],
        "responsables.html": ["responsables"],
        "membres.html": ["membres"],
        "regions.html": ["regions"],
        "responsables-regionaux.html": ["responsablesregionaux"],
        "evenements.html": ["evenements"],
        "projets-evenements.html": ["projetsevenementiels"],
        "budget-evenements.html": ["budgetevenements"],
        "formations.html": ["formations"],
        "commerces.html": ["commerces"],
        "partenaires.html": ["partenaires"],
        "finance.html": ["finance"],
        "documents.html": ["documents"],
        "communication.html": ["communication"]
    };

    function normaliser(valeur) {
        return String(valeur || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\.html$/g, "")
            .replace(/[^a-z0-9]/g, "");
    }

    function obtenirPermissions() {
        let source = session.permissions || [];

        if (typeof source === "string") {
            try {
                source = JSON.parse(source);
            } catch (erreur) {
                source = [];
            }
        }

        if (Array.isArray(source)) {
            return source.map(normaliser);
        }

        if (source && typeof source === "object") {
            if (source.tous === true) {
                return ["tous"];
            }

            return Object.keys(source)
                .filter(cle => source[cle] === true)
                .map(normaliser);
        }

        return [];
    }

    const permissions = obtenirPermissions();

    function autorise(fichier) {
        if (fichier === "dashboard.html") return true;

        if (accesTotal) return true;

        if (permissions.includes("tous")) return true;

        const valeurs = [
            normaliser(fichier),
            ...(alias[fichier] || []).map(normaliser)
        ];

        return valeurs.some(v => permissions.includes(v));
    }

    if (!autorise(page)) {
        alert("Vous n'avez pas l'autorisation d'accéder à ce module.");
        window.location.replace("dashboard.html");
        return;
    }

    // Informations de l'utilisateur connecté
    window.ajaddUtilisateurConnecte = session;
    window.ajaddEstPDG = estPDG;
    window.ajaddEstDG = estDG;

})();
