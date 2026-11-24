// Passages entre les meubles et zones d'ouverture, dessinés au sol (vue 3D) ou au-dessus de tout (plan).
import { useMemo } from 'react'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { shownLayout, useStore } from '../store'
import type { Comfort } from '../model/clearance'
import { useClearance } from '../ui/clearanceView'

export const COMFORT_COLOR: Record<Comfort, string> = { etroit: '#b23b2e', juste: '#c98a1b', ok: '#44634d' }

function Zone({ corners, y, blocked, focused }: { corners: [number, number][]; y: number; blocked: boolean; focused: boolean }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape(corners.map(([x, z]) => new THREE.Vector2(x, -z)))
    return new THREE.ShapeGeometry(s)
  }, [corners])
  const color = blocked ? '#b23b2e' : '#742f45'
  const pts = [...corners, corners[0]].map(([x, z]) => [x, y + 0.002, z] as [number, number, number])
  return (
    <group>
      <mesh geometry={geo} rotation-x={-Math.PI / 2} position-y={y} renderOrder={5}>
        <meshBasicMaterial color={color} transparent opacity={focused ? 0.38 : blocked ? 0.22 : 0.12} depthWrite={false} toneMapped={false} />
      </mesh>
      <Line points={pts} color={color} lineWidth={focused ? 3.5 : 1.6} dashed={!focused} dashSize={0.06} gapSize={0.04} toneMapped={false} />
    </group>
  )
}

export function ClearanceOverlay() {
  const on = useStore((s) => s.passages)
  const selection = useStore((s) => s.selection)
  const focus = useStore((s) => s.passageFocus)
  const view = useStore((s) => s.view)
  const layout = useStore(shownLayout)
  const { gaps, zones } = useClearance(layout, on, selection)
  if (view === 'yeux' || (!gaps.length && !zones.length)) return null
  // En plan, on dessine au-dessus des meubles ; en 3D, au sol
  const y = view === 'plan' ? layout.room.height + 0.02 : 0.025
  return (
    <group>
      {zones.map((z) => (
        <Zone key={z.key} corners={z.corners} y={y} blocked={!!z.blockedBy} focused={focus === z.key} />
      ))}
      {gaps.map((g) => {
        const c = COMFORT_COLOR[g.comfort]
        const f = focus === g.key
        const mid: [number, number, number] = [(g.from[0] + g.to[0]) / 2, y + 0.01, (g.from[1] + g.to[1]) / 2]
        return (
          <group key={g.key}>
            <Line points={[[g.from[0], y + 0.01, g.from[1]], [g.to[0], y + 0.01, g.to[1]]]} color={c} lineWidth={f ? 6 : 2.5} toneMapped={false} />
            {[g.from, g.to].map((p, i) => (
              <mesh key={i} position={[p[0], y + 0.01, p[1]]} rotation-x={-Math.PI / 2} renderOrder={6}>
                <circleGeometry args={[f ? 0.045 : 0.025, 16]} />
                <meshBasicMaterial color={c} toneMapped={false} depthWrite={false} />
              </mesh>
            ))}
            <Html position={mid} center zIndexRange={[9, 0]} style={{ pointerEvents: 'none' }}>
              <div className={`gap-tag ${g.comfort} ${f ? 'focused' : ''}`}>{Math.round(g.length * 100)} cm</div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}
