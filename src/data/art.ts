// Affiches pour les tableaux : créées pour l'application (libres de droits).
export interface Art {
  id: string
  name: string
  /** hauteur / largeur */
  ratio: number
}

export const ART: Art[] = [
  { id: 'arches', name: 'Arches', ratio: 4 / 3 },
  { id: 'soleil', name: 'Soleil couchant', ratio: 4 / 3 },
  { id: 'botanique', name: 'Botanique', ratio: 4 / 3 },
  { id: 'formes', name: 'Formes', ratio: 4 / 3 },
  { id: 'ligne', name: 'Ligne', ratio: 4 / 3 },
  { id: 'bauhaus', name: 'Bauhaus', ratio: 4 / 3 },
  { id: 'collines', name: 'Collines', ratio: 3 / 4 },
  { id: 'mer', name: 'Mer calme', ratio: 3 / 4 },
]

export const artUrl = (id: string, mini = false) => `${import.meta.env.BASE_URL}art/${id}${mini ? '-mini' : ''}.webp`

/** Tailles courantes de cadres (largeur du côté court, en m) */
export const ART_SIZES = [
  { label: 'Petit', short: 0.3 },
  { label: 'Moyen', short: 0.5 },
  { label: 'Grand', short: 0.7 },
]

export const FRAME_LABEL = { chene: 'Chêne', noir: 'Noir', blanc: 'Blanc', sans: 'Sans cadre' } as const

/** Couleurs de linge et de coussins : tons naturels et quelques couleurs franches. */
export const TEXTILE_COLORS = [
  { name: 'Blanc', hex: '#f6f3ee' },
  { name: 'Lin naturel', hex: '#ddd2c1' },
  { name: 'Sable', hex: '#cdb898' },
  { name: 'Gris perle', hex: '#c9c6c1' },
  { name: 'Rose poudré', hex: '#e2b9ae' },
  { name: 'Terracotta', hex: '#b96a4b' },
  { name: 'Moutarde', hex: '#c99a3e' },
  { name: 'Sauge', hex: '#a3ad94' },
  { name: 'Vert olive', hex: '#6f7350' },
  { name: 'Bleu nuit', hex: '#2f3d55' },
  { name: 'Bordeaux', hex: '#742f45' },
  { name: 'Charbon', hex: '#3b3634' },
]
