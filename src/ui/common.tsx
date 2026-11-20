// Petits composants d'interface partagés : icônes, champs de mesure, nuanciers, import de fichiers.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { imageUrl, importImageFile } from '../model/storage'

const svg = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
)

export const Icon = {
  home: svg(<path d="M4 11l8-6.5 8 6.5V20h-5v-5.5h-6V20H4z" />),
  undo: svg(<path d="M9 7H5V3M5 7a8 8 0 1 1-1.4 7" />),
  redo: svg(<path d="M15 7h4V3M19 7a8 8 0 1 0 1.4 7" />),
  rotL: svg(<path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" />),
  rotR: svg(<path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" />),
  copy: svg(
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>,
  ),
  trash: svg(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />),
  close: svg(<path d="M6 6l12 12M18 6L6 18" />),
  plus: svg(<path d="M12 5v14M5 12h14" />),
  lock: svg(
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>,
  ),
  unlock: svg(
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 7.6-1.8" />
    </>,
  ),
  palette: svg(
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.3-1.7-.4-1.1.3-2.3 1.5-2.3H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10.5" cy="7" r="1" />
      <circle cx="15" cy="7.5" r="1" />
    </>,
  ),
  ruler: svg(<path d="M3 16l13-13 5 5L8 21zM7 12l2 2M10 9l2 2M13 6l2 2" />),
  move: svg(<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />),
  pin: svg(<path d="M9 3h6l-1 6 4 4H6l4-4zM12 13v8" />),
  image: svg(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-5-5-8 9" />
    </>,
  ),
  link: svg(<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />),
  check: svg(<path d="M5 12.5l4.5 4.5L19 7.5" />),
  chevron: svg(<path d="M8 10l4 4 4-4" />),
  arrow: svg(<path d="M12 19V5M6 11l6-6 6 6" />),
  wall: svg(<path d="M3 6h18v12H3zM3 12h18M9 6v6M15 12v6" />),
  alert: svg(<path d="M12 4l9 16H3zM12 10v4M12 17v.5" />),
  grid: svg(<path d="M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16" />),
  share: svg(<path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />),
  download: svg(<path d="M12 4v11M8 11l4 4 4-4M5 20h14" />),
  upload: svg(<path d="M12 20V9M8 13l4-4 4 4M5 4h14" />),
  spark: svg(<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />),
  swap: svg(<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />),
  euro: svg(<path d="M17 6.5A6.5 6.5 0 1 0 17 17.5M4 10.5h9M4 13.5h9" />),
  magnet: svg(<path d="M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4zM6 8h4M14 8h4" />),
}

/** Champ de mesure : saisie directe (virgule acceptée) et boutons − / +. */
export function MeasureField({
  label,
  value,
  onChange,
  unit = 'm',
  step = 0.05,
  min = 0,
  max = 99,
  compact = false,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  unit?: 'm' | 'cm'
  step?: number
  min?: number
  max?: number
  compact?: boolean
}) {
  const shown = unit === 'cm' ? Math.round(value * 100).toString() : value.toFixed(2).replace('.', ',')
  const [text, setText] = useState(shown)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (!editing) setText(shown)
  }, [shown, editing])
  const commit = () => {
    setEditing(false)
    const v = parseFloat(text.replace(',', '.'))
    if (Number.isNaN(v)) return setText(shown)
    const meters = unit === 'cm' ? v / 100 : v
    onChange(Math.min(max, Math.max(min, Math.round(meters * 100) / 100)))
  }
  const bump = (d: number) => onChange(Math.min(max, Math.max(min, Math.round((value + d) * 100) / 100)))
  return (
    <label className={`measure ${compact ? 'compact' : ''}`}>
      <span className="measure-label">{label}</span>
      <span className="measure-box">
        {!compact && (
          <button type="button" onClick={() => bump(-step)} aria-label={`Réduire ${label}`} disabled={value <= min}>
            −
          </button>
        )}
        <input
          type="text"
          inputMode="decimal"
          value={text}
          onFocus={(e) => {
            setEditing(true)
            e.target.select()
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label={label}
        />
        <span className="unit">{unit}</span>
        {!compact && (
          <button type="button" onClick={() => bump(step)} aria-label={`Augmenter ${label}`} disabled={value >= max}>
            +
          </button>
        )}
      </span>
    </label>
  )
}

export function Swatches({ colors, value, onChange, allowCustom = true, originalLabel }: { colors: { name: string; hex: string }[]; value: string | null | undefined; onChange: (hex: string | null) => void; allowCustom?: boolean; originalLabel?: string }) {
  return (
    <div className="swatches">
      {originalLabel && (
        <button type="button" className={`swatch original ${!value ? 'active' : ''}`} onClick={() => onChange(null)} title={originalLabel} aria-label={originalLabel}>
          <span>Orig.</span>
        </button>
      )}
      {colors.map((c) => (
        <button
          key={c.hex}
          type="button"
          className={`swatch ${value?.toLowerCase() === c.hex.toLowerCase() ? 'active' : ''}`}
          style={{ background: c.hex }}
          onClick={() => onChange(c.hex)}
          title={c.name}
          aria-label={c.name}
        />
      ))}
      {allowCustom && (
        <label className="swatch custom" title="Autre couleur">
          <input type="color" value={value ?? '#ffffff'} onChange={(e) => onChange(e.target.value)} aria-label="Autre couleur" />
          <span>+</span>
        </label>
      )}
    </div>
  )
}

/** Bouton qui ouvre la galerie / l'appareil photo / les fichiers, puis enregistre l'image. */
export function ImportButton({ label, accept, multiple, onImported, className = 'btn secondary' }: { label: ReactNode; accept: string; multiple?: boolean; onImported: (ids: { id: string; name: string }[]) => void; className?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <>
      <button type="button" className={className} disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? 'Import en cours…' : label}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (!files.length) return
          setBusy(true)
          setError('')
          const out: { id: string; name: string }[] = []
          for (const f of files) {
            try {
              out.push({ id: await importImageFile(f), name: f.name })
            } catch {
              setError(`Impossible de lire « ${f.name} ». Essayez une image JPEG, PNG ou un PDF.`)
            }
          }
          setBusy(false)
          if (out.length) onImported(out)
        }}
      />
      {error && <p className="form-error">{error}</p>}
    </>
  )
}

/** Image enregistrée dans l'appareil. */
export function StoredImage({ id, alt = '', className }: { id: string; alt?: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    imageUrl(id).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [id])
  if (!url) return <div className={`img-placeholder ${className ?? ''}`} />
  return <img src={url} alt={alt} className={className} draggable={false} />
}

export const fmtM = (m: number) => `${m.toFixed(2).replace('.', ',')} m`
export const fmtCm = (m: number) => `${Math.round(m * 100)}`
