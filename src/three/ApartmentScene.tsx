// Visite 3D d'un appartement tracé sur plan : murs de la hauteur choisie (2,50 m par défaut),
// portes ouvertes, fenêtres, parquet dans les pièces de vie et carrelage dans les pièces d'eau.
// - « Vue 3D » : maquette vue d'en haut, sans plafond.
// - « Visite » : à hauteur des yeux, on marche d'une pièce à l'autre en passant par les portes.
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, SoftShadows, useTexture } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { AmbientEnvironment } from './AmbientEnvironment'
import { Wall, type WallSpec } from './architecture'
import { useArchMaterials } from './Room'
import { EYE_HEIGHT, WalkControls, type WalkNav } from './WalkControls'
import { FLOORS, floorTexture, texture } from '../data/finishes'
import { faceAnchor, findFaces, pointInPolygon, projectOnSeg, wallSegs, type Face, type FloorPlan } from '../model/plan'
import type { PlanView } from '../planStore'
import type { WallSide } from '../model/types'

const WALL_COLOR = '#ece8e1'
const COLORS: Record<WallSide, string> = { nord: WALL_COLOR, est: WALL_COLOR, sud: WALL_COLOR, ouest: WALL_COLOR }

/** Murs de l'appartement, centrés sur leur axe, avec leurs ouvertures. */
function apartmentWalls(plan: FloorPlan): WallSpec[] {
  return wallSegs(plan).map((s) => {
    const h = s.wall.thickness / 2
    // Le mur est construit du côté « gauche » de son segment : on le décale d'une demi-épaisseur
    const nx = -s.dz * h
    const nz = s.dx * h
    return {
      key: s.wall.id,
      a: [s.a.x + nx, s.a.z + nz],
      b: [s.b.x + nx, s.b.z + nz],
      thickness: s.wall.thickness,
      height: plan.height,
      extendEnds: h,
      twoSided: true,
      openings: plan.openings
        .filter((o) => o.wallId === s.wall.id)
        .map((o) => ({
          id: o.id,
          kind: o.kind,
          u: o.u,
          width: o.width,
          height: Math.min(o.height, plan.height - o.sill - 0.05),
          sill: o.sill,
          depth: 0,
          hinge: o.hinge ?? 'droite',
          open: true,
        })),
    }
  })
}

const isWet = (name?: string) => !!name && /bain|douche|wc|cuisine|buanderie|cellier/i.test(name)

function FaceFloor({ face, finishId }: { face: Face; finishId: string }) {
  const finish = FLOORS.find((f) => f.id === finishId) ?? FLOORS[0]
  const [map, normalMap, roughnessMap] = useTexture([floorTexture(finish.id, 'diff'), floorTexture(finish.id, 'nor'), floorTexture(finish.id, 'rough')])
  const mats = useMemo(() => {
    const ts = [map, normalMap, roughnessMap].map((t) => {
      const c = t.clone()
      c.wrapS = c.wrapT = THREE.RepeatWrapping
      c.repeat.set(1 / finish.tileSize, 1 / finish.tileSize)
      c.needsUpdate = true
      return c
    })
    ts[0].colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshStandardMaterial({ map: ts[0], normalMap: ts[1], roughnessMap: ts[2], roughness: finish.roughness, normalScale: new THREE.Vector2(finish.normalScale, finish.normalScale), envMapIntensity: 0.9 })
  }, [map, normalMap, roughnessMap, finish])
  const geo = useMemo(() => new THREE.ShapeGeometry(new THREE.Shape(face.points.map((p) => new THREE.Vector2(p.x, -p.z)))), [face])
  return <mesh geometry={geo} material={mats} rotation-x={-Math.PI / 2} position-y={0.001} receiveShadow />
}

function FaceCeiling({ face, height, material }: { face: Face; height: number; material: THREE.Material }) {
  const geo = useMemo(() => new THREE.ShapeGeometry(new THREE.Shape(face.points.map((p) => new THREE.Vector2(p.x, p.z)))), [face])
  return <mesh geometry={geo} material={material} rotation-x={Math.PI / 2} position-y={height} castShadow receiveShadow />
}

