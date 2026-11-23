// Plan 2D dessiné (SVG), sans 3D :
// - en mode « aperçu » : miniature des cartes de projet ;
// - en mode interactif : éditeur de secours quand le navigateur ne peut pas afficher la 3D
//   (déplacer, sélectionner et tourner les meubles, choisir un mur ou une ouverture).
import { useMemo, useRef } from 'react'
import { getItem } from '../data/catalog'
import { itemDims, openingCenter, openingDepth, overlapsOf, wallAxes } from '../model/geometry'
import type { Layout, Opening, PlacedItem, WallSide } from '../model/types'
import { WALL_LABEL, WALL_ORDER } from '../model/types'
import { useStore } from '../store'
import { findGaps, openingZones } from '../model/clearance'

const T = 0.12 // épaisseur des murs dessinés
const INK = '#292321'
const BORD = '#742f45'
const PAPER = '#f8f5f0'

/** Couleur approchée de chaque sol, pour le plan. */
const FLOOR_FILL: Record<string, string> = {
  laminate_floor_02: '#d9bf98',
  herringbone_parquet: '#c9a074',
  dark_wooden_planks: '#9b8169',
  smooth_concrete_floor: '#cfcac3',
  large_floor_tiles_02: '#e3ded6',
  marble_tiles: '#ebe7e1',
}

const CATEGORY_FILL: Record<string, string> = {
  lit: '#ece6dc',
  assise: '#d8cdb9',
  table: '#c79f74',
  rangement: '#b98f68',
  deco: '#9db08a',
}

type V = [number, number]
const add = (a: V, b: V, k = 1): V => [a[0] + b[0] * k, a[1] + b[1] * k]
const pts = (list: V[]) => list.map((p) => p.join(',')).join(' ')

function OpeningShape({ layout, o, selected }: { layout: Layout; o: Opening; selected: boolean }) {
  const ax = wallAxes(layout.room, o.wall)
  const c = openingCenter(layout.room, o)
  const C: V = [c.x, c.z]
  const dir = ax.dir as V
  const inw = ax.inward as V
  const s0 = add(C, dir, -o.width / 2)
  const s1 = add(C, dir, o.width / 2)
  const out = (p: V, k: number) => add(p, inw, -k)
  const ink = selected ? BORD : INK
  const sw = selected ? 0.03 : 0.018
  if (o.kind === 'placard') {
    const d = openingDepth(o)
    const q0 = add(s0, inw, d)
    const q1 = add(s1, inw, d)
    return (
      <g>
        <polygon points={pts([s0, s1, q1, q0])} fill={PAPER} stroke={ink} strokeWidth={sw} />
        <line x1={s0[0]} y1={s0[1]} x2={q1[0]} y2={q1[1]} stroke={ink} strokeWidth={0.01} />
        <line x1={s1[0]} y1={s1[1]} x2={q0[0]} y2={q0[1]} stroke={ink} strokeWidth={0.01} />
      </g>
    )
  }
  const gap = <polygon points={pts([s0, s1, out(s1, T), out(s0, T)])} fill={PAPER} />
  if (o.kind === 'niche') {
    const d = Math.min(openingDepth(o), T - 0.02)
    return (
      <g>
        <polygon points={pts([s0, s1, out(s1, d), out(s0, d)])} fill={PAPER} stroke={ink} strokeWidth={sw} />
      </g>
    )
  }
  const glass = (
    <g>
      {gap}
      <line x1={out(s0, T * 0.42)[0]} y1={out(s0, T * 0.42)[1]} x2={out(s1, T * 0.42)[0]} y2={out(s1, T * 0.42)[1]} stroke={ink} strokeWidth={sw} />
      <line x1={out(s0, T * 0.58)[0]} y1={out(s0, T * 0.58)[1]} x2={out(s1, T * 0.58)[0]} y2={out(s1, T * 0.58)[1]} stroke={ink} strokeWidth={sw} />
    </g>
  )
  if (o.kind === 'fenetre') return glass
  const swingSign = (o.swing ?? 'interieur') === 'interieur' ? 1 : -1
  const leaf = (hinge: V, len: number, towards: number) => {
    const open = add(hinge, inw, len * swingSign)
    const closed = add(hinge, dir, len * towards)
    const path = `M ${closed[0]} ${closed[1]} A ${len} ${len} 0 0 ${towards * swingSign > 0 ? 0 : 1} ${open[0]} ${open[1]}`
    return (
      <g key={`${hinge[0]}-${hinge[1]}`}>
        <line x1={hinge[0]} y1={hinge[1]} x2={open[0]} y2={open[1]} stroke={ink} strokeWidth={sw * 1.6} />
        <path d={path} fill="none" stroke={ink} strokeWidth={0.01} strokeDasharray="0.05 0.035" />
      </g>
    )
  }
  if (o.kind === 'porte-fenetre') {
    return (
      <g>
        {glass}
        {leaf(s0, o.width / 2, 1)}
        {leaf(s1, o.width / 2, -1)}
      </g>
    )
  }
  // Porte : charnières à droite (vu de la pièce) = extrémité du côté « dir »
  const hinge = o.hinge === 'gauche' ? s0 : s1
  return (
    <g>
      {gap}
      {leaf(hinge, o.width, o.hinge === 'gauche' ? 1 : -1)}
    </g>
  )
}

