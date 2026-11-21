// Dessin SVG d'un plan d'appartement (murs, portes, fenêtres, pièces nommées).
// Utilisé par l'éditeur (avec l'image du plan en fond), la loupe et les miniatures de l'accueil.
import { useEffect, useMemo, useState } from 'react'
import { faceAnchor, findFaces, planBounds, wallSegs, type Face, type FloorPlan, type PlanOpening, type WallSeg } from '../model/plan'
import { imageUrl } from '../model/storage'

const INK = '#292321'
const BORD = '#742f45'
const PAPER = '#fbf9f6'

export type Sel = { type: 'point' | 'wall' | 'opening' | 'label'; id: string } | null

const fmtArea = (a: number) => `${a.toFixed(1).replace('.', ',')} m²`
export const fmtLen = (m: number) => `${m.toFixed(2).replace('.', ',')} m`

function wallPolygon(s: WallSeg) {
  const h = s.wall.thickness / 2
  const nx = -s.dz * h
  const nz = s.dx * h
  // Prolongé d'une demi-épaisseur pour fermer proprement les angles
  const ax = s.a.x - s.dx * h
  const az = s.a.z - s.dz * h
  const bx = s.b.x + s.dx * h
  const bz = s.b.z + s.dz * h
  return `${ax + nx},${az + nz} ${bx + nx},${bz + nz} ${bx - nx},${bz - nz} ${ax - nx},${az - nz}`
}

function OpeningMark({ s, o, selected, px }: { s: WallSeg; o: PlanOpening; selected: boolean; px: number }) {
  const T = s.wall.thickness
  const { dx, dz } = s
  const nx = -dz
  const nz = dx
  const at = (u: number, n: number) => [s.a.x + dx * u + nx * n, s.a.z + dz * u + nz * n] as const
  const u0 = o.u - o.width / 2
  const u1 = o.u + o.width / 2
  const ink = selected ? BORD : INK
  const sw = (selected ? 2.4 : 1.4) * px
  const gap = [at(u0, T / 2 + px), at(u1, T / 2 + px), at(u1, -T / 2 - px), at(u0, -T / 2 - px)].map((p) => p.join(',')).join(' ')
  const line = (p: readonly [number, number], q: readonly [number, number], w = sw) => <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={ink} strokeWidth={w} />
  const arc = (hinge: number, free: number, dir: 1 | -1, r: number) => {
    // Battant : du point libre, quart de cercle jusqu'au vantail ouvert (côté +normale)
    const h = at(hinge, 0)
    const f = at(free, 0)
    const open = at(hinge, r)
    const sweep = (free > hinge ? 1 : 0) ^ (dir > 0 ? 0 : 1) ? 0 : 1
    return (
      <g>
        {line(h, open)}
        <path d={`M ${f[0]} ${f[1]} A ${r} ${r} 0 0 ${sweep} ${open[0]} ${open[1]}`} fill="none" stroke={ink} strokeWidth={px} strokeDasharray={`${4 * px} ${3 * px}`} />
      </g>
    )
  }
  return (
    <g>
      <polygon points={gap} fill={PAPER} />
      {o.kind === 'porte' && (o.hinge === 'gauche' ? arc(u0, u1, 1, o.width) : arc(u1, u0, 1, o.width))}
      {o.kind !== 'porte' && (
        <>
          {line(at(u0, T / 4), at(u1, T / 4), px)}
          {line(at(u0, -T / 4), at(u1, -T / 4), px)}
          {line(at(u0, T / 2), at(u0, -T / 2))}
          {line(at(u1, T / 2), at(u1, -T / 2))}
        </>
      )}
      {o.kind === 'porte-fenetre' && (
        <>
          {arc(u0, o.u, 1, o.width / 2)}
          {arc(u1, o.u, 1, o.width / 2)}
        </>
      )}
    </g>
  )
}

export function usePlanImage(plan: FloorPlan) {
  const [url, setUrl] = useState<string | null>(null)
  const id = plan.image?.id
  useEffect(() => {
    let alive = true
    if (id) imageUrl(id).then((u) => alive && setUrl(u))
    else setUrl(null)
    return () => {
      alive = false
    }
  }, [id])
  return url
}

