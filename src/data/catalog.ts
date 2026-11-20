// Catalogue des meubles disponibles.
// Tous les modèles viennent de Poly Haven (https://polyhaven.com) sous licence CC0.
// Dimensions en mètres : largeur (x) × profondeur (z) × hauteur (y).

export type FurnitureCategory = 'assise' | 'table' | 'rangement' | 'deco'

export interface CatalogItem {
  id: string
  name: string
  category: FurnitureCategory
  file: string
  width: number
  depth: number
  height: number
  /** Rotation à appliquer pour que la face avant regarde vers +Z (radians). */
  frontOffset: number
  author: string
  source: string
}

const ph = (id: string) => `https://polyhaven.com/a/${id}`

export const CATALOG: CatalogItem[] = [
  { id: 'sofa_02', name: 'Canapé 3 places', category: 'assise', file: 'models/sofa_02/model.json', width: 1.81, depth: 0.82, height: 0.71, frontOffset: 0, author: 'Kirill Sannikov', source: ph('sofa_02') },
  { id: 'mid_century_lounge_chair', name: 'Fauteuil lounge', category: 'assise', file: 'models/mid_century_lounge_chair/model.json', width: 1.01, depth: 1.19, height: 1.17, frontOffset: 0, author: 'Kuutti Siitonen', source: ph('mid_century_lounge_chair') },
  { id: 'dining_chair_02', name: 'Chaise', category: 'assise', file: 'models/dining_chair_02/model.json', width: 0.43, depth: 0.58, height: 0.97, frontOffset: 0, author: 'James Ray Cock', source: ph('dining_chair_02') },
  { id: 'modern_coffee_table_01', name: 'Table basse', category: 'table', file: 'models/modern_coffee_table_01/model.json', width: 1.2, depth: 0.6, height: 0.39, frontOffset: Math.PI / 2, author: 'Amin', source: ph('modern_coffee_table_01') },
  { id: 'wooden_table_02', name: 'Table à manger', category: 'table', file: 'models/wooden_table_02/model.json', width: 1.13, depth: 0.71, height: 0.8, frontOffset: 0, author: 'Serhii Khromov', source: ph('wooden_table_02') },
  { id: 'modern_wooden_cabinet', name: 'Buffet bas', category: 'rangement', file: 'models/modern_wooden_cabinet/model.json', width: 2.44, depth: 0.52, height: 0.68, frontOffset: 0, author: 'Patrik Pangerl', source: ph('modern_wooden_cabinet') },
  { id: 'wooden_display_shelves_01', name: 'Étagère', category: 'rangement', file: 'models/wooden_display_shelves_01/model.json', width: 1.08, depth: 0.37, height: 1.56, frontOffset: -Math.PI / 2, author: 'James Ray Cock', source: ph('wooden_display_shelves_01') },
  { id: 'potted_plant_02', name: 'Plante en pot', category: 'deco', file: 'models/potted_plant_02/model.json', width: 0.7, depth: 0.66, height: 0.84, frontOffset: 0, author: 'Rico Cilliers', source: ph('potted_plant_02') },
]

export const CATALOG_BY_ID: Record<string, CatalogItem> = Object.fromEntries(CATALOG.map((c) => [c.id, c]))

export const CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  assise: 'Assises',
  table: 'Tables',
  rangement: 'Rangements',
  deco: 'Déco',
}

export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`
