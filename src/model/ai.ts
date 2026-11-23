// Assistant « Demander une idée » : préparation de la demande envoyée au relais,
// puis conversion et vérification des propositions reçues.
// L'IA propose ; l'application vérifie tout (meubles verrouillés, dimensions, chevauchements).
import { CATALOG, REFERENCE_ITEMS, getItem, itemPrice } from '../data/catalog'
import { FLOORS } from '../data/finishes'
import { clampToRoom, findOverlaps, itemDims, openingCenter, openingDepth, wallAxes, wallLength } from './geometry'
import { imageUrl } from './storage'
import type { Inspiration, Layout, MyFurniture, PlacedItem, WallSide } from './types'
import { OPENING_LABEL, WALL_LABEL, WALL_ORDER, uid } from './types'
import { customToCatalog } from '../data/catalog'

/** Adresse du relais (fixée au déploiement dans le fichier .env). */
export const RELAIS_URL: string = (import.meta.env.VITE_RELAIS_URL ?? '').replace(/\/$/, '')
export const aiReady = () => RELAIS_URL.length > 0

const r2 = (v: number) => Math.round(v * 100) / 100
const deg = (rad: number) => Math.round(((rad * 180) / Math.PI) % 360)

/** Description de la pièce pour l'assistant (repère, ouvertures, meubles, catalogue). */
export function roomForAI(layout: Layout, myFurniture: MyFurniture[]) {
  const { room } = layout
  return {
    dimensions: { largeur: room.width, longueur: room.depth, hauteur: room.height },
    murs: Object.fromEntries(
      WALL_ORDER.map((w) => [w, { nom: WALL_LABEL[w], longueur: r2(wallLength(room, w)), couleur: layout.wallColors[w] }]),
    ),
    sol: layout.floorId,
    solsDisponibles: FLOORS.map((f) => ({ id: f.id, nom: f.name })),
    ouvertures: layout.openings.map((o) => {
      const c = openingCenter(room, o)
      const ax = wallAxes(room, o.wall)
      const along = ax.dir[0] !== 0 ? 'x' : 'z'
      return {
        type: OPENING_LABEL[o.kind],
        mur: `${WALL_LABEL[o.wall]} (${o.wall})`,
        centre: { x: r2(c.x), z: r2(c.z) },
        etendue: along === 'x' ? { x: [r2(c.x - o.width / 2), r2(c.x + o.width / 2)] } : { z: [r2(c.z - o.width / 2), r2(c.z + o.width / 2)] },
        largeur: o.width,
        hauteur: o.height,
        allege: o.sill,
        profondeurDansLaPiece: o.kind === 'placard' ? openingDepth(o) : undefined,
        sensOuverture: o.kind === 'porte' || o.kind === 'porte-fenetre' ? o.swing ?? 'interieur' : undefined,
      }
    }),
    meubles: layout.items.map((it) => {
      const c = getItem(it.modelId)
      const d = itemDims(it)
      return {
        ref: it.uid,
        modelId: it.modelId,
        nom: c?.name,
        largeur: r2(d.width),
        profondeur: r2(d.depth),
        hauteur: r2(d.height),
        x: r2(it.x),
        z: r2(it.z),
        rotationDeg: deg(it.rot),
        verrouille: !!it.locked,
        statut: it.status === 'a-acheter' ? 'à acheter' : 'déjà possédé',
      }
    }),
    // Vraies références du commerce (prix relevés) incluses : l'assistant peut proposer des achats réels
    catalogue: [...myFurniture.map(customToCatalog), ...REFERENCE_ITEMS, ...CATALOG].map((c) => ({
      modelId: c.id,
      nom: c.name,
      categorie: c.category,
      largeur: c.width,
      profondeur: c.depth,
      hauteur: c.height,
      prix: typeof c.price === 'number' ? c.price : undefined,
      seGlisseSousUneTable: c.tucksUnder || undefined,
      tapis: c.floorLayer || undefined,
    })),
  }
}

/** Réduit une image enregistrée à 1024 px (JPEG) et la renvoie en base64. */
async function imageBase64(id: string): Promise<string | undefined> {
  const url = await imageUrl(id)
  if (!url) return undefined
  const img = new Image()
  img.src = url
  await img.decode()
  const scale = Math.min(1, 1024 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.82).split(',')[1]
}

export interface AIPlacement {
  ref: string
  modelId: string
  x: number
  z: number
  rotationDeg: number
  couleur: string | null
}

export interface AIProposal {
  titre: string
  explication: string
  murs: Partial<Record<WallSide, string | null>>
  sol: string | null
  meubles: AIPlacement[]
}

