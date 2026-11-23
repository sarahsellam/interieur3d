# Plan du projet

Chaque étape se termine par une version testable en ligne
(https://sarahsellam.github.io/interieur3d/). On ne passe à l'étape suivante
qu'après validation.

**Objectif actuel :** recréer sa propre chambre sur iPad, essayer plusieurs
aménagements et sauvegarder celui qu'on préfère.

**Test de validation de la prochaine version :** recréer la chambre, placer le lit,
les fenêtres et la coiffeuse, puis sauvegarder deux versions avec deux couleurs
différentes pour le mur rose. Le parcours doit être fluide sur iPad.

## Déjà fait

### Étape 1 — Base 3D ✅
- Pièce aux dimensions modifiables, meubles réels (Poly Haven, CC0), vue 3D et plan.

### Étape 2 — Rendu réaliste ✅
- Textures PBR, fenêtres et porte réelles, plinthes et corniches, lumière du jour,
  ombres douces, occlusion ambiante, visite à hauteur d'yeux, plan d'architecte.
- Hébergement gratuit sur GitHub Pages, mis à jour automatiquement.

## Étape 3 — Ma chambre sur iPad ✅ livrée

### Design et couleurs
- Ambiance magazine de décoration, beige et naturelle.
- Palette de l'interface : ivoire #F8F5F0 (fond), blanc #FFFFFF (panneaux),
  beige sable #E8DED2 (onglets), bordeaux #742F45 (boutons, sélection),
  brun charbon #292321 (texte, contours du plan), vert profond #44634D (confirmation).
- Titres en Instrument Serif, menus, boutons, mesures et fiches en Inter.
- Coins légèrement arrondis, ombres discrètes, murs plus fins dans le plan.
  La pièce reste l'élément principal à l'écran.
- La palette ne concerne que l'interface : murs et meubles restent personnalisables.

### Éditeur tactile
- Vues renommées : « Plan », « Vue 3D », « À hauteur des yeux ».
- Bouton + visible sur les fiches du catalogue.
- Meuble sélectionné surligné. Ses commandes s'affichent dans un panneau compact
  en bas : déplacer, tourner, couleur, dimensions, dupliquer, verrouiller, supprimer.
- Annuler / Rétablir.
- Saisie directe des dimensions de la pièce et des meubles.
- Alignement facultatif sur la grille ou sur les murs.
- Alertes de chevauchement précises (meubles concernés surlignés), en autorisant
  le tapis sous un meuble et les chaises rangées sous une table.

### Recréer une vraie pièce
- Démarrer avec une pièce vide, une pièce meublée ou un exemple à tester.
- Saisir les dimensions, importer un plan (image ou PDF) et des photos de la pièce,
  utilisés comme références pendant la construction.
- Ajouter, déplacer et redimensionner portes, fenêtres et portes-fenêtres le long
  des murs, avec le sens d'ouverture des portes dans le plan.
  Placards intégrés et niches.
- Couleur choisie mur par mur. Ouvertures, meubles et couleurs identiques dans les
  trois vues.
- Sauvegarde des projets ; duplication d'un aménagement pour comparer deux versions.

### Accueil et parcours
- Accueil avec un bouton « Créer mon espace », les projets récents et l'accès aux
  inspirations.
- Nouveau projet en trois étapes : « Mon espace » → « Mes inspirations » →
  « Mon aménagement ».
- Onglet « Mes inspirations » à côté de « Meubles » et « Pièce » : photo de la
  galerie ou lien Pinterest, avec une note (« le mur vert », « le bois de la
  commode »). Une photo de référence peut rester visible à côté de la pièce.

## Étape 3 bis — Mes meubles et budget ✅ livrée
- Accueil sur fond beige clair chaleureux #F2EBE1, cartes blanches ou ivoire.
- « Mes meubles » : ajouter un meuble trouvé sur Internet avec « Ajouter depuis un lien »
  (photo, nom, prix, dimensions, vendeur, lien), à vérifier et compléter à la main,
  photo depuis la galerie. Sans modèle 3D exact : représentation simplifiée aux bonnes
  dimensions, clairement signalée.
- « Remplacer » sur chaque meuble : propositions adaptées aux dimensions disponibles,
  filtre de budget par meuble (« Moins de 50 € », « 50 à 100 € », « 100 à 300 € »,
  « Plus de 300 € » ou fourchette personnalisée), fiche avec photo, prix, dimensions,
  vendeur et lien ; aperçu dans la pièce avant de confirmer ; alerte si ça ne rentre pas.
- Meubles « Déjà possédé » ou « À acheter » ; budget total des seuls achats prévus,
  mis à jour à chaque remplacement.
- Inspirations sans IA : couleurs principales de la photo à appliquer aux murs ou aux
  meubles, suggestions de meubles à partir de la note.
- Plus tard (nécessite le relais et l'IA) : récupération automatique des informations
  d'un lien, propositions classées selon l'ambiance des inspirations, produits de vraies
  boutiques (catalogue partenaire / affiliation).

## Étape 4 — Assistant IA « Demander une idée » ✅ livrée
- Demande en langage courant (« Crée un coin bureau en gardant mon lit et en laissant
  l'accès à la porte-fenêtre »).
- Deux propositions à prévisualiser, en respectant les meubles verrouillés, les
  dimensions et les passages.
- Appliquer la proposition choisie, puis comparer avec la version précédente.
- Toucher chaque meuble proposé et choisir « Remplacer » (propositions selon l'ambiance).
- Pré-requis : compte Anthropic (paiement à l'usage, plafond fixé) et petit relais gratuit
  (Cloudflare) qui cache la clé et permet de lire les pages produits.

## Étape 5 — Partage et fil d'inspiration
- Projets privés par défaut.
- ✅ Partage par lien avec demande d'avis : une ou deux versions choisies, question,
  lien sans compte (plan, 3D, hauteur des yeux, lecture seule), vote A/B, commentaire,
  prénom facultatif ; résultats dans l'application ; arrêt du partage à tout moment.
- Fil d'inspiration des projets publics, filtres par type de pièce, surface et budget.
- Modération des contenus.

## Étape 6 — Import de plan avancé
- ✅ Calibrer l'échelle d'un plan importé (photo ou PDF) : deux points + longueur réelle.
- ✅ Tracer les murs d'un appartement complet en touchant les angles, le plan restant
  visible en arrière-plan (loupe sous le doigt, murs d'équerre, épaisseur cloison / mur / porteur).
- ✅ Portes, fenêtres et portes-fenêtres posées sur les murs ; pièces fermées détectées
  automatiquement avec leur surface ; nommer les pièces.
- ✅ Vue 3D de tout l'appartement et visite à hauteur des yeux (murs de 2,50 m réglables,
  portes ouvertes, on passe d'une pièce à l'autre).
- ✅ « Aménager cette pièce » : la pièce devient un projet avec ses vraies dimensions,
  portes et fenêtres (pièce non rectangulaire : aménagée dans son rectangle).
- Plus tard : détection automatique des murs, toujours vérifiable et corrigeable ;
  pièces non rectangulaires dans l'éditeur de pièce.

## Étape 7 — Comptes et sauvegarde en ligne
- ✅ Compte sans mot de passe par clé d'accès (Face ID, Touch ID, empreinte), synchronisée par
  le trousseau iCloud / Google ; code de secours ; ajout d'une clé sur un nouvel appareil.
- ✅ Synchronisation automatique des projets, plans d'appartement, inspirations, « Mes meubles »
  et images entre appareils (la modification la plus récente l'emporte), déconnexion, suppression du compte.
- Export en image et en plan PDF.
- Mentions légales, confidentialité, RGPD.

## Parcours utilisateur (retours de test de novembre 2026)
Objectif : en moins de deux minutes dans la chambre exemple, déplacer un meuble, essayer une
autre couleur et voir la différence entre deux versions.
- Lot A
  - ✅ 3D indisponible : message clair (causes possibles sur iPad / iPhone), plan 2D utilisable,
    visite vidéo de la chambre exemple depuis l'accueil et depuis l'éditeur.
  - ✅ Remplacer : vraies références du commerce (prix relevés, dimensions, lien, date du relevé),
    même sous-type proposé en premier, meubles sans prix affichables malgré le filtre,
    nouveaux modèles 3D (plantes, chevet, tabouret), « Ajouter mon propre lien » dans la fenêtre,
    essai à la même place, contrôle de l'espace, confirmation, budget mis à jour.
- Lot B
  - ✅ Comparatif avant / après dans le projet : deux versions au choix, rendues sous le même angle
    (ou en plan sans 3D), total « À acheter » de chacune, liste de ce qui change, « Changer l'angle
    de vue », « Ouvrir cette version » ; côte à côte sur grand écran, bascule A / B sur téléphone.
  - ✅ Guide de prise en main après « Essayer l'exemple » : déplacer un meuble, changer la couleur
    d'un mur (sur une copie), comparer ; repère animé sur la cible ; chaque étape peut être passée.
  - ✅ Nom complet du meuble dans sa fiche (avec vendeur et lien), noms du plan ajustés à la place.
- Lot C : mesures de passage entre meubles et zones d'ouverture (portes, tiroirs) ;
  couleur prise sur une photo d'inspiration et essayée sur un mur.

## Étape 8 — Publicité et affiliation
- Bandeaux discrets avec consentement cookies.
- Liens d'affiliation vers des meubles similaires.

## Application mobile
- ✅ Application installable depuis le navigateur (écran d'accueil), hors connexion,
  mises à jour, écrans de démarrage, sauvegarde/restauration dans un fichier.
- Plus tard, si besoin : publication dans l'App Store et Google Play (emballage Capacitor,
  compte Apple Developer 99 $/an, compte Google Play 25 $, politique de confidentialité, validation Apple).

## Étape 9 — Finitions
- Temps de chargement, qualité graphique adaptée à l'appareil.
- Catalogue élargi (cuisine, salle de bain, bureau), toujours en CC0.

## Points d'attention
- Licence : uniquement des modèles et textures CC0 ; noter la source de chacun.
- Performance : garder chaque modèle léger pour les téléphones et l'iPad.
- Pas de service payant tant que l'application ne rapporte rien. L'assistant IA
  aura un coût par demande : à prévoir avant l'étape 4.
