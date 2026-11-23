// La scène 3D complète : caméras, lumières, pièce, meubles, effets.
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera, PerspectiveCamera, SoftShadows, useGLTF } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { AmbientEnvironment } from './AmbientEnvironment'
import { shownLayout, useStore } from '../store'
import { Room, SHADOW_ONLY_LAYER, WALL_T, windowLights } from './Room'
import { Furniture } from './Furniture'
import { DragController } from './drag'
import { WalkControls } from './WalkControls'
import { PlanOverlay } from './PlanOverlay'
import { ClearanceOverlay } from './ClearanceOverlay'
import { CaptureHelper } from './capture'
import { GuideProbe } from './GuideProbe'
import { CEILING_LAMP, assetUrl } from '../data/catalog'

/** Lumière naturelle : soleil et ciel entrant par les fenêtres, ambiance douce. */
function Lights({ quality }: { quality: 'high' | 'low' }) {
  const room = useStore((s) => shownLayout(s).room)
  const openings = useStore((s) => shownLayout(s).openings)
  const view = useStore((s) => s.view)
  const windows = useMemo(() => windowLights(room, openings), [room, openings])
  const sun = useMemo(() => {
    // Le soleil entre par la plus grande fenêtre, 32° au-dessus de l'horizon, légèrement de biais
    const w = [...windows].sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? {
      center: new THREE.Vector3(-room.width / 2, 1.5, 0),
      inward: new THREE.Vector3(1, 0, 0),
    }
    const elev = THREE.MathUtils.degToRad(32)
    const dir = w.inward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(-28))
    dir.multiplyScalar(Math.cos(elev)).setY(-Math.sin(elev)).normalize()
    const target = w.center.clone().setY(0).addScaledVector(w.inward, 1.6)
    const position = target.clone().addScaledVector(dir, -14)
    const obj = new THREE.Object3D()
    obj.position.copy(target)
    return { position, target: obj }
  }, [windows, room.width])
  const lightRef = useRef<THREE.DirectionalLight>(null)
  useEffect(() => {
    const l = lightRef.current
    if (!l) return
    l.target = sun.target
    // Les murs masqués (calque 1) continuent de projeter leur ombre
    l.shadow.camera.layers.enable(SHADOW_ONLY_LAYER)
    l.shadow.needsUpdate = true
  }, [sun])
  const ext = Math.max(room.width, room.depth) / 2 + 2
  return (
    <>
      <primitive object={sun.target} />
      <directionalLight
        ref={lightRef}
        castShadow
        position={sun.position}
        intensity={view === 'plan' ? 4 : 8}
        color="#fff0dc"
        shadow-mapSize={quality === 'high' ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.025}
        shadow-camera-left={-ext}
        shadow-camera-right={ext}
        shadow-camera-top={ext}
        shadow-camera-bottom={-ext}
        shadow-camera-near={2}
        shadow-camera-far={40}
      />
      {/* Lumière du ciel diffusée par chaque fenêtre */}
      {windows.map((w) => (
        <WindowSkyLight key={w.id} center={w.center} inward={w.inward} width={w.width} height={w.height} />
      ))}
      <hemisphereLight args={['#f6f2ea', '#cdbfa9', view === 'plan' ? 0.6 : 0.38]} />
    </>
  )
}

RectAreaLightUniformsLib.init()

function WindowSkyLight({ center, inward, width, height }: { center: THREE.Vector3; inward: THREE.Vector3; width: number; height: number }) {
  const ref = useRef<THREE.RectAreaLight>(null)
  const pos = center.clone().addScaledVector(inward, 0.02)
  useEffect(() => {
    ref.current?.lookAt(pos.clone().add(inward))
  })
  return <rectAreaLight ref={ref} position={pos} width={width} height={height} intensity={11} color="#e9eef5" />
}

/** Suspension en verre au centre du plafond (mode visite). */
function CeilingLamp() {
  const view = useStore((s) => s.view)
  const H = useStore((s) => shownLayout(s).room.height)
  const { scene } = useGLTF(assetUrl(CEILING_LAMP.file), false, false)
  const obj = useMemo(() => {
    const o = scene.clone(true)
    const box = new THREE.Box3().setFromObject(o)
    const c = box.getCenter(new THREE.Vector3())
    o.position.set(-c.x, -box.max.y, -c.z)
    const g = new THREE.Group()
    g.add(o)
    return g
  }, [scene])
  if (view !== 'yeux') return null
  return <primitive object={obj} position={[0, H, 0]} />
}

/** Tournage de la vidéo de visite : la caméra est placée image par image par le script d'enregistrement. */
function VideoDriver() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const w = window as unknown as { __pose?: (p: number[], t: number[], fov?: number) => void }
    w.__pose = (p, t, fov) => {
      camera.position.set(p[0], p[1], p[2])
      camera.lookAt(t[0], t[1], t[2])
      if (fov) {
        camera.fov = fov
        camera.updateProjectionMatrix()
      }
      invalidate()
    }
    return () => {
      delete w.__pose
    }
  }, [camera, invalidate])
  return null
}

