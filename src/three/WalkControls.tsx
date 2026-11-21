// Caméra « visite » à hauteur d'yeux (1,60 m).
// - Glisser un doigt (ou la souris) : regarder autour de soi.
// - Toucher le sol : marcher jusqu'à cet endroit.
// - Deux doigts : avancer / reculer en écartant ou rapprochant les doigts.
// - Clavier : flèches ou Z Q S D / W A S D.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { shownLayout, useStore } from '../store'
import { openingCenter, wallAxes } from '../model/geometry'

export const EYE_HEIGHT = 1.6
const MARGIN = 0.3
const SPEED = 1.3 // m/s

/** Visite d'un appartement : point de départ et déplacements autorisés (on ne traverse pas les murs). */
export interface WalkNav {
  start: { x: number; z: number; yaw: number }
  /** Position atteinte en allant de « from » vers « to » (bloquée ou glissant le long des murs) */
  move: (from: THREE.Vector3, to: THREE.Vector3) => THREE.Vector3
  /** Ce point du sol est-il dans l'appartement ? */
  onFloor: (x: number, z: number) => boolean
}

export function WalkControls({ nav }: { nav?: WalkNav } = {}) {
  const { camera, gl, set, invalidate } = useThree()
  const room = useStore((s) => shownLayout(s).room)
  const navRef = useRef(nav)
  navRef.current = nav

  const st = useMemo(
    () => ({
      enabled: true,
      yaw: 0,
      pitch: -0.08,
      pos: new THREE.Vector3(),
      target: null as THREE.Vector3 | null,
      keys: new Set<string>(),
    }),
    [],
  )
  const roomRef = useRef(room)
  roomRef.current = room

  /** Avance de « delta » (en respectant les murs de l'appartement, ou les limites de la pièce). */
  const moveBy = (delta: THREE.Vector3) => {
    const next = st.pos.clone().add(delta)
    if (navRef.current) st.pos.copy(navRef.current.move(st.pos, next))
    else st.pos.copy(clamp(next))
  }

  const clamp = (v: THREE.Vector3) => {
    if (navRef.current) return v
    const r = roomRef.current
    v.x = Math.max(-r.width / 2 + MARGIN, Math.min(r.width / 2 - MARGIN, v.x))
    v.z = Math.max(-r.depth / 2 + MARGIN, Math.min(r.depth / 2 - MARGIN, v.z))
    return v
  }

  // Position de départ : sur le seuil de la porte, comme en entrant dans la pièce
  useEffect(() => {
    if (navRef.current) {
      const s0 = navRef.current.start
      st.pos.set(s0.x, EYE_HEIGHT, s0.z)
      st.yaw = s0.yaw
      st.pitch = -0.08
      st.target = null
      invalidate()
      return
    }
    const layout = shownLayout(useStore.getState())
    const door = layout.openings.find((o) => o.kind === 'porte') ?? layout.openings.find((o) => o.kind === 'porte-fenetre')
    if (door) {
      const c = openingCenter(room, door)
      const n = wallAxes(room, door.wall).inward
      st.pos.set(c.x + n[0] * 0.55, EYE_HEIGHT, c.z + n[1] * 0.55)
      clamp(st.pos)
      // Regarde vers le centre de la pièce
      st.yaw = Math.atan2(st.pos.x, st.pos.z)
    } else {
      st.pos.set(room.width / 2 - 0.8, EYE_HEIGHT, room.depth / 2 - 0.75)
      clamp(st.pos)
      st.yaw = Math.atan2(st.pos.x - -room.width / 2, st.pos.z - -room.depth * 0.1)
    }
    st.pitch = -0.1
    st.target = null
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // S'enregistre comme « contrôles » pour que le déplacement d'un meuble puisse les suspendre
  useEffect(() => {
    set({ controls: st as unknown as THREE.EventDispatcher })
    return () => set({ controls: null })
  }, [set, st])

  useEffect(() => {
    const el = gl.domElement
    const pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>()
    let pinch = 0
    const ndc = new THREE.Vector2()
    const ray = new THREE.Raycaster()
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const hit = new THREE.Vector3()

    const down = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() })
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinch = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      if (!st.enabled) return
      if (pointers.size === 1) {
        const k = 0.0042
        st.yaw += dx * k
        st.pitch = Math.max(-1.1, Math.min(1.0, st.pitch + dy * k))
        st.target = null
        invalidate()
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        const delta = (d - pinch) * 0.008
        pinch = d
        const fwd = new THREE.Vector3(-Math.sin(st.yaw), 0, -Math.cos(st.yaw))
        moveBy(fwd.multiplyScalar(delta))
        st.target = null
        invalidate()
      }
    }
    const up = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId)
      pointers.delete(e.pointerId)
      if (!p || !st.enabled || pointers.size > 0) return
      const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy)
      if (moved > 8 || performance.now() - p.t > 450) return
      // Toucher bref : marcher vers ce point du sol
      const rect = el.getBoundingClientRect()
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      if (!ray.ray.intersectPlane(floor, hit)) return
      const r = roomRef.current
      if (navRef.current ? !navRef.current.onFloor(hit.x, hit.z) : Math.abs(hit.x) > r.width / 2 || Math.abs(hit.z) > r.depth / 2) return
      // On s'arrête un peu avant le point visé
      const dir = hit.clone().sub(st.pos).setY(0)
      const len = dir.length()
      if (len < 0.2) return
      st.target = clamp(st.pos.clone().addScaledVector(dir.normalize(), Math.max(0, len - 0.35)).setY(EYE_HEIGHT))
      invalidate()
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const fwd = new THREE.Vector3(-Math.sin(st.yaw), 0, -Math.cos(st.yaw))
      moveBy(fwd.multiplyScalar(-e.deltaY * 0.002))
      invalidate()
    }
    const keyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      st.keys.add(e.key.toLowerCase())
      invalidate()
    }
    const keyUp = (e: KeyboardEvent) => st.keys.delete(e.key.toLowerCase())

    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    // Phase de capture : on lit l'état avant que le déplacement d'un meuble ne le réinitialise
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', up, true)
    el.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', up, true)
      el.removeEventListener('wheel', wheel)
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
    }
  }, [gl, camera, st, invalidate])

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05)
    let active = false
    const k = st.keys
    const fwd = (k.has('arrowup') || k.has('z') || k.has('w') ? 1 : 0) - (k.has('arrowdown') || k.has('s') ? 1 : 0)
    const side = (k.has('arrowright') || k.has('d') ? 1 : 0) - (k.has('arrowleft') || k.has('q') || k.has('a') ? 1 : 0)
    if (fwd || side) {
      const f = new THREE.Vector3(-Math.sin(st.yaw), 0, -Math.cos(st.yaw))
      const r = new THREE.Vector3(Math.cos(st.yaw), 0, -Math.sin(st.yaw))
      moveBy(f.multiplyScalar(fwd * SPEED * step).addScaledVector(r, side * SPEED * step))
      st.target = null
      active = true
    }
    if (st.target) {
      const d = st.target.clone().sub(st.pos)
      const len = d.length()
      if (len < 0.01) st.target = null
      else {
        const before = st.pos.clone()
        moveBy(d.normalize().multiplyScalar(Math.min(len, SPEED * step * (len < 0.4 ? 0.6 + len : 1))))
        // Arrêté par un mur : on renonce à ce point
        if (st.pos.distanceTo(before) < 1e-4) st.target = null
        active = true
      }
    }
    st.pos.y = EYE_HEIGHT
    camera.position.copy(st.pos)
    camera.rotation.set(st.pitch, st.yaw, 0, 'YXZ')
    if (active) invalidate()
  })

  return null
}
