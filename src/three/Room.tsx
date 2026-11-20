// La pièce : sol texturé, murs, plinthes.
// En vue 3D, les murs situés entre la caméra et la pièce sont masqués
// (vue « maison de poupée ») pour toujours voir l'intérieur.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { FLOORS, floorTexture } from '../data/finishes'

export const WALL_T = 0.12 // épaisseur des murs (m)
const BASEBOARD_H = 0.08
const BASEBOARD_T = 0.015

function Floor() {
  const room = useStore((s) => s.room)
  const floorId = useStore((s) => s.floorId)
  const finish = FLOORS.find((f) => f.id === floorId) ?? FLOORS[0]
  const [map, normalMap, roughnessMap] = useTexture([
    floorTexture(finish.id, 'diff'),
    floorTexture(finish.id, 'nor'),
    floorTexture(finish.id, 'rough'),
  ])
  const gl = useThree((s) => s.gl)

  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace
    for (const t of [map, normalMap, roughnessMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
      t.repeat.set(room.width / finish.tileSize, room.depth / finish.tileSize)
      t.needsUpdate = true
    }
  }, [map, normalMap, roughnessMap, room.width, room.depth, finish.tileSize, gl])

  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[room.width, room.depth]} />
      <meshStandardMaterial
        map={map}
        normalMap={normalMap}
        normalScale={new THREE.Vector2(0.6, 0.6)}
        roughnessMap={roughnessMap}
        roughness={finish.roughnessScale}
        envMapIntensity={0.7}
      />
    </mesh>
  )
}

interface WallDef {
  key: string
  position: [number, number, number]
  size: [number, number, number]
  /** Normale tournée vers l'intérieur de la pièce */
  inward: THREE.Vector3
  baseboard: { position: [number, number, number]; size: [number, number, number] }
}

function Walls() {
  const { width: W, depth: D, height: H } = useStore((s) => s.room)
  const wallColor = useStore((s) => s.wallColor)
  const view = useStore((s) => s.view)
  const refs = useRef<Record<string, THREE.Group | null>>({})
  const invalidate = useThree((s) => s.invalidate)

  const walls = useMemo<WallDef[]>(() => {
    const bbY = BASEBOARD_H / 2
    return [
      {
        key: 'nord',
        position: [0, H / 2, -D / 2 - WALL_T / 2],
        size: [W + 2 * WALL_T, H, WALL_T],
        inward: new THREE.Vector3(0, 0, 1),
        baseboard: { position: [0, bbY, -D / 2 + BASEBOARD_T / 2], size: [W, BASEBOARD_H, BASEBOARD_T] },
      },
      {
        key: 'sud',
        position: [0, H / 2, D / 2 + WALL_T / 2],
        size: [W + 2 * WALL_T, H, WALL_T],
        inward: new THREE.Vector3(0, 0, -1),
        baseboard: { position: [0, bbY, D / 2 - BASEBOARD_T / 2], size: [W, BASEBOARD_H, BASEBOARD_T] },
      },
      {
        key: 'ouest',
        position: [-W / 2 - WALL_T / 2, H / 2, 0],
        size: [WALL_T, H, D],
        inward: new THREE.Vector3(1, 0, 0),
        baseboard: { position: [-W / 2 + BASEBOARD_T / 2, bbY, 0], size: [BASEBOARD_T, BASEBOARD_H, D] },
      },
      {
        key: 'est',
        position: [W / 2 + WALL_T / 2, H / 2, 0],
        size: [WALL_T, H, D],
        inward: new THREE.Vector3(-1, 0, 0),
        baseboard: { position: [W / 2 - BASEBOARD_T / 2, bbY, 0], size: [BASEBOARD_T, BASEBOARD_H, D] },
      },
    ]
  }, [W, D, H])

  const tmp = useMemo(() => new THREE.Vector3(), [])

  // Masque les murs « devant » la caméra
  useFrame(({ camera }) => {
    let changed = false
    for (const w of walls) {
      const g = refs.current[w.key]
      if (!g) continue
      let visible = true
      if (view === '3d') {
        tmp.set(...w.position)
        // Point sur la face intérieure du mur
        tmp.addScaledVector(w.inward, WALL_T / 2)
        const side = tmp.sub(camera.position).multiplyScalar(-1).dot(w.inward)
        visible = side > -0.05
      }
      if (g.visible !== visible) {
        g.visible = visible
        changed = true
      }
    }
    if (changed) invalidate()
  })

  return (
    <group>
      {walls.map((w) => (
        <group key={w.key} ref={(el) => { refs.current[w.key] = el }}>
          <mesh position={w.position} receiveShadow>
            <boxGeometry args={w.size} />
            <meshStandardMaterial color={wallColor} roughness={0.92} envMapIntensity={0.4} />
          </mesh>
          <mesh position={w.baseboard.position} castShadow={false} receiveShadow>
            <boxGeometry args={w.baseboard.size} />
            <meshStandardMaterial color="#f4f2ee" roughness={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Grand sol neutre autour de la pièce, pour ne pas flotter dans le vide. */
function Ground() {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.005}>
      <circleGeometry args={[40, 48]} />
      <meshStandardMaterial color="#cdc6bb" roughness={1} />
    </mesh>
  )
}

export function Room() {
  const invalidate = useThree((s) => s.invalidate)
  const view = useStore((s) => s.view)
  useEffect(() => invalidate(), [view, invalidate])
  return (
    <group>
      <Ground />
      <Floor />
      <Walls />
    </group>
  )
}
