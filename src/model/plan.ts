// Plan d'appartement tracé à la main sur un plan importé (image ou PDF).
// - Les murs sont des segments entre des angles (points), mesurés sur leur axe central.
// - Les portes et fenêtres sont posées sur un mur (distance depuis son premier angle).
// - Les pièces sont détectées automatiquement : chaque zone fermée par des murs.
//   Un nom posé dans une zone (« Chambre », « Salon »…) devient le nom de la pièce.
// Coordonnées en mètres : x vers la droite, z vers le bas du plan (le haut du plan est le « nord »).
import type { Opening, RoomType, WallSide } from './types'
import { uid } from './types'

export type PlanOpeningKind = 'porte' | 'fenetre' | 'porte-fenetre'

export const PLAN_OPENING_LABEL: Record<PlanOpeningKind, string> = {
  porte: 'Porte',
  fenetre: 'Fenêtre',
  'porte-fenetre': 'Porte-fenêtre',
}

export const PLAN_OPENING_DEFAULTS: Record<PlanOpeningKind, { width: number; height: number; sill: number }> = {
  porte: { width: 0.83, height: 2.04, sill: 0 },
  fenetre: { width: 1.2, height: 1.35, sill: 0.9 },
  'porte-fenetre': { width: 1.4, height: 2.15, sill: 0 },
}

export interface PlanPoint {
  id: string
  x: number
  z: number
}

export interface PlanWall {
  id: string
  a: string
  b: string
  /** Épaisseur (m) : 7 cm pour une cloison, 20 cm pour un mur porteur ou de façade */
  thickness: number
}

export interface PlanOpening {
  id: string
  wallId: string
  kind: PlanOpeningKind
  /** Distance entre le premier angle du mur et le centre de l'ouverture (m) */
  u: number
  width: number
  height: number
  sill: number
  hinge?: 'gauche' | 'droite'
}

export interface RoomLabel {
  id: string
  x: number
  z: number
  name: string
}

export interface PlanImage {
  id: string
  widthPx: number
  heightPx: number
  /** Mètres par pixel de l'image */
  scale: number
  /** L'échelle a été réglée par l'utilisateur (sinon : estimation provisoire) */
  calibrated: boolean
  opacity: number
  hidden?: boolean
}

export interface FloorPlan {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  image?: PlanImage
  /** Hauteur sous plafond (m) */
  height: number
  points: PlanPoint[]
  walls: PlanWall[]
  openings: PlanOpening[]
  labels: RoomLabel[]
}

export const WALL_THICKNESS = { cloison: 0.07, standard: 0.12, porteur: 0.2 }

export function newPlan(name: string, image?: { id: string; widthPx: number; heightPx: number }): FloorPlan {
  return {
    id: uid(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    // Sans échelle connue, on suppose un plan d'environ 12 m de large
    image: image ? { ...image, scale: 12 / Math.max(1, image.widthPx), calibrated: false, opacity: 0.55 } : undefined,
    height: 2.5,
    points: [],
    walls: [],
    openings: [],
    labels: [],
  }
}

// ---------------------------------------------------------------- Géométrie de base

export type XZ = { x: number; z: number }

export const dist = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z)

export function pointById(plan: FloorPlan) {
  return new Map(plan.points.map((p) => [p.id, p]))
}

export interface WallSeg {
  wall: PlanWall
  a: PlanPoint
  b: PlanPoint
  len: number
  /** Direction unitaire a → b */
  dx: number
  dz: number
}

export function wallSegs(plan: FloorPlan): WallSeg[] {
  const pts = pointById(plan)
  const out: WallSeg[] = []
  for (const w of plan.walls) {
    const a = pts.get(w.a)
    const b = pts.get(w.b)
    if (!a || !b) continue
    const len = dist(a, b)
    if (len < 1e-6) continue
    out.push({ wall: w, a, b, len, dx: (b.x - a.x) / len, dz: (b.z - a.z) / len })
  }
  return out
}

export function wallSeg(plan: FloorPlan, wallId: string): WallSeg | undefined {
  return wallSegs(plan).find((s) => s.wall.id === wallId)
}

