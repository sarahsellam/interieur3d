// Diagnostic de la 3D sur cet appareil : prise en charge, carte graphique, fluidité mesurée,
// et vérification des gestes (tourner, zoomer, déplacer). Ouvert par « ?diagnostic ».
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { exampleBedroom } from '../model/templates'
import { useStore } from '../store'
import { Scene } from '../three/Scene'
import { Icon } from './common'

interface GlInfo {
  webgl2: boolean
  renderer: string
  maxTexture: number
}

function glInfo(): GlInfo {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    if (!gl) return { webgl2: false, renderer: '—', maxTexture: 0 }
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER))
    return { webgl2: true, renderer, maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number }
  } catch {
    return { webgl2: false, renderer: '—', maxTexture: 0 }
  }
}

function deviceName() {
  const ua = navigator.userAgent
  const ios = /OS (\d+)[._](\d+)/.exec(ua)
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const iphone = /iPhone/.test(ua)
  const browser = /CriOS|Chrome/.test(ua) ? 'Chrome' : /FxiOS|Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'Navigateur'
  if (ipad || iphone) return `${ipad ? 'iPad' : 'iPhone'} · ${browser}${ios ? ` · iOS ${ios[1]}.${ios[2]}` : ''}`
  if (/Android/.test(ua)) return `Android · ${browser}`
  if (/Mac/.test(ua)) return `Mac · ${browser}`
  if (/Windows/.test(ua)) return `Windows · ${browser}`
  return browser
}

type Gestures = { tourner: boolean; zoomer: boolean; deplacer: boolean }

/** Dans la scène : tour automatique pour mesurer la fluidité, puis détection des gestes. */
function Probe({ onFps, onGesture }: { onFps: (fps: number) => void; onGesture: (g: keyof Gestures) => void }) {
  const controls = useThree((s) => s.controls) as unknown as (THREE.EventDispatcher & { autoRotate: boolean; autoRotateSpeed: number; target: THREE.Vector3; getDistance?: () => number; getAzimuthalAngle?: () => number; addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void }) | null
  const invalidate = useThree((s) => s.invalidate)
  const st = useRef({ t0: 0, frames: 0, done: false, start: 0 })
  useEffect(() => {
    if (!controls) return
    if (import.meta.env.DEV) (window as unknown as { __ctl: unknown }).__ctl = controls
    controls.autoRotate = true
    controls.autoRotateSpeed = 6
    st.current = { t0: performance.now(), frames: 0, done: false, start: performance.now() }
  }, [controls])
  useFrame(() => {
    const s = st.current
    if (!controls || s.done) return
    s.frames++
    const el = performance.now() - s.t0
    // Une seconde de chauffe, puis 6 secondes de mesure
    if (el > 1000 && s.start === s.t0) {
      s.start = performance.now()
      s.frames = 0
    }
    if (performance.now() - s.start > 6000 && s.start !== s.t0) {
      s.done = true
      controls.autoRotate = false
      onFps(Math.round((s.frames * 1000) / (performance.now() - s.start)))
    }
    invalidate()
  })
  // Gestes de la personne, après la mesure : on reconnaît le geste aux doigts posés sur l'écran,
  // et on le valide si la vue a réellement bougé à la fin du geste
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const gestureRef = useRef(onGesture)
  gestureRef.current = onGesture
  useEffect(() => {
    if (!controls) return
    const el = gl.domElement
    const pts = new Map<number, { x: number; y: number; x0: number; y0: number }>()
    let kind: keyof Gestures | null = null
    let startGap = 0
    const before = { pos: new THREE.Vector3(), target: new THREE.Vector3() }
    const check = (k: keyof Gestures) =>
      setTimeout(() => {
        if (!st.current.done) return
        if (camera.position.distanceTo(before.pos) > 0.005 || controls.target.distanceTo(before.target) > 0.005) gestureRef.current(k)
      }, 700)
    const down = (e: PointerEvent) => {
      if (pts.size === 0) {
        before.pos.copy(camera.position)
        before.target.copy(controls.target)
        kind = null
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY })
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        startGap = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId)
      if (!p) return
      p.x = e.clientX
      p.y = e.clientY
      if (pts.size === 1 && !kind) {
        if (Math.hypot(p.x - p.x0, p.y - p.y0) > 20) kind = e.buttons === 2 ? 'deplacer' : 'tourner'
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        const gap = Math.hypot(a.x - b.x, a.y - b.y)
        const moved = Math.hypot((a.x - a.x0 + b.x - b.x0) / 2, (a.y - a.y0 + b.y - b.y0) / 2)
        if (Math.abs(gap - startGap) > 30) kind = 'zoomer'
        else if (moved > 30 && kind !== 'zoomer') kind = 'deplacer'
      }
    }
    const up = (e: PointerEvent) => {
      if (!pts.delete(e.pointerId)) return
      if (pts.size === 0 && kind) check(kind)
    }
    const wheel = () => {
      before.pos.copy(camera.position)
      before.target.copy(controls.target)
      check('zoomer')
    }
    el.addEventListener('pointerdown', down, true)
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', up, true)
    el.addEventListener('wheel', wheel)
    return () => {
      el.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', up, true)
      el.removeEventListener('wheel', wheel)
    }
  }, [controls, gl, camera])
  return null
}

