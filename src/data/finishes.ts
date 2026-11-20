// Couleurs de murs et revêtements de sol proposés.
// Toutes les textures viennent de Poly Haven (https://polyhaven.com), licence CC0.

/** Teintes de peinture sobres, proches de nuanciers réels (mat velouté). */
export const WALL_COLORS = [
  { name: 'Blanc cassé', hex: '#ece8e1' },
  { name: 'Lin', hex: '#e2d8c8' },
  { name: 'Greige', hex: '#cdc5b8' },
  { name: 'Argile', hex: '#c9b39d' },
  { name: 'Rose poudré', hex: '#e3c4bd' },
  { name: 'Rose argile', hex: '#d4a597' },
  { name: 'Vieux rose', hex: '#b98a86' },
  { name: 'Terracotta', hex: '#b9765a' },
  { name: 'Sauge', hex: '#b9c0ad' },
  { name: 'Vert de gris', hex: '#7f8b7f' },
  { name: 'Bleu brume', hex: '#bcc6cc' },
  { name: 'Taupe', hex: '#8c8178' },
]

export interface FloorFinish {
  id: string
  name: string
  /** Taille réelle (en mètres) couverte par une répétition de la texture. */
  tileSize: number
  /** Brillance : plus la valeur est basse, plus le sol a de reflets. */
  roughness: number
  normalScale: number
}

export const FLOORS: FloorFinish[] = [
  { id: 'laminate_floor_02', name: 'Parquet chêne clair', tileSize: 2, roughness: 0.85, normalScale: 0.6 },
  { id: 'herringbone_parquet', name: 'Point de Hongrie', tileSize: 1.6, roughness: 0.8, normalScale: 0.7 },
  { id: 'dark_wooden_planks', name: 'Plancher brut', tileSize: 2, roughness: 1, normalScale: 0.8 },
  { id: 'smooth_concrete_floor', name: 'Béton ciré', tileSize: 3, roughness: 0.75, normalScale: 0.4 },
  { id: 'large_floor_tiles_02', name: 'Grands carreaux', tileSize: 2, roughness: 0.6, normalScale: 0.6 },
  { id: 'marble_tiles', name: 'Carreaux marbre', tileSize: 1.5, roughness: 0.45, normalScale: 0.5 },
]

export const floorTexture = (id: string, kind: 'diff' | 'nor' | 'rough' | 'ao') =>
  `${import.meta.env.BASE_URL}textures/${id}_${kind}.webp`

export const texture = (name: string) => `${import.meta.env.BASE_URL}textures/${name}.webp`
