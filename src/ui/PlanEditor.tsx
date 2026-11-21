// Éditeur de plan d'appartement :
// 1. Échelle : toucher les deux bouts d'une cote connue, saisir sa longueur réelle.
// 2. Murs : toucher chaque angle, l'un après l'autre (aimantation d'équerre et sur les angles existants).
// 3. Portes et fenêtres : toucher un mur.
// 4. Pièces : chaque zone fermée est détectée ; on la nomme d'un toucher.
// Puis : visite en 3D de tout l'appartement, et « Aménager cette pièce » pour passer à l'éditeur de pièce.
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import {
  PLAN_OPENING_DEFAULTS,
  PLAN_OPENING_LABEL,
  ROOM_NAMES,
  WALL_THICKNESS,
  addPoint,
  addWall,
  calibrate,
  clampOpenings,
  dist,
  findFaces,
  faceAnchor,
  nearestPoint,
  nearestWall,
  planBounds,
  pointInPolygon,
  projectOnSeg,
  removePoint,
  removeWall,
  roomFromFace,
  setWallLength,
  snapPoint,
  wallSeg,
  wallSegs,
  type Face,
  type FloorPlan,
  type PlanOpeningKind,
  type XZ,
} from '../model/plan'
import { imageSize, imageUrl, putImage } from '../model/storage'
import { uid, type RefImage } from '../model/types'
import { usePlanStore, type PlanTool } from '../planStore'
import { ROOM_LIMITS, useStore } from '../store'
import { Icon, ImportButton, MeasureField } from './common'
import { PlanContent, fmtLen, usePlanImage } from './PlanDrawing'

const SNAP_PX = 22
const BORD = '#742f45'

type Cam = { cx: number; cz: number; s: number }

function useElementSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [ref])
  return size
}

/** Zone visible de l'écran une fois retirés la barre du haut et le panneau. */
function visibleFrame(w: number, h: number, panelOpen: boolean) {
  const narrow = w <= 860
  const top = narrow ? 104 : 60
  const left = narrow ? 0 : 354
  const bottom = narrow ? (panelOpen ? h * 0.44 : 96) + 56 : 0
  return { left, top, width: Math.max(80, w - left), height: Math.max(80, h - top - bottom) }
}

function fitCam(plan: FloorPlan, w: number, h: number, panelOpen: boolean): Cam {
  const b = planBounds(plan)
  const f = visibleFrame(w, h, panelOpen)
  const m = 48
  const bw = Math.max(2, b.maxX - b.minX)
  const bh = Math.max(2, b.maxZ - b.minZ)
  const s = Math.max(4, Math.min(400, Math.min((f.width - 2 * m) / bw, (f.height - 2 * m) / bh)))
  const scrX = f.left + f.width / 2
  const scrY = f.top + f.height / 2
  return { s, cx: (b.minX + b.maxX) / 2 - (scrX - w / 2) / s, cz: (b.minZ + b.maxZ) / 2 - (scrY - h / 2) / s }
}

// ---------------------------------------------------------------- Zone de dessin

type Gesture =
  | { mode: 'none' }
  | { mode: 'pan'; sx: number; sy: number; cam: Cam }
  | { mode: 'pinch'; d: number; mid: { x: number; y: number }; cam: Cam }
  | { mode: 'place'; sx: number; sy: number; touch: boolean }
  | { mode: 'tap'; sx: number; sy: number; cam: Cam; moved: boolean }
  | { mode: 'point'; id: string; key: string }
  | { mode: 'opening'; id: string; key: string; grab: number }
  | { mode: 'label'; id: string; key: string; dx: number; dz: number }

