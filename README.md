# Mon Intérieur 3D

Application web gratuite pour aménager une pièce en 3D, depuis un navigateur
(ordinateur, iPad, téléphone). Nom provisoire.

## Ce que fait la version 1

- Une pièce dont on règle la largeur, la longueur et la hauteur sous plafond.
- 8 meubles réalistes (vrais modèles 3D) : canapé, fauteuil, chaise, table basse,
  table à manger, buffet bas, étagère, plante.
- Ajouter, déplacer (au doigt ou à la souris), pivoter, dupliquer, supprimer un meuble.
- Vue 3D (on tourne autour de la pièce) et vue du dessus (plan avec les cotes).
- Couleur des murs et 5 revêtements de sol.
- Éclairage réaliste : lumière d'ambiance HDRI, ombres douces, occlusion ambiante.
- Le projet est gardé automatiquement dans le navigateur.

## Technologies

| Outil | Rôle |
|---|---|
| TypeScript | JavaScript avec vérification des erreurs avant l'exécution |
| React | Construction de l'interface (boutons, panneaux) |
| Three.js + React Three Fiber + Drei | Affichage 3D dans le navigateur (WebGL) |
| postprocessing (N8AO) | Ombres de contact et rendu plus réaliste |
| Zustand | Mémoire de l'application (pièce, meubles, sélection) |
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
  three/      tout ce qui est 3D (pièce, meubles, caméras, lumières, déplacement)
  ui/         panneaux et boutons
  store.ts    état de l'application et sauvegarde
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

Sols : laminate_floor_02, herringbone_parquet, dark_wooden_planks,
smooth_concrete_floor, marble_tiles. Éclairage : HDRI « lebombo ».
