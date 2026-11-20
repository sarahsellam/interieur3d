// État global de l'application (la pièce, les meubles placés, la sélection…).
// Sauvegardé automatiquement dans le navigateur (localStorage).
import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { CATALOG_BY_ID } from './data/catalog'
import { FLOORS, WALL_COLORS } from './data/finishes'

export interface Room {
  /** Largeur intérieure (axe x), en mètres */
  width: number
  /** Longueur intérieure (axe z), en mètres */
  depth: number
  /** Hauteur sous plafond, en mètres */
  height: number
}

export interface PlacedItem {
  uid: string
  modelId: string
  x: number
  z: number
  /** Rotation autour de l'axe vertical, en radians */
  rot: number
}

export type ViewMode = '3d' | 'visite' | 'top'

export type WallSide = 'nord' | 'sud' | 'est' | 'ouest'

/** Fenêtre ou porte posée sur un mur de la pièce. */
export interface Opening {
  id: string
  kind: 'fenetre' | 'porte'
  wall: WallSide
  /** Position du centre le long du mur, depuis le milieu du mur (m) */
  offset: number
  width: number
  height: number
  /** Hauteur d'allège (bas de la fenêtre) */
  sill: number
}

export const DEFAULT_OPENINGS: Opening[] = [
  { id: 'f1', kind: 'fenetre', wall: 'ouest', offset: 0.2, width: 1.4, height: 1.55, sill: 0.8 },
  { id: 'f2', kind: 'fenetre', wall: 'nord', offset: 1.25, width: 1.2, height: 1.55, sill: 0.8 },
  { id: 'p1', kind: 'porte', wall: 'est', offset: 1.15, width: 0.83, height: 2.04, sill: 0 },
]

export const ROOM_LIMITS = { min: 2, max: 12, minHeight: 2.2, maxHeight: 4 }

interface State {
  room: Room
  wallColor: string
  floorId: string
  items: PlacedItem[]
  selectedUid: string | null
  view: ViewMode
  dragging: boolean
  setRoom: (patch: Partial<Room>) => void
  setWallColor: (hex: string) => void
  setFloor: (id: string) => void
  addItem: (modelId: string) => void
  moveItem: (uid: string, x: number, z: number) => void
  rotateItem: (uid: string, delta: number) => void
  setRotation: (uid: string, rot: number) => void
  duplicateItem: (uid: string) => void
  removeItem: (uid: string) => void
  select: (uid: string | null) => void
  setView: (v: ViewMode) => void
  setDragging: (d: boolean) => void
  resetProject: () => void
}

const uid = () => Math.random().toString(36).slice(2, 10)

/** Demi-encombrement au sol d'un meuble après rotation. */
export function halfExtents(modelId: string, rot: number) {
  const c = CATALOG_BY_ID[modelId]
  if (!c) return { hx: 0.25, hz: 0.25 }
  const cos = Math.abs(Math.cos(rot))
  const sin = Math.abs(Math.sin(rot))
  return {
    hx: (cos * c.width + sin * c.depth) / 2,
    hz: (sin * c.width + cos * c.depth) / 2,
  }
}

/** Garde un meuble à l'intérieur de la pièce. */
export function clampToRoom(item: Pick<PlacedItem, 'modelId' | 'x' | 'z' | 'rot'>, room: Room) {
  const { hx, hz } = halfExtents(item.modelId, item.rot)
  const limX = Math.max(0, room.width / 2 - hx)
  const limZ = Math.max(0, room.depth / 2 - hz)
  return {
    x: Math.min(limX, Math.max(-limX, item.x)),
    z: Math.min(limZ, Math.max(-limZ, item.z)),
  }
}

const normAngle = (a: number) => {
  const t = Math.PI * 2
  return ((a % t) + t) % t
}

const DEFAULT_ROOM: Room = { width: 5, depth: 4.2, height: 2.6 }

