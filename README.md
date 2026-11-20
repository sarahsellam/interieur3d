# Mon Intérieur 3D

Application web gratuite pour aménager une pièce en 3D, depuis un navigateur
(ordinateur, iPad, téléphone). Nom provisoire.

## Ce que fait l'application

- **Accueil** : « Créer mon espace », projets récents, inspirations.
- **Création en trois étapes** : Mon espace (nom, type de pièce, pièce vide / meublée /
  exemple, dimensions, plan et photos de la pièce) → Mes inspirations → Mon aménagement.
- **Trois vues** : Plan (style plan d'architecte, avec cotes, sens d'ouverture des portes),
  Vue 3D (maquette dont on fait le tour) et À hauteur des yeux (on marche dans la pièce).
- **Meubles** : catalogue avec bouton +, dont un lit, une coiffeuse, une table de chevet, une commode
  et une armoire. Un toucher sélectionne le meuble ; le panneau du bas permet de le déplacer,
  le tourner, changer sa couleur et ses dimensions, le dupliquer, le verrouiller ou le supprimer.
- **Pièce** : dimensions saisies directement, couleur choisie mur par mur, fenêtres,
  portes-fenêtres, portes, placards intégrés et niches à placer et redimensionner le long des murs.
- **Aide au placement** : alignement facultatif sur la grille ou sur les murs, alertes de
  chevauchement (le tapis sous un meuble et les chaises rangées sous une table restent permis).
- **Annuler / Rétablir**, enregistrement automatique et bouton « Enregistrer ».
- **Versions** : dupliquer un aménagement pour comparer deux idées (avec vignettes).
- **Références** : plan importé (image ou PDF) et photos de la pièce ; inspirations (photo de
  la galerie ou lien Pinterest + note). Une image peut rester visible à côté de la pièce.
- **Mes meubles** : « Ajouter depuis un lien » (le nom, le vendeur et parfois les dimensions
  sont déduits de l'adresse ; la lecture complète de la page viendra avec le relais de l'étape IA),
  formulaire à vérifier (photo de la galerie, prix, dimensions, vendeur, lien). Sans modèle 3D
  exact, le meuble apparaît sous une forme simplifiée à ses vraies dimensions (signalée « 3D simplifiée »).
- **Remplacer** un meuble : propositions du même type qui tiennent dans l'espace, filtre de budget
  (raccourcis ou fourchette), fiche prix / dimensions / vendeur / lien, aperçu dans la pièce avant
  de confirmer, alerte si la place manque.
- **Budget** : chaque meuble est « Déjà possédé » ou « À acheter » ; le total des achats prévus
  s'affiche en haut et se met à jour à chaque remplacement.
- **Inspirations utiles sans IA** : couleurs principales de la photo à appliquer à un mur ou à un
  meuble, idées tirées de la note (« commode en bois clair », « mur vert »…).
