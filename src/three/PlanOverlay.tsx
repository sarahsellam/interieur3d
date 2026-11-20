// Représentation « plan d'architecte » en vue du dessus :
// murs pochés (gris foncé), fenêtres en double trait, portes avec arc d'ouverture.
import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { useStore } from '../store'
import { wallFrame, type WallSpec } from './architecture'
import { roomWalls } from './Room'

const POCHE = '#3a3936'
const LINE = '#2c2b29'

function WallPlan({ spec }: { spec: WallSpec }) {
  const { length, angle, position } = wallFrame(spec)
  const T = spec.thickness
  const y = spec.height + 0.02
  const ext = spec.extendEnds ? T : 0
  const solids = useMemo(() => {
    const cuts = spec.openings.map((o) => [o.u - o.width / 2, o.u + o.width / 2]).sort((p, q) => p[0] - q[0])
    const spans: [number, number][] = []
    let s = -ext
    for (const [c0, c1] of cuts) {
      if (c0 > s) spans.push([s, c0])
      s = Math.max(s, c1)
    }
    spans.push([s, length + ext])
    return spans
  }, [spec.openings, length, ext])

  return (
    <group position={[position[0], y, position[2]]} rotation-y={angle}>
      {solids.map(([u0, u1]) => (
        <mesh key={u0} position={[(u0 + u1) / 2, 0, -T / 2]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[u1 - u0, T]} />
          <meshBasicMaterial color={POCHE} toneMapped={false} />
        </mesh>
      ))}
      {spec.openings.map((o) => {
        const u0 = o.u - o.width / 2
        const u1 = o.u + o.width / 2
        if (o.kind === 'fenetre') {
          return (
            <group key={o.id}>
              <mesh position={[o.u, -0.001, -T / 2]} rotation-x={-Math.PI / 2}>
                <planeGeometry args={[o.width, T]} />
                <meshBasicMaterial color="#f4f2ee" toneMapped={false} />
              </mesh>
              <Line points={[[u0, 0, -T * 0.42], [u1, 0, -T * 0.42]]} color={LINE} lineWidth={1.2} />
              <Line points={[[u0, 0, -T * 0.58], [u1, 0, -T * 0.58]]} color={LINE} lineWidth={1.2} />
              <Line points={[[u0, 0, 0], [u1, 0, 0]]} color={LINE} lineWidth={1} />
              <Line points={[[u0, 0, -T], [u1, 0, -T]]} color={LINE} lineWidth={1} />
            </group>
          )
        }
        // Porte : vantail ouvert à 90° vers l'intérieur et arc de débattement
        const arc: [number, number, number][] = []
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * (Math.PI / 2)
          arc.push([u1 - Math.cos(a) * o.width, 0, Math.sin(a) * o.width])
        }
        return (
          <group key={o.id}>
            <Line points={[[u1, 0, 0], [u1, 0, o.width]]} color={LINE} lineWidth={2} />
            <Line points={arc} color={LINE} lineWidth={1} dashed dashSize={0.06} gapSize={0.04} />
          </group>
        )
      })}
    </group>
  )
}

export function PlanOverlay() {
  const view = useStore((s) => s.view)
  const room = useStore((s) => s.room)
  const walls = useMemo(() => roomWalls(room), [room])
  if (view !== 'top') return null
  return (
    <group>
      {walls.map((w) => (
        <WallPlan key={w.key} spec={w} />
      ))}
    </group>
  )
}