/** Projection d'un point sur un segment : position le long du mur (u) et distance au mur. */
export function projectOnSeg(s: WallSeg, p: XZ) {
  const u = Math.max(0, Math.min(s.len, (p.x - s.a.x) * s.dx + (p.z - s.a.z) * s.dz))
  const x = s.a.x + s.dx * u
  const z = s.a.z + s.dz * u
  return { u, x, z, d: Math.hypot(p.x - x, p.z - z) }
}

export function nearestWall(plan: FloorPlan, p: XZ, tol: number) {
  let best: { seg: WallSeg; u: number; x: number; z: number; d: number } | null = null
  for (const s of wallSegs(plan)) {
    const pr = projectOnSeg(s, p)
    if (pr.d <= tol && (!best || pr.d < best.d)) best = { seg: s, ...pr }
  }
  return best
}

export function nearestPoint(plan: FloorPlan, p: XZ, tol: number, exclude?: string) {
  let best: PlanPoint | null = null
  let bd = tol
  for (const q of plan.points) {
    if (q.id === exclude) continue
    const d = dist(p, q)
    if (d <= bd) {
      bd = d
      best = q
    }
  }
  return best
}

/** Aimantation d'un nouvel angle : sur un angle existant, sinon d'équerre avec l'angle précédent
 * et alignée sur les autres angles, sinon sur un mur existant. */
export function snapPoint(plan: FloorPlan, p: XZ, from: PlanPoint | null, tol: number): { x: number; z: number; pointId?: string; onWall?: string } {
  const hitPoint = nearestPoint(plan, p, tol, from?.id)
  if (hitPoint) return { x: hitPoint.x, z: hitPoint.z, pointId: hitPoint.id }
  let { x, z } = p
  if (from) {
    // D'équerre (horizontal ou vertical) si l'angle est proche
    const ang = Math.abs(Math.atan2(z - from.z, x - from.x))
    const near = (a: number) => Math.abs(ang - a) < (8 * Math.PI) / 180
    if (near(0) || near(Math.PI)) z = from.z
    else if (near(Math.PI / 2)) x = from.x
  }
  // Alignement sur un autre angle (même x ou même z)
  for (const q of plan.points) {
    if (q.id === from?.id) continue
    if (Math.abs(q.x - x) < tol * 0.6 && !(from && from.x === x)) x = q.x
    if (Math.abs(q.z - z) < tol * 0.6 && !(from && from.z === z)) z = q.z
  }
  const w = nearestWall(plan, { x, z }, tol * 0.8)
  if (w && w.u > 0.05 && w.u < w.seg.len - 0.05) return { x: w.x, z: w.z, onWall: w.seg.wall.id }
  return { x, z }
}

// ---------------------------------------------------------------- Modifications

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** Coupe un mur en deux au point donné (déjà placé sur le mur). Les ouvertures suivent. */
function splitWall(plan: FloorPlan, wallId: string, pointId: string) {
  const s = wallSeg(plan, wallId)
  const p = plan.points.find((q) => q.id === pointId)
  if (!s || !p) return
  const cut = projectOnSeg(s, p).u
  if (cut < 0.01 || cut > s.len - 0.01) return
  const second: PlanWall = { id: uid(), a: pointId, b: s.wall.b, thickness: s.wall.thickness }
  plan.walls = plan.walls.map((w) => (w.id === wallId ? { ...w, b: pointId } : w))
  plan.walls.push(second)
  plan.openings = plan.openings.map((o) => (o.wallId === wallId && o.u > cut ? { ...o, wallId: second.id, u: o.u - cut } : o))
}

/** Ajoute (ou réutilise) un angle ; s'il tombe sur un mur, ce mur est coupé en deux. */
export function addPoint(plan: FloorPlan, snap: { x: number; z: number; pointId?: string; onWall?: string }): string {
  if (snap.pointId) return snap.pointId
  const p: PlanPoint = { id: uid(), x: round(snap.x), z: round(snap.z) }
  plan.points.push(p)
  if (snap.onWall) splitWall(plan, snap.onWall, p.id)
  return p.id
}