const verdict = (fps: number) => (fps >= 45 ? 'très fluide' : fps >= 28 ? 'fluide' : fps >= 18 ? 'correct' : 'lent')

export function Diagnostic() {
  const info = useMemo(glInfo, [])
  const device = useMemo(deviceName, [])
  const [fps, setFps] = useState<number | null>(null)
  const [g, setG] = useState<Gestures>({ tourner: false, zoomer: false, deplacer: false })
  const [copied, setCopied] = useState(false)
  // Les gestes sont repérés dans la scène 3D (autre arbre React) : ils arrivent par un événement
  useEffect(() => {
    const on = (e: Event) => {
      const k = (e as CustomEvent<keyof Gestures>).detail
      setG((x) => (x[k] ? x : { ...x, [k]: true }))
    }
    window.addEventListener('diag-geste', on)
    return () => window.removeEventListener('diag-geste', on)
  }, [])
  useMemo(() => {
    const l = exampleBedroom()
    useStore.setState({ layout: l, layoutPreview: null, view: '3d', selection: null, panelOpen: false })
  }, [])
  const quality = Math.min(screen.width, screen.height) < 500 ? 'low' : 'high'
  const report = [
    `Appareil : ${device}`,
    `3D (WebGL 2) : ${info.webgl2 ? 'oui' : 'non'}`,
    `Carte graphique : ${info.renderer}`,
    `Écran : ${screen.width}×${screen.height} · densité ${window.devicePixelRatio}`,
    fps !== null ? `Fluidité : ${fps} images/s (${verdict(fps)})` : 'Fluidité : mesure en cours',
    `Gestes : tourner ${g.tourner ? 'OK' : '—'} · zoomer ${g.zoomer ? 'OK' : '—'} · déplacer ${g.deplacer ? 'OK' : '—'}`,
  ].join('\n')
  return (
    <div className="app diagnostic">
      {info.webgl2 && (
        <div className="viewport">
          <Scene quality={quality}>
            <Probe onFps={setFps} onGesture={(k) => window.dispatchEvent(new CustomEvent('diag-geste', { detail: k }))} />
          </Scene>
        </div>
      )}
      <div className="diag-card">
        <h1>Test de la 3D</h1>
        <p className="diag-device">{device}</p>
        <ul>
          <li className={info.webgl2 ? 'ok' : 'ko'}>
            {info.webgl2 ? Icon.check : Icon.close} 3D {info.webgl2 ? 'disponible' : 'non disponible sur ce navigateur'}
          </li>
          {info.webgl2 && (
            <>
              <li className={fps === null ? '' : fps >= 18 ? 'ok' : 'ko'}>
                {fps === null ? <span className="diag-spin" /> : fps >= 18 ? Icon.check : Icon.alert}
                {fps === null ? 'Mesure de la fluidité… (6 secondes)' : `Fluidité : ${fps} images/s, ${verdict(fps)}`}
              </li>
              <li className={g.tourner ? 'ok' : ''}>{g.tourner ? Icon.check : Icon.rotR} Tourner : glissez un doigt sur la pièce</li>
              <li className={g.zoomer ? 'ok' : ''}>{g.zoomer ? Icon.check : Icon.plus} Zoomer : écartez ou rapprochez deux doigts</li>
              <li className={g.deplacer ? 'ok' : ''}>{g.deplacer ? Icon.check : Icon.move} Déplacer (facultatif) : faites glisser deux doigts ensemble</li>
            </>
          )}
        </ul>
        {!info.webgl2 && (
          <p className="hint-text">
            Sur iPad et iPhone, la 3D demande Safari avec iOS 15 ou plus récent. Elle est coupée par le mode Isolement (Réglages › Confidentialité et sécurité) ou quand WebGL est désactivé dans les réglages avancés de Safari.
          </p>
        )}
        <p className="diag-gpu muted">Carte graphique : {info.renderer}</p>
        <div className="diag-actions">
          <button
            type="button"
            className={`btn ${copied ? 'saved' : 'secondary'}`}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(report)
                setCopied(true)
              } catch {
                /* copie impossible */
              }
            }}
          >
            {copied ? <>{Icon.check} Copié</> : <>{Icon.copy} Copier le résultat</>}
          </button>
          <a className="btn primary" href={location.pathname}>
            Retour à l'application
          </a>
        </div>
      </div>
    </div>
  )
}