function CameraRig({ video }: { video?: boolean }) {
  const view = useStore((s) => s.view)
  const { width: W, depth: D } = useStore((s) => shownLayout(s).room)
  const ideaOpen = useStore((s) => s.ideaOpen)
  const panelOpen = useStore((s) => s.panelOpen)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)

  // Zoom de la vue du dessus : la pièce entière tient à l'écran
  // Zone visible de l'écran, une fois retirés la barre du haut et le panneau (à gauche ou en bas)
  const frame = useMemo(() => {
    const narrow = size.width <= 860
    // On réserve aussi la ligne des alertes et des réglages d'alignement, sous la barre du haut
    const top = (narrow ? 104 : 60) + 44
    const left = narrow ? 0 : 354
    // Le panneau de l'assistant occupe la droite sur tablette
    const right = !narrow && ideaOpen ? 404 : 0
    // Sur téléphone : le panneau du bas et les boutons d'alignement juste au-dessus
    const bottom = narrow ? (panelOpen ? size.height * 0.44 : 78) + 52 : 0
    const usableW = size.width - left - right - 32
    const usableH = size.height - top - bottom - 64
    const zoom = Math.min(usableW / (W + 2 * WALL_T + 0.6), usableH / (D + 2 * WALL_T + 0.6))
    // Décalage du centre de la pièce vers le centre de la zone visible
    const px = (left - right) / 2
    const py = top + usableH / 2 + 32 - size.height / 2
    return { narrow, zoom, offX: -px / zoom, offZ: -py / zoom }
  }, [size.width, size.height, W, D, ideaOpen, panelOpen])
  const topZoom = frame.zoom

  useEffect(() => invalidate(), [view, topZoom, invalidate])

  if (video)
    return (
      <>
        <PerspectiveCamera makeDefault fov={55} near={0.03} far={200} position={[5, 5, 5]} />
        <VideoDriver />
      </>
    )

  // En mode portrait (téléphone), on recule pour voir toute la pièce
  const aspect = size.width / size.height
  const dist = (Math.max(W, D) * 1.15 + 1.2) * (aspect < 1 ? Math.min(1.75, 1.1 / aspect) : 1)
  if (view === 'yeux') {
    return (
      <>
        <PerspectiveCamera makeDefault fov={aspect < 1 ? 72 : 60} near={0.03} far={200} />
        <WalkControls key={`${W}-${D}`} />
      </>
    )
  }
  if (view === 'plan') {
    const { narrow, offX, offZ } = frame
    return (
      <>
        <OrthographicCamera makeDefault position={[offX, 30, offZ + 0.0001]} zoom={topZoom} near={0.1} far={100} />
        <OrbitControls
          key={`top-${W}-${D}-${narrow}-${ideaOpen}-${narrow && panelOpen}`}
          makeDefault
          target={[offX, 0, offZ]}
          enableRotate={false}
          screenSpacePanning
          minZoom={topZoom * 0.5}
          maxZoom={topZoom * 4}
          mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
          touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
        />
      </>
    )
  }
  return (
    <>
      <PerspectiveCamera makeDefault fov={45} near={0.05} far={200} position={[dist * 0.55, dist * 0.85, dist * 0.95]} />
      <OrbitControls
        key={`3d-${aspect < 1}`}
        makeDefault
        target={[0, aspect < 1 ? -0.6 : 0.5, aspect < 1 ? 0.9 : 0]}
        enableDamping
        dampingFactor={0.12}
        minDistance={1.2}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
    </>
  )
}

function Items() {
  const items = useStore((s) => shownLayout(s).items)
  const preview = useStore((s) => s.preview)
  return (
    <>
      {items.map((it) => {
        // Pendant un aperçu de remplacement, le meuble proposé prend la place de l'ancien
        const shown = preview && preview.uid === it.uid ? preview.item : it
        return (
          <Suspense key={it.uid + shown.modelId} fallback={null}>
            <Furniture item={shown} />
          </Suspense>
        )
      })}
    </>
  )
}

function Effects({ quality }: { quality: 'high' | 'low' }) {
  const view = useStore((s) => s.view)
  const high = quality === 'high'
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO halfRes={!high} aoRadius={view === 'yeux' ? 0.7 : 0.9} distanceFalloff={0.8} intensity={high ? 2.6 : 2} quality={high ? 'high' : 'performance'} />
      <Bloom intensity={view === 'yeux' ? 0.35 : 0.12} luminanceThreshold={0.92} luminanceSmoothing={0.2} mipmapBlur />
      <SMAA />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette offset={0.35} darkness={view === 'yeux' ? 0.38 : 0.2} />
    </EffectComposer>
  )
}

export function Scene({ quality, video }: { quality: 'high' | 'low'; video?: boolean }) {
  const select = useStore((s) => s.select)
  return (
    <Canvas
      shadows
      frameloop="demand"
      dpr={quality === 'high' ? [1, 2] : [1, 1.25]}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      onPointerMissed={() => select(null)}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={['#ebe5dc']} />
      <SoftShadows size={22} samples={quality === 'high' ? 14 : 7} focus={0.5} />
      <CameraRig video={video} />
      <Lights quality={quality} />
      <Suspense fallback={null}>
        <AmbientEnvironment intensity={0.5} />
        <Room />
        <CeilingLamp />
      </Suspense>
      <Items />
      <PlanOverlay />
      <ClearanceOverlay />
      <DragController />
      <Effects quality={quality} />
      <CaptureHelper />
      <GuideProbe />
    </Canvas>
  )
}
