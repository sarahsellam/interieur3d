// Vraies références de meubles, proposées dans « Remplacer ».
// Chaque fiche a été relevée sur la page du vendeur (prix, dimensions, lien) à la date indiquée.
// Les prix changent : l'application affiche « prix relevé le … » et le lien vers la page du produit.
// La 3D utilise le modèle le plus proche du catalogue (« base »), mis aux vraies dimensions.
// Pour ajouter une référence : relever la page (le relais /produit lit prix et dimensions), puis ajouter une ligne.

export interface Reference {
  id: string
  name: string
  vendor: string
  link: string
  price: number
  /** Dimensions en mètres (largeur × profondeur × hauteur) ; pour une plante, encombrement estimé du feuillage */
  width: number
  depth: number
  height: number
  /** Modèle 3D du catalogue qui la représente */
  base: string
  /** Sous-type (coiffeuse, commode…) pour proposer d'abord des meubles équivalents */
  kind: string
  /** Couleur appliquée au modèle 3D */
  color?: string
  /** Photo du produit sur le site du vendeur */
  image?: string
  /** Précision affichée sous les dimensions */
  note?: string
}

export const REFERENCES_CHECKED_AT = '2026-11-23'

const BLANC = '#f3f1ec'
const BRUN_NOIR = '#4a3b33'

