// Représentation « plan d'architecte » en vue du dessus :
// murs en brun charbon, fenêtres en double trait, portes avec sens d'ouverture,
// placards (rectangle barré), niches, numéros des murs, grille facultative.
// Les murs et ouvertures se sélectionnent d'un toucher ; une ouverture sélectionnée glisse le long de son mur.
import { useMemo } from 'react'
import { Html, Line } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { shownLayout, useStore } from '../store'
import { GRID_STEP } from '../model/geometry'
import { WALL_LABEL } from '../model/types'
import { wallFrame, type WallOpening, type WallSpec } from './architecture'
import { roomWalls } from './Room'
import { startOpeningDrag } from './drag'

const INK = '#292321'
const ACCENT = '#742f45'
const PAPER = '#f8f5f0'

type Pt = [number, number, number]

function OpeningPlan({ o, T, selected }: { o: WallOpening; T: number; selected: boolean }) {
  const u0 = o.u - o.width / 2
  const u1 = o.u + o.width / 2
  const ink = selected ? ACCENT : INK
  const lw = selected ? 2.2 : 1.2
  if (o.kind === 'placard') {
    const d = o.depth
    return (
      <group>
        <mesh position={[o.u, -0.002, d / 2]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[o.width, d]} />
          <meshBasicMaterial color={PAPER} toneMapped={false} />
        </mesh>
        <Line points={[[u0, 0, 0], [u0, 0, d], [u1, 0, d], [u1, 0, 0]]} color={ink} lineWidth={lw} />
        <Line points={[[u0, 0, 0], [u1, 0, d]]} color={ink} lineWidth={0.8} />
        <Line points={[[u1, 0, 0], [u0, 0, d]]} color={ink} lineWidth={0.8} />
      </group>
    )
  }
  if (o.kind === 'niche') {
    const d = o.depth
    return (
      <group>
        <mesh position={[o.u, 0.001, -d / 2]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[o.width, d]} />
          <meshBasicMaterial color={PAPER} toneMapped={false} />
        </mesh>
        <Line points={[[u0, 0.002, 0], [u0, 0.002, -d], [u1, 0.002, -d], [u1, 0.002, 0]]} color={ink} lineWidth={lw} />
      </group>
    )
  }
  const glass = (
    <group>
      <mesh position={[o.u, -0.001, -T / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[o.width, T]} />
        <meshBasicMaterial color={PAPER} toneMapped={false} />
      </mesh>
      <Line points={[[u0, 0, -T * 0.42], [u1, 0, -T * 0.42]]} color={ink} lineWidth={lw} />
      <Line points={[[u0, 0, -T * 0.58], [u1, 0, -T * 0.58]]} color={ink} lineWidth={lw} />
      <Line points={[[u0, 0, 0], [u0, 0, -T]]} color={ink} lineWidth={1} />
      <Line points={[[u1, 0, 0], [u1, 0, -T]]} color={ink} lineWidth={1} />
    </group>
  )
  if (o.kind === 'fenetre') return glass
  // Battants : arc de débattement (pointillé) et vantail ouvert à 90°
  const arc = (hingeU: number, len: number, dirSign: number): Pt[] => {
    const pts: Pt[] = []
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * (Math.PI / 2)
      pts.push([hingeU + dirSign * Math.cos(a) * len, 0, Math.sin(a) * len])
    }
    return pts
  }
  if (o.kind === 'porte-fenetre') {
    const half = o.width / 2
    return (
      <group>
        {glass}
        <Line points={[[u0, 0, 0], [u0, 0, half]]} color={ink} lineWidth={lw + 0.6} />
        <Line points={[[u1, 0, 0], [u1, 0, half]]} color={ink} lineWidth={lw + 0.6} />
        <Line points={arc(u0, half, 1)} color={ink} lineWidth={0.9} dashed dashSize={0.05} gapSize={0.035} />
        <Line points={arc(u1, half, -1)} color={ink} lineWidth={0.9} dashed dashSize={0.05} gapSize={0.035} />
      </group>
    )
  }
  // Porte : charnière à gauche ou à droite vue depuis la pièce (la droite est vers +x)
  const hingeU = o.hinge === 'gauche' ? u0 : u1
  const sign = o.hinge === 'gauche' ? 1 : -1
  return (
    <group>
      <mesh position={[o.u, -0.001, -T / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[o.width, T]} />
        <meshBasicMaterial color={PAPER} toneMapped={false} />
      </mesh>
      <Line points={[[hingeU, 0, 0], [hingeU, 0, o.width]]} color={ink} lineWidth={lw + 0.8} />
      <Line points={arc(hingeU, o.width, sign)} color={ink} lineWidth={0.9} dashed dashSize={0.06} gapSize={0.04} />
    </group>
  )
}

function WallPlan({ spec, side }: { spec: WallSpec; side: keyof typeof WALL_LABEL }) {
  const { length, angle, position } = wallFrame(spec)
  const T = spec.thickness
  const y = spec.height + 0.02
  const ext = spec.extendEnds ? T : 0
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null
  const wallSelected = selection?.type === 'wall' && selection.id === side
  const solids = useMemo(() => {
    const cuts = spec.openings
      .filter((o) => o.kind !== 'placard')
      .map((o) => [o.u - o.width / 2, o.u + o.width / 2])
      .sort((p, q) => p[0] - q[0])
    const spans: [number, number][] = []
    let s = -ext
    for (const [c0, c1] of cuts) {
      if (c0 > s) spans.push([s, c0])
      s = Math.max(s, c1)
    }
    spans.push([s, length + ext])
    return spans
  }, [spec.openings, length, ext])

  const tap = (e: ThreeEvent<MouseEvent>) => e.delta < 8

  return (
    <group position={[position[0], y, position[2]]} rotation-y={angle}>
      {/* Zone de toucher élargie pour sélectionner le mur facilement au doigt */}
      <mesh
        position={[length / 2, -0.01, -T / 2]}
        rotation-x={-Math.PI / 2}
        onClick={(e) => {
          if (!tap(e)) return
          e.stopPropagation()
          select({ type: 'wall', id: side })
        }}
      >
        <planeGeometry args={[length, T + 0.16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {solids.map(([u0, u1]) => (
        <mesh key={u0} position={[(u0 + u1) / 2, 0, -T / 2]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[u1 - u0, T]} />
          <meshBasicMaterial color={wallSelected ? ACCENT : INK} toneMapped={false} />
        </mesh>
      ))}
      {spec.openings.map((o) => {
        const sel = selection?.type === 'opening' && selection.id === o.id
        return (
          <group
            key={o.id}
            onClick={(e) => {
              if (!tap(e)) return
              e.stopPropagation()
              select({ type: 'opening', id: o.id })
            }}
            onPointerDown={(e) => {
              if (!sel) return
              e.stopPropagation()
              if (controls) controls.enabled = false
              startOpeningDrag(o.id, e.ray, e.pointerId)
            }}
          >
            {/* Zone de toucher de l'ouverture */}
            <mesh position={[o.u, 0.01, o.kind === 'placard' ? o.depth / 2 : -T / 2]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[o.width, o.kind === 'placard' ? o.depth : T + 0.2]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            <OpeningPlan o={o} T={T} selected={sel} />
          </group>
        )
      })}
      <Html position={[length / 2, 0, -T - 0.22]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`wall-tag ${wallSelected ? 'active' : ''}`}>
          {WALL_LABEL[side]} · {length.toFixed(2).replace('.', ',')} m
        </div>
      </Html>
    </group>
  )
}

function Grid() {
  const { width: W, depth: D, height: H } = useStore((s) => shownLayout(s).room)
  const lines = useMemo(() => {
    const out: Pt[][] = []
    for (let x = Math.ceil(-W / 2 / GRID_STEP) * GRID_STEP; x <= W / 2 + 1e-6; x += GRID_STEP) out.push([[x, H + 0.01, -D / 2], [x, H + 0.01, D / 2]])
    for (let z = Math.ceil(-D / 2 / GRID_STEP) * GRID_STEP; z <= D / 2 + 1e-6; z += GRID_STEP) out.push([[-W / 2, H + 0.01, z], [W / 2, H + 0.01, z]])
    return out
  }, [W, D, H])
  return (
    <group>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color={INK} lineWidth={0.5} transparent opacity={0.12} />
      ))}
    </group>
  )
}

export function PlanOverlay() {
  const view = useStore((s) => s.view)
  const room = useStore((s) => shownLayout(s).room)
  const openings = useStore((s) => shownLayout(s).openings)
  const grid = useStore((s) => s.snap.grid)
  const walls = useMemo(() => roomWalls(room, openings), [room, openings])
  if (view !== 'plan') return null
  return (
    <group>
      {grid && <Grid />}
      {walls.map((w) => (
        <WallPlan key={w.key} spec={w} side={w.side} />
      ))}
    </group>
  )
}
