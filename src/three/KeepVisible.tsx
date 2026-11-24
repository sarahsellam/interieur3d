// Garde à l'écran ce que l'on vient de sélectionner (ou le passage touché dans la liste) :
// si la fiche, le panneau ou les bandeaux le cachent, la vue glisse doucement pour le dégager.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { openingCenter, wallAxes, wallLength } from '../model/geometry'
import { useStore } from '../store'

/** Partie de l'écran que rien ne recouvre (en pixels, relatifs au canevas). */
function freeArea(canvas: HTMLCanvasElement) {
  const r = canvas.getBoundingClientRect()
  let top = r.top
  let bottom = r.bottom
  let left = r.left
  const right = r.right
  const narrow = window.innerWidth <= 860
  const bar = document.querySelector('.editor-top')?.getBoundingClientRect()
  if (bar) top = Math.max(top, bar.bottom)
  const hud = document.querySelector('.hud')?.getBoundingClientRect()
  if (hud && hud.height > 4 && narrow) top = Math.max(top, hud.bottom)
  const sheet = document.querySelector('.selection-sheet')?.getBoundingClientRect()
  if (sheet) bottom = Math.min(bottom, sheet.top)
  const panel = document.querySelector('.panel')?.getBoundingClientRect()
  if (panel) {
    if (narrow) bottom = Math.min(bottom, panel.top)
    else left = Math.max(left, panel.right)
  }
  return { top: top - r.top, bottom: bottom - r.top, left: left - r.left, right: right - r.left }
}

export function KeepVisible() {
  const { camera, gl, controls, invalidate } = useThree()
  const selection = useStore((s) => s.selection)
  const focus = useStore((s) => s.focusPoint)
  const view = useStore((s) => s.view)
  const anim = useRef<{ from: THREE.Vector3; delta: THREE.Vector3; t: number } | null>(null)
  const v = useMemo(() => new THREE.Vector3(), [])

  const ensure = (p: THREE.Vector3) => {
    const ctl = controls as unknown as { target?: THREE.Vector3 } | null
    if (view === 'yeux' || !ctl?.target) return
    const a = freeArea(gl.domElement)
    if (a.bottom - a.top < 80 || a.right - a.left < 80) return
    const w = gl.domElement.clientWidth
    const h = gl.domElement.clientHeight
    v.copy(p).project(camera)
    const sx = ((v.x + 1) / 2) * w
    const sy = ((1 - v.y) / 2) * h
    const m = 40
    if (sx > a.left + m && sx < a.right - m && sy > a.top + m && sy < a.bottom - m) return
    // Point de l'écran visé : le centre de la zone libre (à la même profondeur)
    const tx = (a.left + a.right) / 2
    const ty = (a.top + a.bottom) / 2
    const want = new THREE.Vector3((tx / w) * 2 - 1, -((ty / h) * 2 - 1), v.z).unproject(camera)
    const delta = p.clone().sub(want)
    if (view === 'plan') delta.y = 0
    anim.current = { from: camera.position.clone(), delta, t: 0 }
    invalidate()
  }

  // À chaque sélection : on attend que la fiche s'affiche, puis on vérifie
  useEffect(() => {
    if (!selection) return
    const st = useStore.getState()
    const l = st.layout
    let p: THREE.Vector3 | null = null
    if (selection.type === 'item') {
      const it = l.items.find((i) => i.uid === selection.id)
      if (it) p = new THREE.Vector3(it.x, 0.4, it.z)
    } else if (selection.type === 'opening') {
      const o = l.openings.find((x) => x.id === selection.id)
      if (o) {
        const c = openingCenter(l.room, o)
        p = new THREE.Vector3(c.x, 1, c.z)
      }
    } else if (selection.type === 'decor') {
      const d = (l.decor ?? []).find((x) => x.id === selection.id)
      if (d) {
        const ax = wallAxes(l.room, d.wall)
        const u = wallLength(l.room, d.wall) / 2 + d.offset
        p = new THREE.Vector3(ax.a[0] + ax.dir[0] * u, d.y, ax.a[1] + ax.dir[1] * u)
      }
    }
    if (!p || st.dragging) return
    const target = p
    const t = setTimeout(() => !useStore.getState().dragging && ensure(target), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.type, selection?.id])

  useEffect(() => {
    if (!focus) return
    const t = setTimeout(() => ensure(new THREE.Vector3(focus.x, focus.y, focus.z)), 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.n])

  useFrame((_, dt) => {
    const a = anim.current
    const ctl = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null
    if (!a || !ctl?.target) return
    const prev = Math.min(1, a.t)
    a.t = Math.min(1, a.t + dt / 0.35)
    const e = (x: number) => 1 - (1 - x) ** 3
    const step = a.delta.clone().multiplyScalar(e(a.t) - e(prev))
    camera.position.add(step)
    ctl.target.add(step)
    ctl.update?.()
    if (a.t >= 1) anim.current = null
    invalidate()
  })
  return null
}
