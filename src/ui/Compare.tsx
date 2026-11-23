// Comparatif avant / après : deux versions du projet, vues sous le même angle,
// avec le total « À acheter » de chacune et la liste de ce qui change.
// Grand écran : côte à côte. Téléphone : bascule A / B.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtPrice, getItem, itemPrice } from '../data/catalog'
import { FLOORS } from '../data/finishes'
import { budgetOf } from '../model/geometry'
import type { Layout } from '../model/types'
import { WALL_LABEL, WALL_ORDER } from '../model/types'
import { useProject, useStore } from '../store'
import { captureThumb } from '../three/capture'
import { Icon } from './common'
import { Plan2D } from './Plan2D'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

/** Ce qui change de A à B, en phrases courtes. */
export function versionDiff(a: Layout, b: Layout): string[] {
  const out: string[] = []
  for (const w of WALL_ORDER) if (a.wallColors[w].toLowerCase() !== b.wallColors[w].toLowerCase()) out.push(`${WALL_LABEL[w]} : autre couleur`)
  if (a.floorId !== b.floorId) out.push(`Sol : ${FLOORS.find((f) => f.id === b.floorId)?.name ?? 'autre sol'}`)
  const name = (m: string) => getItem(m)?.name ?? 'meuble'
  const inA = new Map(a.items.map((i) => [i.uid, i]))
  const inB = new Map(b.items.map((i) => [i.uid, i]))
  for (const it of b.items) {
    const o = inA.get(it.uid)
    if (!o) out.push(`Ajouté : ${name(it.modelId)}`)
    else if (o.modelId !== it.modelId) out.push(`Remplacé : ${name(o.modelId)} → ${name(it.modelId)}`)
    else if (Math.hypot(o.x - it.x, o.z - it.z) > 0.04 || Math.abs(o.rot - it.rot) > 0.01) out.push(`Déplacé : ${name(it.modelId)}`)
    else if ((o.color ?? '') !== (it.color ?? '')) out.push(`Autre couleur : ${name(it.modelId)}`)
    else if (JSON.stringify(o.textiles ?? {}) !== JSON.stringify(it.textiles ?? {})) out.push(`Linge ou coussins : ${name(it.modelId)}`)
  }
  for (const it of a.items) if (!inB.has(it.uid)) out.push(`Retiré : ${name(it.modelId)}`)
  if (JSON.stringify(a.openings) !== JSON.stringify(b.openings)) out.push('Portes ou fenêtres modifiées')
  if (JSON.stringify(a.decor ?? []) !== JSON.stringify(b.decor ?? [])) out.push('Tableaux modifiés')
  if (a.room.width !== b.room.width || a.room.depth !== b.room.depth) out.push('Dimensions de la pièce modifiées')
  return out
}

function Budget({ l }: { l: Layout }) {
  const b = useMemo(() => budgetOf(l, itemPrice), [l])
  return (
    <span className="compare-budget">
      À acheter : <strong>{fmtPrice(b.total)}</strong>
      {b.missing > 0 && <span className="muted"> · {b.missing} sans prix</span>}
    </span>
  )
}

