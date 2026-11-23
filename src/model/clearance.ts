// Passages et zones d'ouverture : est-ce pratique au quotidien ?
// - Écart libre entre deux meubles voisins qui se font face (« 52 cm entre le lit et l'armoire »).
// - Zone nécessaire pour ouvrir les tiroirs, les portes d'une armoire ou tirer une chaise,
//   signalée si elle est gênée par un autre meuble ou par un mur.
// Repères de confort : moins de 60 cm, c'est étroit ; 60 à 90 cm, c'est juste ; 90 cm et plus, c'est confortable.
import { getItem, type CatalogItem } from '../data/catalog'
import { halfExtents, itemDims } from './geometry'
import type { Layout, PlacedItem } from './types'

export type Comfort = 'etroit' | 'juste' | 'ok'
export const comfortOf = (m: number): Comfort => (m < 0.6 ? 'etroit' : m < 0.9 ? 'juste' : 'ok')
export const COMFORT_LABEL: Record<Comfort, string> = { etroit: 'étroit', juste: 'juste', ok: 'confortable' }

export interface Gap {
  key: string
  a: PlacedItem
  b: PlacedItem
  /** Segment mesuré, au sol (x, z) */
  from: [number, number]
  to: [number, number]
  length: number
  comfort: Comfort
}

export interface OpeningZone {
  item: PlacedItem
  /** Coins du rectangle au sol, dans l'ordre */
  corners: [number, number][]
  depth: number
  label: string
  /** Gênée par un meuble ou un mur */
  blockedBy: string | null
}

const name = (it: PlacedItem) => getItem(it.modelId)?.name.split(',')[0] ?? 'meuble'
/** « le lit », « la commode »… pour des phrases naturelles */
export function withArticle(it: PlacedItem) {
  const c = getItem(it.modelId)
  const n = name(it)
  const lower = n.charAt(0).toLowerCase() + n.slice(1)
  if (c?.custom || c?.reference) return `« ${n} »`
  const fem = /^(commode|armoire|table|chaise|coiffeuse|plante|étagère|petite|grande)/i.test(n)
  return /^[aeiouyhéè]/i.test(n) ? `l'${lower}` : `${fem ? 'la' : 'le'} ${lower}`
}

/** Profondeur à laisser libre devant un meuble pour s'en servir. */
function zoneFor(c: CatalogItem, w: number, d: number): { depth: number; label: string } | null {
  const kind = c.kind ?? (c.custom && c.category === 'rangement' ? 'commode' : '')
  switch (kind) {
    case 'commode':
    case 'buffet':
      return { depth: Math.min(0.55, d * 0.9 + 0.1), label: 'ouverture des tiroirs' }
    case 'chevet':
      return { depth: Math.min(0.4, d * 0.9), label: 'ouverture du tiroir' }
    case 'armoire':
      return { depth: Math.min(0.6, w / 2 + 0.02), label: 'ouverture des portes' }
    case 'bureau':
    case 'coiffeuse':
      return { depth: 0.7, label: 'place pour s’asseoir' }
    default:
      return null
  }
}

/** Boîte au sol d'un meuble (alignée sur les axes). */
function box(it: PlacedItem) {
  const h = halfExtents(it)
  return { minX: it.x - h.hx, maxX: it.x + h.hx, minZ: it.z - h.hz, maxZ: it.z + h.hz }
}

const counted = (it: PlacedItem) => {
  const c = getItem(it.modelId)
  return !!c && !c.floorLayer
}

