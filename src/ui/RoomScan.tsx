// « Recréer la pièce depuis mes photos » : on choisit jusqu'à 4 photos de la vraie pièce,
// l'assistant reconnaît meubles, portes et fenêtres, on regarde le résultat dans la pièce,
// puis on le garde (nouvelle version) ou on annule.
import { useEffect, useRef, useState } from 'react'
import { aiReady } from '../model/ai'
import { buildScannedLayout, scanRoomPhotos, type RoomScan, type ScannedLayout } from '../model/roomScan'
import { useProject, useStore } from '../store'
import { Icon, ImportButton, StoredImage } from './common'

type Phase = 'form' | 'loading' | 'result' | 'kept'

const m = (v: number) => v.toFixed(2).replace('.', ',')

export function RoomScanPanel() {
  const req = useStore((s) => s.scan)
  const setScan = useStore((s) => s.setScan)
  const project = useProject()
  const layout = useStore((s) => s.layout)
  const myFurniture = useStore((s) => s.myFurniture)
  const setLayoutPreview = useStore((s) => s.setLayoutPreview)
  const applyLayoutAsVersion = useStore((s) => s.applyLayoutAsVersion)
  const addReference = useStore((s) => s.addReference)
  const photos = (project?.references ?? []).filter((r) => r.kind === 'photo')
  const [chosen, setChosen] = useState<string[]>(() => photos.slice(0, 4).map((p) => p.id))
  const [measured, setMeasured] = useState(!req?.estimate)
  const [phase, setPhase] = useState<Phase>('form')
  const [error, setError] = useState('')
  const [scan, setScanResult] = useState<RoomScan | null>(null)
  const [built, setBuilt] = useState<ScannedLayout | null>(null)
  const started = useRef(false)

  const close = () => {
    setLayoutPreview(null)
    setScan(null)
  }

  const send = async () => {
    if (!navigator.onLine) return setError("Pas de connexion Internet : la lecture des photos a besoin d'Internet.")
    if (!chosen.length) return setError('Choisissez au moins une photo.')
    setPhase('loading')
    setError('')
    try {
      const st = useStore.getState()
      const s = await scanRoomPhotos(chosen, project?.roomType ?? 'chambre', measured ? st.layout.room : null, myFurniture)
      const b = buildScannedLayout(st.layout, s, measured)
      setScanResult(s)
      setBuilt(b)
      setPhase('result')
      setLayoutPreview(b.layout)
      // On replie le panneau des meubles pour voir toute la pièce à côté du résultat
      st.setPanelOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue.')
      setPhase('form')
    }
  }

  // Depuis la création du projet : on lance directement
  useEffect(() => {
    if (req?.auto && !started.current && chosen.length && aiReady()) {
      started.current = true
      send()
    }
  })

  const head = (
    <div className="sheet-head">
      <div>
        <strong>Recréer ma pièce depuis mes photos</strong>
        <span className="muted">{project?.name}</span>
      </div>
      <button type="button" className="icon-btn small" onClick={close} aria-label="Fermer">
        {Icon.close}
      </button>
    </div>
  )

  if (!aiReady())
    return (
      <aside className="idea-panel scan-panel" aria-label="Recréer ma pièce depuis mes photos">
        {head}
        <p className="hint-text">La lecture des photos n'est pas encore branchée à cette version de l'application.</p>
      </aside>
    )

  return (
    <aside className="idea-panel scan-panel" aria-label="Recréer ma pièce depuis mes photos">
      {head}

      {phase === 'form' && (
        <div className="idea-form">
          <p className="hint-text">
            L'assistant reconnaît les meubles, portes et fenêtres de vos photos et les place sur le plan. Pour un bon résultat : 2 à 4 photos prises depuis
            les coins, en plein jour, qui montrent ensemble les quatre murs.
          </p>
          <div className="field">
            <span>Photos à lire (4 au maximum)</span>
            <div className="idea-inspi">
              {photos.map((p, i) => {
                const on = chosen.includes(p.id)
                const n = chosen.indexOf(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`idea-inspi-item ${on ? 'on' : ''}`}
                    onClick={() => setChosen(on ? chosen.filter((x) => x !== p.id) : chosen.length < 4 ? [...chosen, p.id] : chosen)}
                    aria-pressed={on}
                  >
                    <StoredImage id={p.id} />
                    <span>{on ? (n === 0 ? 'Photo 1 · mur 1 en face' : `Photo ${n + 1}`) : `Photo ${i + 1}`}</span>
                  </button>
                )
              })}
            </div>
            <ImportButton
              label={<>{Icon.image} Ajouter des photos</>}
              accept="image/*"
              multiple
              onImported={(ids) => {
                ids.forEach((x) => addReference({ id: x.id, name: x.name, kind: 'photo' }))
                setChosen((c) => [...c, ...ids.map((x) => x.id)].slice(0, 4))
              }}
            />
          </div>
          <p className="hint-text">Le mur qu'on voit en face sur la photo 1 devient le mur 1 du plan.</p>
          <label className="check-row">
            <input type="checkbox" checked={measured} onChange={(e) => setMeasured(e.target.checked)} />
            <span>
              J'ai mesuré la pièce : garder {m(layout.room.width)} × {m(layout.room.depth)} m
            </span>
          </label>
          {!measured && <p className="hint-text">Les dimensions seront estimées d'après les photos (à vérifier au mètre ensuite).</p>}
          <p className="hint-text">Le résultat est une nouvelle version : votre pièce actuelle est conservée. Chaque lecture coûte environ 15 centimes.</p>
          {error && <p className="notice warn">{error}</p>}
          <button type="button" className="btn primary large" onClick={send} disabled={!chosen.length}>
            {Icon.spark} Lire mes photos
          </button>
        </div>
      )}

      {phase === 'loading' && (
        <div className="idea-loading" role="status">
          <span className="spinner" aria-hidden />
          <p>L'assistant repère les meubles, les portes et les fenêtres…</p>
          <p className="hint-text">Cela prend en général une à deux minutes.</p>
        </div>
      )}

      {phase === 'result' && built && scan && (
        <div className="idea-results scan-result">
          <p className="notice ok">
            {Icon.check} {built.seen.length} meuble{built.seen.length > 1 ? 's' : ''} et {built.openings.length} ouverture{built.openings.length > 1 ? 's' : ''} placés.
            Regardez la pièce : gardez-la ou annulez.
          </p>
          <p className="muted">
            Pièce de {m(built.layout.room.width)} × {m(built.layout.room.depth)} m{measured ? ' (vos mesures)' : ' (estimée)'}. {scan.orientation}
          </p>
          <div className="scan-lists">
            <div>
              <h3>Meubles</h3>
              <ul>
                {built.seen.map((s, i) => (
                  <li key={i}>
                    <strong>{s.vu}</strong> → {s.name}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Portes et fenêtres</h3>
              <ul>
                {built.openings.map((o, i) => (
                  <li key={i}>{o.label}</li>
                ))}
                {!built.openings.length && <li>Aucune vue sur les photos</li>}
              </ul>
            </div>
          </div>
          {(built.notes.length > 0 || scan.incertain) && (
            <ul className="idea-notes">
              {built.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
              {scan.incertain && <li>{scan.incertain}</li>}
            </ul>
          )}
          <div className="idea-actions">
            <button type="button" className="btn ghost" onClick={() => (setLayoutPreview(null), setPhase('form'))}>
              Annuler
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                applyLayoutAsVersion(built.layout)
                setPhase('kept')
              }}
            >
              {Icon.check} Garder cette pièce
            </button>
          </div>
        </div>
      )}

      {phase === 'kept' && (
        <div className="idea-applied">
          <p className="notice ok">{Icon.check} Votre pièce est créée comme nouvelle version « Ma pièce (photos) ». L'ancienne est conservée.</p>
          <p className="hint-text">
            Les positions sont approximatives : touchez un meuble pour le déplacer ou corriger ses dimensions, et une fenêtre pour ajuster sa place sur le mur.
          </p>
          <button type="button" className="btn primary" onClick={close}>
            Terminer
          </button>
        </div>
      )}
    </aside>
  )
}

/** Bouton de l'onglet « Pièce ». */
export function RoomScanButton() {
  const project = useProject()
  const setScan = useStore((s) => s.setScan)
  const n = (project?.references ?? []).filter((r) => r.kind === 'photo').length
  return (
    <button type="button" className="btn secondary scan-btn" onClick={() => setScan({ auto: false, estimate: false })}>
      {Icon.spark} {n ? 'Placer les meubles et fenêtres de mes photos' : 'Recréer ma pièce depuis des photos'}
    </button>
  )
}
