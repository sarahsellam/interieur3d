// Catalogue des meubles disponibles.
// Modèles 3D : Poly Haven (https://polyhaven.com), licence CC0.
// Meubles « maison » : construits par le code, avec des textures Poly Haven (CC0).
// Dimensions en mètres : largeur (x) × profondeur (z) × hauteur (y).
import type { ItemDims, MyFurniture } from '../model/types'
import { REFERENCES, REFERENCES_CHECKED_AT } from './references'

export type FurnitureCategory = 'lit' | 'assise' | 'table' | 'rangement' | 'deco'

export interface CatalogItem {
  id: string
  name: string
  category: FurnitureCategory
  file: string
  width: number
  depth: number
  height: number
  /** Meuble construit par le code (dimensions réellement modifiables) */
  procedural?: boolean
  /** Rotation à appliquer pour que la face avant regarde vers +Z (radians). */
  frontOffset: number
  /** Posé à plat au sol (tapis) : peut passer sous tous les meubles */
  floorLayer?: boolean
  /** Se range sous une table ou une coiffeuse (chaise, tabouret) */
  tucksUnder?: boolean
  /** Accueille une chaise ou un tabouret dessous (table, bureau, coiffeuse) */
  hostsUnder?: boolean
  /** Type de matière principale, pour proposer les bonnes couleurs */
  material: 'tissu' | 'bois' | 'cuir' | 'vegetal'
  author: string
  source: string
  /** Meuble ajouté par l'utilisateur (« Mes meubles ») : représentation 3D simplifiée */
  custom?: boolean
  price?: number | null
  vendor?: string
  link?: string
  imageId?: string
  imageUrl?: string
  /** Couleur de la représentation simplifiée (ou couleur par défaut d'une référence) */
  color?: string
  /** Sous-type précis (coiffeuse, commode, plante…), pour proposer d'abord des meubles équivalents */
  kind?: string
  /** Vraie référence du commerce : modèle 3D du catalogue utilisé (« base ») et date du relevé de prix */
  reference?: boolean
  base?: string
  checkedAt?: string
  note?: string
  /** Taille réelle du modèle 3D, quand la fiche a d'autres dimensions (référence) */
  modelDims?: ItemDims
}

const ph = (id: string) => `https://polyhaven.com/a/${id}`
const HOME = 'Modèle maison'