const round = (v: number) => Math.round(v * 1000) / 1000

/** Intersection stricte de deux segments. */
function crossing(p1: XZ, p2: XZ, p3: XZ, p4: XZ): XZ | null {
  const d = (p2.x - p1.x) * (p4.z - p3.z) - (p2.z - p1.z) * (p4.x - p3.x)
  if (Math.abs(d) < 1e-9) return null
  const t = ((p3.x - p1.x) * (p4.z - p3.z) - (p3.z - p1.z) * (p4.x - p3.x)) / d
  const v = ((p3.x - p1.x) * (p2.z - p1.z) - (p3.z - p1.z) * (p2.x - p1.x)) / d
  const e = 0.02
  if (t <= e || t >= 1 - e || v <= e || v >= 1 - e) return null
  return { x: p1.x + t * (p2.x - p1.x), z: p1.z + t * (p2.z - p1.z) }
}

/** Ajoute un mur entre deux angles ; les murs qu'il croise sont coupés au croisement. */
export function addWall(plan: FloorPlan, a: string, b: string, thickness: number) {
  if (a === b) return
  if (plan.walls.some((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a))) return
  const pts = pointById(plan)
  const pa = pts.get(a)!
  const pb = pts.get(b)!
  // Croisements avec les murs existants
  const cuts: { t: number; id: string }[] = []
  for (const s of wallSegs(plan)) {
    if ([s.wall.a, s.wall.b].includes(a) || [s.wall.a, s.wall.b].includes(b)) continue
    const c = crossing(pa, pb, s.a, s.b)
    if (!c) continue
    const id = addPoint(plan, { x: c.x, z: c.z, onWall: s.wall.id })
    cuts.push({ t: dist(pa, c), id })
  }
  const chain = [a, ...cuts.sort((p, q) => p.t - q.t).map((c) => c.id), b]
  for (let i = 0; i < chain.length - 1; i++) plan.walls.push({ id: uid(), a: chain[i], b: chain[i + 1], thickness })
}

/** Supprime les angles qui ne portent plus aucun mur. */
function pruneOrphans(plan: FloorPlan) {
  const used = new Set(plan.walls.flatMap((w) => [w.a, w.b]))
  plan.points = plan.points.filter((p) => used.has(p.id))
}

export function removeWall(plan: FloorPlan, wallId: string, keepPoints: string[] = []) {
  plan.walls = plan.walls.filter((w) => w.id !== wallId)
  plan.openings = plan.openings.filter((o) => o.wallId !== wallId)
  const used = new Set([...plan.walls.flatMap((w) => [w.a, w.b]), ...keepPoints])
  plan.points = plan.points.filter((p) => used.has(p.id))
}

export function removePoint(plan: FloorPlan, pointId: string) {
  const walls = plan.walls.filter((w) => w.a === pointId || w.b === pointId)
  // Un angle entre deux murs alignés : on les réunit en un seul
  if (walls.length === 2) {
    const [w1, w2] = walls
    const o1 = w1.a === pointId ? w1.b : w1.a
    const o2 = w2.a === pointId ? w2.b : w2.a
    const pts = pointById(plan)
    const P = pts.get(pointId)!
    const A = pts.get(o1)!
    const B = pts.get(o2)!
    const cross = (P.x - A.x) * (B.z - A.z) - (P.z - A.z) * (B.x - A.x)
    if (Math.abs(cross) / Math.max(0.01, dist(A, B)) < 0.03) {
      const merged: PlanWall = { id: w1.id, a: o1, b: o2, thickness: Math.max(w1.thickness, w2.thickness) }
      const len1 = dist(A, P)
      plan.openings = plan.openings.map((o) => {
        if (o.wallId === w1.id) return { ...o, u: w1.a === o1 ? o.u : len1 - o.u }
        if (o.wallId === w2.id) return { ...o, wallId: w1.id, u: len1 + (w2.a === pointId ? o.u : dist(P, B) - o.u) }
        return o
      })
      plan.walls = plan.walls.filter((w) => w.id !== w2.id).map((w) => (w.id === w1.id ? merged : w))
      plan.points = plan.points.filter((p) => p.id !== pointId)
      return
    }
  }
  for (const w of walls) removeWall(plan, w.id)
  plan.points = plan.points.filter((p) => p.id !== pointId)
  pruneOrphans(plan)
}

