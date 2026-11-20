// La pièce : sol PBR, murs en enduit peint, fenêtres, porte, plinthes, corniches, plafond.
// En vue 3D d'ensemble, les murs entre la caméra et la pièce sont masqués
// (vue « maison de poupée ») mais continuent de bloquer le soleil : la lumière
// n'entre que par les fenêtres, quel que soit l'angle de vue.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { DEFAULT_OPENINGS, useStore, type Opening, type Room as RoomDims, type WallSide } from '../store'
import { FLOORS, floorTexture, texture } from '../data/finishes'
import { Wall, type ArchMaterials, type WallSpec } from './architecture'

export const WALL_T = 0.16 // épaisseur des murs (m)
/** Calque des objets masqués à la vue mais qui projettent encore leur ombre. */
export const SHADOW_ONLY_LAYER = 1

const setLayer = (o: THREE.Object3D, visible: boolean) =>
  o.traverse((c) => (visible ? c.layers.set(0) : c.layers.set(SHADOW_ONLY_LAYER)))

/** Murs de la pièce rectangulaire, avec leurs ouvertures (coordonnées sur la face intérieure). */
export function roomWalls(room: RoomDims, openings: Opening[] = DEFAULT_OPENINGS): (WallSpec & { inward: THREE.Vector3 })[] {
  const { width: W, depth: D, height: H } = room
  const corners: Record<WallSide, { a: [number, number]; b: [number, number]; inward: THREE.Vector3 }> = {
    nord: { a: [-W / 2, -D / 2], b: [W / 2, -D / 2], inward: new THREE.Vector3(0, 0, 1) },
    est: { a: [W / 2, -D / 2], b: [W / 2, D / 2], inward: new THREE.Vector3(-1, 0, 0) },
    sud: { a: [W / 2, D / 2], b: [-W / 2, D / 2], inward: new THREE.Vector3(0, 0, -1) },
    ouest: { a: [-W / 2, D / 2], b: [-W / 2, -D / 2], inward: new THREE.Vector3(1, 0, 0) },
  }
  return (Object.keys(corners) as WallSide[]).map((side) => {
    const c = corners[side]
    const length = Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1])
    const ops = openings
      .filter((o) => o.wall === side)
      .map((o) => {
        const width = Math.min(o.width, length - 0.3)
        const half = length / 2 - width / 2 - 0.12
        const u = length / 2 + Math.max(-half, Math.min(half, o.offset))
        const height = Math.min(o.height, H - o.sill - 0.15)
        return { id: o.id, kind: o.kind, u, width, height, sill: o.sill }
      })
    return { key: side, a: c.a, b: c.b, inward: c.inward, thickness: WALL_T, height: H, openings: ops, extendEnds: true }
  })
}

/** Centre (côté intérieur) et normale de chaque fenêtre, pour placer la lumière du jour. */
export function windowLights(room: RoomDims) {
  return roomWalls(room).flatMap((w) =>
    w.openings
      .filter((o) => o.kind === 'fenetre')
      .map((o) => {
        const dir = new THREE.Vector3(w.b[0] - w.a[0], 0, w.b[1] - w.a[1]).normalize()
        const center = new THREE.Vector3(w.a[0], o.sill + o.height / 2, w.a[1]).addScaledVector(dir, o.u)
        return { id: o.id, center, inward: w.inward.clone(), width: o.width, height: o.height }
      }),
  )
}