function ItemShape({ it, selected, overlapping, labels }: { it: PlacedItem; selected: boolean; overlapping: boolean; labels: boolean }) {
  const c = getItem(it.modelId)
  const d = itemDims(it)
  const rugLike = c?.floorLayer
  // Tapis neutre, plantes en vert, le reste selon le type de meuble
  const base = rugLike ? '#e4dccf' : c?.material === 'vegetal' ? '#9db08a' : CATEGORY_FILL[c?.category === 'deco' ? 'assise' : c?.category ?? 'assise']
  const fill = it.color ?? c?.color ?? base
  const deg = (-it.rot * 180) / Math.PI
  // Nom court (avant la virgule), à une taille qui tient dans la longueur disponible du meuble
  const label = useMemo(() => {
    const text = (c?.name ?? '').split(',')[0].trim()
    const quarter = Math.round(((((it.rot % Math.PI) + Math.PI) % Math.PI) / (Math.PI / 2))) % 2 === 1
    const room = (quarter ? d.depth : d.width) * 0.9
    return { text, size: Math.min(0.13, room / Math.max(1, text.length * 0.64)) }
  }, [c?.name, it.rot, d.width, d.depth])
  const r = Math.min(0.05, d.width / 6, d.depth / 6)
  return (
    <g transform={`translate(${it.x} ${it.z}) rotate(${deg})`}>
      <rect x={-d.width / 2} y={-d.depth / 2} width={d.width} height={d.depth} rx={r} fill={fill} fillOpacity={rugLike ? 0.55 : 0.95} stroke={overlapping ? '#c0392b' : selected ? BORD : 'rgba(41,35,33,.45)'} strokeWidth={selected || overlapping ? 0.035 : 0.012} />
      {!rugLike && <line x1={-d.width / 2 + r} y1={d.depth / 2 - 0.02} x2={d.width / 2 - r} y2={d.depth / 2 - 0.02} stroke="rgba(41,35,33,.55)" strokeWidth={0.025} />}
      {labels && !rugLike && label.size >= 0.05 && (
        <text x={0} y={0.04} textAnchor="middle" fontSize={label.size} fill={INK} transform={`rotate(${-deg})`} style={{ pointerEvents: 'none', fontFamily: 'Inter, sans-serif' }}>
          {label.text}
        </text>
      )}
    </g>
  )
}

