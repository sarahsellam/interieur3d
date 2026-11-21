// État de l'éditeur de plan d'appartement (séparé de l'éditeur de pièce).
import { create } from 'zustand'
import { deleteImage, imageSize, loadPlans, savePlans } from './model/storage'
import { WALL_THICKNESS, clonePlan, newPlan, type FloorPlan, type PlanOpeningKind, type XZ } from './model/plan'

export type PlanTool = 'echelle' | 'murs' | 'ouvertures' | 'pieces' | 'selection'
export type PlanView = 'plan' | '3d' | 'yeux'
export type ChainPoint = { x: number; z: number; pointId?: string; onWall?: string }
export type PlanSelection = { type: 'point' | 'wall' | 'opening' | 'label'; id: string } | null

const HISTORY_MAX = 80
let autosave: ReturnType<typeof setTimeout> | undefined
let last = { key: '', time: 0 }

interface PlanState {
  plans: FloorPlan[]
  plan: FloorPlan | null
  past: FloorPlan[]
  future: FloorPlan[]
  tool: PlanTool
  view: PlanView
  selection: PlanSelection
  /** Dernier angle posé pendant le tracé d'une suite de murs (pas encore enregistré pour le premier) */
  chain: ChainPoint | null
  panelOpen: boolean
  setPanelOpen: (v: boolean) => void
  /** Points de la mesure d'échelle en cours */
  calib: XZ[]
  openingKind: PlanOpeningKind
  thickness: number
  savedAt: number

  reload: () => void
  createPlan: (name: string, imageId?: string) => Promise<void>
  openPlan: (id: string) => void
  save: () => void
  closePlan: () => void
  deletePlan: (id: string) => void
  rename: (name: string) => void
  /** Modifie le plan (avec mémoire pour « Annuler ») ; la clé regroupe les petits changements rapides */
  edit: (key: string, fn: (p: FloorPlan) => void) => void
  undo: () => void
  redo: () => void
  setTool: (t: PlanTool) => void
  setView: (v: PlanView) => void
  select: (s: PlanSelection) => void
  setChain: (c: ChainPoint | null) => void
  setCalib: (pts: XZ[]) => void
  setOpeningKind: (k: PlanOpeningKind) => void
  setThickness: (t: number) => void
}

export const usePlanStore = create<PlanState>()((set, get) => {
  const persist = (plan: FloorPlan) => {
    const plans = [plan, ...get().plans.filter((p) => p.id !== plan.id)]
    savePlans(plans)
    set({ plans })
  }
  return {
    plans: loadPlans(),
    plan: null,
    past: [],
    future: [],
    tool: 'murs',
    view: 'plan',
    selection: null,
    chain: null,
    calib: [],
    openingKind: 'porte',
    thickness: WALL_THICKNESS.standard,
    savedAt: 0,
    panelOpen: typeof window === 'undefined' || window.innerWidth > 860,

    reload: () => set({ plans: loadPlans() }),

    createPlan: async (name, imageId) => {
      const size = imageId ? await imageSize(imageId) : null
      const plan = newPlan(name.trim() || 'Mon appartement', imageId && size ? { id: imageId, widthPx: size.width, heightPx: size.height } : undefined)
      persist(plan)
      // Avec une image : on commence par l'échelle ; sans image : directement les murs
      set({ plan: clonePlan(plan), past: [], future: [], selection: null, chain: null, calib: [], tool: plan.image ? 'echelle' : 'murs', view: 'plan' })
    },

    openPlan: (id) => {
      const p = get().plans.find((x) => x.id === id)
      if (!p) return
      set({ plan: clonePlan(p), past: [], future: [], selection: null, chain: null, calib: [], tool: p.walls.length ? 'selection' : p.image && !p.image.calibrated ? 'echelle' : 'murs', view: 'plan' })
    },

    save: () => {
      const p = get().plan
      if (!p) return
      clearTimeout(autosave)
      persist(clonePlan(p))
      set({ savedAt: Date.now() })
    },

    closePlan: () => {
      if (get().plan) get().save()
      set({ plan: null, selection: null, chain: null, calib: [] })
    },

    deletePlan: (id) => {
      const p = get().plans.find((x) => x.id === id)
      if (p?.image) deleteImage(p.image.id)
      const plans = get().plans.filter((x) => x.id !== id)
      savePlans(plans)
      set({ plans })
    },

    rename: (name) => get().edit('nom', (p) => (p.name = name.trim() || p.name)),

    edit: (key, fn) => {
      const cur = get().plan
      if (!cur) return
      const now = Date.now()
      const merge = key === last.key && now - last.time < 900
      last = { key, time: now }
      const next = clonePlan(cur)
      fn(next)
      next.updatedAt = now
      set({
        plan: next,
        past: merge ? get().past : [...get().past, cur].slice(-HISTORY_MAX),
        future: [],
      })
      clearTimeout(autosave)
      autosave = setTimeout(() => get().save(), 1200)
    },

    undo: () => {
      const { past, plan, future } = get()
      if (!past.length || !plan) return
      last = { key: '', time: 0 }
      set({ plan: past[past.length - 1], past: past.slice(0, -1), future: [plan, ...future], selection: null, chain: null })
      clearTimeout(autosave)
      autosave = setTimeout(() => get().save(), 1200)
    },
    redo: () => {
      const { past, plan, future } = get()
      if (!future.length || !plan) return
      last = { key: '', time: 0 }
      set({ plan: future[0], future: future.slice(1), past: [...past, plan], selection: null, chain: null })
      clearTimeout(autosave)
      autosave = setTimeout(() => get().save(), 1200)
    },

    setTool: (tool) => set({ tool, chain: null, calib: [], selection: null }),
    setView: (view) => set({ view, chain: null }),
    select: (selection) => set({ selection }),
    setChain: (chain) => set({ chain }),
    setPanelOpen: (panelOpen) => set({ panelOpen }),
    setCalib: (calib) => set({ calib }),
    setOpeningKind: (openingKind) => set({ openingKind }),
    setThickness: (thickness) => set({ thickness }),
  }
})

// Aide aux tests automatiques (version de développement uniquement)
if (import.meta.env.DEV) (window as unknown as { __planStore: typeof usePlanStore }).__planStore = usePlanStore
