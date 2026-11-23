// Bouton « Passages » et liste des écarts : ce qui est étroit, ce qui gêne une ouverture.
import { useMemo, useState } from 'react'
import { COMFORT_LABEL, findGaps, gapSentence, openingZones, withArticle } from '../model/clearance'
import { shownLayout, useStore } from '../store'
import { Icon } from './common'

export function PassagesChip() {
  const on = useStore((s) => s.passages)
  const set = useStore((s) => s.setPassages)
  return (
    <button type="button" className={`chip ${on ? 'selected' : ''}`} onClick={() => set(!on)} aria-pressed={on} title="Espace libre entre les meubles et zones d'ouverture">
      {Icon.ruler} Passages
    </button>
  )
}

export function PassagesCard() {
  const on = useStore((s) => s.passages)
  const view = useStore((s) => s.view)
  const layout = useStore(shownLayout)
  const set = useStore((s) => s.setPassages)
  // Sur téléphone, la liste est repliée pour laisser voir la pièce
  const [open, setOpen] = useState(() => window.innerWidth > 860)
  const gaps = useMemo(() => (on ? findGaps(layout) : []), [on, layout])
  const zones = useMemo(() => (on ? openingZones(layout).filter((z) => z.blockedBy) : []), [on, layout])
  if (!on) return null
  const tight = gaps.filter((g) => g.comfort !== 'ok')
  return (
    <div className={`passages-card ${open ? '' : 'closed'}`} role="region" aria-label="Passages">
      <div className="passages-head">
        <button type="button" className="passages-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <strong>Passages</strong>
          <span className="muted">
            {tight.length + zones.length === 0 ? 'tout est confortable' : `${tight.length + zones.length} point${tight.length + zones.length > 1 ? 's' : ''} à vérifier`}
          </span>
        </button>
        <button type="button" className="icon-btn small" onClick={() => set(false)} aria-label="Masquer les passages">
          {Icon.close}
        </button>
      </div>
      {open && (
        <>
          <ul className="passages-list">
            {zones.map((z) => (
              <li key={z.item.uid} className="etroit">
                <span className="dot" /> {capital(z.label)} de {withArticle(z.item)} : gênée par {z.blockedBy}
              </li>
            ))}
            {gaps.slice(0, 6).map((g) => (
              <li key={g.key} className={g.comfort}>
                <span className="dot" /> {gapSentence(g)} <span className="muted">· {COMFORT_LABEL[g.comfort]}</span>
              </li>
            ))}
            {gaps.length === 0 && zones.length === 0 && <li className="muted">Aucun passage à mesurer entre les meubles.</li>}
          </ul>
          <p className="passages-legend">
            <span className="etroit">moins de 60 cm : étroit</span> · <span className="juste">60 à 90 cm : juste</span> · <span className="ok">90 cm et plus</span>
            {view === 'yeux' && <> · passez en Plan ou en Vue 3D pour voir les mesures</>}
          </p>
        </>
      )}
    </div>
  )
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