export async function askIdea(demande: string, layout: Layout, myFurniture: MyFurniture[], inspirations: Inspiration[]): Promise<AIProposal[]> {
  const insp = await Promise.all(
    inspirations.slice(0, 4).map(async (i) => ({ note: i.note || (i.link ? `Lien : ${i.link}` : ''), image: i.imageId ? await imageBase64(i.imageId) : undefined })),
  )
  const res = await fetch(`${RELAIS_URL}/idee`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ demande, piece: roomForAI(layout, myFurniture), inspirations: insp }),
  }).catch(() => null)
  if (!res) throw new Error("Impossible de joindre l'assistant. Vérifiez la connexion Internet.")
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.erreur ?? `L'assistant a renvoyé une erreur (${res.status}).`)
  return data.propositions as AIProposal[]
}

export interface CheckedProposal {
  proposal: AIProposal
  layout: Layout
  /** Ce que l'application a corrigé ou signalé */
  notes: string[]
}

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

/** Transforme une proposition en version d'aménagement et vérifie qu'elle respecte la pièce. */
export function checkProposal(base: Layout, p: AIProposal): CheckedProposal {
  const notes: string[] = []
  const l: Layout = JSON.parse(JSON.stringify(base))
  l.id = uid()
  l.name = `Idée : ${p.titre}`.slice(0, 60)
  l.updatedAt = Date.now()
  delete l.thumb
  for (const w of WALL_ORDER) if (isHex(p.murs?.[w])) l.wallColors[w] = p.murs[w] as string
  if (p.sol && FLOORS.some((f) => f.id === p.sol)) l.floorId = p.sol

  const byUid = new Map(base.items.map((it) => [it.uid, it]))
  const used = new Set<string>()
  const items: PlacedItem[] = []
  // Les meubles verrouillés restent exactement où ils sont
  for (const it of base.items) if (it.locked) (items.push({ ...it }), used.add(it.uid))
  let unknown = 0
  for (const m of p.meubles ?? []) {
    const old = byUid.get(m.ref)
    if (old?.locked || used.has(m.ref)) continue
    const modelId = old && !getItem(m.modelId) ? old.modelId : m.modelId
    if (!getItem(modelId)) {
      unknown++
      continue
    }
    const sameModel = old && old.modelId === modelId
    const cand: PlacedItem = sameModel
      ? { ...old!, x: m.x, z: m.z, rot: ((m.rotationDeg % 360) * Math.PI) / 180 }
      : { uid: old && !used.has(old.uid) ? old.uid : uid(), modelId, x: m.x, z: m.z, rot: ((m.rotationDeg % 360) * Math.PI) / 180, status: 'a-acheter' }
    if (isHex(m.couleur)) cand.color = m.couleur
    const clamped = { ...cand, ...clampToRoom(cand, l.room) }
    if (Math.hypot(clamped.x - cand.x, clamped.z - cand.z) > 0.05) notes.push(`${getItem(modelId)!.name} recadré pour rester dans la pièce`)
    used.add(clamped.uid)
    items.push(clamped)
  }
  if (unknown) notes.push(`${unknown} meuble${unknown > 1 ? 's' : ''} inconnu${unknown > 1 ? 's' : ''} ignoré${unknown > 1 ? 's' : ''}`)
  const removed = base.items.filter((it) => !used.has(it.uid))
  if (removed.length) notes.push(`Retiré : ${removed.map((it) => getItem(it.modelId)?.name ?? 'meuble').join(', ')}`)
  const added = items.filter((it) => !byUid.has(it.uid))
  if (added.length) notes.push(`Ajouté : ${added.map((it) => getItem(it.modelId)?.name ?? 'meuble').join(', ')}`)
  l.items = items
  const overlaps = findOverlaps(l)
  if (overlaps.length) notes.push(`${overlaps.length} chevauchement${overlaps.length > 1 ? 's' : ''} à vérifier (surligné${overlaps.length > 1 ? 's' : ''} en rouge)`)
  return { proposal: p, layout: l, notes }
}

/** Budget des achats d'une proposition (meubles ajoutés ou remplacés). */
export function proposalBudget(l: Layout) {
  return l.items.filter((it) => it.status === 'a-acheter').reduce((s, it) => s + (itemPrice(it) ?? 0), 0)
}

/** Lecture d'une page produit par le relais (photo, prix, dimensions…). */
export async function readProductViaRelais(url: string) {
  const res = await fetch(`${RELAIS_URL}/produit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) throw new Error('relais')
  return (await res.json()) as {
    lu: boolean
    nom?: string | null
    image?: string | null
    prix?: number | null
    vendeur?: string
    largeur?: number | null
    profondeur?: number | null
    hauteur?: number | null
    categorie?: MyFurniture['category'] | null
  }
}