function Apartment({ plan, view }: { plan: FloorPlan; view: PlanView }) {
  const { m, walls: wallMats } = useArchMaterials(COLORS)
  const specs = useMemo(() => apartmentWalls(plan), [plan])
  const faces = useMemo(() => findFaces(plan), [plan])
  const outside = useTexture(texture('../hdr/exterieur'))
  useMemo(() => {
    outside.colorSpace = THREE.SRGBColorSpace
  }, [outside])
  const b = bounds(plan)
  return (
    <group>
      {specs.map((s) => (
        <Wall key={s.key} spec={s} m={m} wallMat={wallMats.nord} />
      ))}
      {faces.map((f) => (
        <FaceFloor key={f.key} face={f} finishId={isWet(f.label?.name) ? 'large_floor_tiles_02' : 'laminate_floor_02'} />
      ))}
      {view === 'yeux' && faces.map((f) => <FaceCeiling key={`c-${f.key}`} face={f} height={plan.height} material={m.ceiling} />)}
      {view === 'yeux' ? (
        <mesh position={[b.cx, 1.6, b.cz]} renderOrder={-1}>
          <sphereGeometry args={[80, 48, 24]} />
          <meshBasicMaterial map={outside} side={THREE.BackSide} color={new THREE.Color(1.35, 1.35, 1.35)} depthWrite={false} />
        </mesh>
      ) : (
        <mesh rotation-x={-Math.PI / 2} position={[b.cx, -0.004, b.cz]} receiveShadow>
          <circleGeometry args={[b.r + 30, 64]} />
          <meshStandardMaterial color="#ddd5ca" roughness={1} envMapIntensity={0.6} />
        </mesh>
      )}
      {/* Une lumière douce au plafond de chaque pièce, pour la visite */}
      {view === 'yeux' &&
        faces.slice(0, 10).map((f) => {
          const a = faceAnchor(f)
          return <pointLight key={`l-${f.key}`} position={[a.x, plan.height - 0.3, a.z]} intensity={Math.min(6, 1.2 + f.area * 0.25)} distance={Math.sqrt(f.area) * 2.4} decay={1.6} color="#fff3e2" />
        })}
    </group>
  )
}

function bounds(plan: FloorPlan) {
  const xs = plan.points.map((p) => p.x)
  const zs = plan.points.map((p) => p.z)
  const minX = Math.min(...xs, 0)
  const maxX = Math.max(...xs, 0)
  const minZ = Math.min(...zs, 0)
  const maxZ = Math.max(...zs, 0)
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, w: maxX - minX, d: maxZ - minZ, r: Math.hypot(maxX - minX, maxZ - minZ) / 2 }
}

function Sun({ plan, quality }: { plan: FloorPlan; quality: 'high' | 'low' }) {
  const b = bounds(plan)
  const ref = useRef<THREE.DirectionalLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
    target.position.set(b.cx, 0, b.cz)
    if (ref.current) {
      ref.current.target = target
      ref.current.shadow.needsUpdate = true
    }
  }, [b.cx, b.cz, target])
  const ext = b.r + 2
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={ref}
        castShadow
        position={[b.cx + ext * 0.7, ext * 1.4 + 6, b.cz + ext * 0.9]}
        intensity={6}
        color="#fff0dc"
        shadow-mapSize={quality === 'high' ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
        shadow-camera-left={-ext}
        shadow-camera-right={ext}
        shadow-camera-top={ext}
        shadow-camera-bottom={-ext}
        shadow-camera-near={1}
        shadow-camera-far={ext * 4 + 20}
      />
      <hemisphereLight args={['#f6f2ea', '#cdbfa9', 0.55]} />
    </>
  )
}