function useArchMaterials(wallColor: string): ArchMaterials {
  const [detail, nor, rough] = useTexture([texture('plaster_detail'), texture('plaster_nor'), texture('plaster_rough')])
  const mats = useMemo(() => {
    for (const t of [detail, nor, rough]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(1 / 1.4, 1 / 1.4)
    }
    detail.colorSpace = THREE.SRGBColorSpace
    const paint = (color: string, normal: number) =>
      new THREE.MeshStandardMaterial({
        color,
        map: detail,
        normalMap: nor,
        normalScale: new THREE.Vector2(normal, normal),
        roughnessMap: rough,
        roughness: 0.95,
        envMapIntensity: 0.5,
      })
    return {
      wall: paint(wallColor, 0.15),
      ceiling: paint('#f6f4f0', 0.08),
      trim: new THREE.MeshStandardMaterial({ color: '#f1efea', roughness: 0.38, envMapIntensity: 0.7 }),
      frame: new THREE.MeshStandardMaterial({ color: '#f4f3f0', roughness: 0.3, envMapIntensity: 0.8 }),
      sill: new THREE.MeshStandardMaterial({ color: '#e9e6e0', roughness: 0.25, envMapIntensity: 0.9 }),
      metal: new THREE.MeshStandardMaterial({ color: '#c9c7c2', metalness: 1, roughness: 0.32 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.1,
        roughness: 0.03,
        metalness: 0,
        envMapIntensity: 1.6,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, nor, rough])
  useEffect(() => {
    ;(mats.wall as THREE.MeshStandardMaterial).color.set(wallColor)
  }, [wallColor, mats])
  return mats
}

function Floor() {
  const room = useStore((s) => s.room)
  const floorId = useStore((s) => s.floorId)
  const finish = FLOORS.find((f) => f.id === floorId) ?? FLOORS[0]
  const [map, normalMap, roughnessMap, aoMap] = useTexture([
    floorTexture(finish.id, 'diff'),
    floorTexture(finish.id, 'nor'),
    floorTexture(finish.id, 'rough'),
    floorTexture(finish.id, 'ao'),
  ])
  const gl = useThree((s) => s.gl)
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace
    for (const t of [map, normalMap, roughnessMap, aoMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
      t.repeat.set(room.width / finish.tileSize, room.depth / finish.tileSize)
      t.needsUpdate = true
    }
  }, [map, normalMap, roughnessMap, aoMap, room.width, room.depth, finish.tileSize, gl])

  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow name="sol">
      <planeGeometry args={[room.width, room.depth]} />
      <meshStandardMaterial
        map={map}
        normalMap={normalMap}
        normalScale={new THREE.Vector2(finish.normalScale, finish.normalScale)}
        roughnessMap={roughnessMap}
        roughness={finish.roughness}
        aoMap={aoMap}
        aoMapIntensity={0.8}
        envMapIntensity={0.9}
      />
    </mesh>
  )
}

function Walls({ m }: { m: ArchMaterials }) {
  const room = useStore((s) => s.room)
  const view = useStore((s) => s.view)
  const refs = useRef<Record<string, THREE.Group | null>>({})
  const state = useRef<Record<string, boolean>>({})
  const invalidate = useThree((s) => s.invalidate)
  const walls = useMemo(() => roomWalls(room), [room])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ camera }) => {
    let changed = false
    for (const w of walls) {
      const g = refs.current[w.key]
      if (!g) continue
      let visible = true
      if (view === '3d') {
        tmp.set(w.a[0], 0, w.a[1])
        visible = camera.position.clone().sub(tmp).dot(w.inward) > -0.05
      }
      if (state.current[w.key] !== visible) {
        state.current[w.key] = visible
        setLayer(g, visible)
        changed = true
      }
    }
    if (changed) invalidate()
  })

  return (
    <group>
      {walls.map((w) => (
        <Wall
          key={w.key}
          spec={w}
          m={m}
          groupRef={(el) => {
            if (refs.current[w.key] !== el) delete state.current[w.key]
            refs.current[w.key] = el
          }}
        />
      ))}
    </group>
  )
}

function Ceiling({ m }: { m: ArchMaterials }) {
  const { width: W, depth: D, height: H } = useStore((s) => s.room)
  const view = useStore((s) => s.view)
  const ref = useRef<THREE.Mesh>(null)
  useEffect(() => {
    if (ref.current) setLayer(ref.current, view === 'visite')
  }, [view, W, D, H])
  return (
    <mesh ref={ref} position={[0, H, 0]} rotation-x={Math.PI / 2} material={m.ceiling} castShadow receiveShadow>
      <planeGeometry args={[W + 2 * WALL_T, D + 2 * WALL_T]} />
    </mesh>
  )
}

/** Le jardin vu par les fenêtres (panorama réel), uniquement en mode visite. */
function Outside() {
  const view = useStore((s) => s.view)
  const tex = useTexture(texture('../hdr/exterieur'))
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.mapping = THREE.EquirectangularReflectionMapping
  }, [tex])
  if (view !== 'visite') return null
  return (
    <mesh position={[0, 1.6, 0]} renderOrder={-1}>
      <sphereGeometry args={[60, 48, 24]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} color={new THREE.Color(1.35, 1.35, 1.35)} depthWrite={false} />
    </mesh>
  )
}

/** Sol neutre autour de la pièce, pour la vue d'ensemble. */
function Ground() {
  const view = useStore((s) => s.view)
  if (view === 'visite') return null
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.004}>
      <circleGeometry args={[40, 64]} />
      <meshStandardMaterial color="#d8d3cb" roughness={1} envMapIntensity={0.6} />
    </mesh>
  )
}

export function Room() {
  const wallColor = useStore((s) => s.wallColor)
  const m = useArchMaterials(wallColor)
  return (
    <group>
      <Ground />
      <Floor />
      <Walls m={m} />
      <Ceiling m={m} />
      <Outside />
    </group>
  )
}
