// Un meuble placé dans la pièce : modèle 3D réel (glTF/GLB), sélection, déplacement.
import { useEffect, useMemo } from 'react'
import { useGLTF, Html } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { getItem, assetUrl } from '../data/catalog'
import { useStore, type PlacedItem } from '../store'
import { itemDims, overlapsOf } from '../model/geometry'
import type { ItemDims } from '../model/types'
import { startDrag } from './drag'
import { ProceduralModel } from './procedural'

/** Charge un modèle, le centre et pose sa base au sol. */
export function useNormalizedModel(modelId: string) {
  const c = getItem(modelId)!
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

function SelectionOutline({ width, depth, color = '#742f45' }: { width: number; depth: number; color?: string }) {
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
    const t = 0.018
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
      <meshBasicMaterial color={color} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/** Modèle 3D importé : mis à l'échelle des dimensions choisies et teinté si besoin. */
function ModelPrimitive({ modelId, dims, color, onPointerDown }: { modelId: string; dims: ItemDims; color?: string | null; onPointerDown: (e: ThreeEvent<PointerEvent>) => void }) {
  const c = getItem(modelId)!
  const { object } = useNormalizedModel(modelId)
  // Matériaux propres à cet exemplaire, pour pouvoir le teinter sans toucher aux autres
  const originals = useMemo(() => {
    const list: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; base: THREE.Color }[] = []
    object.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh && mesh.material) {
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone()
        mesh.material = mat
        list.push({ mesh, mat, base: mat.color.clone() })
      }
    })
    return list
  }, [object])
  useEffect(() => {
    for (const { mat, base } of originals) {
      if (color) mat.color.copy(base).multiply(new THREE.Color(color)).multiplyScalar(1.6)
      else mat.color.copy(base)
    }
  }, [color, originals])
  return (
    <group scale={[dims.width / c.width, dims.height / c.height, dims.depth / c.depth]}>
      <primitive object={object} onPointerDown={onPointerDown} />
    </group>
  )
}

export function FurnitureShape({ modelId, dims, color, onPointerDown }: { modelId: string; dims?: ItemDims; color?: string | null; onPointerDown?: (e: ThreeEvent<PointerEvent>) => void }) {
  const c = getItem(modelId)!
  const handler = onPointerDown ?? (() => {})
  const d = dims ?? { width: c.width, depth: c.depth, height: c.height }
  if (c.procedural) {
    return (
      <group onPointerDown={handler}>
        <ProceduralModel id={modelId} dims={d} color={color ?? null} />
      </group>
    )
  }
  return <ModelPrimitive modelId={modelId} dims={d} color={color} onPointerDown={handler} />
}

export function Furniture({ item }: { item: PlacedItem }) {
  const c = getItem(item.modelId)!
  const dims = itemDims(item)
  const selected = useStore((s) => s.selection?.type === 'item' && s.selection.id === item.uid)
  const overlapping = useStore((s) => overlapsOf(s.layout).some((o) => o.a.id === item.uid || o.b.id === item.uid))
  const dragging = useStore((s) => s.dragging)
  const select = useStore((s) => s.select)
  const view = useStore((s) => s.view)
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== undefined && e.button !== 0) return
    // À hauteur des yeux, toucher le tapis sert à marcher, pas à le sélectionner
    if (view === 'yeux' && c.floorLayer && !selected) return
    e.stopPropagation()
    select({ type: 'item', id: item.uid })
    if (item.locked) return
    // Bloque la caméra pendant le déplacement du meuble
    if (controls) controls.enabled = false
    startDrag(item, e.ray, e.pointerId)
  }

  return (
    <group position={[item.x, 0, item.z]} rotation-y={item.rot}>
      <FurnitureShape modelId={item.modelId} dims={item.dims} color={item.color} onPointerDown={onPointerDown} />
      {(selected || overlapping) && <SelectionOutline width={dims.width} depth={dims.depth} color={overlapping ? '#c0392b' : '#742f45'} />}
      {selected && !dragging && (
        <Html position={[0, dims.height + 0.15, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="dim-label">
            {item.locked ? 'Verrouillé · ' : ''}
            {Math.round(dims.width * 100)} × {Math.round(dims.depth * 100)} cm
          </div>
        </Html>
      )}
    </group>
  )
}

export function preloadCatalog(files: string[]) {
  files.filter(Boolean).forEach((f) => useGLTF.preload(assetUrl(f), false, false))
}
