# Plan du projet

Chaque étape se termine par une version testable en ligne. On ne passe à l'étape
suivante qu'après validation.

## Étape 1 — Base 3D ✅
- Choix des technologies, structure du projet, README, ce plan.
- Une pièce aux dimensions modifiables (largeur, longueur, hauteur).
- 8 meubles réalistes (modèles glTF/GLB CC0 de Poly Haven).
- Ajouter, déplacer, pivoter, dupliquer, supprimer.
- Vue 3D et vue du dessus avec cotes.
- Éclairage réaliste (HDRI, ombres douces, occlusion ambiante).
- Bonus : couleur des murs, 5 sols, sauvegarde automatique dans le navigateur.
- Lien de test.

## Étape 2 — Rendu réaliste « visite d'architecte » ⏳ PRIORITÉ 1 (en cours)
- Textures PBR réalistes de Poly Haven (CC0) : parquet, carrelage, peinture murale
  (enduit légèrement texturé), plafond, plinthes moulurées.
- Lumière naturelle : fenêtre réelle (découpe du mur, cadre, vitre, appui) laissant
  entrer la lumière du jour, ciel visible dehors, éclairage d'ambiance doux.
- Ombres douces, occlusion ambiante, reflets subtils sur les sols et les meubles.
- Couleurs sobres et naturelles ; aucune forme en simples cubes (moulures, chambranles).
- Caméra « visite » à hauteur d'yeux (1,60 m) pour se promener dans la pièce,
  en plus de la vue 3D d'ensemble et de la vue du dessus.
- Validation par captures d'écran avant de passer à l'étape 3.

## Étape 3 — Import du plan de l'appartement ⏳ PRIORITÉ 2
- Charger le plan en image (JPG, PNG) ou en PDF (première page convertie en image).
- Calibrer l'échelle : toucher deux points du plan et saisir la distance réelle
  (largeur d'une porte, longueur d'un mur).
- Tracer les murs en touchant les angles, le plan restant visible en arrière-plan
  (zoom, déplacement, aimantation aux angles et à l'horizontale/verticale, annuler).
- Placer portes et fenêtres sur les murs ; nommer les pièces.
- Génération de l'appartement complet en 3D (murs de 2,50 m), navigation pièce par pièce.
- Plus tard seulement : détection automatique des murs, toujours présentée comme une
  proposition que l'utilisateur vérifie et corrige avant validation.

## Étape 4 — Types de pièces, catalogue et ouvertures
- Choisir le type de pièce : chambre, salon, cuisine, salle de bain, bureau.
- Portes et miroirs posables librement sur les murs.
- Catalogue élargi par pièce (lit, armoire, bureau, meubles de cuisine, sanitaires…),
  toujours en CC0 uniquement.
- Les meubles ne se chevauchent plus (détection de collision) et s'aimantent aux murs.

## Étape 5 — Personnalisation
- Couleur et matière des meubles (tissus, bois, métal).
- Plus de couleurs et de sols, luminaires.
- Annuler / rétablir.
- Mesures : distance entre meubles, surface libre.
- Réglage automatique de la qualité graphique selon l'appareil.

## Étape 6 — Application installable
- Hébergement définitif sur un nom de domaine (par exemple Vercel ou Netlify).
- Installation sur l'écran d'accueil (iPad, iPhone, Android) avec fonctionnement hors ligne.
- Optimisation des temps de chargement.

## Étape 7 — Comptes et sauvegarde en ligne
- Création de compte (e-mail, Apple, Google), par exemple avec Supabase.
- Plusieurs projets par personne, retrouvés sur tous les appareils.
- Export en image (capture de la vue 3D) et en plan PDF.
- Mentions légales, politique de confidentialité, conformité RGPD.

## Étape 8 — Inspiration et partage
- Galerie de photos d'inspiration (images libres de droits ou fournies par les membres).
- Partage d'un projet par lien (lecture seule).
- Communauté : publier son aménagement, aimer, commenter, signaler.
- Modération des contenus.

## Étape 9 — Aide d'une IA
- Proposer un aménagement à partir des dimensions et d'un style (« salon cosy, 20 m² »).
- Conseils de couleurs et de disposition.
- Respect des règles de circulation (passages de 80 cm, etc.).

## Étape 10 — Publicité et affiliation
- Bandeaux publicitaires discrets (par exemple Google AdSense), avec bannière de
  consentement cookies obligatoire en Europe.
- Liens d'affiliation : meubles similaires à acheter chez des marchands partenaires.
- Statistiques d'usage respectueuses de la vie privée.

## Points d'attention
- Licence : uniquement des modèles et textures CC0 ; noter la source de chacun.
- Performance : garder chaque modèle léger (moins de 1 Mo si possible) pour les téléphones.
- Pas de dépendance à un service payant tant que l'application ne rapporte rien.