/** Déplacements de la visite : on reste sur le sol des pièces et on ne passe qu'à travers les portes. */
function useNav(plan: FloorPlan): WalkNav {
  return useMemo(() => {
    const faces = findFaces(plan)
    const segs = wallSegs(plan)
    const R = 0.25
    const blocked = (x: number, z: number) => {
      for (const s of segs) {
        const pr = projectOnSeg(s, { x, z })
        if (pr.d > s.wall.thickness / 2 + R) continue
        const door = plan.openings.find((o) => o.wallId === s.wall.id && o.kind !== 'fenetre' && Math.abs(pr.u - o.u) < o.width / 2 - 0.12)
        if (!door) return true
      }
      return false
    }
    const onFloor = (x: number, z: number) => faces.some((f) => pointInPolygon({ x, z }, f.points))
    // Départ : dans l'entrée (sinon la plus grande pièce), dans un angle, le regard vers l'angle opposé
    // (côté fenêtres) pour embrasser toute la pièce
    const entry = faces.find((f) => /entr/i.test(f.label?.name ?? '')) ?? [...faces].sort((a, b) => b.area - a.area)[0]
    let start = { x: 0, z: 0, yaw: 0 }
    if (entry) {
      const c = faceAnchor(entry)
      const windows = plan.openings
        .filter((o) => o.kind !== 'porte' && entry.walls.some((w) => w.id === o.wallId))
        .map((o) => {
          const s = segs.find((x) => x.wall.id === o.wallId)!
          return { x: s.a.x + s.dx * o.u, z: s.a.z + s.dz * o.u }
        })
      const light = windows.length ? { x: windows.reduce((a, w) => a + w.x, 0) / windows.length, z: windows.reduce((a, w) => a + w.z, 0) / windows.length } : c
      // L'angle le plus éloigné des fenêtres, en évitant ceux où s'ouvre une porte
      const doors = plan.openings
        .filter((o) => o.kind === 'porte')
        .map((o) => {
          const s = segs.find((x) => x.wall.id === o.wallId)
          return s ? { x: s.a.x + s.dx * o.u, z: s.a.z + s.dz * o.u, r: o.width + 0.4 } : null
        })
        .filter((d): d is { x: number; z: number; r: number } => !!d)
      // Chaque angle est noté : loin des fenêtres (on les voit de face) et sans porte ouverte dans le champ de vision
      let best = { score: -Infinity, pos: c as { x: number; z: number } }
      for (const corner of entry.points) {
        const d = Math.hypot(c.x - corner.x, c.z - corner.z) || 1
        const pos = { x: corner.x + ((c.x - corner.x) / d) * 0.9, z: corner.z + ((c.z - corner.z) / d) * 0.9 }
        if (!onFloor(pos.x, pos.z) || blocked(pos.x, pos.z)) continue
        const dir = { x: (c.x - pos.x) / d, z: (c.z - pos.z) / d }
        let score = Math.hypot(pos.x - light.x, pos.z - light.z)
        for (const door of doors) {
          const vx = door.x - pos.x
          const vz = door.z - pos.z
          const len = Math.hypot(vx, vz)
          if (len < door.r) score -= 6
          else if (len < 3 && (vx * dir.x + vz * dir.z) / len > 0.5) score -= 3
        }
        if (score > best.score) best = { score, pos }
      }
      const pos = best.pos
      start = { x: pos.x, z: pos.z, yaw: Math.atan2(-(c.x - pos.x), -(c.z - pos.z)) }
    }
    return {
      start,
      onFloor,
      move: (from, to) => {
        const ok = (x: number, z: number) => onFloor(x, z) && !blocked(x, z)
        if (ok(to.x, to.z)) return to.clone().setY(EYE_HEIGHT)
        // Glisse le long du mur
        if (ok(to.x, from.z)) return new THREE.Vector3(to.x, EYE_HEIGHT, from.z)
        if (ok(from.x, to.z)) return new THREE.Vector3(from.x, EYE_HEIGHT, to.z)
        return from.clone()
      },
    }
  }, [plan])
}

function Cameras({ plan, view }: { plan: FloorPlan; view: PlanView }) {
  const nav = useNav(plan)
  const size = useThree((s) => s.size)
  const b = bounds(plan)
  const aspect = size.width / size.height
  if (view === 'yeux')
    return (
      <>
        <PerspectiveCamera makeDefault fov={aspect < 1 ? 72 : 62} near={0.03} far={300} />
        <WalkControls key={plan.id} nav={nav} />
      </>
    )
  const dist = (Math.max(b.w, b.d) * 0.95 + 2) * (aspect < 1 ? Math.min(1.8, 1.1 / aspect) : 1)
  return (
    <>
      <PerspectiveCamera makeDefault fov={40} near={0.1} far={400} position={[b.cx + dist * 0.35, dist * 1.05, b.cz + dist * 0.75]} />
      <OrbitControls makeDefault target={[b.cx, 0, b.cz]} enableDamping dampingFactor={0.12} minDistance={2} maxDistance={80} maxPolarAngle={Math.PI / 2 - 0.08} />
    </>
  )
}

export function ApartmentScene({ plan, view, quality }: { plan: FloorPlan; view: PlanView; quality: 'high' | 'low' }) {
  const high = quality === 'high'
  return (
    <Canvas shadows frameloop="demand" dpr={high ? [1, 2] : [1, 1.25]} gl={{ antialias: false, powerPreference: 'high-performance' }} style={{ touchAction: 'none' }}>
      <color attach="background" args={['#ebe5dc']} />
      <SoftShadows size={22} samples={high ? 12 : 6} focus={0.5} />
      <Cameras plan={plan} view={view} />
      <Sun plan={plan} quality={quality} />
      <Suspense fallback={null}>
        <AmbientEnvironment intensity={0.55} />
        <Apartment plan={plan} view={view} />
      </Suspense>
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <N8AO halfRes={!high} aoRadius={0.8} distanceFalloff={0.8} intensity={high ? 2.4 : 1.8} quality={high ? 'high' : 'performance'} />
        <Bloom intensity={view === 'yeux' ? 0.3 : 0.1} luminanceThreshold={0.92} luminanceSmoothing={0.2} mipmapBlur />
        <SMAA />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <Vignette offset={0.35} darkness={view === 'yeux' ? 0.36 : 0.2} />
      </EffectComposer>
    </Canvas>
  )
}