- Les projets restent **privés**, enregistrés dans l'appareil (aucun compte pour l'instant).
- **Application installable** (iPad, iPhone, Android, ordinateur) : icône, écran de démarrage,
  ouverture en plein écran, fonctionnement **hors connexion** (sauf l'assistant IA), mise à jour
  proposée quand une nouvelle version est publiée.
- **Sauvegarde dans un fichier** (et restauration) : copie de secours et passage des projets de
  Safari vers l'application installée, qui ne partagent pas leurs données sur iPad/iPhone.

## Technologies

| Outil | Rôle |
|---|---|
| TypeScript | JavaScript avec vérification des erreurs avant l'exécution |
| React | Construction de l'interface (boutons, panneaux) |
| Three.js + React Three Fiber + Drei | Affichage 3D dans le navigateur (WebGL) |
| postprocessing (N8AO) | Ombres de contact et rendu plus réaliste |
| Zustand | Mémoire de l'application (projets, versions, sélection, historique) |
| idb-keyval | Enregistrement des images (plans, photos) dans l'appareil |
| vite-plugin-pwa (Workbox) | Application installable et fonctionnement hors connexion |
| pdf.js | Conversion de la première page d'un plan PDF en image |
| Inter, Instrument Serif | Polices de l'interface (licence SIL OFL, intégrées) |
| Vite | Lance l'application en local et prépare la version à mettre en ligne |
| glTF-Transform | Optimise les modèles 3D pour les téléphones |

## Lancer l'application sur un ordinateur

Il faut [Node.js](https://nodejs.org) version 20 ou plus.

```bash
npm install
```

```bash
npm run dev
```

Ouvrir ensuite l'adresse affichée (par exemple `http://localhost:5173`).
Pour tester sur un iPad du même réseau Wi-Fi, utiliser l'adresse « Network » affichée.

Pour fabriquer la version à mettre en ligne (dossier `dist/`) :

```bash
npm run build
```

## Organisation des fichiers

```
public/
  models/     modèles 3D des meubles (glTF optimisé : model.json + textures)
  textures/   textures de sol (.webp)
  thumbs/     vignettes du catalogue
  hdr/        image d'éclairage d'ambiance (panorama 360°)
  icons/      icônes de l'application (écran d'accueil)
src/
  data/       catalogue des meubles, couleurs et sols
  model/      données d'un projet, calculs (chevauchements, alignements), enregistrement
  three/      tout ce qui est 3D (pièce, ouvertures, meubles, caméras, lumières, déplacement)
  ui/         accueil, assistant, éditeur, inspirations
  store.ts    état de l'application, versions, annuler / rétablir
```

## Ajouter un meuble

1. Choisir un modèle sur [Poly Haven](https://polyhaven.com/models) (licence CC0 uniquement).
2. Télécharger la version glTF 1k et la convertir :
   `npx gltf-transform optimize modele.gltf public/models/modele.glb --texture-compress webp --texture-size 1024 --compress quantize`, puis `npx gltf-transform copy` vers un dossier `public/models/<id>/` (fichier `model.json` + textures `.webp` : l'hébergeur de test n'accepte pas le format `.glb`)
3. Ajouter une ligne dans `src/data/catalog.ts` (nom, catégorie, dimensions).
4. Générer sa vignette : ouvrir `http://localhost:5173/?thumb=<id>` et faire une capture.

## Licences des contenus

Tous les modèles 3D, textures et l'image d'éclairage viennent de
[Poly Haven](https://polyhaven.com) et sont sous licence **CC0** (domaine public,
utilisation commerciale autorisée, sans obligation de citer l'auteur).

| Meuble | Auteur | Source |
|---|---|---|
| Canapé 3 places | Kirill Sannikov | polyhaven.com/a/sofa_02 |
| Fauteuil lounge | Kuutti Siitonen | polyhaven.com/a/mid_century_lounge_chair |
| Chaise | James Ray Cock | polyhaven.com/a/dining_chair_02 |
| Table basse | Amin | polyhaven.com/a/modern_coffee_table_01 |
| Table à manger | Serhii Khromov | polyhaven.com/a/wooden_table_02 |
| Buffet bas | Patrik Pangerl | polyhaven.com/a/modern_wooden_cabinet |
| Étagère | James Ray Cock | polyhaven.com/a/wooden_display_shelves_01 |
| Plante en pot | Rico Cilliers | polyhaven.com/a/potted_plant_02 |
| Suspension | James Ray Cock | polyhaven.com/a/modern_ceiling_lamp_01 |
| Canapé en lin | modèle maison, texture « rough_linen » | polyhaven.com/a/rough_linen |
| Tapis en laine | modèle maison, texture « poly_wool_herringbone » | polyhaven.com/a/poly_wool_herringbone |

Textures (Poly Haven, CC0) : sols laminate_floor_02, herringbone_parquet,
dark_wooden_planks, smooth_concrete_floor, large_floor_tiles_02, marble_tiles ;
murs et plafond painted_plaster_wall. Panoramas : « lebombo » (lumière d'ambiance)
et « residential_garden » (vue par les fenêtres).

Bois des meubles maison : « oak_veneer_01 » (Poly Haven, CC0). Le lit, la coiffeuse, le
tabouret, la table de chevet, la commode, l'armoire et le bureau sont des modèles maison.

Les fenêtres, portes, placards, niches, plinthes et corniches sont dessinés par le code
(fichier `src/three/architecture.tsx`).

## Assistant IA et relais (dossier `relais/`)

L'assistant « Demander une idée » et la lecture complète des pages produits passent par un
petit relais hébergé gratuitement chez Cloudflare (Workers). Il garde la clé de l'API Claude
secrète : elle n'est jamais dans l'application ni dans ce dépôt.

- `relais/src/index.ts` : `POST /idee` (deux propositions d'aménagement, modèle `claude-opus-5-5`,
  réponse au format vérifié) et `POST /produit` (lecture d'une fiche produit).
- Partage par lien (`relais/src/partages.ts`, un Durable Object SQLite par partage, offre gratuite) :
  `POST /partage` (crée le lien, renvoie un identifiant et une clé secrète), `GET /partage/:id`
  (pièce + votes ; avec `?cle=` les prénoms complets), `POST /partage/:id/avis`, `DELETE /partage/:id?cle=`.
  Le lien de l'application a la forme `…/interieur3d/#partage-<identifiant>`.
- Seules les adresses listées dans `ALLOWED_ORIGINS` (`relais/wrangler.toml`) peuvent l'appeler.
- La clé se saisit comme secret `ANTHROPIC_API_KEY` dans le tableau de bord Cloudflare.
- Déploiement : `cd relais && npm install && npx wrangler deploy`.
- L'adresse du relais est indiquée à l'application dans le fichier `.env` (`VITE_RELAIS_URL`, ici https://interieur3d.sellamsarah.workers.dev). Le Worker Cloudflare s'appelle `interieur3d` et se redéploie tout seul à chaque envoi sur GitHub (Workers Builds, dossier `relais`).
- Coût mesuré : environ 0,18 $ par idée demandée (5 300 jetons envoyés, 7 800 reçus, 1 à 2 minutes), 1 à 2 centimes par lien lu.
  Fixez un plafond de dépense mensuel dans la console Anthropic.