function PlanCanvas() {
  const plan = usePlanStore((s) => s.plan)!
  const tool = usePlanStore((s) => s.tool)
  const sel = usePlanStore((s) => s.selection)
  const chain = usePlanStore((s) => s.chain)
  const calib = usePlanStore((s) => s.calib)
  const wrapRef = useRef<HTMLDivElement>(null)
  const { w, h } = useElementSize(wrapRef)
  const [cam, setCam] = useState<Cam | null>(null)
  const [cursor, setCursor] = useState<XZ | null>(null)
  const [loupe, setLoupe] = useState<{ x: number; y: number } | null>(null)
  const gesture = useRef<Gesture>({ mode: 'none' })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const faces = useMemo(() => findFaces(plan), [plan])
  const href = usePlanImage(plan)

  // Cadrage initial (et bouton « Recentrer »)
  const fitKey = usePlanStore((s) => s.plan?.id)
  const [fitTick, setFitTick] = useState(0)
  useEffect(() => {
    if (w && h) setCam(fitCam(usePlanStore.getState().plan!, w, h, usePlanStore.getState().panelOpen))
  }, [fitKey, w > 0, h > 0, fitTick]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const f = () => setFitTick((t) => t + 1)
    window.addEventListener('plan-recentrer', f)
    return () => window.removeEventListener('plan-recentrer', f)
  }, [])

  const toWorld = useCallback(
    (clientX: number, clientY: number): XZ => {
      const r = wrapRef.current!.getBoundingClientRect()
      const c = cam!
      return { x: c.cx + (clientX - r.left - w / 2) / c.s, z: c.cz + (clientY - r.top - h / 2) / c.s }
    },
    [cam, w, h],
  )

  if (!cam || !w) return <div className="plan-canvas" ref={wrapRef} />
  const px = 1 / cam.s
  const tol = SNAP_PX * px
  const st = usePlanStore.getState

  // Position aimantée du curseur pendant le tracé
  const from = chain ? { id: chain.pointId ?? '', x: chain.x, z: chain.z } : null
  const snapped = cursor && tool === 'murs' ? snapPoint(plan, cursor, from, tol) : cursor && tool === 'echelle' ? (() => {
    const q = nearestPoint(plan, cursor, tol)
    return q ? { x: q.x, z: q.z, pointId: q.id } : cursor
  })() : null

  const hitTest = (p: XZ): { type: 'point' | 'opening' | 'wall' | 'label'; id: string } | null => {
    const pt = nearestPoint(plan, p, tol)
    if (pt) return { type: 'point', id: pt.id }
    const segs = wallSegs(plan)
    for (const o of plan.openings) {
      const s = segs.find((x) => x.wall.id === o.wallId)
      if (!s) continue
      const pr = projectOnSeg(s, p)
      if (pr.d < Math.max(tol, s.wall.thickness) && Math.abs(pr.u - o.u) < o.width / 2) return { type: 'opening', id: o.id }
    }
    const wl = nearestWall(plan, p, Math.max(tol * 0.8, 0.08))
    if (wl) return { type: 'wall', id: wl.seg.wall.id }
    const lb = plan.labels.find((l) => dist(l, p) < tol * 1.6)
    if (lb) return { type: 'label', id: lb.id }
    return null
  }

  const place = (p: XZ) => {
    const s = st()
    if (tool === 'echelle') {
      const q = nearestPoint(plan, p, tol)
      const pt = q ? { x: q.x, z: q.z } : p
      const next = s.calib.length >= 2 ? [pt] : [...s.calib, pt]
      s.setCalib(next)
      // Sur téléphone, le panneau s'ouvre pour saisir la longueur
      if (next.length === 2) s.setPanelOpen(true)
      return
    }
    // Murs
    const c = s.chain
    const snap = snapPoint(plan, p, c ? { id: c.pointId ?? '', x: c.x, z: c.z } : null, tol)
    if (!c) {
      s.setChain(snap)
      return
    }
    if (c.pointId && snap.pointId === c.pointId) return
    if (dist(c, snap) < 0.05) return
    let endId = ''
    s.edit(`mur-${Date.now()}`, (pl) => {
      const a = addPoint(pl, c)
      endId = addPoint(pl, snap)
      addWall(pl, a, endId, s.thickness)
    })
    const end = st().plan!.points.find((q) => q.id === endId)!
    // Revenir sur un angle existant ferme la suite de murs
    s.setChain(snap.pointId ? null : { x: end.x, z: end.z, pointId: end.id })
  }

  const tap = (p: XZ) => {
    const s = st()
    if (tool === 'ouvertures') {
      const wl = nearestWall(plan, p, Math.max(0.35, tol * 1.2))
      if (!wl) return s.select(null)
      const hit = hitTest(p)
      if (hit?.type === 'opening') return s.select(hit)
      const d = PLAN_OPENING_DEFAULTS[s.openingKind]
      const id = uid()
      s.edit(`ouverture-${id}`, (pl) => {
        pl.openings.push({ id, wallId: wl.seg.wall.id, kind: s.openingKind, u: wl.u, ...d, sill: d.sill })
        clampOpenings(pl)
      })
      // Pas de fiche ouverte : on enchaîne les portes et fenêtres (toucher l'une d'elles pour la régler)
      s.select(null)
      return
    }
    if (tool === 'pieces') {
      const lb = plan.labels.find((l) => dist(l, p) < tol * 1.6)
      if (lb) return s.select({ type: 'label', id: lb.id })
      const f = faces.find((x) => pointInPolygon(p, x.points))
      if (!f) return s.select(null)
      if (f.label) return s.select({ type: 'label', id: f.label.id })
      const a = faceAnchor(f)
      const id = uid()
      s.edit(`piece-${id}`, (pl) => pl.labels.push({ id, x: a.x, z: a.z, name: '' }))
      s.select({ type: 'label', id })
      return
    }
    s.select(hitTest(p))
  }

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.plan-loupe')) return
    wrapRef.current!.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = { mode: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, cam }
      setLoupe(null)
      return
    }
    if (pointers.current.size > 2) return
    if (e.button === 1 || e.button === 2) {
      gesture.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, cam }
      return
    }
    const p = toWorld(e.clientX, e.clientY)
    if (tool === 'murs' || tool === 'echelle') {
      const touch = e.pointerType !== 'mouse'
      gesture.current = { mode: 'place', sx: e.clientX, sy: e.clientY, touch }
      setCursor(p)
      if (touch) setLoupe({ x: e.clientX, y: e.clientY })
      return
    }
    const hit = hitTest(p)
    if (tool === 'selection' && hit?.type === 'point') {
      st().select(hit)
      gesture.current = { mode: 'point', id: hit.id, key: `angle-${hit.id}-${Date.now()}` }
      return
    }
    if ((tool === 'selection' || tool === 'ouvertures') && hit?.type === 'opening') {
      const o = plan.openings.find((x) => x.id === hit.id)!
      const s = wallSeg(plan, o.wallId)!
      st().select(hit)
      gesture.current = { mode: 'opening', id: o.id, key: `ouv-${o.id}-${Date.now()}`, grab: projectOnSeg(s, p).u - o.u }
      return
    }
    if ((tool === 'selection' || tool === 'pieces') && hit?.type === 'label') {
      const l = plan.labels.find((x) => x.id === hit.id)!
      st().select(hit)
      gesture.current = { mode: 'label', id: l.id, key: `nom-${l.id}-${Date.now()}`, dx: l.x - p.x, dz: l.z - p.z }
      return
    }
    gesture.current = { mode: 'tap', sx: e.clientX, sy: e.clientY, cam, moved: false }
  }

  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!pointers.current.has(e.pointerId)) {
      // Souris sans bouton : aperçu du prochain mur
      if (e.pointerType === 'mouse' && (tool === 'murs' || tool === 'echelle')) setCursor(toWorld(e.clientX, e.clientY))
      return
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (g.mode === 'pinch') {
      const [a, b] = [...pointers.current.values()]
      if (!a || !b) return
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const s = Math.max(4, Math.min(600, g.cam.s * (d / g.d)))
      const r = wrapRef.current!.getBoundingClientRect()
      // Le point sous le milieu des doigts reste sous les doigts
      const wx = g.cam.cx + (g.mid.x - r.left - w / 2) / g.cam.s
      const wz = g.cam.cz + (g.mid.y - r.top - h / 2) / g.cam.s
      setCam({ s, cx: wx - (mid.x - r.left - w / 2) / s, cz: wz - (mid.y - r.top - h / 2) / s })
      return
    }
    if (g.mode === 'pan' || (g.mode === 'tap' && (g.moved || Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 6))) {
      const c = g.cam
      if (g.mode === 'tap') g.moved = true
      setCam({ ...c, cx: c.cx - (e.clientX - g.sx) / c.s, cz: c.cz - (e.clientY - g.sy) / c.s })
      return
    }
    const p = toWorld(e.clientX, e.clientY)
    if (g.mode === 'place') {
      setCursor(p)
      if (g.touch) setLoupe({ x: e.clientX, y: e.clientY })
      return
    }
    if (g.mode === 'point') {
      const pt = plan.points.find((q) => q.id === g.id)
      if (!pt) return
      // Aimantation d'équerre avec les angles voisins
      const neighbors = plan.walls.filter((wl) => wl.a === g.id || wl.b === g.id).map((wl) => plan.points.find((q) => q.id === (wl.a === g.id ? wl.b : wl.a))!)
      let { x, z } = p
      for (const n of neighbors) {
        if (Math.abs(n.x - x) < tol * 0.6) x = n.x
        if (Math.abs(n.z - z) < tol * 0.6) z = n.z
      }
      st().edit(g.key, (pl) => {
        pl.points = pl.points.map((q) => (q.id === g.id ? { ...q, x: Math.round(x * 1000) / 1000, z: Math.round(z * 1000) / 1000 } : q))
        clampOpenings(pl)
      })
      return
    }
    if (g.mode === 'opening') {
      st().edit(g.key, (pl) => {
        const o = pl.openings.find((x) => x.id === g.id)
        const s = o && wallSeg(pl, o.wallId)
        if (!o || !s) return
        o.u = projectOnSeg(s, p).u - g.grab
        clampOpenings(pl)
      })
      return
    }
    if (g.mode === 'label') {
      st().edit(g.key, (pl) => {
        const l = pl.labels.find((x) => x.id === g.id)
        if (l) Object.assign(l, { x: p.x + g.dx, z: p.z + g.dz })
      })
    }
  }

  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    pointers.current.delete(e.pointerId)
    if (pointers.current.size > 0) {
      // Fin d'un pincement : on attend que tous les doigts soient levés
      if (g.mode === 'pinch') gesture.current = { mode: 'none' }
      return
    }
    gesture.current = { mode: 'none' }
    setLoupe(null)
    if (e.type === 'pointercancel') return
    if (g.mode === 'place') {
      place(toWorld(e.clientX, e.clientY))
      if (g.touch) setCursor(null)
    } else if (g.mode === 'tap' && !g.moved) tap(toWorld(e.clientX, e.clientY))
  }

  const onWheel = (e: React.WheelEvent) => {
    const r = wrapRef.current!.getBoundingClientRect()
    const k = Math.exp(-e.deltaY * 0.0015)
    const s = Math.max(4, Math.min(600, cam.s * k))
    const wx = cam.cx + (e.clientX - r.left - w / 2) / cam.s
    const wz = cam.cz + (e.clientY - r.top - h / 2) / cam.s
    setCam({ s, cx: wx - (e.clientX - r.left - w / 2) / s, cz: wz - (e.clientY - r.top - h / 2) / s })
  }

  const viewBox = `${cam.cx - w / 2 / cam.s} ${cam.cz - h / 2 / cam.s} ${w / cam.s} ${h / cam.s}`
  const selFace = sel?.type === 'label' ? faces.find((f) => f.label?.id === sel.id)?.key : null

  const overlay = (k: number) => (
    <g>
      {/* Mesure d'échelle */}
      {tool === 'echelle' && calib.length > 0 && (
        <g>
          {calib.length === 2 && <line x1={calib[0].x} y1={calib[0].z} x2={calib[1].x} y2={calib[1].z} stroke={BORD} strokeWidth={3 * k} strokeDasharray={`${8 * k} ${5 * k}`} />}
          {calib.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.z} r={7 * k} fill={BORD} stroke="#fff" strokeWidth={2 * k} />
          ))}
        </g>
      )}
      {/* Prochain mur */}
      {tool === 'murs' && chain && snapped && (
        <g>
          <line x1={chain.x} y1={chain.z} x2={snapped.x} y2={snapped.z} stroke={BORD} strokeOpacity={0.55} strokeWidth={Math.max(st().thickness, 3 * k)} strokeLinecap="square" />
          <text x={(chain.x + snapped.x) / 2} y={(chain.z + snapped.z) / 2 - 12 * k} fontSize={13 * k} textAnchor="middle" fill={BORD} fontWeight={600} className="plan-len halo">
            {fmtLen(dist(chain, snapped))}
          </text>
        </g>
      )}
      {tool === 'murs' && chain && <circle cx={chain.x} cy={chain.z} r={6 * k} fill={BORD} stroke="#fff" strokeWidth={2 * k} />}
      {(tool === 'murs' || tool === 'echelle') && snapped && (
        <g>
          <circle cx={snapped.x} cy={snapped.z} r={(('pointId' in snapped && snapped.pointId) ? 10 : 6) * k} fill="none" stroke={BORD} strokeWidth={2 * k} />
          <line x1={snapped.x - 14 * k} y1={snapped.z} x2={snapped.x + 14 * k} y2={snapped.z} stroke={BORD} strokeWidth={1 * k} />
          <line x1={snapped.x} y1={snapped.z - 14 * k} x2={snapped.x} y2={snapped.z + 14 * k} stroke={BORD} strokeWidth={1 * k} />
        </g>
      )}
    </g>
  )

  const content = (k: number) => (
    <>
      <PlanContent
        plan={plan}
        faces={faces}
        px={k}
        sel={sel}
        imageHref={href}
        showPoints={tool === 'selection' || tool === 'murs'}
        showLengths={tool !== 'pieces'}
        selectedFace={selFace}
      />
      {overlay(k)}
    </>
  )

  // Loupe (au toucher) : agrandit la zone sous le doigt pour placer les angles avec précision
  const L = 150
  const zoom = 3
  const loupeView = snapped ? `${snapped.x - L / 2 / (cam.s * zoom)} ${snapped.z - L / 2 / (cam.s * zoom)} ${L / (cam.s * zoom)} ${L / (cam.s * zoom)}` : ''
  const r = wrapRef.current?.getBoundingClientRect()

  return (
    <div
      className={`plan-canvas tool-${tool}`}
      ref={wrapRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={(e) => e.pointerType === 'mouse' && !pointers.current.size && setCursor(null)}
      onWheel={onWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg width={w} height={h} viewBox={viewBox} className="plan-svg">
        <defs>
          <pattern id="plan-grid" width={1} height={1} patternUnits="userSpaceOnUse">
            <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#e4dcd1" strokeWidth={px} />
          </pattern>
        </defs>
        <rect x={cam.cx - w / 2 / cam.s} y={cam.cz - h / 2 / cam.s} width={w / cam.s} height={h / cam.s} fill="url(#plan-grid)" />
        {content(px)}
      </svg>
      {(tool === 'murs' || tool === 'echelle') && (
        // Toujours présente pendant le tracé (l'image du plan y est déjà chargée), visible seulement sous le doigt
        <div
          className="plan-loupe"
          style={
            loupe && snapped && r
              ? {
                  left: Math.max(8, Math.min(w - L - 8, loupe.x - r.left - L / 2)),
                  // Au-dessus du doigt, ou en dessous s'il n'y a pas la place sous la barre du haut
                  top: loupe.y - r.top - L - 70 < (w <= 860 ? 112 : 68) ? loupe.y - r.top + 70 : loupe.y - r.top - L - 70,
                }
              : { visibility: 'hidden', left: -400, top: 0 }
          }
        >
          <svg width={L} height={L} viewBox={loupeView || `0 0 1 1`}>
            {snapped && <rect x={snapped.x - 50} y={snapped.z - 50} width={100} height={100} fill="#fbf9f6" />}
            {content(px / zoom)}
          </svg>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Panneau des outils

const TOOLS: { id: PlanTool; label: string; icon: keyof typeof Icon }[] = [
  { id: 'echelle', label: 'Échelle', icon: 'ruler' },
  { id: 'murs', label: 'Murs', icon: 'wall' },
  { id: 'ouvertures', label: 'Portes, fenêtres', icon: 'door' },
  { id: 'pieces', label: 'Pièces', icon: 'tag' },
  { id: 'selection', label: 'Modifier', icon: 'pointer' },
]

const THICKNESSES = [
  { t: WALL_THICKNESS.cloison, label: 'Cloison', sub: '7 cm' },
  { t: WALL_THICKNESS.standard, label: 'Mur', sub: '12 cm' },
  { t: WALL_THICKNESS.porteur, label: 'Porteur', sub: '20 cm' },
]

/** Crée une pièce à aménager à partir d'une pièce du plan, et l'ouvre. */
async function furnish(plan: FloorPlan, f: Face) {
  const r = roomFromFace(plan, f)
  const refs: RefImage[] = []
  // Copie de l'image du plan comme référence de la pièce (indépendante du plan)
  if (plan.image) {
    const url = await imageUrl(plan.image.id)
    if (url) {
      const id = uid()
      await putImage(id, await (await fetch(url)).blob())
      refs.push({ id, kind: 'plan', name: plan.name })
    }
  }
  const clampDim = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
  usePlanStore.getState().closePlan()
  useStore.getState().createProject({
    name: r.name,
    roomType: r.roomType,
    start: 'vide',
    room: {
      width: clampDim(r.room.width, ROOM_LIMITS.min, ROOM_LIMITS.max),
      depth: clampDim(r.room.depth, ROOM_LIMITS.min, ROOM_LIMITS.max),
      height: clampDim(r.room.height, ROOM_LIMITS.minHeight, ROOM_LIMITS.maxHeight),
    },
    references: refs,
    openings: r.openings,
  })
}

function ToolHelp() {
  const plan = usePlanStore((s) => s.plan)!
  const tool = usePlanStore((s) => s.tool)
  const calib = usePlanStore((s) => s.calib)
  const chain = usePlanStore((s) => s.chain)
  const thickness = usePlanStore((s) => s.thickness)
  const openingKind = usePlanStore((s) => s.openingKind)
  const s = usePlanStore.getState()
  const [real, setReal] = useState(3)
  const faces = useMemo(() => findFaces(plan), [plan])

  if (tool === 'echelle') {
    if (!plan.image)
      return <p className="hint-text">Pas de plan importé : vous tracez directement en mètres, l'échelle est déjà juste.</p>
    return (
      <div className="plan-help">
        <p className="hint-text">
          {calib.length < 2
            ? `Touchez les deux bouts d'une longueur que vous connaissez sur le plan (une cote écrite, un mur mesuré). ${calib.length === 1 ? 'Premier point posé : touchez le second.' : ''}`
            : 'Indiquez la longueur réelle entre les deux points.'}
        </p>
        {calib.length === 2 && (
          <>
            <MeasureField label="Longueur réelle" value={real} min={0.2} max={60} step={0.05} onChange={setReal} />
            <button
              type="button"
              className="btn primary full"
              onClick={() => {
                s.edit('echelle', (p) => calibrate(p, calib[0], calib[1], real))
                s.setTool(plan.walls.length ? 'selection' : 'murs')
                window.dispatchEvent(new Event('plan-recentrer'))
              }}
            >
              Valider l'échelle
            </button>
          </>
        )}
        <p className={`plan-status ${plan.image.calibrated ? 'ok' : ''}`}>
          {plan.image.calibrated ? <>{Icon.check} Échelle réglée</> : <>{Icon.alert} Échelle pas encore réglée : les longueurs sont approximatives</>}
        </p>
      </div>
    )
  }
  if (tool === 'murs') {
    const lastWall = chain?.pointId ? plan.walls.find((wl) => wl.b === chain.pointId) : undefined
    const lastSeg = lastWall ? wallSeg(plan, lastWall.id) : undefined
    return (
      <div className="plan-help">
        <div className="choice-row thickness-row">
          {THICKNESSES.map((t) => (
            <button key={t.t} type="button" className={`chip ${thickness === t.t ? 'selected' : ''}`} onClick={() => s.setThickness(t.t)}>
              {t.label} <span className="muted">{t.sub}</span>
            </button>
          ))}
        </div>
        <p className="hint-text">
          {chain ? 'Touchez l\'angle suivant. Touchez un angle déjà posé pour fermer la pièce.' : 'Touchez le premier angle d\'un mur, puis chaque angle suivant. Les murs se mettent d\'équerre tout seuls.'}
        </p>
        {lastSeg && <MeasureField label="Longueur du dernier mur" value={Math.round(lastSeg.len * 100) / 100} min={0.1} max={40} onChange={(v) => {
          s.edit('long-dernier', (p) => setWallLength(p, lastSeg.wall.id, v))
          const pt = usePlanStore.getState().plan!.points.find((q) => q.id === chain!.pointId)!
          s.setChain({ x: pt.x, z: pt.z, pointId: pt.id })
        }} />}
        {chain && (
          <button type="button" className="btn secondary full" onClick={() => s.setChain(null)}>
            {Icon.check} Terminer cette suite de murs
          </button>
        )}
      </div>
    )
  }
  if (tool === 'ouvertures')
    return (
      <div className="plan-help">
        <div className="choice-row">
          {(Object.keys(PLAN_OPENING_LABEL) as PlanOpeningKind[]).map((k) => (
            <button key={k} type="button" className={`chip ${openingKind === k ? 'selected' : ''}`} onClick={() => s.setOpeningKind(k)}>
              {PLAN_OPENING_LABEL[k]}
            </button>
          ))}
        </div>
        <p className="hint-text">Touchez un mur à l'endroit de la {PLAN_OPENING_LABEL[openingKind].toLowerCase()}. Faites-la glisser pour l'ajuster.</p>
      </div>
    )
  if (tool === 'pieces')
    return (
      <div className="plan-help">
        <p className="hint-text">{faces.length ? 'Touchez une pièce sur le plan pour lui donner un nom.' : 'Aucune pièce fermée pour l\'instant : fermez les murs tout autour d\'une pièce.'}</p>
        <RoomList faces={faces} />
      </div>
    )
  return (
    <div className="plan-help">
      <p className="hint-text">Touchez un angle, un mur, une porte ou une fenêtre pour le modifier. Faites glisser un angle pour le déplacer. Deux doigts pour zoomer.</p>
      {faces.length > 0 && <RoomList faces={faces} />}
    </div>
  )
}

function RoomList({ faces }: { faces: Face[] }) {
  const plan = usePlanStore((s) => s.plan)!
  const s = usePlanStore.getState()
  const [busy, setBusy] = useState(false)
  if (!faces.length) return null
  return (
    <div className="row-list plan-rooms">
      {faces.map((f) => (
        <div key={f.key} className="plan-room-row">
          <button
            type="button"
            className="row-item"
            onClick={() => {
              if (f.label) s.select({ type: 'label', id: f.label.id })
              else {
                const a = faceAnchor(f)
                const id = uid()
                s.edit(`piece-${id}`, (pl) => pl.labels.push({ id, x: a.x, z: a.z, name: '' }))
                s.select({ type: 'label', id })
              }
            }}
          >
            <span>{f.label?.name || 'Pièce sans nom'}</span>
            <span className="muted">{f.floorArea.toFixed(1).replace('.', ',')} m²</span>
          </button>
          <button type="button" className="chip" disabled={busy} onClick={async () => (setBusy(true), await furnish(plan, f))} title="Aménager cette pièce en 3D">
            Aménager
          </button>
        </div>
      ))}
    </div>
  )
}

function PlanSettings() {
  const plan = usePlanStore((s) => s.plan)!
  const s = usePlanStore.getState()
  const img = plan.image
  return (
    <section className="plan-settings">
      <h3>Plan importé</h3>
      {img ? (
        <>
          <label className="field">
            <span>Visibilité du plan</span>
            <input type="range" min={0.1} max={1} step={0.05} value={img.opacity} onChange={(e) => s.edit('opacite', (p) => (p.image!.opacity = Number(e.target.value)))} />
          </label>
          <div className="choice-row">
            <button type="button" className="chip" onClick={() => s.edit('cacher', (p) => (p.image!.hidden = !p.image!.hidden))}>
              {img.hidden ? 'Afficher le plan' : 'Cacher le plan'}
            </button>
          </div>
        </>
      ) : (
        <p className="hint-text">Vous pouvez glisser un plan (photo ou PDF) sous votre tracé.</p>
      )}
      <ImportButton
        label={<>{Icon.image} {img ? 'Changer de plan' : 'Importer un plan'}</>}
        accept="image/*,application/pdf"
        className="btn secondary"
        onImported={async ([f]) => {
          const size = await imageSize(f.id)
          if (!size) return
          s.edit('image', (p) => {
            // Un nouveau plan garde l'échelle actuelle tant qu'on ne l'a pas réglée
            const scale = p.image?.calibrated ? p.image.scale : 12 / size.width
            p.image = { id: f.id, widthPx: size.width, heightPx: size.height, scale, calibrated: false, opacity: 0.55 }
          })
          s.setTool('echelle')
          window.dispatchEvent(new Event('plan-recentrer'))
        }}
      />
      <h3>Appartement</h3>
      <label className="field">
        <span>Nom</span>
        <input type="text" value={plan.name} onChange={(e) => s.edit('nom', (p) => (p.name = e.target.value))} />
      </label>
      <MeasureField label="Hauteur sous plafond" value={plan.height} min={2} max={4} onChange={(v) => s.edit('hauteur', (p) => (p.height = v))} />
    </section>
  )
}

function PlanPanel() {
  const tool = usePlanStore((s) => s.tool)
  const setTool = usePlanStore((s) => s.setTool)
  const open = usePlanStore((s) => s.panelOpen)
  const setOpen = usePlanStore((s) => s.setPanelOpen)
  return (
    <aside className={`panel plan-panel ${open ? 'open' : 'closed'}`}>
      <div className="sheet-handle" onClick={() => setOpen(!open)} role="button" aria-label={open ? 'Réduire le panneau' : 'Ouvrir le panneau'}>
        <span />
      </div>
      <div className="plan-tools" role="toolbar" aria-label="Outils du plan">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" className={`tool ${tool === t.id ? 'on' : ''}`} aria-pressed={tool === t.id} onClick={() => (setTool(t.id), setOpen(true))}>
            {Icon[t.icon]}
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <div className="panel-body">
        <ToolHelp />
        <PlanSettings />
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------- Élément sélectionné

function PlanSelectionSheet() {
  const plan = usePlanStore((s) => s.plan)!
  const sel = usePlanStore((s) => s.selection)
  const s = usePlanStore.getState()
  const faces = useMemo(() => findFaces(plan), [plan])
  const [busy, setBusy] = useState(false)
  if (!sel) return null
  const close = (
    <button type="button" className="icon-btn small" onClick={() => s.select(null)} aria-label="Fermer">
      {Icon.close}
    </button>
  )
  let body: React.ReactNode = null
  if (sel.type === 'wall') {
    const seg = wallSeg(plan, sel.id)
    if (!seg) return null
    body = (
      <>
        <div className="sheet-head">
          <div>
            <strong>Mur</strong>
            <span className="muted">{fmtLen(seg.len)} · {Math.round(seg.wall.thickness * 100)} cm d'épaisseur</span>
          </div>
          {close}
        </div>
        <MeasureField label="Longueur" value={Math.round(seg.len * 100) / 100} min={0.1} max={40} onChange={(v) => s.edit(`long-${sel.id}`, (p) => setWallLength(p, sel.id, v))} />
        <div className="choice-row">
          {THICKNESSES.map((t) => (
            <button key={t.t} type="button" className={`chip ${Math.abs(seg.wall.thickness - t.t) < 0.001 ? 'selected' : ''}`} onClick={() => s.edit(`ep-${sel.id}`, (p) => p.walls.forEach((wl) => wl.id === sel.id && (wl.thickness = t.t)))}>
              {t.label} <span className="muted">{t.sub}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn ghost danger-text" onClick={() => (s.edit('suppr', (p) => removeWall(p, sel.id)), s.select(null))}>
          {Icon.trash} Supprimer ce mur
        </button>
      </>
    )
  } else if (sel.type === 'point') {
    body = (
      <>
        <div className="sheet-head">
          <div>
            <strong>Angle</strong>
            <span className="muted">Faites-le glisser pour le déplacer.</span>
          </div>
          {close}
        </div>
        <button type="button" className="btn ghost danger-text" onClick={() => (s.edit('suppr', (p) => removePoint(p, sel.id)), s.select(null))}>
          {Icon.trash} Supprimer cet angle
        </button>
      </>
    )
  } else if (sel.type === 'opening') {
    const o = plan.openings.find((x) => x.id === sel.id)
    if (!o) return null
    const set = (patch: Partial<typeof o>, key: string) =>
      s.edit(`${key}-${o.id}`, (p) => {
        p.openings = p.openings.map((x) => (x.id === o.id ? { ...x, ...patch } : x))
        clampOpenings(p)
      })
    body = (
      <>
        <div className="sheet-head">
          <div>
            <strong>{PLAN_OPENING_LABEL[o.kind]}</strong>
            <span className="muted">Faites-la glisser le long du mur.</span>
          </div>
          {close}
        </div>
        <div className="choice-row">
          {(Object.keys(PLAN_OPENING_LABEL) as PlanOpeningKind[]).map((k) => (
            <button key={k} type="button" className={`chip ${o.kind === k ? 'selected' : ''}`} onClick={() => set({ kind: k, ...PLAN_OPENING_DEFAULTS[k] }, 'type')}>
              {PLAN_OPENING_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="dims-row">
          <MeasureField label="Largeur" value={o.width} min={0.4} max={4} onChange={(v) => set({ width: v }, 'larg')} />
          <MeasureField label="Hauteur" value={o.height} min={0.4} max={plan.height} onChange={(v) => set({ height: v }, 'haut')} />
          {o.kind === 'fenetre' && <MeasureField label="Allège" value={o.sill} min={0} max={2} onChange={(v) => set({ sill: v }, 'allege')} />}
        </div>
        {o.kind === 'porte' && (
          <button type="button" className="chip" onClick={() => set({ hinge: o.hinge === 'gauche' ? 'droite' : 'gauche' }, 'sens')}>
            {Icon.swap} Changer le sens d'ouverture
          </button>
        )}
        <button type="button" className="btn ghost danger-text" onClick={() => (s.edit('suppr', (p) => (p.openings = p.openings.filter((x) => x.id !== o.id))), s.select(null))}>
          {Icon.trash} Supprimer
        </button>
      </>
    )
  } else if (sel.type === 'label') {
    const l = plan.labels.find((x) => x.id === sel.id)
    if (!l) return null
    const face = faces.find((f) => f.label?.id === l.id)
    const r = face ? roomFromFace(plan, face) : null
    body = (
      <>
        <div className="sheet-head">
          <div>
            <strong>{l.name || 'Nommer cette pièce'}</strong>
            {face && <span className="muted">{face.floorArea.toFixed(1).replace('.', ',')} m² environ</span>}
          </div>
          {close}
        </div>
        <input
          type="text"
          className="plan-name-input"
          value={l.name}
          placeholder="Nom de la pièce"
          autoFocus={!l.name && window.innerWidth > 860}
          onChange={(e) => s.edit(`nom-${l.id}`, (p) => p.labels.forEach((x) => x.id === l.id && (x.name = e.target.value)))}
        />
        <div className="choice-row">
          {ROOM_NAMES.map((n) => (
            <button
              key={n}
              type="button"
              className={`chip ${l.name === n ? 'selected' : ''}`}
              onClick={() => {
                s.edit(`nom-${l.id}`, (p) => p.labels.forEach((x) => x.id === l.id && (x.name = n)))
                // Nom choisi : on referme pour nommer la pièce suivante
                if (usePlanStore.getState().tool === 'pieces') s.select(null)
              }}
            >
              {n}
            </button>
          ))}
        </div>
        {face && r && (
          <>
            {!r.rectangular && <p className="hint-text">Cette pièce n'est pas rectangulaire : elle sera aménagée comme un rectangle de {fmtLen(r.room.width)} × {fmtLen(r.room.depth)}.</p>}
            <button type="button" className="btn primary" disabled={busy} onClick={async () => (setBusy(true), await furnish(plan, face))}>
              {Icon.spark} Aménager cette pièce en 3D
            </button>
          </>
        )}
        <button type="button" className="btn ghost danger-text" onClick={() => (s.edit('suppr', (p) => (p.labels = p.labels.filter((x) => x.id !== l.id))), s.select(null))}>
          {Icon.trash} Retirer le nom
        </button>
      </>
    )
  }
  return (
    <div className="selection-sheet plan-sheet" role="region" aria-label="Élément sélectionné">
      {body}
    </div>
  )
}

// ---------------------------------------------------------------- Barre du haut et écran

export function PlanTopBar({ threeD }: { threeD: boolean }) {
  const plan = usePlanStore((s) => s.plan)!
  const view = usePlanStore((s) => s.view)
  const setView = usePlanStore((s) => s.setView)
  const canUndo = usePlanStore((s) => s.past.length > 0)
  const canRedo = usePlanStore((s) => s.future.length > 0)
  const savedAt = usePlanStore((s) => s.savedAt)
  const s = usePlanStore.getState()
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (!savedAt) return
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 1800)
    return () => clearTimeout(t)
  }, [savedAt])
  const has3D = threeD && plan.walls.length > 0
  return (
    <header className="editor-top">
      <div className="top-left">
        <button
          type="button"
          className="icon-btn"
          onClick={() => {
            s.closePlan()
            useStore.getState().goHome()
          }}
          aria-label="Accueil"
        >
          {Icon.home}
        </button>
        <div className="project-title">
          <span className="project-name-top">{plan.name}</span>
          <span className="share-sub">Plan d'appartement</span>
        </div>
      </div>
      <div className="segmented" role="tablist" aria-label="Type de vue">
        {(
          [
            ['plan', 'Plan'],
            ['3d', 'Vue 3D'],
            ['yeux', 'Visite'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            className={view === v ? 'active' : ''}
            disabled={v !== 'plan' && !has3D}
            title={v !== 'plan' && !has3D ? (threeD ? 'Tracez d\'abord des murs' : 'La 3D n’est pas disponible sur ce navigateur') : undefined}
            onClick={() => setView(v)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="top-right">
        {view === 'plan' && (
          <button type="button" className="icon-btn" onClick={() => window.dispatchEvent(new Event('plan-recentrer'))} aria-label="Recentrer" title="Recentrer le plan">
            {Icon.target}
          </button>
        )}
        <button type="button" className="icon-btn" onClick={s.undo} disabled={!canUndo} aria-label="Annuler" title="Annuler">
          {Icon.undo}
        </button>
        <button type="button" className="icon-btn" onClick={s.redo} disabled={!canRedo} aria-label="Rétablir" title="Rétablir">
          {Icon.redo}
        </button>
        <button type="button" className={`btn ${flash ? 'saved' : 'primary'}`} onClick={s.save}>
          {flash ? <>{Icon.check} Enregistré</> : 'Enregistrer'}
        </button>
      </div>
    </header>
  )
}

/** Sur téléphone, panneau replié : rappel de ce qu'il faut toucher, et bouton pour finir un mur. */
function PlanHintBar() {
  const tool = usePlanStore((s) => s.tool)
  const chain = usePlanStore((s) => s.chain)
  const calib = usePlanStore((s) => s.calib)
  const open = usePlanStore((s) => s.panelOpen)
  const sel = usePlanStore((s) => s.selection)
  const kind = usePlanStore((s) => s.openingKind)
  if (open || sel) return null
  const text =
    tool === 'echelle'
      ? calib.length === 0
        ? 'Touchez le début d\'une longueur connue'
        : 'Touchez la fin de cette longueur'
      : tool === 'murs'
        ? chain
          ? 'Touchez l\'angle suivant'
          : 'Touchez le premier angle'
        : tool === 'ouvertures'
          ? `Touchez un mur : ${PLAN_OPENING_LABEL[kind].toLowerCase()}`
          : tool === 'pieces'
            ? 'Touchez une pièce pour la nommer'
            : 'Touchez un élément pour le modifier'
  return (
    <div className="plan-hintbar" role="status">
      <span>{text}</span>
      {tool === 'murs' && chain && (
        <button type="button" className="chip selected" onClick={() => usePlanStore.getState().setChain(null)}>
          Terminer
        </button>
      )}
      {(tool === 'ouvertures' || tool === 'murs') && (
        <button type="button" className="chip" onClick={() => usePlanStore.getState().setPanelOpen(true)}>
          Options
        </button>
      )}
    </div>
  )
}

export function PlanEditorUI() {
  const view = usePlanStore((s) => s.view)
  // Raccourcis clavier : annuler, rétablir, échap, supprimer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const s = usePlanStore.getState()
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
      } else if (e.key === 'Escape') {
        s.setChain(null)
        s.setCalib([])
        s.select(null)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selection) {
        const sel = s.selection
        s.edit('suppr', (p) => {
          if (sel.type === 'wall') removeWall(p, sel.id)
          if (sel.type === 'point') removePoint(p, sel.id)
          if (sel.type === 'opening') p.openings = p.openings.filter((x) => x.id !== sel.id)
          if (sel.type === 'label') p.labels = p.labels.filter((x) => x.id !== sel.id)
        })
        s.select(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  if (view !== 'plan') return null
  return (
    <>
      <PlanPanel />
      <PlanSelectionSheet />
      <PlanHintBar />
    </>
  )
}

export { PlanCanvas }
