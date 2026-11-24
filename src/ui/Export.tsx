// Exporter : une belle image de la vue (pour Instagram, un proche, un artisan) et le plan PDF coté.
// Le fichier est préparé, puis un second toucher l'envoie (Safari demande un geste pour partager).
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { offerFile } from '../model/backup'
import { roomPlanPdf } from '../model/exportPlan'
import type { Layout } from '../model/types'
import { useProject, useStore } from '../store'
import { captureThumb } from '../three/capture'
import { Icon } from './common'

const fileName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'piece'

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = src
  })
}

/** Image de la vue actuelle (3D), ou du plan dessiné quand la 3D n'est pas disponible. */
async function viewImage(threeD: boolean): Promise<HTMLImageElement | null> {
  if (threeD) {
    const url = await captureThumb(2400)
    return url ? loadImage(url) : null
  }
  const svg = document.querySelector('svg.plan2d') as SVGSVGElement | null
  if (!svg) return null
  const clone = svg.cloneNode(true) as SVGSVGElement
  const r = svg.getBoundingClientRect()
  clone.setAttribute('width', String(r.width * 2))
  clone.setAttribute('height', String(r.height * 2))
  const data = new XMLSerializer().serializeToString(clone)
  return loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data))
}

/** Image finale : la vue, et un bandeau ivoire avec le nom du projet. */
async function composeImage(img: HTMLImageElement, title: string, subtitle: string): Promise<Blob> {
  const W = img.naturalWidth
  const H = img.naturalHeight
  const band = Math.round(Math.max(90, W * 0.075))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H + band
  const g = c.getContext('2d')!
  g.fillStyle = '#ebe5dc'
  g.fillRect(0, 0, W, H)
  g.drawImage(img, 0, 0, W, H)
  g.fillStyle = '#f8f5f0'
  g.fillRect(0, H, W, band)
  const pad = band * 0.42
  g.fillStyle = '#292321'
  g.font = `${Math.round(band * 0.36)}px "Instrument Serif", Georgia, serif`
  g.textBaseline = 'middle'
  g.fillText(title, pad, H + band * 0.4)
  g.fillStyle = '#6e625c'
  g.font = `${Math.round(band * 0.17)}px Inter, -apple-system, sans-serif`
  g.fillText(subtitle, pad, H + band * 0.74)
  g.fillStyle = '#742f45'
  g.font = `600 ${Math.round(band * 0.18)}px Inter, -apple-system, sans-serif`
  g.textAlign = 'right'
  g.fillText('Mon Intérieur 3D', W - pad, H + band * 0.5)
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.92))
}

type Ready = { file: File; preview?: string; label: string }

export function ExportPanel({ onClose, layout: given, name: givenName }: { onClose: () => void; layout?: Layout; name?: string }) {
  const project = useProject()
  const current = useStore((s) => s.layout)
  const threeD = useStore((s) => s.threeD)
  const view = useStore((s) => s.view)
  const layout = given ?? current
  const [busy, setBusy] = useState<'image' | 'pdf' | null>(null)
  const [ready, setReady] = useState<Ready | null>(null)
  const [error, setError] = useState('')
  const name = givenName ?? project?.name ?? 'Ma pièce'

  useEffect(() => () => {
    if (ready?.preview) URL.revokeObjectURL(ready.preview)
  }, [ready])

  const makeImage = async () => {
    setBusy('image')
    setError('')
    try {
      useStore.getState().select(null)
      await new Promise((r) => setTimeout(r, 250))
      const img = await viewImage(threeD)
      if (!img) throw new Error()
      const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      const blob = await composeImage(img, name, `${layout.name} · ${date}`)
      const file = new File([blob], `${fileName(name)}.jpg`, { type: 'image/jpeg' })
      setReady({ file, preview: URL.createObjectURL(blob), label: 'Image prête' })
    } catch {
      setError("L'image n'a pas pu être créée. Réessayez.")
    }
    setBusy(null)
  }

  const makePdf = async () => {
    setBusy('pdf')
    setError('')
    try {
      const file = await roomPlanPdf(layout, name)
      setReady({ file, label: 'Plan PDF prêt' })
    } catch {
      setError("Le plan n'a pas pu être créé. Réessayez.")
    }
    setBusy(null)
  }

  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" aria-label="Exporter">
      <div className="modal-card export-card">
        <div className="popover-head">
          <h2>Exporter</h2>
          <button type="button" className="icon-btn small" onClick={onClose} aria-label="Fermer">
            {Icon.close}
          </button>
        </div>
        {!ready ? (
          <>
            <div className="export-options">
              {!given && (
                <button type="button" className="export-option" disabled={!!busy} onClick={makeImage}>
                  <span className="export-icon">{Icon.image}</span>
                  <strong>{busy === 'image' ? 'Préparation…' : 'Image de la vue'}</strong>
                  <span className="muted">
                    {threeD ? `Ce que vous voyez (${view === 'plan' ? 'plan' : view === 'yeux' ? 'à hauteur des yeux' : 'vue 3D'}), en haute définition, avec le nom du projet.` : 'Le plan de la pièce, en image.'}
                  </span>
                </button>
              )}
              <button type="button" className="export-option" disabled={!!busy} onClick={makePdf}>
                <span className="export-icon">{Icon.ruler}</span>
                <strong>{busy === 'pdf' ? 'Préparation…' : 'Plan PDF avec les cotes'}</strong>
                <span className="muted">À l'échelle, format A4 : murs, portes, fenêtres, meubles numérotés, couleurs et budget. Idéal pour un artisan.</span>
              </button>
            </div>
            {!given && <p className="hint-text">Astuce : choisissez d'abord l'angle de vue qui vous plaît (Vue 3D ou à hauteur des yeux).</p>}
          </>
        ) : (
          <div className="export-ready">
            {ready.preview ? <img src={ready.preview} alt="Aperçu de l'image" /> : <div className="export-pdf">{Icon.ruler} {ready.file.name}</div>}
            <p className="export-ready-label">
              {Icon.check} {ready.label}
            </p>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setReady(null)}>
                Retour
              </button>
              <button type="button" className="btn primary" onClick={() => offerFile(ready.file, name)}>
                {Icon.share} Enregistrer ou envoyer
              </button>
            </div>
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>,
    document.body,
  )
}
