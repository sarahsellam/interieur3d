// Bouton « Passages » et liste des écarts : ce qui est étroit, ce qui gêne une ouverture.
import { useMemo, useState } from 'react'
import { COMFORT_LABEL, findGaps, gapSentence, openingZones, zoneSentence } from '../model/clearance'
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
  const focus = useStore((s) => s.passageFocus)
  const setFocus = useStore((s) => s.setPassageFocus)
  const showPoint = useStore((s) => s.showPoint)
  /** Toucher une alerte : mise en évidence sur le plan (et la pièce se recentre si besoin) ; second toucher : on l'éteint */
  const toggle = (key: string, p: [number, number]) => {
    if (focus === key) return setFocus(null)
    setFocus(key)
    showPoint(p[0], p[1], 0.05)
    // Sur téléphone, la liste se replie pour laisser voir l'endroit concerné
    if (window.innerWidth <= 860) setOpen(false)
  }
  if (!on) return null
  const fz = zones.find((z) => z.key === focus)
  const fg = gaps.find((g) => g.key === focus)
  const focusText = !open && (fz || fg) ? `Affiché : ${fz ? zoneSentence(fz) : gapSentence(fg!)}` : null
  const tight = gaps.filter((g) => g.comfort !== 'ok')
  return (
    <div className={`passages-card ${open ? '' : 'closed'}`} role="region" aria-label="Passages">
      <div className="passages-head">
        <button type="button" className="passages-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <strong>Passages</strong>
          <span className="muted">
            {focusText ?? (tight.length + zones.length === 0 ? 'tout est confortable' : `${tight.length + zones.length} point${tight.length + zones.length > 1 ? 's' : ''} à vérifier`)}
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
              <li key={z.key} className={`etroit ${focus === z.key ? 'focused' : ''}`}>
                <button type="button" onClick={() => toggle(z.key, center(z.corners))}>
                  <span className="dot" /> {zoneSentence(z)}
                </button>
              </li>
            ))}
            {gaps.slice(0, 6).map((g) => (
              <li key={g.key} className={`${g.comfort} ${focus === g.key ? 'focused' : ''}`}>
                <button type="button" onClick={() => toggle(g.key, [(g.from[0] + g.to[0]) / 2, (g.from[1] + g.to[1]) / 2])}>
                  <span className="dot" /> {gapSentence(g)} <span className="muted">· {COMFORT_LABEL[g.comfort]}</span>
                </button>
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

const center = (c: [number, number][]): [number, number] => [c.reduce((a, p) => a + p[0], 0) / c.length, c.reduce((a, p) => a + p[1], 0) / c.length]
