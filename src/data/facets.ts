// Caractéristiques des meubles pour la recherche et les filtres : teinte, matière, style.
import type { CatalogItem } from './catalog'
import { REFERENCES } from './references'

export type Tone = 'blanc' | 'beige' | 'bois-clair' | 'bois-fonce' | 'gris' | 'noir' | 'vert' | 'rose' | 'bleu' | 'terracotta'
export type Matiere = 'bois' | 'tissu' | 'cuir' | 'vegetal'
export type Style = 'contemporain' | 'scandinave' | 'classique' | 'vintage' | 'campagne'

export const TONES: { id: Tone; label: string; hex: string }[] = [
  { id: 'blanc', label: 'Blanc', hex: '#f3f1ec' },
  { id: 'beige', label: 'Beige', hex: '#d8cdb9' },
  { id: 'bois-clair', label: 'Bois clair', hex: '#c49a6c' },
  { id: 'bois-fonce', label: 'Bois foncé', hex: '#6b4a33' },
  { id: 'gris', label: 'Gris', hex: '#a9a6a1' },
  { id: 'noir', label: 'Noir', hex: '#2f2a28' },
  { id: 'vert', label: 'Vert', hex: '#8d9a7c' },
  { id: 'rose', label: 'Rose', hex: '#ddb8b0' },
  { id: 'bleu', label: 'Bleu', hex: '#3e4a5c' },
  { id: 'terracotta', label: 'Terracotta', hex: '#b9765a' },
]
export const MATIERES: { id: Matiere; label: string }[] = [
  { id: 'bois', label: 'Bois' },
  { id: 'tissu', label: 'Tissu' },
  { id: 'cuir', label: 'Cuir' },
  { id: 'vegetal', label: 'Plante' },
]
export const STYLES: { id: Style; label: string }[] = [
  { id: 'contemporain', label: 'Contemporain' },
  { id: 'scandinave', label: 'Scandinave' },
  { id: 'classique', label: 'Classique' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'campagne', label: 'Campagne' },
]

/** Teinte et style des modèles du catalogue (ceux dont la couleur ne vient pas d'une fiche). */
const CATALOG_FACETS: Record<string, { tone?: Tone; style: Style[] }> = {
  lit_double: { tone: 'beige', style: ['contemporain'] },
  lit_simple: { tone: 'beige', style: ['contemporain'] },
  sofa_lin: { tone: 'beige', style: ['contemporain', 'scandinave'] },
  sofa_02: { tone: 'noir', style: ['classique'] },
  mid_century_lounge_chair: { tone: 'bois-fonce', style: ['vintage'] },
  dining_chair_02: { tone: 'bois-fonce', style: ['vintage', 'classique'] },
  tabouret: { tone: 'beige', style: ['scandinave'] },
  painted_wooden_stool: { tone: 'blanc', style: ['campagne'] },
  coiffeuse: { tone: 'bois-clair', style: ['scandinave', 'vintage'] },
  bureau: { tone: 'bois-clair', style: ['scandinave'] },
  wooden_table_02: { tone: 'bois-fonce', style: ['campagne'] },
  modern_coffee_table_01: { tone: 'bois-clair', style: ['contemporain'] },
  chevet: { tone: 'bois-clair', style: ['scandinave'] },
  painted_wooden_nightstand: { tone: 'blanc', style: ['campagne'] },
  commode: { tone: 'bois-clair', style: ['scandinave'] },
  armoire: { tone: 'bois-clair', style: ['scandinave'] },
  modern_wooden_cabinet: { tone: 'bois-clair', style: ['contemporain'] },
  wooden_display_shelves_01: { tone: 'bois-fonce', style: ['vintage'] },
  rug_wool: { tone: 'gris', style: ['contemporain', 'scandinave'] },
  potted_plant_01: { tone: 'vert', style: [] },
  potted_plant_02: { tone: 'vert', style: [] },
  potted_plant_04: { tone: 'vert', style: [] },
}

/** Style des vraies références (d'après la gamme). */
const REF_STYLE: Record<string, Style[]> = {
  MALM: ['contemporain'],
  HEMNES: ['classique', 'campagne'],
  IDANÄS: ['classique'],
  STORKLINTA: ['contemporain'],
  KLEPPSTAD: ['contemporain'],
  BRIMNES: ['contemporain'],
  MICKE: ['contemporain'],
  LINNMON: ['scandinave', 'contemporain'],
  STOENSE: ['contemporain', 'scandinave'],
  POÄNG: ['scandinave', 'vintage'],
  FEJKA: [],
}

/** Teinte d'une couleur (hex) parmi les familles proposées. */
export function toneOfHex(hex: string, material?: Matiere): Tone {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 510
  const s = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255))
  let h = 0
  if (max !== min) {
    if (max === r) h = ((g - b) / (max - min) + 6) % 6
    else if (max === g) h = (b - r) / (max - min) + 2
    else h = (r - g) / (max - min) + 4
    h *= 60
  }
  if (l > 0.88) return 'blanc'
  if (l < 0.22) return 'noir'
  if (s < 0.12) return l > 0.75 ? 'blanc' : 'gris'
  if (h >= 75 && h < 170) return 'vert'
  if (h >= 190 && h < 280) return 'bleu'
  if (h >= 330 || h < 12) return l > 0.6 ? 'rose' : 'terracotta'
  // Tons orangés et bruns
  if (material === 'bois') return l > 0.45 ? 'bois-clair' : 'bois-fonce'
  if (h < 25 && s > 0.35) return l > 0.65 ? 'rose' : 'terracotta'
  return l > 0.7 ? 'beige' : l > 0.45 ? 'bois-clair' : 'bois-fonce'
}

export function materialOf(c: CatalogItem): Matiere | null {
  return c.custom ? null : c.material
}

export function toneOf(c: CatalogItem): Tone | null {
  if (c.color) return toneOfHex(c.color, c.material)
  const f = CATALOG_FACETS[c.base ?? c.id]
  return f?.tone ?? null
}

export function stylesOf(c: CatalogItem): Style[] | null {
  if (c.custom) return null
  if (c.reference) {
    const r = REFERENCES.find((x) => 'ref:' + x.id === c.id)
    const range = r?.name.split(' ')[0] ?? ''
    return REF_STYLE[range] ?? []
  }
  return CATALOG_FACETS[c.id]?.style ?? []
}

/** Texte sans accents ni majuscules, pour la recherche. */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