/** Garde chaque ouverture sur son mur (après un déplacement d'angle). */
export function clampOpenings(plan: FloorPlan) {
  const segs = new Map(wallSegs(plan).map((s) => [s.wall.id, s]))
  plan.openings = plan.openings
    .filter((o) => segs.has(o.wallId))
    .map((o) => {
      const s = segs.get(o.wallId)!
      const width = Math.min(o.width, Math.max(0.4, s.len - 0.1))
      const u = Math.max(width / 2 + 0.03, Math.min(s.len - width / 2 - 0.03, o.u))
      return { ...o, width, u }
    })
}

/** Change la longueur d'un mur en déplaçant son second angle (les murs reliés suivent). */
export function setWallLength(plan: FloorPlan, wallId: string, length: number) {
  const s = wallSeg(plan, wallId)
  if (!s || length < 0.1) return
  plan.points = plan.points.map((p) => (p.id === s.b.id ? { ...p, x: round(s.a.x + s.dx * length), z: round(s.a.z + s.dz * length) } : p))
  clampOpenings(plan)
}

/** Échelle : la distance entre deux points du plan vaut « real » mètres. Tout le tracé suit. */
export function calibrate(plan: FloorPlan, p1: XZ, p2: XZ, real: number) {
  const d = dist(p1, p2)
  if (d < 1e-6 || real <= 0) return
  const k = real / d
  plan.points = plan.points.map((p) => ({ ...p, x: round(p.x * k), z: round(p.z * k) }))
  plan.labels = plan.labels.map((l) => ({ ...l, x: l.x * k, z: l.z * k }))
  plan.openings = plan.openings.map((o) => ({ ...o, u: o.u * k }))
  if (plan.image) plan.image = { ...plan.image, scale: plan.image.scale * k, calibrated: true }
  clampOpenings(plan)
}

export const clonePlan = clone

// ---------------------------------------------------------------- Pièces (zones fermées)

export interface Face {
  key: string
  /** Angles dans l'ordre */
  points: PlanPoint[]
  /** Mur de chaque côté (côté i : points[i] → points[i+1]) */
  walls: PlanWall[]
  /** Surface entre les axes des murs (m²) */
  area: number
  /** Surface au sol approchée, une fois retirée l'épaisseur des murs (m²) */
  floorArea: number
  centroid: XZ
  label?: RoomLabel
}

function signedArea(poly: XZ[]) {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p.x * q.z - q.x * p.z
  }
  return a / 2
}