const defaultItems = (): PlacedItem[] => [
  { uid: uid(), modelId: 'rug_wool', x: -0.55, z: 0.45, rot: 0 },
  { uid: uid(), modelId: 'sofa_lin', x: -0.55, z: 1.55, rot: Math.PI },
  { uid: uid(), modelId: 'modern_coffee_table_01', x: -0.55, z: 0.4, rot: 0 },
  { uid: uid(), modelId: 'mid_century_lounge_chair', x: -1.85, z: -0.55, rot: Math.PI / 2 - 0.45 },
  { uid: uid(), modelId: 'modern_wooden_cabinet', x: -0.9, z: -1.83, rot: 0 },
  { uid: uid(), modelId: 'potted_plant_02', x: -2.1, z: 1.72, rot: 0.6 },
  { uid: uid(), modelId: 'wooden_display_shelves_01', x: 2.3, z: -0.55, rot: -Math.PI / 2 },
  { uid: uid(), modelId: 'wooden_table_02', x: 1.15, z: -0.75, rot: 0 },
  { uid: uid(), modelId: 'dining_chair_02', x: 1.15, z: -1.32, rot: 0 },
  { uid: uid(), modelId: 'dining_chair_02', x: 1.15, z: -0.18, rot: Math.PI },
]

/** Accès au stockage du navigateur protégé (navigation privée, stockage bloqué…). */
const safeStorage: StateStorage = {
  getItem: (k) => {
    try { return localStorage.getItem(k) } catch { return null }
  },
  setItem: (k, v) => {
    try { localStorage.setItem(k, v) } catch { /* stockage indisponible */ }
  },
  removeItem: (k) => {
    try { localStorage.removeItem(k) } catch { /* stockage indisponible */ }
  },
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      room: DEFAULT_ROOM,
      wallColor: WALL_COLORS[0].hex,
      floorId: FLOORS[0].id,
      items: defaultItems(),
      selectedUid: null,
      view: '3d',
      dragging: false,

      setRoom: (patch) =>
        set((s) => {
          const room = { ...s.room, ...patch }
          room.width = Math.min(ROOM_LIMITS.max, Math.max(ROOM_LIMITS.min, room.width))
          room.depth = Math.min(ROOM_LIMITS.max, Math.max(ROOM_LIMITS.min, room.depth))
          room.height = Math.min(ROOM_LIMITS.maxHeight, Math.max(ROOM_LIMITS.minHeight, room.height))
          // Les meubles restent dans la pièce quand elle rétrécit
          const items = s.items.map((it) => ({ ...it, ...clampToRoom(it, room) }))
          return { room, items }
        }),
      setWallColor: (wallColor) => set({ wallColor }),
      setFloor: (floorId) => set({ floorId }),

      addItem: (modelId) => {
        const { room, items } = get()
        // Petit décalage pour ne pas empiler exactement les meubles ajoutés
        const n = items.length % 5
        const base = { modelId, x: (n - 2) * 0.15, z: (n - 2) * 0.15, rot: 0 }
        const item: PlacedItem = { uid: uid(), ...base, ...clampToRoom(base, room) }
        set({ items: [...items, item], selectedUid: item.uid })
      },
      moveItem: (id, x, z) =>
        set((s) => ({
          items: s.items.map((it) => (it.uid === id ? { ...it, ...clampToRoom({ ...it, x, z }, s.room) } : it)),
        })),
      rotateItem: (id, delta) => {
        const it = get().items.find((i) => i.uid === id)
        if (it) get().setRotation(id, it.rot + delta)
      },
      setRotation: (id, rot) =>
        set((s) => ({
          items: s.items.map((it) => {
            if (it.uid !== id) return it
            const next = { ...it, rot: normAngle(rot) }
            return { ...next, ...clampToRoom(next, s.room) }
          }),
        })),
      duplicateItem: (id) => {
        const { items, room } = get()
        const it = items.find((i) => i.uid === id)
        if (!it) return
        const base = { ...it, x: it.x + 0.3, z: it.z + 0.3 }
        const copy: PlacedItem = { ...base, uid: uid(), ...clampToRoom(base, room) }
        set({ items: [...items, copy], selectedUid: copy.uid })
      },
      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.uid !== id), selectedUid: s.selectedUid === id ? null : s.selectedUid })),
      select: (selectedUid) => set({ selectedUid }),
      setView: (view) => set({ view }),
      setDragging: (dragging) => set({ dragging }),
      resetProject: () =>
        set({ room: DEFAULT_ROOM, wallColor: WALL_COLORS[0].hex, floorId: FLOORS[0].id, items: defaultItems(), selectedUid: null }),
    }),
    {
      name: 'interieur3d-projet-v2',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ room: s.room, wallColor: s.wallColor, floorId: s.floorId, items: s.items, view: s.view }),
    },
  ),
)
