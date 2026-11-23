// Passages entre les meubles et zones d'ouverture, dessinés au sol (vue 3D) ou au-dessus de tout (plan).
import { useMemo } from 'react'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { shownLayout, useStore } from '../store'
import { findGaps, openingZones, type Comfort } from '../model/clearance'

export const COMFORT_COLOR: Record<Comfort, string> = { etroit: '#b23b2e', juste: '#c98a1b', ok: '#44634d' }

function Zone({ corners, y, blocked }: { corners: [number, number][]; y: number; blocked: boolean }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape(corners.map(([x, z]) => new THREE.Vector2(x, -z)))
    return new THREE.ShapeGeometry(s)
  }, [corners])
  const color = blocked ? '#b23b2e' : '#742f45'
  const pts = [...corners, corners[0]].map(([x, z]) => [x, y + 0.002, z] as [number, number, number])
  return (
    <group>
      <mesh geometry={geo} rotation-x={-Math.PI / 2} position-y={y} renderOrder={5}>
        <meshBasicMaterial color={color} transparent opacity={blocked ? 0.22 : 0.1} depthWrite={false} toneMapped={false} />
      </mesh>
      <Line points={pts} color={color} lineWidth={1.6} dashed dashSize={0.06} gapSize={0.04} toneMapped={false} />
    </group>
  )
}

export function ClearanceOverlay() {
  const on = useStore((s) => s.passages)
  const view = useStore((s) => s.view)
  const layout = useStore(shownLayout)
  const gaps = useMemo(() => (on ? findGaps(layout) : []), [on, layout])
  const zones = useMemo(() => (on ? openingZones(layout) : []), [on, layout])
  if (!on || view === 'yeux') return null
  // En plan, on dessine au-dessus des meubles ; en 3D, au sol
  const y = view === 'plan' ? layout.room.height + 0.02 : 0.025
  return (
    <group>
      {zones.map((z) => (
        <Zone key={z.item.uid} corners={z.corners} y={y} blocked={!!z.blockedBy} />
      ))}
      {gaps.map((g) => {
        const c = COMFORT_COLOR[g.comfort]
        const mid: [number, number, number] = [(g.from[0] + g.to[0]) / 2, y + 0.01, (g.from[1] + g.to[1]) / 2]
        return (
          <group key={g.key}>
            <Line points={[[g.from[0], y + 0.01, g.from[1]], [g.to[0], y + 0.01, g.to[1]]]} color={c} lineWidth={2.5} toneMapped={false} />
            {[g.from, g.to].map((p, i) => (
              <mesh key={i} position={[p[0], y + 0.01, p[1]]} rotation-x={-Math.PI / 2} renderOrder={6}>
                <circleGeometry args={[0.025, 16]} />
                <meshBasicMaterial color={c} toneMapped={false} depthWrite={false} />
              </mesh>
            ))}
            <Html position={mid} center zIndexRange={[9, 0]} style={{ pointerEvents: 'none' }}>
              <div className={`gap-tag ${g.comfort}`}>{Math.round(g.length * 100)} cm</div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}
