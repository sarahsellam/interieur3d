// La scène 3D complète : caméras, lumières, pièce, meubles, effets.
import { Suspense, useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Html, OrbitControls, OrthographicCamera, PerspectiveCamera, SoftShadows } from '@react-three/drei'
import { EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { AmbientEnvironment } from './AmbientEnvironment'
import { useStore } from '../store'
import { Room, WALL_T } from './Room'
import { Furniture } from './Furniture'
import { DragController } from './drag'

const fmt = (m: number) => `${m.toFixed(2).replace('.', ',')} m`

function Lights() {
  const { width: W, depth: D, height: H } = useStore((s) => s.room)
  const ext = Math.max(W, D) / 2 + 1.5
  return (
    <>
      {/* Lumière principale douce, venant d'en haut et légèrement de côté */}
      <directionalLight
        castShadow
        position={[W * 0.35 + 1.5, H + 5, D * 0.25 + 2]}
        intensity={2}
        color="#fff4e6"
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-ext}
        shadow-camera-right={ext}
        shadow-camera-top={ext}
        shadow-camera-bottom={-ext}
        shadow-camera-near={0.5}
        shadow-camera-far={H + 20}
      />
      {/* Lumière diffuse chaude venant du plafond */}
      <hemisphereLight args={['#fff3e2', '#bfae96', 0.55]} />
    </>
  )
}

function CameraRig() {
  const view = useStore((s) => s.view)
  const { width: W, depth: D } = useStore((s) => s.room)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)

  // Zoom de la vue du dessus : la pièce entière tient à l'écran
  const topZoom = useMemo(() => {
    const narrow = size.width < 768
    const usableH = narrow ? size.height * 0.62 : size.height
    const usableW = narrow ? size.width : size.width - 340
    return Math.min(usableW / (W + 2 * WALL_T + 1), usableH / (D + 2 * WALL_T + 1))
  }, [size.width, size.height, W, D])

  useEffect(() => invalidate(), [view, topZoom, invalidate])

  // En mode portrait (téléphone), on recule pour voir toute la pièce
  const aspect = size.width / size.height
  const dist = Math.max(W, D) * (aspect < 1 ? Math.min(1.75, 1.1 / aspect) : 1)
  if (view === 'top') {
    const narrow = size.width < 768
    // Décale la vue pour compenser le panneau (à gauche sur tablette, en bas sur téléphone)
    const offX = narrow ? 0 : -170 / topZoom
    const offZ = narrow ? (size.height * 0.19) / topZoom : 0
    return (
      <>
        <OrthographicCamera makeDefault position={[offX, 30, offZ + 0.0001]} zoom={topZoom} near={0.1} far={100} />
        <OrbitControls
          key={`top-${W}-${D}-${narrow}`}
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
      <PerspectiveCamera makeDefault fov={45} near={0.05} far={200} position={[dist * 0.62, dist * 0.78 + 1, dist * 1.05 + 0.6]} />
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

function RoomLabels() {
  const view = useStore((s) => s.view)
  const { width: W, depth: D } = useStore((s) => s.room)
  if (view !== 'top') return null
  return (
    <>
      <Html position={[0, 0.1, -D / 2 - WALL_T - 0.25]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className="room-label">{fmt(W)}</div>
      </Html>
      <Html position={[-W / 2 - WALL_T - 0.25, 0.1, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className="room-label vertical">{fmt(D)}</div>
      </Html>
    </>
  )
}

function Items() {
  const items = useStore((s) => s.items)
  return (
    <>
      {items.map((it) => (
        <Suspense key={it.uid} fallback={null}>
          <Furniture item={it} />
        </Suspense>
      ))}
    </>
  )
}

export function Scene({ quality }: { quality: 'high' | 'low' }) {
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
      <color attach="background" args={['#e7e2da']} />
      <SoftShadows size={18} samples={quality === 'high' ? 12 : 6} focus={0.6} />
      <CameraRig />
      <Lights />
      <Suspense fallback={null}>
        <AmbientEnvironment intensity={0.6} />
        <Room />
      </Suspense>
      <Items />
      <RoomLabels />
      <DragController />
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <N8AO halfRes={quality !== 'high'} aoRadius={0.6} distanceFalloff={0.6} intensity={quality === 'high' ? 2.2 : 1.6} quality={quality === 'high' ? 'medium' : 'performance'} />
        <SMAA />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
    </Canvas>
  )
}
