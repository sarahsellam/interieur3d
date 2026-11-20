// Barre du haut, barre d'actions du meuble sélectionné, écran de chargement, aide.
import { useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { CATALOG_BY_ID } from '../data/catalog'
import { useStore } from '../store'

const Icon = {
  rotL: (
    <svg viewBox="0 0 24 24" aria-hidden><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  rotR: (
    <svg viewBox="0 0 24 24" aria-hidden><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  copy: (
    <svg viewBox="0 0 24 24" aria-hidden><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" aria-hidden><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
  ),
}

export function TopBar() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo" aria-hidden>
          <svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="currentColor" /></svg>
        </span>
        <span className="brand-name">Mon Intérieur 3D</span>
      </div>
      <div className="segmented" role="tablist" aria-label="Type de vue">
        {([['3d', 'Vue 3D'], ['visite', 'Visite'], ['top', 'Plan']] as const).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
            {label}
          </button>
        ))}
      </div>
    </header>
  )
}

export function SelectionBar() {
  const selectedUid = useStore((s) => s.selectedUid)
  const item = useStore((s) => s.items.find((i) => i.uid === s.selectedUid))
  const rotateItem = useStore((s) => s.rotateItem)
  const setRotation = useStore((s) => s.setRotation)
  const duplicateItem = useStore((s) => s.duplicateItem)
  const removeItem = useStore((s) => s.removeItem)
  const select = useStore((s) => s.select)
  if (!selectedUid || !item) return null
  const c = CATALOG_BY_ID[item.modelId]
  const deg = Math.round((item.rot * 180) / Math.PI) % 360
  const step = Math.PI / 4
  return (
    <div className="selection-bar" role="toolbar" aria-label={`Actions pour ${c.name}`}>
      <div className="sel-title">
        <strong>{c.name}</strong>
        <button className="icon-btn ghost" onClick={() => select(null)} aria-label="Désélectionner">{Icon.close}</button>
      </div>
      <div className="sel-actions">
        <button className="icon-btn" onClick={() => rotateItem(item.uid, step)} aria-label="Pivoter à gauche de 45°">{Icon.rotL}</button>
        <input
          className="rot-slider"
          type="range"
          min={0}
          max={359}
          step={1}
          value={deg}
          onChange={(e) => setRotation(item.uid, (parseFloat(e.target.value) * Math.PI) / 180)}
          aria-label="Angle de rotation"
        />
        <span className="rot-value">{deg}°</span>
        <button className="icon-btn" onClick={() => rotateItem(item.uid, -step)} aria-label="Pivoter à droite de 45°">{Icon.rotR}</button>
        <span className="sep" />
        <button className="icon-btn" onClick={() => duplicateItem(item.uid)} aria-label="Dupliquer">{Icon.copy}</button>
        <button className="icon-btn danger" onClick={() => removeItem(item.uid)} aria-label="Supprimer">{Icon.trash}</button>
      </div>
    </div>
  )
}

const VISIT_HINT_KEY = 'interieur3d-aide-visite'

export function VisitHint() {
  const view = useStore((s) => s.view)
  const [seen, setSeen] = useState(() => {
    try { return !!localStorage.getItem(VISIT_HINT_KEY) } catch { return false }
  })
  if (view !== 'visite' || seen) return null
  const close = () => {
    setSeen(true)
    try { localStorage.setItem(VISIT_HINT_KEY, '1') } catch { /* rien */ }
  }
  return (
    <div className="hint" role="note">
      <p>
        <strong>Vous êtes dans la pièce, à hauteur d'yeux.</strong> Glissez le doigt pour regarder autour de vous,
        <strong> touchez le sol</strong> pour y marcher, écartez deux doigts pour avancer.
        Sur ordinateur : flèches du clavier.
      </p>
      <button onClick={close}>C'est parti</button>
    </div>
  )
}

export function Loader() {
  const { active, progress } = useProgress()
  const [shown, setShown] = useState(true)
  useEffect(() => {
    if (!active && progress >= 100) {
      const t = setTimeout(() => setShown(false), 300)
      return () => clearTimeout(t)
    }
  }, [active, progress])
  if (!shown) return null
  return (
    <div className={`loader ${!active && progress >= 100 ? 'done' : ''}`}>
      <div className="loader-box">
        <span>Chargement de la pièce…</span>
        <div className="bar"><div style={{ width: `${Math.round(progress)}%` }} /></div>
      </div>
    </div>
  )
}

const HINT_KEY = 'interieur3d-aide-vue'

export function Hint() {
  const [visible, setVisible] = useState(() => {
    try { return !localStorage.getItem(HINT_KEY) } catch { return true }
  })
  if (!visible) return null
  const close = () => {
    setVisible(false)
    try { localStorage.setItem(HINT_KEY, '1') } catch { /* rien */ }
  }
  return (
    <div className="hint" role="note">
      <p>
        <strong>Touchez un meuble</strong> pour le sélectionner, puis <strong>glissez-le</strong> pour le déplacer.
        Glissez ailleurs pour tourner autour de la pièce, pincez pour zoomer.
      </p>
      <button onClick={close}>J'ai compris</button>
    </div>
  )
}
