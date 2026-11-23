// Capture d'une petite image de la vue 3D (vignette du projet ou de la version).
import { useFrame, useThree } from '@react-three/fiber'

let pending: ((url: string) => void) | null = null
let pendingWidth = 360
let requestRender: (() => void) | null = null

/** Demande une vignette JPEG (≈ 360 px de large) de ce qui est affiché. */
export function captureThumb(width = 360): Promise<string> {
  return new Promise((resolve) => {
    if (!requestRender) return resolve('')
    pending = resolve
    pendingWidth = width
    requestRender()
    // Sécurité : si aucune image n'arrive, on n'attend pas indéfiniment
    setTimeout(() => {
      if (pending === resolve) {
        pending = null
        resolve('')
      }
    }, 6000)
  })
}

export function CaptureHelper() {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  requestRender = invalidate
  // Priorité 2 : juste après le rendu final (effets compris), dans la même image
  useFrame(() => {
    if (!pending) return
    const src = gl.domElement
    const w = Math.min(pendingWidth, src.width)
    const h = Math.round((src.height / src.width) * w)
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d')?.drawImage(src, 0, 0, w, h)
    const done = pending
    pending = null
    try {
      done(c.toDataURL('image/jpeg', pendingWidth > 400 ? 0.85 : 0.72))
    } catch {
      done('')
    }
  }, 2)
  return null
}