export function pointInPolygon(p: XZ, poly: XZ[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

function polygonCentroid(poly: XZ[]): XZ {
  const A = signedArea(poly)
  if (Math.abs(A) < 1e-9) return { x: poly.reduce((s, p) => s + p.x, 0) / poly.length, z: poly.reduce((s, p) => s + p.z, 0) / poly.length }
  let cx = 0
  let cz = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const f = p.x * q.z - q.x * p.z
    cx += (p.x + q.x) * f
    cz += (p.z + q.z) * f
  }
  return { x: cx / (6 * A), z: cz / (6 * A) }
}

/** Zones fermées par les murs (faces du graphe des murs, sans la face extérieure). */
export function findFaces(plan: FloorPlan): Face[] {
  const pts = pointById(plan)
  // Demi-arêtes sortantes de chaque angle, triées par angle
  const out = new Map<string, { to: string; wall: PlanWall; ang: number }[]>()
  for (const w of plan.walls) {
    const a = pts.get(w.a)
    const b = pts.get(w.b)
    if (!a || !b) continue
    if (!out.has(a.id)) out.set(a.id, [])
    if (!out.has(b.id)) out.set(b.id, [])
    out.get(a.id)!.push({ to: b.id, wall: w, ang: Math.atan2(b.z - a.z, b.x - a.x) })
    out.get(b.id)!.push({ to: a.id, wall: w, ang: Math.atan2(a.z - b.z, a.x - b.x) })
  }
  for (const list of out.values()) list.sort((p, q) => p.ang - q.ang)
  const seen = new Set<string>()
  const faces: Face[] = []
  for (const [from, list] of out) {
    for (const e of list) {
      const startKey = `${from}>${e.to}`
      if (seen.has(startKey)) continue
      const ids: string[] = []
      const walls: PlanWall[] = []
      let cur = from
      let edge = e
      let guard = 0
      while (guard++ < 2000) {
        const k = `${cur}>${edge.to}`
        if (seen.has(k)) break
        seen.add(k)
        ids.push(cur)
        walls.push(edge.wall)
        // Arrivé en « to », on repart par l'arête qui précède l'arête de retour (on tourne toujours du même côté)
        const back = out.get(edge.to)!
        const i = back.findIndex((x) => x.to === cur && x.wall.id === edge.wall.id)
        const next = back[(i - 1 + back.length) % back.length]
        cur = edge.to
        edge = next
      }
      if (ids.length < 3) continue
      const poly = ids.map((id) => pts.get(id)!)
      const A = signedArea(poly)
      // Les zones intérieures sont parcourues dans un sens (aire positive ici), la face extérieure dans l'autre
      if (A <= 0.3) continue
      const area = A
      let perimeter = 0
      for (let i = 0; i < poly.length; i++) perimeter += dist(poly[i], poly[(i + 1) % poly.length]) * (walls[i].thickness / 2)
      faces.push({
        key: [...ids].sort().join('-'),
        points: poly,
        walls,
        area,
        floorArea: Math.max(0, area - perimeter),
        centroid: polygonCentroid(poly),
      })
    }
  }
  // Un nom posé dans une zone la nomme
  for (const f of faces) f.label = plan.labels.find((l) => pointInPolygon(l, f.points))
  return faces
}

/** Point d'étiquette bien à l'intérieur de la zone (le centre, ou à défaut un point intérieur). */
export function faceAnchor(f: Face): XZ {
  if (pointInPolygon(f.centroid, f.points)) return f.centroid
  // Pièce en L : on cherche un point intérieur le long d'une ligne horizontale
  const zs = f.points.map((p) => p.z)
  const z = (Math.min(...zs) + Math.max(...zs)) / 2
  const xs: number[] = []
  for (let i = 0; i < f.points.length; i++) {
    const a = f.points[i]
    const b = f.points[(i + 1) % f.points.length]
    if (a.z > z !== b.z > z) xs.push(a.x + ((z - a.z) * (b.x - a.x)) / (b.z - a.z))
  }
  xs.sort((a, b) => a - b)
  return xs.length >= 2 ? { x: (xs[0] + xs[1]) / 2, z } : f.centroid
}

export const ROOM_NAMES = ['Chambre', 'Salon', 'Séjour', 'Cuisine', 'Salle de bain', 'WC', 'Entrée', 'Couloir', 'Bureau', 'Dressing', 'Cellier', 'Buanderie']

export function guessRoomType(name: string): RoomType {
  const n = name.toLowerCase()
  if (n.includes('chambre')) return 'chambre'
  if (n.includes('bureau')) return 'bureau'
  if (n.includes('cuisine')) return 'cuisine'
  if (n.includes('bain') || n.includes('douche') || n.includes('wc')) return 'salle-de-bain'
  return 'salon'
}

// ---------------------------------------------------------------- Passage vers l'aménagement d'une pièce

export interface RoomFromFace {
  name: string
  roomType: RoomType
  room: { width: number; depth: number; height: number }
  openings: Opening[]
  rectangular: boolean
}

/** Transforme une pièce du plan en pièce rectangulaire à aménager (dimensions intérieures, portes, fenêtres). */
export function roomFromFace(plan: FloorPlan, f: Face): RoomFromFace {
  const xs = f.points.map((p) => p.x)
  const zs = f.points.map((p) => p.z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const segs = new Map(wallSegs(plan).map((s) => [s.wall.id, s]))
  // Épaisseur des murs de chaque côté : on mesure l'intérieur, de plinthe à plinthe
  const sideT = (test: (s: WallSeg) => boolean) => {
    const t = f.walls.map((w) => segs.get(w.id)).filter((s): s is WallSeg => !!s && test(s)).map((s) => s.wall.thickness)
    return t.length ? Math.max(...t) : f.walls.reduce((a, w) => a + w.thickness, 0) / f.walls.length
  }
  const near = (a: number, b: number) => Math.abs(a - b) < 0.05
  const tN = sideT((s) => Math.abs(s.dz) < 0.02 && near(s.a.z, minZ))
  const tS = sideT((s) => Math.abs(s.dz) < 0.02 && near(s.a.z, maxZ))
  const tW = sideT((s) => Math.abs(s.dx) < 0.02 && near(s.a.x, minX))
  const tE = sideT((s) => Math.abs(s.dx) < 0.02 && near(s.a.x, maxX))
  const x0 = minX + tW / 2
  const x1 = maxX - tE / 2
  const z0 = minZ + tN / 2
  const z1 = maxZ - tS / 2
  const width = Math.max(1, Math.round((x1 - x0) * 100) / 100)
  const depth = Math.max(1, Math.round((z1 - z0) * 100) / 100)
  const midX = (x0 + x1) / 2
  const midZ = (z0 + z1) / 2
  const openings: Opening[] = []
  const tol = 0.05
  for (const w of f.walls) {
    const s = segs.get(w.id)
    if (!s) continue
    const horiz = Math.abs(s.dz) < 0.02
    const vert = Math.abs(s.dx) < 0.02
    let side: WallSide | null = null
    if (horiz && Math.abs(s.a.z - minZ) < tol) side = 'nord'
    else if (horiz && Math.abs(s.a.z - maxZ) < tol) side = 'sud'
    else if (vert && Math.abs(s.a.x - maxX) < tol) side = 'est'
    else if (vert && Math.abs(s.a.x - minX) < tol) side = 'ouest'
    if (!side) continue
    for (const o of plan.openings.filter((x) => x.wallId === w.id)) {
      const cx = s.a.x + s.dx * o.u
      const cz = s.a.z + s.dz * o.u
      const offset = side === 'nord' ? cx - midX : side === 'est' ? cz - midZ : side === 'sud' ? midX - cx : midZ - cz
      openings.push({ id: uid(), kind: o.kind, wall: side, offset: Math.round(offset * 100) / 100, width: o.width, height: o.height, sill: o.sill, hinge: o.hinge })
    }
  }
  const name = f.label?.name ?? 'Pièce'
  // Rectangulaire : 4 angles une fois les points alignés retirés, tous d'équerre
  const corners = f.points.filter((p, i) => {
    const a = f.points[(i - 1 + f.points.length) % f.points.length]
    const b = f.points[(i + 1) % f.points.length]
    return Math.abs((p.x - a.x) * (b.z - a.z) - (p.z - a.z) * (b.x - a.x)) > 0.02
  })
  const rectangular = corners.length === 4 && corners.every((p) => (Math.abs(p.x - minX) < tol || Math.abs(p.x - maxX) < tol) && (Math.abs(p.z - minZ) < tol || Math.abs(p.z - maxZ) < tol))
  return { name, roomType: guessRoomType(name), room: { width, depth, height: plan.height }, openings, rectangular }
}

/** Cadre englobant de tout le tracé (et de l'image). */
export function planBounds(plan: FloorPlan) {
  const xs = plan.points.map((p) => p.x)
  const zs = plan.points.map((p) => p.z)
  if (plan.image && !plan.image.hidden) {
    xs.push(0, plan.image.widthPx * plan.image.scale)
    zs.push(0, plan.image.heightPx * plan.image.scale)
  }
  if (!xs.length) return { minX: -3, maxX: 3, minZ: -3, maxZ: 3 }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
}