export const REFERENCES: Reference[] = [
  // Coiffeuses
  { id: 'ikea-malm-coiffeuse', name: 'MALM coiffeuse, blanc', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/malm-coiffeuse-blanc-10203610/', image: 'https://www.ikea.com/fr/fr/images/products/malm-coiffeuse-blanc__1400013_pe968487_s5.jpg', price: 149, width: 1.2, depth: 0.41, height: 0.78, base: 'coiffeuse', kind: 'coiffeuse', color: BLANC, note: 'sans miroir' },
  { id: 'ikea-hemnes-coiffeuse', name: 'HEMNES coiffeuse avec miroir, blanc', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/hemnes-coiffeuse-avec-miroir-blanc-30374413/', image: 'https://www.ikea.com/fr/fr/images/products/hemnes-coiffeuse-avec-miroir-blanc__0627085_pe693165_s5.jpg', price: 249, width: 1.0, depth: 0.5, height: 1.59, base: 'coiffeuse', kind: 'coiffeuse', color: BLANC },
  // Commodes
  { id: 'ikea-hemnes-commode-3', name: 'HEMNES commode 3 tiroirs, teinté blanc', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/hemnes-commode-3-tiroirs-teinte-blanc-80424745/', image: 'https://www.ikea.com/fr/fr/images/products/hemnes-commode-3-tiroirs-teinte-blanc__1602245_pe1043337_s5.jpg', price: 229, width: 1.08, depth: 0.5, height: 0.96, base: 'commode', kind: 'commode', color: BLANC },
  { id: 'ikea-storklinta-commode-4', name: 'STORKLINTA commode 4 tiroirs, blanc', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/storklinta-commode-4-tiroirs-blanc-40627537/', image: 'https://www.ikea.com/fr/fr/images/products/storklinta-commode-4-tiroirs-blanc__1520360_pe1012852_s5.jpg', price: 119, width: 0.7, depth: 0.5, height: 0.98, base: 'commode', kind: 'commode', color: BLANC },
  // Chevets
  { id: 'ikea-idanas-chevet', name: 'IDANÄS table de chevet, blanc', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/idanaes-table-chevet-blanc-90458810/', image: 'https://www.ikea.com/fr/fr/images/products/idanaes-table-chevet-blanc__0898843_pe782659_s5.jpg', price: 129, width: 0.47, depth: 0.4, height: 0.68, base: 'chevet', kind: 'chevet', color: BLANC },
  { id: 'ikea-hemnes-commode-2', name: 'HEMNES commode 2 tiroirs (chevet), teinté blanc', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/hemnes-commode-2-tiroirs-teinte-blanc-80242627/', image: 'https://www.ikea.com/fr/fr/images/products/hemnes-commode-2-tiroirs-teinte-blanc__0651108_pe706676_s5.jpg', price: 99.99, width: 0.54, depth: 0.38, height: 0.66, base: 'chevet', kind: 'chevet', color: BLANC },
  // Lits
  { id: 'ikea-malm-lit-haut', name: 'MALM cadre de lit haut, blanc, 160×200', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/malm-cadre-de-lit-haut-blanc-40249471/', image: 'https://www.ikea.com/fr/fr/images/products/malm-cadre-de-lit-haut-blanc__0749130_pe745499_s5.jpg', price: 229, width: 1.76, depth: 2.09, height: 1.0, base: 'lit_double', kind: 'lit', color: BLANC, note: 'sans matelas ni sommier' },
  { id: 'ikea-malm-lit-coffre', name: 'MALM cadre de lit coffre, brun noir, 160×200', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/malm-cadre-lit-coffre-brun-noir-70404804/', image: 'https://www.ikea.com/fr/fr/images/products/malm-cadre-lit-coffre-brun-noir__0749129_pe745498_s5.jpg', price: 599, width: 1.75, depth: 2.1, height: 1.0, base: 'lit_double', kind: 'lit', color: BRUN_NOIR, note: 'sans matelas' },
  // Armoires
  { id: 'ikea-kleppstad-armoire', name: 'KLEPPSTAD armoire 2 portes, blanc', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/kleppstad-armoire-2-portes-blanc-80437234/', image: 'https://www.ikea.com/fr/fr/images/products/kleppstad-armoire-2-portes-blanc__0733324_pe748781_s5.jpg', price: 99.99, width: 0.79, depth: 0.55, height: 1.76, base: 'armoire', kind: 'armoire', color: BLANC },
  { id: 'ikea-brimnes-armoire', name: 'BRIMNES armoire 2 portes, blanc', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/brimnes-armoire-2-portes-blanc-40400478/', image: 'https://www.ikea.com/fr/fr/images/products/brimnes-armoire-2-portes-blanc__0140624_pe300605_s5.jpg', price: 149, width: 0.78, depth: 0.5, height: 1.9, base: 'armoire', kind: 'armoire', color: BLANC },
  // Bureaux
  { id: 'ikea-micke-bureau', name: 'MICKE bureau, brun noir', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/micke-bureau-brun-noir-10244743/', image: 'https://www.ikea.com/fr/fr/images/products/micke-bureau-brun-noir__0735981_pe740299_s5.jpg', price: 89.99, width: 1.05, depth: 0.5, height: 0.75, base: 'bureau', kind: 'bureau', color: BRUN_NOIR },
  { id: 'ikea-linnmon-krille', name: 'LINNMON / KRILLE bureau, blanc', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/linnmon-krille-bureau-blanc-s09416212/', image: 'https://www.ikea.com/fr/fr/images/products/linnmon-krille-bureau-blanc__0974304_pe812347_s5.jpg', price: 99, width: 1.0, depth: 0.6, height: 0.73, base: 'bureau', kind: 'bureau', color: BLANC },
  { id: 'ikea-linnmon-adils', name: 'LINNMON / ADILS bureau, effet chêne blanchi', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/linnmon-adils-bureau-effet-chene-blanchi-noir-s99416340/', image: 'https://www.ikea.com/fr/fr/images/products/linnmon-adils-bureau-effet-chene-blanchi-noir__0977193_pe813435_s5.jpg', price: 47.96, width: 1.0, depth: 0.6, height: 0.74, base: 'bureau', kind: 'bureau', color: '#e0d2b8' },
  // Plantes (artificielles)
  { id: 'ikea-fejka-areca', name: 'FEJKA plante artificielle Aréca', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/fejka-plante-artificielle-interieur-exterieur-areca-00600894/', image: 'https://www.ikea.com/fr/fr/images/products/fejka-plante-artificielle-interieur-exterieur-areca__1389906_pe965290_s5.jpg', price: 39.99, width: 0.55, depth: 0.55, height: 1.2, base: 'potted_plant_01', kind: 'plante', note: 'pot Ø 19 cm, feuillage estimé' },
  { id: 'ikea-fejka-erable', name: 'FEJKA plante artificielle érable orange-brun', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/fejka-plante-artificielle-interieur-exterieur-erable-orange-brun-30631238/', image: 'https://www.ikea.com/fr/fr/images/products/fejka-plante-artificielle-interieur-exterieur-erable-orange-brun__1515411_pe1011411_s5.jpg', price: 49.99, width: 0.6, depth: 0.6, height: 1.5, base: 'potted_plant_01', kind: 'plante', note: 'pot Ø 19 cm, feuillage estimé' },
  { id: 'ikea-fejka-bambou', name: 'FEJKA plante artificielle bambou', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/fejka-plante-artificielle-interieur-exterieur-bambou-40610607/', image: 'https://www.ikea.com/fr/fr/images/products/fejka-plante-artificielle-interieur-exterieur-bambou__1423297_pe979093_s5.jpg', price: 49.99, width: 0.5, depth: 0.5, height: 1.8, base: 'potted_plant_01', kind: 'plante', note: 'pot Ø 21 cm, feuillage estimé' },
  { id: 'ikea-fejka-monstera', name: 'FEJKA plante artificielle monstera (petite)', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/fejka-plante-artificielle-interieur-exterieur-monstera-60615232/', image: 'https://www.ikea.com/fr/fr/images/products/fejka-plante-artificielle-interieur-exterieur-monstera__0959226_pe809439_s5.jpg', price: 6.99, width: 0.25, depth: 0.25, height: 0.32, base: 'potted_plant_04', kind: 'plante', note: 'pot Ø 12 cm, à poser' },
  // Tapis
  { id: 'ikea-stoense-blanc', name: 'STOENSE tapis poils ras, blanc cassé', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/stoense-tapis-poils-ras-blanc-casse-50425529/', image: 'https://www.ikea.com/fr/fr/images/products/stoense-tapis-poils-ras-blanc-casse__0624386_pe691799_s5.jpg', price: 89.99, width: 1.7, depth: 2.4, height: 0.018, base: 'rug_wool', kind: 'tapis', color: '#efe9de' },
  { id: 'ikea-stoense-beige', name: 'STOENSE tapis poils ras, beige', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/stoense-tapis-poils-ras-beige-10607668/', image: 'https://www.ikea.com/fr/fr/images/products/stoense-tapis-poils-ras-beige__1405711_pe970547_s5.jpg', price: 89.99, width: 1.7, depth: 2.4, height: 0.018, base: 'rug_wool', kind: 'tapis', color: '#d6c4a8' },
  { id: 'ikea-stoense-vert', name: 'STOENSE tapis poils ras, vert pâle', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/stoense-tapis-poils-ras-vert-pale-20629151/', image: 'https://www.ikea.com/fr/fr/images/products/stoense-tapis-poils-ras-vert-pale__1492281_pe1004363_s5.jpg', price: 89.99, width: 1.7, depth: 2.4, height: 0.018, base: 'rug_wool', kind: 'tapis', color: '#c3cfb5' },
  // Fauteuil
  { id: 'ikea-poang', name: 'POÄNG fauteuil, bouleau / Gunnared beige', vendor: 'IKEA', link: 'https://www.ikea.com/fr/fr/p/poaeng-fauteuil-plaque-bouleau-gunnared-beige-s59514385/', image: 'https://www.ikea.com/fr/fr/images/products/poaeng-fauteuil-plaque-bouleau-gunnared-beige__1192140_pe900880_s5.jpg', price: 169, width: 0.68, depth: 0.82, height: 1.0, base: 'mid_century_lounge_chair', kind: 'fauteuil' },
]
