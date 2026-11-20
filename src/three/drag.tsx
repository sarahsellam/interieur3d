// Déplacement d'un meuble au doigt / à la souris, en glissant sur le sol.
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore, type PlacedItem } from '../store'

const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const hit = new THREE.Vector3()

let active: { uid: string; offX: number; offZ: number; pointerId: number; moved: boolean; startX: number; startZ: number } | null = null

export function startDrag(item: PlacedItem, ray: THREE.Ray, pointerId: number) {
  if (!ray.intersectPlane(floorPlane, hit)) return
  active = { uid: item.uid, offX: item.x - hit.x, offZ: item.z - hit.z, pointerId, moved: false, startX: item.x, startZ: item.z }
}

const SNAP = 0.01 // 1 cm

export function DragController() {
  const { camera, gl, raycaster, controls } = useThree()

  useEffect(() => {
    const el = gl.domElement
    const ndc = new THREE.Vector2()

    const onMove = (ev: PointerEvent) => {
      if (!active || ev.pointerId !== active.pointerId) return
      const rect = el.getBoundingClientRect()
      ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      if (!raycaster.ray.intersectPlane(floorPlane, hit)) return
      const x = Math.round((hit.x + active.offX) / SNAP) * SNAP
      const z = Math.round((hit.z + active.offZ) / SNAP) * SNAP
      if (!active.moved && Math.hypot(x - active.startX, z - active.startZ) < 0.02) return
      if (!active.moved) {
        active.moved = true
        useStore.getState().setDragging(true)
      }
      useStore.getState().moveItem(active.uid, x, z)
    }
    const onUp = (ev: PointerEvent) => {
      if (!active || ev.pointerId !== active.pointerId) return
      active = null
      useStore.getState().setDragging(false)
      if (controls) (controls as unknown as { enabled: boolean }).enabled = true
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [camera, gl, raycaster, controls])

  return null
}
