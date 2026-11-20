// État global de l'application : écran affiché, projet ouvert, version en cours
// d'édition, sélection, historique (annuler / rétablir) et enregistrement.
import { create } from 'zustand'
import { CUSTOM_PREFIX, getItem, registerCustomFurniture } from './data/catalog'
import { clampOffset, clampToRoom, snapPosition } from './model/geometry'
import { loadInspirations, loadMyFurniture, loadProjects, saveInspirations, saveMyFurniture, saveProjects, deleteImage } from './model/storage'
import { startLayout, type StartKind } from './model/templates'
import type { Inspiration, ItemDims, ItemStatus, Layout, MyFurniture, Opening, OpeningKind, PlacedItem, Project, RefImage, Room, RoomType, Selection, ViewMode, WallSide } from './model/types'
import { uid } from './model/types'

export type { Layout, Opening, PlacedItem, Room, ViewMode, WallSide } from './model/types'

export const ROOM_LIMITS = { min: 1.5, max: 12, minHeight: 2.2, maxHeight: 4 }

export type Screen = 'accueil' | 'assistant' | 'editeur'

const HISTORY_MAX = 60

interface State {
  screen: Screen
  projects: Project[]
  inspirations: Inspiration[]
  projectId: string | null
  /** Copie de travail de la version ouverte */
  layout: Layout
  past: Layout[]
  future: Layout[]
  selection: Selection
  view: ViewMode
  dragging: boolean
  snap: { grid: boolean; walls: boolean }
  /** Image de référence affichée à côté de la pièce */
  pinnedImage: string | null
  /** Moment du dernier enregistrement (pour la confirmation « Enregistré ») */
  savedAt: number
  dirty: boolean
  /** Meubles ajoutés par l'utilisateur (communs à tous les projets) */
  myFurniture: MyFurniture[]
  /** Remplacement en cours d'aperçu (non confirmé) */
  preview: { uid: string; item: PlacedItem } | null
  /** Aménagement complet en aperçu (proposition de l'assistant), affiché à la place de la version */
  layoutPreview: Layout | null

  // Navigation et projets
  goHome: () => void
  startWizard: () => void
  createProject: (p: { name: string; roomType: RoomType; start: StartKind; room: Room; references: RefImage[] }) => void
  openProject: (id: string) => void
  deleteProject: (id: string) => void
  renameProject: (name: string) => void
  addReference: (ref: RefImage) => void
  removeReference: (id: string) => void
  save: (thumb?: string) => void

  // Versions
  duplicateVersion: () => void
  switchVersion: (id: string) => void
  renameVersion: (id: string, name: string) => void
  deleteVersion: (id: string) => void

  // Historique
  record: (key?: string) => void
  undo: () => void
  redo: () => void

  // Pièce
  setRoom: (patch: Partial<Room>) => void
  setWallColor: (side: WallSide, hex: string) => void
  setAllWallsColor: (hex: string) => void
  setFloor: (id: string) => void

  // Ouvertures
  addOpening: (kind: OpeningKind, wall: WallSide) => void
  updateOpening: (id: string, patch: Partial<Opening>, key?: string) => void
  removeOpening: (id: string) => void

  // Meubles
  addItem: (modelId: string) => void
  moveItem: (uid: string, x: number, z: number) => void
  rotateItem: (uid: string, delta: number) => void
  setRotation: (uid: string, rot: number) => void
  setItemColor: (uid: string, color: string | null) => void
  setItemDims: (uid: string, dims: ItemDims | undefined) => void
  toggleLock: (uid: string) => void
  duplicateItem: (uid: string) => void
  removeItem: (uid: string) => void

  // Interface
  select: (s: Selection) => void
  setView: (v: ViewMode) => void
  setDragging: (d: boolean) => void
  setSnap: (patch: Partial<State['snap']>) => void
  pinImage: (id: string | null) => void

  // Statut et prix
  setItemStatus: (uid: string, status: ItemStatus) => void
  setItemPrice: (uid: string, price: number | null) => void

  // Remplacement
  previewReplace: (uid: string, modelId: string) => void
  cancelPreview: () => void
  confirmReplace: () => void

  // Assistant
  ideaOpen: boolean
  setIdeaOpen: (v: boolean) => void
  setLayoutPreview: (l: Layout | null) => void
  applyLayoutAsVersion: (l: Layout) => void

  // Mes meubles
  saveMyFurniture: (f: MyFurniture) => void
  removeMyFurniture: (id: string) => void
  placeMyFurniture: (id: string) => void

