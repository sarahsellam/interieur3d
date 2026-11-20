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
- Les projets restent **privés**, enregistrés dans l'appareil (aucun compte pour l'instant).

## Technologies

| Outil | Rôle |
|---|---|
| TypeScript | JavaScript avec vérification des erreurs avant l'exécution |
| React | Construction de l'interface (boutons, panneaux) |
| Three.js + React Three Fiber + Drei | Affichage 3D dans le navigateur (WebGL) |
| postprocessing (N8AO) | Ombres de contact et rendu plus réaliste |
| Zustand | Mémoire de l'application (projets, versions, sélection, historique) |
| idb-keyval | Enregistrement des images (plans, photos) dans l'appareil |
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
