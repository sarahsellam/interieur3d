// Couleurs de murs et revêtements de sol proposés.
// Textures de sol : Poly Haven, licence CC0.

export const WALL_COLORS = [
  { name: 'Blanc cassé', hex: '#f1ede6' },
  { name: 'Lin', hex: '#e4d9c6' },
  { name: 'Greige', hex: '#cbc2b4' },
  { name: 'Sauge', hex: '#b3bea5' },
  { name: 'Bleu brume', hex: '#b6c4cd' },
  { name: 'Terracotta', hex: '#c58b6c' },
  { name: 'Vert forêt', hex: '#4f6152' },
  { name: 'Anthracite', hex: '#4a4b4e' },
]

export interface FloorFinish {
  id: string
  name: string
  /** Taille réelle (en mètres) couverte par une répétition de la texture. */
  tileSize: number
  roughnessScale: number
}

export const FLOORS: FloorFinish[] = [
  { id: 'laminate_floor_02', name: 'Parquet clair', tileSize: 2, roughnessScale: 1 },
  { id: 'herringbone_parquet', name: 'Point de Hongrie', tileSize: 1.6, roughnessScale: 0.9 },
  { id: 'dark_wooden_planks', name: 'Chêne foncé', tileSize: 2, roughnessScale: 1 },
  { id: 'smooth_concrete_floor', name: 'Béton ciré', tileSize: 3, roughnessScale: 0.85 },
  { id: 'marble_tiles', name: 'Carreaux marbre', tileSize: 1.5, roughnessScale: 0.6 },
]

export const floorTexture = (id: string, kind: 'diff' | 'nor' | 'rough') =>
  `${import.meta.env.BASE_URL}textures/${id}_${kind}.webp`