/** Contenu du plan, en mètres. « px » = taille d'un pixel écran en mètres (traits et textes constants). */
export function PlanContent({
  plan,
  faces,
  px,
  sel = null,
  imageHref,
  showPoints = false,
  showLengths = false,
  selectedFace,
}: {
  plan: FloorPlan
  faces: Face[]
  px: number
  sel?: Sel
  imageHref?: string | null
  showPoints?: boolean
  showLengths?: boolean
  selectedFace?: string | null
}) {
  const segs = useMemo(() => wallSegs(plan), [plan])
  const img = plan.image
  return (
    <g>
      {img && imageHref && !img.hidden && (
        <image href={imageHref} x={0} y={0} width={img.widthPx * img.scale} height={img.heightPx * img.scale} opacity={img.opacity} preserveAspectRatio="none" />
      )}
      {faces.map((f) => (
        <polygon
          key={f.key}
          points={f.points.map((p) => `${p.x},${p.z}`).join(' ')}
          fill={selectedFace === f.key ? '#ead7dc' : f.label ? '#efe5d8' : '#f4efe8'}
          opacity={img && imageHref && !img.hidden ? 0.72 : 1}
        />
      ))}
      {segs.map((s) => (
        <polygon key={s.wall.id} points={wallPolygon(s)} fill={sel?.type === 'wall' && sel.id === s.wall.id ? BORD : INK} />
      ))}
      {plan.openings.map((o) => {
        const s = segs.find((x) => x.wall.id === o.wallId)
        return s ? <OpeningMark key={o.id} s={s} o={o} px={px} selected={sel?.type === 'opening' && sel.id === o.id} /> : null
      })}
      {showLengths &&
        segs
          .filter((s) => s.len / px > 70)
          .map((s) => {
            const off = s.wall.thickness / 2 + 12 * px
            const x = (s.a.x + s.b.x) / 2 - s.dz * off
            const z = (s.a.z + s.b.z) / 2 + s.dx * off
            return (
              <text key={`l-${s.wall.id}`} x={x} y={z} fontSize={11 * px} textAnchor="middle" dominantBaseline="middle" fill="#6e625c" className="plan-len">
                {fmtLen(s.len)}
              </text>
            )
          })}
      {faces.map((f) => {
        const a = f.label ?? faceAnchor(f)
        const big = 15 * px
        return (
          <g key={`t-${f.key}`} className="plan-room-text">
            <text x={a.x} y={a.z - 4 * px} fontSize={big} textAnchor="middle" fill={f.label ? INK : '#9a8f88'} fontFamily="'Instrument Serif', serif">
              {f.label ? f.label.name || 'Pièce' : ''}
            </text>
            <text x={a.x} y={a.z + 12 * px} fontSize={11 * px} textAnchor="middle" fill="#6e625c">
              {fmtArea(f.floorArea)}
            </text>
          </g>
        )
      })}
      {showPoints &&
        plan.points.map((p) => {
          const on = sel?.type === 'point' && sel.id === p.id
          return <circle key={p.id} cx={p.x} cy={p.z} r={(on ? 7 : 4.5) * px} fill={on ? BORD : '#fff'} stroke={on ? '#fff' : BORD} strokeWidth={1.6 * px} />
        })}
    </g>
  )
}

/** Miniature (cartes de l'accueil). */
export function PlanThumb({ plan, className }: { plan: FloorPlan; className?: string }) {
  const faces = useMemo(() => findFaces(plan), [plan])
  const b = useMemo(() => {
    if (!plan.points.length) return planBounds(plan)
    const xs = plan.points.map((p) => p.x)
    const zs = plan.points.map((p) => p.z)
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
  }, [plan])
  const url = usePlanImage(plan)
  const m = 0.6
  const w = b.maxX - b.minX + 2 * m
  const h = b.maxZ - b.minZ + 2 * m
  const px = Math.max(w, h) / 320
  return (
    <svg className={className} viewBox={`${b.minX - m} ${b.minZ - m} ${w} ${h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Plan : ${plan.name}`}>
      <rect x={b.minX - m} y={b.minZ - m} width={w} height={h} fill={PAPER} />
      <PlanContent plan={plan} faces={faces} px={px} imageHref={plan.points.length ? null : url} />
    </svg>
  )
}