export function ComparePanel() {
  const project = useProject()
  const layout = useStore((s) => s.layout)
  const open = useStore((s) => s.compareOpen)
  const setOpen = useStore((s) => s.setCompareOpen)
  const threeD = useStore((s) => s.threeD)
  const view = useStore((s) => s.view)
  const switchVersion = useStore((s) => s.switchVersion)
  const duplicateVersion = useStore((s) => s.duplicateVersion)
  // Versions à jour : la version ouverte est prise telle qu'elle est à l'écran
  const versions = useMemo(() => (project?.versions ?? []).map((v) => (v.id === layout.id ? layout : v)), [project, layout])
  const [aId, setAId] = useState<string>('')
  const [bId, setBId] = useState<string>('')
  const [shown, setShown] = useState<'a' | 'b'>('a')
  const [images, setImages] = useState<{ a: string; b: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [reframe, setReframe] = useState(false)

  // Par défaut : la première version (A) et la version ouverte, ou la dernière (B)
  useEffect(() => {
    if (!open || versions.length < 2) return
    const others = versions.filter((v) => v.id !== layout.id)
    const b = versions.some((v) => v.id === bId) ? bId : layout.id !== versions[0].id ? layout.id : versions[versions.length - 1].id
    const a = versions.some((v) => v.id === aId) && aId !== b ? aId : (versions.find((v) => v.id !== b) ?? others[0]).id
    setAId(a)
    setBId(b)
  }, [open, versions.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const A = versions.find((v) => v.id === aId)
  const B = versions.find((v) => v.id === bId)

  /** Rendu des deux versions avec la caméra actuelle (même cadrage). */
  const render = useCallback(async () => {
    if (!A || !B || !threeD) return
    setBusy(true)
    const width = Math.min(1100, Math.round(window.innerWidth * (window.innerWidth > 860 ? 0.5 : 1) * Math.min(2, window.devicePixelRatio || 1)))
    const shots: string[] = []
    for (const l of [A, B]) {
      useStore.setState({ layoutPreview: l, selection: null })
      await frames()
      await wait(900) // le temps de charger un meuble qui n'était pas encore affiché
      shots.push(await captureThumb(width))
    }
    useStore.setState({ layoutPreview: null })
    setImages({ a: shots[0], b: shots[1] })
    setBusy(false)
  }, [A, B, threeD])

  useEffect(() => {
    if (open && !reframe && A && B) void render()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, aId, bId, reframe, view])

  if (!open) return null

  // Recadrage : on rend la main à la 3D pour choisir l'angle
  if (reframe)
    return (
      <div className="compare-reframe" role="status">
        <span>Tournez ou zoomez la vue, puis touchez :</span>
        <button type="button" className="btn primary" onClick={() => setReframe(false)}>
          Comparer avec cette vue
        </button>
      </div>
    )

  const close = () => {
    useStore.setState({ layoutPreview: null })
    setImages(null)
    setOpen(false)
  }

  if (versions.length < 2)
    return (
      <div className="compare" role="dialog" aria-label="Comparer deux versions">
        <div className="compare-card compare-empty">
          <div className="popover-head">
            <h2>Comparer deux versions</h2>
            <button type="button" className="icon-btn small" onClick={close} aria-label="Fermer">
              {Icon.close}
            </button>
          </div>
          <p className="hint-text">Il faut deux versions pour comparer. Créez une copie de « {layout.name} » : vous y essayez une autre idée sans toucher à l'originale, puis vous revenez ici.</p>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              duplicateVersion()
              close()
            }}
          >
            {Icon.copy} Créer une version B
          </button>
        </div>
      </div>
    )

  const diff = A && B ? versionDiff(A, B) : []
  const side = (key: 'a' | 'b', l: Layout | undefined, setId: (id: string) => void, otherId: string) => (
    <section className={`compare-side ${shown === key ? 'shown' : ''}`}>
      <div className="compare-side-head">
        <span className="compare-letter">{key.toUpperCase()}</span>
        <select value={l?.id} onChange={(e) => setId(e.target.value)} aria-label={`Version ${key.toUpperCase()}`}>
          {versions.map((v) => (
            <option key={v.id} value={v.id} disabled={v.id === otherId}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      <div className={`compare-image ${images && !busy && threeD ? 'has-img' : ''}`}>
        {!threeD && l ? <Plan2D layout={l} className="compare-plan" /> : images && !busy ? <img src={images[key]} alt={`Rendu de ${l?.name}`} /> : <div className="compare-loading">Préparation de la vue…</div>}
      </div>
      <div className="compare-side-foot">
        {l && <Budget l={l} />}
        {l && l.id !== layout.id && (
          <button
            type="button"
            className="chip"
            onClick={() => {
              switchVersion(l.id)
              close()
            }}
          >
            Ouvrir cette version
          </button>
        )}
        {l && l.id === layout.id && <span className="muted">Version ouverte</span>}
      </div>
    </section>
  )

  return (
    <div className="compare" role="dialog" aria-label="Comparer deux versions">
      <div className="compare-card">
        <div className="popover-head">
          <h2>Avant / après</h2>
          <div className="segmented compare-toggle" role="tablist" aria-label="Version affichée">
            <button type="button" role="tab" aria-selected={shown === 'a'} className={shown === 'a' ? 'active' : ''} onClick={() => setShown('a')}>
              A
            </button>
            <button type="button" role="tab" aria-selected={shown === 'b'} className={shown === 'b' ? 'active' : ''} onClick={() => setShown('b')}>
              B
            </button>
          </div>
          <button type="button" className="icon-btn small" onClick={close} aria-label="Fermer">
            {Icon.close}
          </button>
        </div>
        <div className="compare-sides">
          {side('a', A, setAId, bId)}
          {side('b', B, setBId, aId)}
        </div>
        <div className="compare-foot">
          <div className="compare-diff">
            <strong>Ce qui change de A à B</strong>
            {diff.length ? (
              <ul>
                {diff.slice(0, 6).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
                {diff.length > 6 && <li className="muted">et {diff.length - 6} autre{diff.length > 7 ? 's' : ''} changement{diff.length > 7 ? 's' : ''}</li>}
              </ul>
            ) : (
              <p className="muted">Les deux versions sont identiques.</p>
            )}
          </div>
          {threeD && (
            <button type="button" className="btn secondary" disabled={busy} onClick={() => setReframe(true)}>
              {Icon.move} Changer l'angle de vue
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Bouton « Comparer » de la barre du haut. */
export function CompareButton() {
  const setOpen = useStore((s) => s.setCompareOpen)
  const open = useStore((s) => s.compareOpen)
  return (
    <button type="button" className={`chip compare-btn ${open ? 'selected' : ''}`} onClick={() => setOpen(!open)} data-guide="comparer" title="Comparer deux versions">
      {Icon.swap} <span className="compare-label">Comparer</span>
    </button>
  )
}
