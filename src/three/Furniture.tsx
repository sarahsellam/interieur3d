// Un meuble placé dans la pièce : modèle 3D réel (glTF/GLB), sélection, déplacement.
import { useMemo } from 'react'
import { useGLTF, Html } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { CATALOG_BY_ID, assetUrl } from '../data/catalog'
import { useStore, type PlacedItem } from '../store'
import { startDrag } from './drag'

/** Charge un modèle, le centre et pose sa base au sol. */
export function useNormalizedModel(modelId: string) {
  const c = CATALOG_BY_ID[modelId]
  const { scene } = useGLTF(assetUrl(c.file), false, false)
  return useMemo(() => {
    const root = scene.clone(true)
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
    const box = new THREE.Box3().setFromObject(root)
    const center = box.getCenter(new THREE.Vector3())
    const wrapper = new THREE.Group()
    root.position.set(-center.x, -box.min.y, -center.z)
    wrapper.add(root)
    wrapper.rotation.y = c.frontOffset
    const size = box.getSize(new THREE.Vector3())
    return { object: wrapper, size }
  }, [scene, c.frontOffset])
}

function SelectionOutline({ width, depth }: { width: number; depth: number }) {
  const pad = 0.06
  const w = width + pad * 2
  const d = depth + pad * 2
  const shape = useMemo(() => {
    const r = 0.06
    const s = new THREE.Shape()
    const x = -w / 2, y = -d / 2
    s.moveTo(x + r, y)
    s.lineTo(x + w - r, y)
    s.quadraticCurveTo(x + w, y, x + w, y + r)
    s.lineTo(x + w, y + d - r)
    s.quadraticCurveTo(x + w, y + d, x + w - r, y + d)
    s.lineTo(x + r, y + d)
    s.quadraticCurveTo(x, y + d, x, y + d - r)
    s.lineTo(x, y + r)
    s.quadraticCurveTo(x, y, x + r, y)
    const hole = new THREE.Path()
    const t = 0.025
    hole.moveTo(x + t + r, y + t)
    hole.lineTo(x + w - t - r, y + t)
    hole.quadraticCurveTo(x + w - t, y + t, x + w - t, y + t + r)
    hole.lineTo(x + w - t, y + d - t - r)
    hole.quadraticCurveTo(x + w - t, y + d - t, x + w - t - r, y + d - t)
    hole.lineTo(x + t + r, y + d - t)
    hole.quadraticCurveTo(x + t, y + d - t, x + t, y + d - t - r)
    hole.lineTo(x + t, y + t + r)
    hole.quadraticCurveTo(x + t, y + t, x + t + r, y + t)
    s.holes.push(hole)
    return s
  }, [w, d])
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.004} renderOrder={2}>
      <shapeGeometry args={[shape, 6]} />
      <meshBasicMaterial color="#d9772b" transparent opacity={0.95} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

export function Furniture({ item }: { item: PlacedItem }) {
  const c = CATALOG_BY_ID[item.modelId]
  const { object } = useNormalizedModel(item.modelId)
  const selected = useStore((s) => s.selectedUid === item.uid)
  const dragging = useStore((s) => s.dragging)
  const select = useStore((s) => s.select)
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== undefined && e.button !== 0) return
    e.stopPropagation()
    select(item.uid)
    // Bloque la rotation de la caméra pendant le déplacement du meuble
    if (controls) controls.enabled = false
    startDrag(item, e.ray, e.pointerId)
  }

  return (
    <group position={[item.x, 0, item.z]} rotation-y={item.rot}>
      <primitive object={object} onPointerDown={onPointerDown} />
      {selected && <SelectionOutline width={c.width} depth={c.depth} />}
      {selected && !dragging && (
        <Html position={[0, c.height + 0.15, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="dim-label">
            {Math.round(c.width * 100)} × {Math.round(c.depth * 100)} cm
          </div>
        </Html>
      )}
    </group>
  )
}

export function preloadCatalog(files: string[]) {
  files.forEach((f) => useGLTF.preload(assetUrl(f), false, false))
}
