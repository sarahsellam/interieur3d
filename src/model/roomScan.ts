// « Recréer la pièce depuis mes photos » : l'assistant lit les photos de la vraie pièce
// (meubles, portes, fenêtres, couleurs) ; l'application vérifie et construit une version.
import { CATALOG, customToCatalog, getItem } from '../data/catalog'
import { FLOORS } from '../data/finishes'
import { clampOffset, clampToRoom, findOverlaps, wallLength } from './geometry'
import { RELAIS_URL } from './ai'
import { imageUrl } from './storage'
import type { Layout, MyFurniture, Opening, OpeningKind, PlacedItem, Room, RoomType, WallSide } from './types'
import { WALL_LABEL, WALL_ORDER, uid } from './types'
import { ROOM_LIMITS } from '../store'

export interface ScanOpening {
  type: OpeningKind
  mur: WallSide
  depuisLaGauche: number
  largeur: number
  hauteur: number
  allege: number
  charniere: 'gauche' | 'droite' | null
}

export interface ScanItem {
  vu: string
  modelId: string
  x: number
  z: number
  rotationDeg: number
  largeur: number
  profondeur: number
  hauteur: number
  couleur: string | null
  poseSurMeuble: boolean
}

export interface RoomScan {
  orientation: string
  dimensions: { largeur: number; longueur: number; hauteur: number }
  murs: Partial<Record<WallSide, string | null>>
  sol: string | null
  ouvertures: ScanOpening[]
  meubles: ScanItem[]
  incertain: string
}

/** Photo réduite à 1280 px (JPEG, base64) : assez de détails pour reconnaître les meubles. */
async function photoBase64(id: string): Promise<string | undefined> {
  const url = await imageUrl(id)
  if (!url) return undefined
  const img = new Image()
  img.src = url
  await img.decode()
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.85).split(',')[1]
}