/** Dessin du plan ; `interactive` active la sélection et le déplacement. */
export function Plan2D({ layout, interactive = false, className }: { layout: Layout; interactive?: boolean; className?: string }) {
  const { width: W, depth: D } = layout.room
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const moveItem = useStore((s) => s.moveItem)
  const updateOpening = useStore((s) => s.updateOpening)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<
    | { type: 'item'; uid: string; dx: number; dz: number; pointerId: number }
    | { type: 'opening'; id: string; grab: number; start: number; pointerId: number }
    | null
  >(null)
  const overlaps = useMemo(() => (interactive ? overlapsOf(layout) : []), [layout, interactive])
  const m = 0.45
  const vb = `${-W / 2 - T - m} ${-D / 2 - T - m} ${W + 2 * (T + m)} ${D + 2 * (T + m)}`

  const toPlan = (e: React.PointerEvent): V => {
    const svg = svgRef.current!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return [p.x, p.y]
  }

  const items = [...layout.items].sort((a, b) => Number(!getItem(a.modelId)?.floorLayer) - Number(!getItem(b.modelId)?.floorLayer))
  const ordered = interactive && selection?.type === 'item' ? [...items.filter((i) => i.uid !== selection.id), ...items.filter((i) => i.uid === selection.id)] : items

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={vb}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Plan de la pièce : ${W.toFixed(2).replace('.', ',')} × ${D.toFixed(2).replace('.', ',')} m`}
      onPointerDown={interactive ? () => select(null) : undefined}
      onPointerMove={
        interactive
          ? (e) => {
              const d = drag.current
              if (!d || d.pointerId !== e.pointerId) return
              const [x, z] = toPlan(e)
              if (d.type === 'item') moveItem(d.uid, Math.round((x + d.dx) * 100) / 100, Math.round((z + d.dz) * 100) / 100)
              else {
                const o = layout.openings.find((q) => q.id === d.id)
                if (!o) return
                const ax = wallAxes(layout.room, o.wall)
                const mid: V = [(ax.a[0] + ax.b[0]) / 2, (ax.a[1] + ax.b[1]) / 2]
                const g = (x - mid[0]) * ax.dir[0] + (z - mid[1]) * ax.dir[1]
                updateOpening(d.id, { offset: Math.round((d.start + g - d.grab) * 100) / 100 }, `glisser-${d.id}`)
              }
            }
          : undefined
      }
      onPointerUp={interactive ? () => (drag.current = null) : undefined}
      onPointerCancel={interactive ? () => (drag.current = null) : undefined}
    >
      {/* Murs (pochés) puis sol */}
      <rect x={-W / 2 - T} y={-D / 2 - T} width={W + 2 * T} height={D + 2 * T} fill={INK} />
      <rect x={-W / 2} y={-D / 2} width={W} height={D} fill={FLOOR_FILL[layout.floorId] ?? '#d9bf98'} />
      {/* Couleur de chaque mur : liseré côté pièce */}
      {WALL_ORDER.map((w) => {
        const ax = wallAxes(layout.room, w)
        const a = add(ax.a as V, ax.inward as V, 0.025)
        const b = add(ax.b as V, ax.inward as V, 0.025)
        return <line key={w} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={layout.wallColors[w]} strokeWidth={0.05} />
      })}
      {interactive &&
        WALL_ORDER.map((w: WallSide) => {
          const ax = wallAxes(layout.room, w)
          const a = ax.a as V
          const b = ax.b as V
          const sel = selection?.type === 'wall' && selection.id === w
          return (
            <polygon
              key={`hit-${w}`}
              points={pts([add(a, ax.inward as V, 0.06), add(b, ax.inward as V, 0.06), add(b, ax.inward as V, -T - 0.06), add(a, ax.inward as V, -T - 0.06)])}
              fill={sel ? BORD : 'transparent'}
              fillOpacity={sel ? 0.55 : 0}
              onPointerDown={(e) => {
                e.stopPropagation()
                select({ type: 'wall', id: w })
              }}
            >
              <title>{WALL_LABEL[w]}</title>
            </polygon>
          )
        })}
      {layout.openings.map((o) => {
        const sel = interactive && selection?.type === 'opening' && selection.id === o.id
        return (
          <g
            key={o.id}
            onPointerDown={
              interactive
                ? (e) => {
                    e.stopPropagation()
                    if (!sel) return select({ type: 'opening', id: o.id })
                    const [x, z] = toPlan(e)
                    const ax = wallAxes(layout.room, o.wall)
                    const mid: V = [(ax.a[0] + ax.b[0]) / 2, (ax.a[1] + ax.b[1]) / 2]
                    drag.current = { type: 'opening', id: o.id, grab: (x - mid[0]) * ax.dir[0] + (z - mid[1]) * ax.dir[1], start: o.offset, pointerId: e.pointerId }
                    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
                  }
                : undefined
            }
          >
            <OpeningShape layout={layout} o={o} selected={!!sel} />
          </g>
        )
      })}
      {ordered.map((it) => (
        <g
          key={it.uid}
          onPointerDown={
            interactive
              ? (e) => {
                  e.stopPropagation()
                  select({ type: 'item', id: it.uid })
                  if (it.locked) return
                  const [x, z] = toPlan(e)
                  drag.current = { type: 'item', uid: it.uid, dx: it.x - x, dz: it.z - z, pointerId: e.pointerId }
                  svgRef.current?.setPointerCapture?.(e.pointerId)
                }
              : undefined
          }
          style={interactive ? { cursor: it.locked ? 'default' : 'grab' } : undefined}
        >
          <ItemShape
            it={it}
            selected={interactive && selection?.type === 'item' && selection.id === it.uid}
            overlapping={overlaps.some((o) => o.a.id === it.uid || o.b.id === it.uid)}
            labels={interactive}
          />
        </g>
      ))}
      {interactive && <ClearanceSvg layout={layout} />}
    </svg>
  )
}

const COMFORT_FILL = { etroit: '#b23b2e', juste: '#c98a1b', ok: '#44634d' } as const

/** Passages et zones d'ouverture, sur le plan dessiné (sans 3D). */
function ClearanceSvg({ layout }: { layout: Layout }) {
  const on = useStore((s) => s.passages)
  const gaps = useMemo(() => (on ? findGaps(layout) : []), [on, layout])
  const zones = useMemo(() => (on ? openingZones(layout) : []), [on, layout])
  if (!on) return null
  return (
    <g style={{ pointerEvents: 'none' }}>
      {zones.map((z) => (
        <polygon
          key={z.item.uid}
          points={z.corners.map((p) => p.join(',')).join(' ')}
          fill={z.blockedBy ? 'rgba(178,59,46,.22)' : 'rgba(116,47,69,.1)'}
          stroke={z.blockedBy ? '#b23b2e' : BORD}
          strokeWidth={0.015}
          strokeDasharray="0.06 0.04"
        />
      ))}
      {gaps.map((g) => {
        const c = COMFORT_FILL[g.comfort]
        const mx = (g.from[0] + g.to[0]) / 2
        const mz = (g.from[1] + g.to[1]) / 2
        const label = `${Math.round(g.length * 100)} cm`
        return (
          <g key={g.key}>
            <line x1={g.from[0]} y1={g.from[1]} x2={g.to[0]} y2={g.to[1]} stroke={c} strokeWidth={0.025} />
            <rect x={mx - 0.21} y={mz - 0.08} width={0.42} height={0.16} rx={0.08} fill={c} />
            <text x={mx} y={mz + 0.045} textAnchor="middle" fontSize={0.12} fontWeight={700} fill="#fff" style={{ fontFamily: 'Inter, sans-serif' }}>
              {label}
            </text>
          </g>
        )
      })}
    </g>
  )
}