export const CATALOG: CatalogItem[] = [
  // Lits
  { id: 'lit_double', kind: 'lit', name: 'Lit double', category: 'lit', file: '', procedural: true, width: 1.68, depth: 2.12, height: 1.05, frontOffset: 0, material: 'tissu', author: HOME, source: ph('rough_linen') },
  { id: 'lit_simple', kind: 'lit', name: 'Lit simple', category: 'lit', file: '', procedural: true, width: 0.98, depth: 2.02, height: 0.95, frontOffset: 0, material: 'tissu', author: HOME, source: ph('rough_linen') },
  // Assises
  { id: 'sofa_lin', kind: 'canape', name: 'Canapé en lin', category: 'assise', file: '', procedural: true, width: 2.2, depth: 0.95, height: 0.8, frontOffset: 0, material: 'tissu', author: HOME, source: ph('rough_linen') },
  { id: 'sofa_02', kind: 'canape', name: 'Canapé capitonné', category: 'assise', file: 'models/sofa_02/model.json', width: 1.81, depth: 0.82, height: 0.71, frontOffset: 0, material: 'cuir', author: 'Kirill Sannikov', source: ph('sofa_02') },
  { id: 'mid_century_lounge_chair', kind: 'fauteuil', name: 'Fauteuil lounge', category: 'assise', file: 'models/mid_century_lounge_chair/model.json', width: 1.01, depth: 1.19, height: 1.17, frontOffset: 0, material: 'cuir', author: 'Kuutti Siitonen', source: ph('mid_century_lounge_chair') },
  { id: 'dining_chair_02', kind: 'chaise', name: 'Chaise', category: 'assise', file: 'models/dining_chair_02/model.json', width: 0.43, depth: 0.58, height: 0.97, frontOffset: 0, tucksUnder: true, material: 'cuir', author: 'James Ray Cock', source: ph('dining_chair_02') },
  { id: 'painted_wooden_stool', kind: 'tabouret', name: 'Tabouret en bois peint', category: 'assise', file: 'models/painted_wooden_stool/model.json', width: 0.38, depth: 0.41, height: 0.58, frontOffset: 0, tucksUnder: true, material: 'bois', author: 'Kirill Sannikov', source: ph('painted_wooden_stool') },
  { id: 'tabouret', kind: 'tabouret', name: 'Tabouret', category: 'assise', file: '', procedural: true, width: 0.42, depth: 0.36, height: 0.46, frontOffset: 0, tucksUnder: true, material: 'tissu', author: HOME, source: ph('rough_linen') },
  // Tables
  { id: 'coiffeuse', kind: 'coiffeuse', name: 'Coiffeuse', category: 'table', file: '', procedural: true, width: 1.0, depth: 0.45, height: 1.55, frontOffset: 0, hostsUnder: true, material: 'bois', author: HOME, source: ph('oak_veneer_01') },
  { id: 'bureau', kind: 'bureau', name: 'Bureau', category: 'table', file: '', procedural: true, width: 1.2, depth: 0.6, height: 0.75, frontOffset: 0, hostsUnder: true, material: 'bois', author: HOME, source: ph('oak_veneer_01') },
  { id: 'wooden_table_02', kind: 'table', name: 'Table à manger', category: 'table', file: 'models/wooden_table_02/model.json', width: 1.13, depth: 0.71, height: 0.8, frontOffset: 0, hostsUnder: true, material: 'bois', author: 'Serhii Khromov', source: ph('wooden_table_02') },
  { id: 'modern_coffee_table_01', kind: 'table-basse', name: 'Table basse', category: 'table', file: 'models/modern_coffee_table_01/model.json', width: 1.2, depth: 0.6, height: 0.39, frontOffset: Math.PI / 2, material: 'bois', author: 'Amin', source: ph('modern_coffee_table_01') },
  // Rangements
  { id: 'chevet', kind: 'chevet', name: 'Table de chevet', category: 'rangement', file: '', procedural: true, width: 0.45, depth: 0.38, height: 0.52, frontOffset: 0, material: 'bois', author: HOME, source: ph('oak_veneer_01') },
  { id: 'painted_wooden_nightstand', kind: 'chevet', name: 'Chevet en bois peint', category: 'rangement', file: 'models/painted_wooden_nightstand/model.json', width: 0.5, depth: 0.51, height: 0.62, frontOffset: 0, material: 'bois', author: 'Kirill Sannikov', source: ph('painted_wooden_nightstand') },
  { id: 'commode', kind: 'commode', name: 'Commode', category: 'rangement', file: '', procedural: true, width: 1.2, depth: 0.5, height: 0.85, frontOffset: 0, material: 'bois', author: HOME, source: ph('oak_veneer_01') },
  { id: 'armoire', kind: 'armoire', name: 'Armoire', category: 'rangement', file: '', procedural: true, width: 1.2, depth: 0.6, height: 2.0, frontOffset: 0, material: 'bois', author: HOME, source: ph('oak_veneer_01') },
  { id: 'modern_wooden_cabinet', kind: 'buffet', name: 'Buffet bas', category: 'rangement', file: 'models/modern_wooden_cabinet/model.json', width: 2.44, depth: 0.52, height: 0.68, frontOffset: 0, material: 'bois', author: 'Patrik Pangerl', source: ph('modern_wooden_cabinet') },
  { id: 'wooden_display_shelves_01', kind: 'etagere', name: 'Étagère', category: 'rangement', file: 'models/wooden_display_shelves_01/model.json', width: 1.08, depth: 0.37, height: 1.56, frontOffset: -Math.PI / 2, material: 'bois', author: 'James Ray Cock', source: ph('wooden_display_shelves_01') },
  // Déco
  { id: 'rug_wool', kind: 'tapis', name: 'Tapis en laine', category: 'deco', file: '', procedural: true, width: 2.3, depth: 1.6, height: 0.012, frontOffset: 0, floorLayer: true, material: 'tissu', author: HOME, source: ph('poly_wool_herringbone') },
  { id: 'potted_plant_01', kind: 'plante', name: 'Grande plante en pot', category: 'deco', file: 'models/potted_plant_01/model.json', width: 0.59, depth: 0.64, height: 1.35, frontOffset: 0, material: 'vegetal', author: 'Rico Cilliers', source: ph('potted_plant_01') },
  { id: 'potted_plant_04', kind: 'plante', name: 'Petite plante grasse', category: 'deco', file: 'models/potted_plant_04/model.json', width: 0.17, depth: 0.19, height: 0.27, frontOffset: 0, material: 'vegetal', author: 'James Ray Cock', source: ph('potted_plant_04') },
  { id: 'potted_plant_02', kind: 'plante', name: 'Plante en pot', category: 'deco', file: 'models/potted_plant_02/model.json', width: 0.7, depth: 0.66, height: 0.84, frontOffset: 0, material: 'vegetal', author: 'Rico Cilliers', source: ph('potted_plant_02') },
]

/** Suspension affichée au plafond en mode « à hauteur des yeux » (Poly Haven, CC0). */
export const CEILING_LAMP = { file: 'models/modern_ceiling_lamp_01/model.json', author: 'James Ray Cock', source: ph('modern_ceiling_lamp_01') }

export const CATALOG_BY_ID: Record<string, CatalogItem> = Object.fromEntries(CATALOG.map((c) => [c.id, c]))

// ---------- Vraies références du commerce ----------

export const REFERENCE_PREFIX = 'ref:'