export async function scanRoomPhotos(photoIds: string[], roomType: RoomType, known: Room | null, myFurniture: MyFurniture[]): Promise<RoomScan> {
  const photos = (await Promise.all(photoIds.slice(0, 4).map(photoBase64))).filter((p): p is string => !!p)
  if (!photos.length) throw new Error('Photos introuvables dans cet appareil.')
  // Meubles génériques (et « Mes meubles ») : ceux d'une photo sont déjà chez vous
  const catalogue = [...myFurniture.map(customToCatalog), ...CATALOG].map((c) => ({
    modelId: c.id,
    nom: c.name,
    categorie: c.category,
    largeur: c.width,
    profondeur: c.depth,
    hauteur: c.height,
    tapis: c.floorLayer || undefined,
  }))
  const res = await fetch(`${RELAIS_URL}/piece-photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      photos,
      typePiece: roomType,
      dimensionsConnues: known ? { largeur: known.width, longueur: known.depth, hauteur: known.height } : null,
      catalogue,
      sols: FLOORS.map((f) => ({ id: f.id, nom: f.name })),
    }),
  }).catch(() => null)
  if (!res) throw new Error("Impossible de joindre l'assistant. Vérifiez la connexion Internet.")
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.erreur ?? `L'assistant a renvoyé une erreur (${res.status}).`)
  return data.piece as RoomScan
}

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const r2 = (v: number) => Math.round(v * 100) / 100

export interface ScannedLayout {
  layout: Layout
  notes: string[]
  /** Ce qui a été reconnu, pour l'afficher */
  seen: { name: string; vu: string }[]
  openings: { label: string }[]
}

/**
 * Construit une version à partir de la lecture des photos.
 * `keepDims` : on garde les dimensions mesurées par la personne (sinon l'estimation).
 */
export function buildScannedLayout(base: Layout, scan: RoomScan, keepDims: boolean): ScannedLayout {
  const notes: string[] = []
  const l: Layout = JSON.parse(JSON.stringify(base))
  l.id = uid()
  l.name = 'Ma pièce (photos)'
  l.updatedAt = Date.now()
  delete l.thumb
  l.decor = []

  if (!keepDims && scan.dimensions) {
    l.room = {
      width: r2(clamp(num(scan.dimensions.largeur, base.room.width), ROOM_LIMITS.min, ROOM_LIMITS.max)),
      depth: r2(clamp(num(scan.dimensions.longueur, base.room.depth), ROOM_LIMITS.min, ROOM_LIMITS.max)),
      height: r2(clamp(num(scan.dimensions.hauteur, base.room.height), ROOM_LIMITS.minHeight, ROOM_LIMITS.maxHeight)),
    }
  }
  const room = l.room
  for (const w of WALL_ORDER) if (isHex(scan.murs?.[w])) l.wallColors[w] = scan.murs[w] as string
  if (scan.sol && FLOORS.some((f) => f.id === scan.sol)) l.floorId = scan.sol

  // Ouvertures : position depuis l'angle gauche du mur (vu de l'intérieur) → décalage depuis le milieu
  const openings: Opening[] = []
  for (const o of scan.ouvertures ?? []) {
    if (!WALL_ORDER.includes(o.mur)) continue
    const len = wallLength(room, o.mur)
    const isDoor = o.type === 'porte' || o.type === 'porte-fenetre'
    const width = clamp(num(o.largeur, 1), 0.3, len - 0.2)
    const height = clamp(num(o.hauteur, isDoor ? 2.04 : 1.35), 0.3, room.height - 0.02)
    const sill = isDoor || o.type === 'placard' ? 0 : clamp(num(o.allege, 0.9), 0, room.height - height - 0.02)
    const op: Opening = { id: uid(), kind: o.type, wall: o.mur, offset: 0, width, height, sill }
    op.offset = clampOffset(room, op, num(o.depuisLaGauche, len / 2) - len / 2)
    if (o.type === 'porte') {
      op.hinge = o.charniere ?? 'droite'
      op.swing = 'interieur'
    }
    if (o.type === 'porte-fenetre') op.swing = 'interieur'
    if (o.type === 'placard') op.depth = 0.6
    if (o.type === 'niche') op.depth = 0.1
    // Même ouverture vue sur deux photos : on n'en garde qu'une
    const dup = openings.some((p) => p.wall === op.wall && Math.abs(p.offset - op.offset) < (p.width + op.width) / 4)
    if (!dup) openings.push(op)
  }
  l.openings = openings

  const items: PlacedItem[] = []
  const seen: ScannedLayout['seen'] = []
  let unknown = 0
  for (const m of scan.meubles ?? []) {
    const c = getItem(m.modelId)
    if (!c) {
      unknown++
      continue
    }
    const it: PlacedItem = {
      uid: uid(),
      modelId: c.id,
      x: num(m.x, 0),
      z: num(m.z, 0),
      rot: ((((num(m.rotationDeg, 0) % 360) + 360) % 360) * Math.PI) / 180,
      status: 'possede',
    }
    // Dimensions vues, quand elles s'écartent nettement de celles du modèle
    const w = clamp(num(m.largeur, c.width), 0.15, 4)
    const d = clamp(num(m.profondeur, c.depth), 0.15, 4)
    const h = clamp(num(m.hauteur, c.height), 0.05, room.height)
    if (!c.custom && (Math.abs(w - c.width) > 0.08 || Math.abs(d - c.depth) > 0.08 || Math.abs(h - c.height) > 0.1)) it.dims = { width: r2(w), depth: r2(d), height: r2(h) }
    // Couleur vue (pas pour les plantes : leur feuillage garde ses vraies teintes)
    if (isHex(m.couleur) && !c.custom && c.material !== 'vegetal') it.color = m.couleur
    if (m.poseSurMeuble) it.onTop = true
    Object.assign(it, clampToRoom(it, room))
    items.push(it)
    seen.push({ name: c.name, vu: m.vu })
  }
  l.items = items
  if (unknown) notes.push(`${unknown} meuble${unknown > 1 ? 's' : ''} sans équivalent dans le catalogue, non placé${unknown > 1 ? 's' : ''}`)
  const overlaps = findOverlaps(l)
  if (overlaps.length) notes.push(`${overlaps.length} chevauchement${overlaps.length > 1 ? 's' : ''} à vérifier (en rouge sur le plan)`)
  return {
    layout: l,
    notes,
    seen,
    openings: openings.map((o) => ({ label: `${o.kind === 'fenetre' ? 'Fenêtre' : o.kind === 'porte' ? 'Porte' : o.kind === 'porte-fenetre' ? 'Porte-fenêtre' : o.kind === 'placard' ? 'Placard' : 'Niche'} · ${WALL_LABEL[o.wall]}` })),
  }
}
