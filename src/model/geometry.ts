// Calculs géométriques au sol : encombrement des meubles, alignements, chevauchements.
import { CATALOG_BY_ID } from '../data/catalog'
import type { ItemDims, Layout, Opening, PlacedItem, Room, WallSide } from './types'
import { OPENING_LABEL } from './types'

export function itemDims(item: Pick<PlacedItem, 'modelId' | 'dims'>): ItemDims {
  const c = CATALOG_BY_ID[item.modelId]
  if (item.dims) return item.dims
  if (!c) return { width: 0.5, depth: 0.5, height: 0.5 }
  return { width: c.width, depth: c.depth, height: c.height }
}

/** Demi-encombrement au sol d'un meuble après rotation (boîte alignée sur les axes). */
export function halfExtents(item: Pick<PlacedItem, 'modelId' | 'dims' | 'rot'>) {
  const d = itemDims(item)
  const cos = Math.abs(Math.cos(item.rot))
  const sin = Math.abs(Math.sin(item.rot))
  return { hx: (cos * d.width + sin * d.depth) / 2, hz: (sin * d.width + cos * d.depth) / 2 }
}

/** Garde un meuble à l'intérieur de la pièce. */
export function clampToRoom(item: Pick<PlacedItem, 'modelId' | 'dims' | 'rot' | 'x' | 'z'>, room: Room) {
  const { hx, hz } = halfExtents(item)
  const limX = Math.max(0, room.width / 2 - hx)
  const limZ = Math.max(0, room.depth / 2 - hz)
  return { x: Math.min(limX, Math.max(-limX, item.x)), z: Math.min(limZ, Math.max(-limZ, item.z)) }
}

export const GRID_STEP = 0.1
const WALL_SNAP = 0.15

/** Alignement facultatif : sur la grille (10 cm) et/ou contre les murs (à moins de 15 cm). */
export function snapPosition(item: Pick<PlacedItem, 'modelId' | 'dims' | 'rot'>, x: number, z: number, room: Room, opts: { grid: boolean; walls: boolean }) {
  let nx = x
  let nz = z
  if (opts.grid) {
    nx = Math.round(nx / GRID_STEP) * GRID_STEP
    nz = Math.round(nz / GRID_STEP) * GRID_STEP
  }
  if (opts.walls) {
    const { hx, hz } = halfExtents(item)
    const L = -room.width / 2 + hx
    const R = room.width / 2 - hx
    const T = -room.depth / 2 + hz
    const B = room.depth / 2 - hz
    if (Math.abs(x - L) < WALL_SNAP) nx = L
    else if (Math.abs(x - R) < WALL_SNAP) nx = R
    if (Math.abs(z - T) < WALL_SNAP) nz = T
    else if (Math.abs(z - B) < WALL_SNAP) nz = B
  }
  return { x: nx, z: nz }
}

// ---------- Murs et ouvertures ----------

/** Longueur intérieure d'un mur. */
export const wallLength = (room: Room, side: WallSide) => (side === 'nord' || side === 'sud' ? room.width : room.depth)

/**
 * Repère d'un mur : point de départ de la face intérieure, direction le long du mur,
 * normale vers l'intérieur. Le décalage des ouvertures est mesuré depuis le milieu,
 * dans le sens de la direction.
 */
export function wallAxes(room: Room, side: WallSide) {
  const W = room.width / 2
  const D = room.depth / 2
  switch (side) {
    case 'nord':
      return { a: [-W, -D] as [number, number], b: [W, -D] as [number, number], dir: [1, 0], inward: [0, 1] }
    case 'est':
      return { a: [W, -D] as [number, number], b: [W, D] as [number, number], dir: [0, 1], inward: [-1, 0] }
    case 'sud':
      return { a: [W, D] as [number, number], b: [-W, D] as [number, number], dir: [-1, 0], inward: [0, -1] }
    case 'ouest':
      return { a: [-W, D] as [number, number], b: [-W, -D] as [number, number], dir: [0, -1], inward: [1, 0] }
  }
}

/** Point au sol du centre d'une ouverture (sur la face intérieure du mur). */
export function openingCenter(room: Room, o: Pick<Opening, 'wall' | 'offset'>) {
  const ax = wallAxes(room, o.wall)
  const mx = (ax.a[0] + ax.b[0]) / 2
  const mz = (ax.a[1] + ax.b[1]) / 2
  return { x: mx + ax.dir[0] * o.offset, z: mz + ax.dir[1] * o.offset }
}

/** Décalage maximal d'une ouverture pour qu'elle reste sur son mur. */
export function clampOffset(room: Room, o: Pick<Opening, 'wall' | 'width'>, offset: number) {
  const half = Math.max(0, wallLength(room, o.wall) / 2 - o.width / 2 - 0.05)
  return Math.max(-half, Math.min(half, offset))
}