/** Références présentées comme des meubles du catalogue, dessinées avec le modèle 3D le plus proche. */
export const REFERENCE_ITEMS: CatalogItem[] = REFERENCES.map((r) => {
  const b = CATALOG_BY_ID[r.base]
  return {
    ...b,
    id: REFERENCE_PREFIX + r.id,
    name: r.name,
    kind: r.kind,
    width: r.width,
    depth: r.depth,
    height: r.height,
    price: r.price,
    vendor: r.vendor,
    link: r.link,
    color: r.color,
    note: r.note,
    imageUrl: r.image,
    reference: true,
    base: b.id,
    checkedAt: REFERENCES_CHECKED_AT,
    modelDims: { width: b.width, depth: b.depth, height: b.height },
  }
})
for (const r of REFERENCE_ITEMS) CATALOG_BY_ID[r.id] = r

// ---------- « Mes meubles » ----------

export const CUSTOM_PREFIX = 'perso:'
const customRegistry: Record<string, CatalogItem> = {}

/** Fiche « catalogue » d'un meuble personnel, pour l'afficher comme les autres. */
export function customToCatalog(f: MyFurniture): CatalogItem {
  return {
    id: CUSTOM_PREFIX + f.id,
    name: f.name || 'Meuble',
    category: f.category,
    file: '',
    procedural: true,
    custom: true,
    width: f.width,
    depth: f.depth,
    height: f.height,
    frontOffset: 0,
    tucksUnder: f.category === 'assise' && f.height < 1.1 && f.width < 0.7,
    hostsUnder: f.category === 'table',
    material: f.category === 'lit' || f.category === 'assise' ? 'tissu' : 'bois',
    author: f.vendor || 'Ajouté par vous',
    source: f.link ?? '',
    price: f.price,
    vendor: f.vendor,
    link: f.link,
    imageId: f.imageId,
    imageUrl: f.imageUrl,
    color: f.color,
  }
}

export function registerCustomFurniture(list: MyFurniture[]) {
  for (const k of Object.keys(customRegistry)) delete customRegistry[k]
  for (const f of list) customRegistry[CUSTOM_PREFIX + f.id] = customToCatalog(f)
}

/** Meubles personnels d'un projet partagé par quelqu'un d'autre (ajoutés sans effacer les siens). */
export function registerSharedFurniture(list: MyFurniture[]) {
  for (const f of list) customRegistry[CUSTOM_PREFIX + f.id] = customToCatalog(f)
}

/** Fiche d'un meuble, qu'il vienne du catalogue ou de « Mes meubles ». */
export function getItem(modelId: string): CatalogItem | undefined {
  return CATALOG_BY_ID[modelId] ?? customRegistry[modelId]
}

/** Prix retenu pour un meuble placé (prix saisi, sinon prix de la fiche). */
export function itemPrice(it: { modelId: string; price?: number | null }): number | null {
  if (typeof it.price === 'number') return it.price
  const p = getItem(it.modelId)?.price
  return typeof p === 'number' ? p : null
}

export const fmtPrice = (v: number) => `${v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`

export const CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  lit: 'Lits',
  assise: 'Assises',
  table: 'Tables et coiffeuses',
  rangement: 'Rangements',
  deco: 'Déco',
}

/** Couleurs proposées pour les meubles, selon leur matière. */
export const ITEM_COLORS: Record<CatalogItem['material'], { name: string; hex: string }[]> = {
  tissu: [
    { name: 'Lin naturel', hex: '#d8cdb9' },
    { name: 'Blanc cassé', hex: '#efebe4' },
    { name: 'Gris perle', hex: '#b9b6b0' },
    { name: 'Anthracite', hex: '#55524e' },
    { name: 'Sauge', hex: '#a3ad94' },
    { name: 'Bleu nuit', hex: '#3e4a5c' },
    { name: 'Terracotta', hex: '#b9765a' },
    { name: 'Rose poudré', hex: '#ddb8b0' },
    { name: 'Bordeaux', hex: '#742f45' },
  ],
  bois: [
    { name: 'Chêne clair', hex: '#d9b98f' },
    { name: 'Chêne naturel', hex: '#b88d5e' },
    { name: 'Noyer', hex: '#7a5338' },
    { name: 'Blanc', hex: '#f1eee8' },
    { name: 'Sauge', hex: '#a9b29c' },
    { name: 'Gris', hex: '#9a958e' },
    { name: 'Noir', hex: '#3a3633' },
    { name: 'Rose poudré', hex: '#dfbdb5' },
  ],
  cuir: [
    { name: 'Cognac', hex: '#b07850' },
    { name: 'Chocolat', hex: '#6d4a37' },
    { name: 'Noir', hex: '#4a4542' },
    { name: 'Camel', hex: '#c9a77f' },
    { name: 'Vert bouteille', hex: '#4f6150' },
  ],
  vegetal: [],
}

export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`
