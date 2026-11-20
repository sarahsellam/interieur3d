// Mode spécial (?thumb=<id>) servant uniquement à générer les vignettes du catalogue.
import { Suspense, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { AmbientEnvironment } from './AmbientEnvironment'
import { CATALOG_BY_ID } from '../data/catalog'
import { useNormalizedModel } from './Furniture'

function Model({ id }: { id: string }) {
  const { object, size } = useNormalizedModel(id)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  useEffect(() => {
    const r = size.length() / 2
    const dist = r / Math.sin((camera.fov * Math.PI) / 360) * 0.92
    const dir = new THREE.Vector3(0.75, 0.55, 1).normalize()
    camera.position.copy(dir.multiplyScalar(dist)).add(new THREE.Vector3(0, size.y / 2, 0))
    camera.lookAt(0, size.y / 2, 0)
    camera.updateProjectionMatrix()
    ;(window as unknown as { thumbReady: boolean }).thumbReady = true
  }, [camera, size])
  return <primitive object={object} />
}

export function ThumbScene({ id }: { id: string }) {
  if (!CATALOG_BY_ID[id]) return null
  return (
    <Canvas gl={{ preserveDrawingBuffer: true, alpha: true }} camera={{ fov: 30 }} style={{ width: 512, height: 512 }}>
      <ambientLight intensity={0.3} />
      <directionalLight position={[3, 5, 4]} intensity={2} />
      <Suspense fallback={null}>
        <AmbientEnvironment intensity={0.9} />
        <Model id={id} />
      </Suspense>
    </Canvas>
  )
}
