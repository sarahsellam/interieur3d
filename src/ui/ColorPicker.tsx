// Pipette sur une photo d'inspiration : on touche la photo pour prendre une couleur,
// puis « Essayer sur mon mur » : aperçu immédiat dans la pièce, à garder ou à annuler.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { imageUrl } from '../model/storage'
import type { Layout, WallSide } from '../model/types'
import { WALL_LABEL, WALL_ORDER } from '../model/types'
import { useStore } from '../store'
import { Icon } from './common'
import { colorName } from '../data/finishes'

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

/** Clair ou foncé, pour écrire lisiblement sur la couleur. */
const isDark = (h: string) => {
  const n = parseInt(h.slice(1), 16)
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 < 140
}

type Target = WallSide | 'tous'

/** Pipette sur une photo (imageId), ou essai direct d'une couleur déjà choisie (initialColor, ex. pastille de la palette). */
export function PhotoColorPicker({ imageId, initialColor, onClose }: { imageId?: string; initialColor?: string; onClose: () => void }) {
  const layout = useStore((s) => s.layout)
  const setLayoutPreview = useStore((s) => s.setLayoutPreview)
  const setWallColor = useStore((s) => s.setWallColor)
  const setAll = useStore((s) => s.setAllWallsColor)
  const [url, setUrl] = useState<string | null>(null)
  const [color, setColor] = useState<string | null>(initialColor ?? null)
  const [mark, setMark] = useState<{ x: number; y: number } | null>(null)
  const [stage, setStage] = useState<'pick' | 'wall'>(initialColor ? 'wall' : 'pick')
  const picking = useRef(false)
  const [target, setTarget] = useState<Target | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  /** Vue d'avant l'aperçu : en plan, un mur se voit mal, on passe en 3D le temps de l'essai */
  const prevView = useRef<'plan' | null>(null)
  const restoreView = () => {
    if (prevView.current) useStore.getState().setView(prevView.current)
    prevView.current = null
  }

  useEffect(() => {
    let alive = true
    if (imageId) imageUrl(imageId).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [imageId])

  // Copie réduite de la photo pour lire les couleurs
  const ready = () => {
    const img = imgRef.current
    if (!img) return
    const scale = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(img.naturalWidth * scale))
    c.height = Math.max(1, Math.round(img.naturalHeight * scale))
    c.getContext('2d', { willReadFrequently: true })?.drawImage(img, 0, 0, c.width, c.height)
    canvas.current = c
  }

  const pick = (e: React.PointerEvent<HTMLImageElement>) => {
    const img = imgRef.current
    const c = canvas.current
    if (!img || !c) return
    const r = img.getBoundingClientRect()
    const px = Math.max(0, Math.min(c.width - 1, ((e.clientX - r.left) / r.width) * c.width))
    const py = Math.max(0, Math.min(c.height - 1, ((e.clientY - r.top) / r.height) * c.height))
    // Moyenne d'un petit carré autour du doigt (évite un pixel isolé)
    const s = 4
    const x0 = Math.max(0, Math.floor(px - s))
    const y0 = Math.max(0, Math.floor(py - s))
    const w = Math.min(c.width - x0, s * 2 + 1)
    const h = Math.min(c.height - y0, s * 2 + 1)
    const d = c.getContext('2d')!.getImageData(x0, y0, w, h).data
    let R = 0
    let G = 0
    let B = 0
    const n = d.length / 4
    for (let i = 0; i < d.length; i += 4) {
      R += d[i]
      G += d[i + 1]
      B += d[i + 2]
    }
    setColor(hex(R / n, G / n, B / n))
    // Repère placé dans le cadre de la photo (l'image y est centrée)
    const box = img.parentElement!.getBoundingClientRect()
    const cx = Math.max(r.left, Math.min(r.right, e.clientX))
    const cy = Math.max(r.top, Math.min(r.bottom, e.clientY))
    setMark({ x: cx - box.left, y: cy - box.top })
  }

  /** Aperçu dans la pièce, sans rien enregistrer. */
  const preview = (t: Target) => {
    if (!color) return
    setTarget(t)
    const l: Layout = JSON.parse(JSON.stringify(useStore.getState().layout))
    if (t === 'tous') WALL_ORDER.forEach((w) => (l.wallColors[w] = color))
    else l.wallColors[t] = color
    setLayoutPreview(l)
    const st = useStore.getState()
    if (st.threeD && st.view === 'plan') {
      prevView.current = 'plan'
      st.setView('3d')
    }
    // Sur téléphone, on replie le panneau pour bien voir la pièce
    if (window.innerWidth <= 860) st.setPanelOpen(false)
  }

  const cancel = () => {
    setLayoutPreview(null)
    restoreView()
    setTarget(null)
    // Couleur venue de la palette : annuler referme ; depuis la photo : on revient à la pipette
    if (!imageId) return onClose()
    setStage('pick')
  }
  const close = () => {
    setLayoutPreview(null)
    restoreView()
    onClose()
  }
  const keep = () => {
    if (!color || !target) return
    setLayoutPreview(null)
    if (target === 'tous') setAll(color)
    else setWallColor(target, color)
    onClose()
  }

  return createPortal(
    <div className={`color-picker stage-${stage}`} role="dialog" aria-label="Prendre une couleur sur la photo">
      <div className="popover-head">
        <h2>{stage === 'pick' ? 'Prendre une couleur' : 'Essayer sur mon mur'}</h2>
        <button type="button" className="icon-btn small" onClick={close} aria-label="Fermer">
          {Icon.close}
        </button>
      </div>
      {stage === 'pick' && (
        <>
          <p className="hint-text">Touchez la photo à l'endroit de la couleur qui vous plaît.</p>
          <div className="picker-photo">
            {url && (
              <img
                ref={imgRef}
                src={url}
                alt="Photo d'inspiration"
                onLoad={ready}
                onPointerDown={(e) => {
                  picking.current = true
                  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
                  pick(e)
                }}
                // Glisser le doigt pour affiner la couleur
                onPointerMove={(e) => picking.current && pick(e)}
                onPointerUp={() => (picking.current = false)}
                onPointerCancel={() => (picking.current = false)}
                draggable={false}
              />
            )}
            {mark && color && <span className="picker-mark" style={{ left: mark.x, top: mark.y, background: color }} />}
          </div>
        </>
      )}
      <div className="picker-color">
        <span className="picker-swatch" style={{ background: color ?? 'transparent', color: color && isDark(color) ? '#fff' : 'var(--ink)' }}>
          {color ? colorName(color) : 'Touchez la photo'}
        </span>
        {stage === 'pick' ? (
          <button type="button" className="btn primary" disabled={!color} onClick={() => setStage('wall')}>
            Essayer sur mon mur
          </button>
        ) : (
          <button type="button" className="btn ghost" onClick={cancel}>
            Choisir une autre couleur
          </button>
        )}
      </div>
      {stage === 'wall' && (
        <>
          <p className="hint-text">{target ? 'Aperçu dans la pièce. Gardez-le ou annulez.' : 'Quel mur ?'}</p>
          <div className="choice-row">
            {WALL_ORDER.map((w) => (
              <button key={w} type="button" className={`chip ${target === w ? 'selected' : ''}`} onClick={() => preview(w)}>
                <span className="dot" style={{ background: target === w || target === 'tous' ? color! : layout.wallColors[w] }} /> {WALL_LABEL[w]}
              </button>
            ))}
            <button type="button" className={`chip ${target === 'tous' ? 'selected' : ''}`} onClick={() => preview('tous')}>
              Tous les murs
            </button>
          </div>
          <div className="picker-actions">
            <button type="button" className="btn ghost" onClick={cancel} disabled={!target}>
              Annuler
            </button>
            <button type="button" className="btn primary" onClick={keep} disabled={!target}>
              {Icon.check} Garder cette couleur
            </button>
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}
