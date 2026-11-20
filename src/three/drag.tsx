// Déplacement au doigt / à la souris :
// - un meuble glisse sur le sol ;
// - une ouverture (fenêtre, porte, placard…) glisse le long de son mur.
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore, type PlacedItem } from '../store'
import { wallAxes } from '../model/geometry'

const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const hit = new THREE.Vector3()

type Active =
  | { type: 'item'; uid: string; offX: number; offZ: number; pointerId: number; moved: boolean; startX: number; startZ: number }
  | { type: 'opening'; id: string; pointerId: number; grab: number; startOffset: number; moved: boolean }

let active: Active | null = null

export function startDrag(item: PlacedItem, ray: THREE.Ray, pointerId: number) {
  if (item.locked || !ray.intersectPlane(floorPlane, hit)) return
  active = { type: 'item', uid: item.uid, offX: item.x - hit.x, offZ: item.z - hit.z, pointerId, moved: false, startX: item.x, startZ: item.z }
}

/** Position (le long du mur, depuis son milieu) du point visé par le rayon. */
function alongWall(ray: THREE.Ray, openingId: string): number | null {
  const { layout, view } = useStore.getState()
  const o = layout.openings.find((x) => x.id === openingId)
  if (!o) return null
  const ax = wallAxes(layout.room, o.wall)
  const mid = new THREE.Vector3((ax.a[0] + ax.b[0]) / 2, 0, (ax.a[1] + ax.b[1]) / 2)
  const dir = new THREE.Vector3(ax.dir[0], 0, ax.dir[1])
  // En vue du dessus on vise le sol ; ailleurs, le plan du mur
  const plane =
    view === 'plan' ? floorPlane : new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(ax.inward[0], 0, ax.inward[1]), mid)
  if (!ray.intersectPlane(plane, hit)) return null
  return hit.clone().sub(mid).dot(dir)
}

export function startOpeningDrag(id: string, ray: THREE.Ray, pointerId: number) {
  const o = useStore.getState().layout.openings.find((x) => x.id === id)
  const g = alongWall(ray, id)
  if (!o || g === null) return
  active = { type: 'opening', id, pointerId, grab: g, startOffset: o.offset, moved: false }
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
      const st = useStore.getState()
      if (active.type === 'item') {
        if (!raycaster.ray.intersectPlane(floorPlane, hit)) return
        const x = Math.round((hit.x + active.offX) / SNAP) * SNAP
        const z = Math.round((hit.z + active.offZ) / SNAP) * SNAP
        if (!active.moved && Math.hypot(x - active.startX, z - active.startZ) < 0.02) return
        if (!active.moved) {
          active.moved = true
          st.setDragging(true)
        }
        st.moveItem(active.uid, x, z)
      } else {
        const g = alongWall(raycaster.ray, active.id)
        if (g === null) return
        let offset = active.startOffset + (g - active.grab)
        if (st.snap.grid) offset = Math.round(offset / 0.05) * 0.05
        offset = Math.round(offset / SNAP) * SNAP
        if (!active.moved && Math.abs(offset - active.startOffset) < 0.02) return
        if (!active.moved) {
          active.moved = true
          st.setDragging(true)
        }
        st.updateOpening(active.id, { offset }, `glisser-${active.id}`)
      }
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