/** Profondeur par défaut d'un placard (dans la pièce) ou d'une niche (dans le mur). */
export const openingDepth = (o: Opening) => o.depth ?? (o.kind === 'placard' ? 0.6 : o.kind === 'niche' ? 0.1 : 0)

// ---------- Chevauchements ----------

interface Rect {
  label: string
  id: string
  kind: 'item' | 'opening'
  cx: number
  cz: number
  hw: number
  hd: number
  rot: number
}

function corners(r: Rect) {
  const c = Math.cos(r.rot)
  const s = Math.sin(r.rot)
  // Rotation autour de l'axe vertical (convention Three.js : x' = x cos + z sin, z' = -x sin + z cos)
  return [
    [-r.hw, -r.hd],
    [r.hw, -r.hd],
    [r.hw, r.hd],
    [-r.hw, r.hd],
  ].map(([x, z]) => [r.cx + x * c + z * s, r.cz - x * s + z * c])
}

/** Test de séparation des axes entre deux rectangles orientés, avec une petite tolérance. */
function rectsOverlap(a: Rect, b: Rect, tolerance = 0.015) {
  const ca = corners(a)
  const cb = corners(b)
  for (const r of [a, b]) {
    const c = Math.cos(r.rot)
    const s = Math.sin(r.rot)
    for (const [ax, az] of [
      [c, -s],
      [s, c],
    ]) {
      const pa = ca.map(([x, z]) => x * ax + z * az)
      const pb = cb.map(([x, z]) => x * ax + z * az)
      if (Math.max(...pa) - tolerance <= Math.min(...pb) || Math.max(...pb) - tolerance <= Math.min(...pa)) return false
    }
  }
  return true
}

function itemRect(it: PlacedItem): Rect {
  const d = itemDims(it)
  return { label: CATALOG_BY_ID[it.modelId]?.name ?? 'Meuble', id: it.uid, kind: 'item', cx: it.x, cz: it.z, hw: d.width / 2, hd: d.depth / 2, rot: it.rot }
}

/** Zones occupées par les placards et le débattement des portes. */
function openingRects(layout: Layout): Rect[] {
  const out: Rect[] = []
  for (const o of layout.openings) {
    const ax = wallAxes(layout.room, o.wall)
    const c = openingCenter(layout.room, o)
    // Angle tel que la largeur suit le mur
    const rot = Math.atan2(-ax.dir[1], ax.dir[0])
    if (o.kind === 'placard') {
      const d = openingDepth(o)
      out.push({ label: OPENING_LABEL.placard, id: o.id, kind: 'opening', cx: c.x + ax.inward[0] * d / 2, cz: c.z + ax.inward[1] * d / 2, hw: o.width / 2, hd: d / 2, rot })
    } else if ((o.kind === 'porte' || o.kind === 'porte-fenetre') && (o.swing ?? 'interieur') === 'interieur') {
      const leaf = o.kind === 'porte' ? o.width : o.width / 2
      out.push({ label: `Ouverture : ${OPENING_LABEL[o.kind].toLowerCase()}`, id: o.id, kind: 'opening', cx: c.x + ax.inward[0] * leaf / 2, cz: c.z + ax.inward[1] * leaf / 2, hw: o.width / 2, hd: leaf / 2, rot })
    }
  }
  return out
}

export interface Overlap {
  a: { id: string; label: string; kind: 'item' | 'opening' }
  b: { id: string; label: string; kind: 'item' | 'opening' }
}

/** Liste les chevauchements gênants (le tapis et les chaises rangées sous une table sont permis). */
export function findOverlaps(layout: Layout): Overlap[] {
  const items = layout.items.filter((it) => !CATALOG_BY_ID[it.modelId]?.floorLayer)
  const out: Overlap[] = []
  const rects = items.map(itemRect)
  for (let i = 0; i < items.length; i++) {
    const ci = CATALOG_BY_ID[items[i].modelId]
    for (let j = i + 1; j < items.length; j++) {
      const cj = CATALOG_BY_ID[items[j].modelId]
      if ((ci?.tucksUnder && cj?.hostsUnder) || (cj?.tucksUnder && ci?.hostsUnder)) continue
      if (rectsOverlap(rects[i], rects[j])) out.push({ a: rects[i], b: rects[j] })
    }
    for (const r of openingRects(layout)) {
      if (rectsOverlap(rects[i], r, 0.03)) out.push({ a: rects[i], b: r })
    }
  }
  return out
}

const overlapCache = new WeakMap<Layout, Overlap[]>()
/** Chevauchements de la version en cours (calculés une seule fois par état). */
export function overlapsOf(layout: Layout): Overlap[] {
  let r = overlapCache.get(layout)
  if (!r) {
    r = findOverlaps(layout)
    overlapCache.set(layout, r)
  }
  return r
}