/** Écarts entre meubles voisins : pour chaque meuble et chaque côté, le plus proche en face. */
export function findGaps(layout: Layout, max = 1.4): Gap[] {
  const items = layout.items.filter(counted)
  const boxes = items.map(box)
  const best = new Map<string, Gap>()
  const consider = (g: Gap) => {
    const k = [g.a.uid, g.b.uid].sort().join('|')
    const cur = best.get(k)
    if (!cur || g.length < cur.length) best.set(k, { ...g, key: k })
  }
  for (let i = 0; i < items.length; i++) {
    const A = boxes[i]
    const a = items[i]
    // Les chaises et tabourets rangés sous une table ne comptent pas comme un passage
    const near: Record<'px' | 'nx' | 'pz' | 'nz', Gap | null> = { px: null, nx: null, pz: null, nz: null }
    for (let j = 0; j < items.length; j++) {
      if (i === j) continue
      const B = boxes[j]
      const b = items[j]
      const ox0 = Math.max(A.minX, B.minX)
      const ox1 = Math.min(A.maxX, B.maxX)
      const oz0 = Math.max(A.minZ, B.minZ)
      const oz1 = Math.min(A.maxZ, B.maxZ)
      const mk = (from: [number, number], to: [number, number], length: number): Gap => ({ key: '', a, b, from, to, length, comfort: comfortOf(length) })
      if (ox1 - ox0 > 0.12) {
        const mx = (ox0 + ox1) / 2
        if (B.minZ >= A.maxZ - 0.001 && B.minZ - A.maxZ <= max) {
          const g = mk([mx, A.maxZ], [mx, B.minZ], B.minZ - A.maxZ)
          if (!near.pz || g.length < near.pz.length) near.pz = g
        }
        if (A.minZ >= B.maxZ - 0.001 && A.minZ - B.maxZ <= max) {
          const g = mk([mx, B.maxZ], [mx, A.minZ], A.minZ - B.maxZ)
          if (!near.nz || g.length < near.nz.length) near.nz = g
        }
      }
      if (oz1 - oz0 > 0.12) {
        const mz = (oz0 + oz1) / 2
        if (B.minX >= A.maxX - 0.001 && B.minX - A.maxX <= max) {
          const g = mk([A.maxX, mz], [B.minX, mz], B.minX - A.maxX)
          if (!near.px || g.length < near.px.length) near.px = g
        }
        if (A.minX >= B.maxX - 0.001 && A.minX - B.maxX <= max) {
          const g = mk([B.maxX, mz], [A.minX, mz], A.minX - B.maxX)
          if (!near.nx || g.length < near.nx.length) near.nx = g
        }
      }
    }
    // En dessous de 20 cm, les meubles sont côte à côte : ce n'est pas un passage
    Object.values(near).forEach((g) => g && g.length >= 0.2 && consider(g))
  }
  // Une chaise contre sa table n'est pas un passage
  return [...best.values()].filter((g) => !(getItem(g.a.modelId)?.tucksUnder || getItem(g.b.modelId)?.tucksUnder)).sort((p, q) => p.length - q.length)
}

/** Les rectangles se chevauchent-ils ? (séparation sur les axes des deux rectangles) */
function polysOverlap(p: [number, number][], q: [number, number][]) {
  for (const poly of [p, q]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, z1] = poly[i]
      const [x2, z2] = poly[(i + 1) % poly.length]
      const nx = z2 - z1
      const nz = x1 - x2
      const proj = (pts: [number, number][]) => pts.map(([x, z]) => x * nx + z * nz)
      const a = proj(p)
      const b = proj(q)
      if (Math.max(...a) <= Math.min(...b) + 1e-4 || Math.max(...b) <= Math.min(...a) + 1e-4) return false
    }
  }
  return true
}

function footprint(it: PlacedItem): [number, number][] {
  const d = itemDims(it)
  const c = Math.cos(it.rot)
  const s = Math.sin(it.rot)
  const local: [number, number][] = [
    [-d.width / 2, -d.depth / 2],
    [d.width / 2, -d.depth / 2],
    [d.width / 2, d.depth / 2],
    [-d.width / 2, d.depth / 2],
  ]
  return local.map(([x, z]) => [it.x + x * c + z * s, it.z - x * s + z * c])
}

/** Zones d'ouverture devant les meubles, et ce qui les gêne. */
export function openingZones(layout: Layout): OpeningZone[] {
  const out: OpeningZone[] = []
  const W = layout.room.width / 2
  const D = layout.room.depth / 2
  for (const it of layout.items) {
    const c = getItem(it.modelId)
    if (!c) continue
    const d = itemDims(it)
    const z = zoneFor(c, d.width, d.depth)
    if (!z) continue
    const cs = Math.cos(it.rot)
    const sn = Math.sin(it.rot)
    // La face avant regarde vers +Z dans le repère du meuble
    const local: [number, number][] = [
      [-d.width / 2, d.depth / 2],
      [d.width / 2, d.depth / 2],
      [d.width / 2, d.depth / 2 + z.depth],
      [-d.width / 2, d.depth / 2 + z.depth],
    ]
    const corners = local.map(([x, zz]) => [it.x + x * cs + zz * sn, it.z - x * sn + zz * cs] as [number, number])
    let blockedBy: string | null = null
    if (corners.some(([x, zz]) => Math.abs(x) > W + 0.01 || Math.abs(zz) > D + 0.01)) blockedBy = 'le mur'
    for (const o of layout.items) {
      if (blockedBy || o.uid === it.uid) continue
      const oc = getItem(o.modelId)
      // Un tapis ne gêne pas ; une chaise ou un tabouret devant une table ou une coiffeuse non plus
      if (!oc || oc.floorLayer || (oc.tucksUnder && c.hostsUnder)) continue
      if (polysOverlap(corners, footprint(o))) blockedBy = withArticle(o)
    }
    out.push({ item: it, corners, depth: z.depth, label: z.label, blockedBy })
  }
  return out
}

/** Phrases courtes pour la liste des passages. */
export function gapSentence(g: Gap) {
  return `${Math.round(g.length * 100)} cm entre ${withArticle(g.a)} et ${withArticle(g.b)}`
}
