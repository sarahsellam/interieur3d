// La pièce : sol PBR, murs en enduit peint, fenêtres, porte, plinthes, corniches, plafond.
// En vue 3D d'ensemble, les murs entre la caméra et la pièce sont masqués
// (vue « maison de poupée ») mais continuent de bloquer le soleil : la lumière
// n'entre que par les fenêtres, quel que soit l'angle de vue.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { shownLayout, useStore, type Opening, type Room as RoomDims, type WallSide } from '../store'
import { FLOORS, floorTexture, texture } from '../data/finishes'
import { openingDepth } from '../model/geometry'
import { Wall, type ArchMaterials, type WallSpec } from './architecture'
import { startOpeningDrag } from './drag'
import { DecorPiece } from './WallDecor'

export const WALL_T = 0.12 // épaisseur des murs (m)
/** Calque des objets masqués à la vue mais qui projettent encore leur ombre. */
export const SHADOW_ONLY_LAYER = 1

const setLayer = (o: THREE.Object3D, visible: boolean) =>
  o.traverse((c) => (visible ? c.layers.set(0) : c.layers.set(SHADOW_ONLY_LAYER)))

/** Murs de la pièce rectangulaire, avec leurs ouvertures (coordonnées sur la face intérieure). */
export function roomWalls(room: RoomDims, openings: Opening[]): (WallSpec & { inward: THREE.Vector3; side: WallSide })[] {
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
        const width = Math.min(o.width, length - 0.1)
        const half = Math.max(0, length / 2 - width / 2)
        const u = length / 2 + Math.max(-half, Math.min(half, o.offset))
        const height = Math.min(o.height, H - o.sill - (o.kind === 'placard' ? 0 : 0.05))
        return { id: o.id, kind: o.kind, u, width, height, sill: o.sill, depth: openingDepth(o), hinge: o.hinge ?? 'droite' }
      })
    return { key: side, side, a: c.a, b: c.b, inward: c.inward, thickness: WALL_T, height: H, openings: ops, extendEnds: true }
  })
}

/** Centre (côté intérieur) et normale de chaque fenêtre, pour placer la lumière du jour. */
export function windowLights(room: RoomDims, openings: Opening[]) {
  return roomWalls(room, openings).flatMap((w) =>
    w.openings
      .filter((o) => o.kind === 'fenetre' || o.kind === 'porte-fenetre')
      .map((o) => {
        const dir = new THREE.Vector3(w.b[0] - w.a[0], 0, w.b[1] - w.a[1]).normalize()
        const center = new THREE.Vector3(w.a[0], o.sill + o.height / 2, w.a[1]).addScaledVector(dir, o.u)
        return { id: o.id, center, inward: w.inward.clone(), width: o.width, height: o.height }
      }),
  )
}

export function useArchMaterials(wallColors: Record<WallSide, string>): { m: ArchMaterials; walls: Record<WallSide, THREE.MeshStandardMaterial> } {
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
      wall: paint('#ece8e1', 0.15),
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
  // Une peinture par mur, pour pouvoir choisir la couleur mur par mur
  const walls = useMemo(() => {
    const out = {} as Record<WallSide, THREE.MeshStandardMaterial>
    for (const side of ['nord', 'est', 'sud', 'ouest'] as WallSide[]) out[side] = (mats.wall as THREE.MeshStandardMaterial).clone()
    return out
  }, [mats])
  useEffect(() => {
    for (const side of Object.keys(walls) as WallSide[]) walls[side].color.set(wallColors[side])
  }, [wallColors, walls])
  return { m: mats, walls }
}

function Floor() {
  const room = useStore((s) => shownLayout(s).room)
  const floorId = useStore((s) => shownLayout(s).floorId)
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

function Walls({ m, wallMats }: { m: ArchMaterials; wallMats: Record<WallSide, THREE.MeshStandardMaterial> }) {
  const room = useStore((s) => shownLayout(s).room)
  const openings = useStore((s) => shownLayout(s).openings)
  const decor = useStore((s) => shownLayout(s).decor)
  const view = useStore((s) => s.view)
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const refs = useRef<Record<string, THREE.Group | null>>({})
  const state = useRef<Record<string, boolean>>({})
  const invalidate = useThree((s) => s.invalidate)
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null
  const walls = useMemo(() => roomWalls(room, openings), [room, openings])
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

  // Un toucher bref sur un mur ou une ouverture la sélectionne ; glisser une ouverture déjà sélectionnée la déplace
  const tap = (e: ThreeEvent<MouseEvent>) => e.delta < 8
  return (
    <group>
      {walls.map((w) => (
        <Wall
          key={w.key}
          spec={w}
          m={m}
          wallMat={wallMats[w.side]}
          groupRef={(el) => {
            if (refs.current[w.key] !== el) delete state.current[w.key]
            refs.current[w.key] = el
          }}
          handlers={{
            selectedWall: selection?.type === 'wall' && selection.id === w.side,
            selectedOpening: selection?.type === 'opening' ? selection.id : null,
            onWallClick: (e) => {
              if (!tap(e)) return
              e.stopPropagation()
              select({ type: 'wall', id: w.side })
            },
            onOpeningClick: (id, e) => {
              if (!tap(e)) return
              e.stopPropagation()
              select({ type: 'opening', id })
            },
            onOpeningDown: (id, e) => {
              const sel = useStore.getState().selection
              if (sel?.type !== 'opening' || sel.id !== id) return
              e.stopPropagation()
              if (controls) controls.enabled = false
              startOpeningDrag(id, e.ray, e.pointerId)
            },
          }}
        >
          {(decor ?? [])
            .filter((d) => d.wall === w.side)
            .map((d) => {
              const length = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1])
              return <DecorPiece key={d.id} d={d} u={length / 2 + d.offset} selected={selection?.type === 'decor' && selection.id === d.id} />
            })}
        </Wall>
      ))}
    </group>
  )
}

function Ceiling({ m }: { m: ArchMaterials }) {
  const { width: W, depth: D, height: H } = useStore((s) => shownLayout(s).room)
  const view = useStore((s) => s.view)
  const ref = useRef<THREE.Mesh>(null)
  useEffect(() => {
    if (ref.current) setLayer(ref.current, view === 'yeux')
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
  if (view !== 'yeux') return null
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
  if (view === 'yeux') return null
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.004}>
      <circleGeometry args={[40, 64]} />
      <meshStandardMaterial color="#ddd5ca" roughness={1} envMapIntensity={0.6} />
    </mesh>
  )
}

export function Room() {
  const wallColors = useStore((s) => shownLayout(s).wallColors)
  const { m, walls } = useArchMaterials(wallColors)
  return (
    <group>
      <Ground />
      <Floor />
      <Walls m={m} wallMats={walls} />
      <Ceiling m={m} />
      <Outside />
    </group>
  )
}