  // Inspirations
  addInspiration: (i: Omit<Inspiration, 'id' | 'createdAt'>) => void
  updateInspiration: (id: string, patch: Partial<Inspiration>) => void
  removeInspiration: (id: string) => void
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const normAngle = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)

let lastRecord = { key: '', time: 0 }
let autosaveTimer: ReturnType<typeof setTimeout> | undefined

const initialProjects = loadProjects()
const initialFurniture = loadMyFurniture()
registerCustomFurniture(initialFurniture)

export const useStore = create<State>()((set, get) => {
  /** Modifie la version en cours après avoir mémorisé l'état précédent (pour « Annuler »). */
  const edit = (key: string, fn: (l: Layout) => void) => {
    get().record(key)
    const l = clone(get().layout)
    fn(l)
    l.updatedAt = Date.now()
    set({ layout: l, dirty: true })
    clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => get().save(), 1500)
  }

  const persistProject = (mutate: (p: Project) => void) => {
    const { projectId } = get()
    const projects = get().projects.map((p) => {
      if (p.id !== projectId) return p
      const copy = clone(p)
      mutate(copy)
      copy.updatedAt = Date.now()
      return copy
    })
    saveProjects(projects)
    set({ projects })
  }

  return {
    screen: initialProjects.length ? 'accueil' : 'accueil',
    projects: initialProjects,
    inspirations: loadInspirations(),
    projectId: null,
    layout: startLayout('exemple', 'chambre', { width: 3.6, depth: 4, height: 2.5 }),
    past: [],
    future: [],
    selection: null,
    view: 'plan',
    dragging: false,
    snap: { grid: false, walls: true },
    pinnedImage: null,
    savedAt: 0,
    dirty: false,
    myFurniture: initialFurniture,
    preview: null,
    layoutPreview: null,
    ideaOpen: false,
    setIdeaOpen: (ideaOpen) => set({ ideaOpen, ...(ideaOpen ? { selection: null } : { layoutPreview: null }) }),

    goHome: () => {
      if (get().projectId && get().dirty) get().save()
      set({ screen: 'accueil', selection: null, pinnedImage: null, ideaOpen: false, layoutPreview: null })
    },
    startWizard: () => set({ screen: 'assistant' }),

    createProject: ({ name, roomType, start, room, references }) => {
      const layout = startLayout(start, roomType, room)
      const project: Project = {
        id: uid(),
        name: name.trim() || 'Mon espace',
        roomType,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        versions: [layout],
        activeVersionId: layout.id,
        references,
      }
      const projects = [project, ...get().projects]
      saveProjects(projects)
      set({ projects, projectId: project.id, layout: clone(layout), past: [], future: [], selection: null, screen: 'editeur', view: 'plan', dirty: false, savedAt: 0 })
    },

    openProject: (id) => {
      const p = get().projects.find((x) => x.id === id)
      if (!p) return
      const v = p.versions.find((x) => x.id === p.activeVersionId) ?? p.versions[0]
      set({ projectId: id, layout: clone(v), past: [], future: [], selection: null, screen: 'editeur', dirty: false, savedAt: 0 })
    },

    deleteProject: (id) => {
      const p = get().projects.find((x) => x.id === id)
      p?.references.forEach((r) => deleteImage(r.id))
      const projects = get().projects.filter((x) => x.id !== id)
      saveProjects(projects)
      set({ projects })
    },

    renameProject: (name) => persistProject((p) => (p.name = name.trim() || p.name)),

    addReference: (ref) => persistProject((p) => p.references.push(ref)),
    removeReference: (id) => {
      deleteImage(id)
      persistProject((p) => (p.references = p.references.filter((r) => r.id !== id)))
      if (get().pinnedImage === id) set({ pinnedImage: null })
    },

    save: (thumb) => {
      clearTimeout(autosaveTimer)
      const layout = clone(get().layout)
      if (thumb) layout.thumb = thumb
      persistProject((p) => {
        p.versions = p.versions.map((v) => (v.id === layout.id ? layout : v))
        p.activeVersionId = layout.id
      })
      set({ savedAt: Date.now(), dirty: false, layout: thumb ? { ...get().layout, thumb } : get().layout })
    },

    duplicateVersion: () => {
      get().save()
      const p = get().projects.find((x) => x.id === get().projectId)
      if (!p) return
      const copy = clone(get().layout)
      copy.id = uid()
      copy.name = `Version ${p.versions.length + 1}`
      copy.updatedAt = Date.now()
      persistProject((pp) => {
        pp.versions.push(copy)
        pp.activeVersionId = copy.id
      })
      set({ layout: copy, past: [], future: [], selection: null, savedAt: Date.now(), dirty: false })
    },

    switchVersion: (id) => {
      if (id === get().layout.id) return
      get().save()
      const p = get().projects.find((x) => x.id === get().projectId)
      const v = p?.versions.find((x) => x.id === id)
      if (!v) return
      persistProject((pp) => (pp.activeVersionId = id))
      set({ layout: clone(v), past: [], future: [], selection: null, dirty: false })
    },

    renameVersion: (id, name) => {
      if (id === get().layout.id) set({ layout: { ...get().layout, name } })
      persistProject((p) => p.versions.forEach((v) => v.id === id && (v.name = name.trim() || v.name)))
    },

    deleteVersion: (id) => {
      const p = get().projects.find((x) => x.id === get().projectId)
      if (!p || p.versions.length < 2) return
      const remaining = p.versions.filter((v) => v.id !== id)
      persistProject((pp) => {
        pp.versions = pp.versions.filter((v) => v.id !== id)
        if (pp.activeVersionId === id) pp.activeVersionId = remaining[0].id
      })
      if (get().layout.id === id) set({ layout: clone(remaining[0]), past: [], future: [], selection: null })
    },

    record: (key = '') => {
      const now = performance.now()
      // Une série de petits changements rapprochés (glisser, curseur) = un seul pas d'historique
      if (key && key === lastRecord.key && now - lastRecord.time < 900) {
        lastRecord.time = now
        return
      }
      lastRecord = { key, time: now }
      const past = [...get().past, clone(get().layout)].slice(-HISTORY_MAX)
      set({ past, future: [] })
    },
    undo: () => {
      const { past, future, layout } = get()
      if (!past.length) return
      lastRecord = { key: '', time: 0 }
      set({ layout: past[past.length - 1], past: past.slice(0, -1), future: [clone(layout), ...future], selection: null, dirty: true })
      clearTimeout(autosaveTimer)
      autosaveTimer = setTimeout(() => get().save(), 1500)
    },
    redo: () => {
      const { past, future, layout } = get()
      if (!future.length) return
      lastRecord = { key: '', time: 0 }
      set({ layout: future[0], future: future.slice(1), past: [...past, clone(layout)], selection: null, dirty: true })
      clearTimeout(autosaveTimer)
      autosaveTimer = setTimeout(() => get().save(), 1500)
    },

    setRoom: (patch) =>
      edit('room', (l) => {
        const r = { ...l.room, ...patch }
        r.width = Math.min(ROOM_LIMITS.max, Math.max(ROOM_LIMITS.min, r.width))
        r.depth = Math.min(ROOM_LIMITS.max, Math.max(ROOM_LIMITS.min, r.depth))
        r.height = Math.min(ROOM_LIMITS.maxHeight, Math.max(ROOM_LIMITS.minHeight, r.height))
        l.room = r
        l.items = l.items.map((it) => ({ ...it, ...clampToRoom(it, r) }))
        l.openings = l.openings.map((o) => {
          const width = Math.min(o.width, (o.wall === 'nord' || o.wall === 'sud' ? r.width : r.depth) - 0.2)
          return { ...o, width, height: Math.min(o.height, r.height - o.sill - 0.05), offset: clampOffset(r, { ...o, width }, o.offset) }
        })
      }),
    setWallColor: (side, hex) => edit(`mur-${side}`, (l) => (l.wallColors[side] = hex)),
    setAllWallsColor: (hex) => edit('murs', (l) => (Object.keys(l.wallColors) as WallSide[]).forEach((s) => (l.wallColors[s] = hex))),
    setFloor: (id) => edit('sol', (l) => (l.floorId = id)),

    addOpening: (kind, wall) => {
      const defaults: Record<OpeningKind, Omit<Opening, 'id' | 'wall' | 'offset' | 'kind'>> = {
        fenetre: { width: 1.2, height: 1.35, sill: 0.9 },
        'porte-fenetre': { width: 1.4, height: 2.15, sill: 0, swing: 'interieur' },
        porte: { width: 0.83, height: 2.04, sill: 0, hinge: 'droite', swing: 'interieur' },
        placard: { width: 1.2, height: 2.3, sill: 0, depth: 0.6 },
        niche: { width: 0.8, height: 0.9, sill: 0.9, depth: 0.1 },
      }
      const id = uid()
      edit('ouverture-ajout', (l) => {
        const d = defaults[kind]
        const len = wall === 'nord' || wall === 'sud' ? l.room.width : l.room.depth
        const width = Math.min(d.width, len - 0.3)
        const height = Math.min(d.height, l.room.height - d.sill - 0.1)
        // Cherche une place libre le long du mur
        const others = l.openings.filter((o) => o.wall === wall)
        let offset = 0
        for (const cand of [0, -len / 4, len / 4, -len / 3, len / 3]) {
          if (others.every((o) => Math.abs(o.offset - cand) > (o.width + width) / 2 + 0.05)) {
            offset = cand
            break
          }
        }
        l.openings.push({ id, kind, wall, ...d, width, height, offset: clampOffset(l.room, { wall, width }, offset) })
      })
      set({ selection: { type: 'opening', id } })
    },
    updateOpening: (id, patch, key) =>
      edit(key ?? `ouverture-${id}`, (l) => {
        l.openings = l.openings.map((o) => {
          if (o.id !== id) return o
          const n = { ...o, ...patch }
          const len = n.wall === 'nord' || n.wall === 'sud' ? l.room.width : l.room.depth
          n.width = Math.max(0.3, Math.min(n.width, len - 0.1))
          n.sill = Math.max(0, Math.min(n.sill, l.room.height - 0.3))
          n.height = Math.max(0.3, Math.min(n.height, l.room.height - n.sill - (n.kind === 'placard' ? 0 : 0.05)))
          n.offset = clampOffset(l.room, n, n.offset)
          return n
        })
      }),
    removeOpening: (id) => {
      edit('ouverture-suppr', (l) => (l.openings = l.openings.filter((o) => o.id !== id)))
      set({ selection: null })
    },

    addItem: (modelId) => {
      const { layout } = get()
      const n = layout.items.length % 5
      const base = { modelId, x: (n - 2) * 0.15, z: (n - 2) * 0.15, rot: 0 }
      const it: PlacedItem = { uid: uid(), ...base, ...clampToRoom(base, layout.room) }
      // Un meuble trouvé sur Internet est a priori à acheter ; un meuble du catalogue représente souvent un meuble déjà là
      if (modelId.startsWith(CUSTOM_PREFIX)) it.status = 'a-acheter'
      edit('ajout', (l) => l.items.push(it))
      set({ selection: { type: 'item', id: it.uid } })
    },
    moveItem: (id, x, z) =>
      edit(`deplacer-${id}`, (l) => {
        l.items = l.items.map((it) => {
          if (it.uid !== id || it.locked) return it
          const s = snapPosition(it, x, z, l.room, get().snap)
          return { ...it, ...clampToRoom({ ...it, ...s }, l.room) }
        })
      }),
    rotateItem: (id, delta) => {
      const it = get().layout.items.find((i) => i.uid === id)
      if (it) get().setRotation(id, it.rot + delta)
    },
    setRotation: (id, rot) =>
      edit(`tourner-${id}`, (l) => {
        l.items = l.items.map((it) => {
          if (it.uid !== id || it.locked) return it
          const n = { ...it, rot: normAngle(rot) }
          return { ...n, ...clampToRoom(n, l.room) }
        })
      }),
    setItemColor: (id, color) => edit(`couleur-${id}`, (l) => l.items.forEach((it) => it.uid === id && (it.color = color))),
    setItemDims: (id, dims) =>
      edit(`dims-${id}`, (l) => {
        l.items = l.items.map((it) => {
          if (it.uid !== id) return it
          const n = { ...it, dims: dims && { width: Math.max(0.1, dims.width), depth: Math.max(0.05, dims.depth), height: Math.max(0.01, dims.height) } }
          return { ...n, ...clampToRoom(n, l.room) }
        })
      }),
    toggleLock: (id) => edit(`verrou-${id}`, (l) => l.items.forEach((it) => it.uid === id && (it.locked = !it.locked))),
    duplicateItem: (id) => {
      const it = get().layout.items.find((i) => i.uid === id)
      if (!it) return
      const base = { ...clone(it), x: it.x + 0.3, z: it.z + 0.3, locked: false }
      const copy: PlacedItem = { ...base, uid: uid(), ...clampToRoom(base, get().layout.room) }
      edit('dupliquer', (l) => l.items.push(copy))
      set({ selection: { type: 'item', id: copy.uid } })
    },
    removeItem: (id) => {
      edit('supprimer', (l) => (l.items = l.items.filter((i) => i.uid !== id)))
      set({ selection: null })
    },

    // Pendant l'aperçu d'une proposition de l'assistant, la pièce est en lecture seule
    select: (selection) => {
      if (get().layoutPreview && selection) return
      set({ selection, preview: null })
    },
    setView: (view) => set({ view }),
    setDragging: (dragging) => set({ dragging }),
    setSnap: (patch) => set({ snap: { ...get().snap, ...patch } }),
    pinImage: (pinnedImage) => set({ pinnedImage }),

    setItemStatus: (id, status) => edit(`statut-${id}`, (l) => l.items.forEach((it) => it.uid === id && (it.status = status))),
    setItemPrice: (id, price) => edit(`prix-${id}`, (l) => l.items.forEach((it) => it.uid === id && (it.price = price))),

    previewReplace: (id, modelId) => {
      const old = get().layout.items.find((i) => i.uid === id)
      if (!old) return
      const base: PlacedItem = { ...old, modelId, dims: undefined, color: null, price: null, locked: false }
      set({ preview: { uid: id, item: { ...base, ...clampToRoom(base, get().layout.room) } } })
    },
    cancelPreview: () => set({ preview: null }),
    confirmReplace: () => {
      const p = get().preview
      if (!p) return
      edit('remplacer', (l) => {
        l.items = l.items.map((it) => (it.uid === p.uid ? { ...p.item, status: 'a-acheter' } : it))
      })
      set({ preview: null })
    },

    setLayoutPreview: (layoutPreview) => set({ layoutPreview, selection: null, preview: null }),
    applyLayoutAsVersion: (l) => {
      // La version actuelle est gardée telle quelle : la proposition devient une nouvelle version
      get().save()
      const copy = clone(l)
      copy.id = uid()
      copy.updatedAt = Date.now()
      persistProject((pp) => {
        pp.versions.push(copy)
        pp.activeVersionId = copy.id
      })
      set({ layout: copy, layoutPreview: null, past: [], future: [], selection: null, savedAt: Date.now(), dirty: false })
    },

    saveMyFurniture: (f) => {
      const exists = get().myFurniture.some((x) => x.id === f.id)
      const myFurniture = exists ? get().myFurniture.map((x) => (x.id === f.id ? f : x)) : [f, ...get().myFurniture]
      registerCustomFurniture(myFurniture)
      saveMyFurniture(myFurniture)
      // Rafraîchit la pièce si ce meuble y est déjà placé
      set({ myFurniture, layout: { ...get().layout } })
    },
    removeMyFurniture: (id) => {
      const f = get().myFurniture.find((x) => x.id === id)
      if (f?.imageId) deleteImage(f.imageId)
      const myFurniture = get().myFurniture.filter((x) => x.id !== id)
      saveMyFurniture(myFurniture)
      // Les exemplaires déjà placés restent affichés tant que la fiche existe : on les retire aussi
      const modelId = CUSTOM_PREFIX + id
      if (get().layout.items.some((it) => it.modelId === modelId)) edit('supprimer-meuble', (l) => (l.items = l.items.filter((it) => it.modelId !== modelId)))
      registerCustomFurniture(myFurniture)
      set({ myFurniture })
    },
    placeMyFurniture: (id) => {
      get().addItem(CUSTOM_PREFIX + id)
      const f = get().myFurniture.find((x) => x.id === id)
      const sel = get().selection
      if (f?.owned && sel?.type === 'item') {
        set({ layout: { ...get().layout, items: get().layout.items.map((it) => (it.uid === sel.id ? { ...it, status: 'possede' as const } : it)) } })
      }
    },

    addInspiration: (i) => {
      const inspirations = [{ ...i, id: uid(), createdAt: Date.now() }, ...get().inspirations]
      saveInspirations(inspirations)
      set({ inspirations })
    },
    updateInspiration: (id, patch) => {
      const inspirations = get().inspirations.map((i) => (i.id === id ? { ...i, ...patch } : i))
      saveInspirations(inspirations)
      set({ inspirations })
    },
    removeInspiration: (id) => {
      const insp = get().inspirations.find((i) => i.id === id)
      if (insp?.imageId) deleteImage(insp.imageId)
      const inspirations = get().inspirations.filter((i) => i.id !== id)
      saveInspirations(inspirations)
      set({ inspirations, pinnedImage: get().pinnedImage === insp?.imageId ? null : get().pinnedImage })
    },
  }
})

/** Aménagement affiché dans la 3D : l'aperçu d'une proposition s'il y en a un, sinon la version en cours. */
export const shownLayout = (s: { layout: Layout; layoutPreview: Layout | null }) => s.layoutPreview ?? s.layout

/** Projet ouvert. */
export const useProject = () => useStore((s) => s.projects.find((p) => p.id === s.projectId) ?? null)

export const catalogOf = (it: PlacedItem) => getItem(it.modelId)
