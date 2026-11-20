// « Demander une idée » : l'assistant propose deux aménagements de la pièce,
// à partir de la demande et des inspirations. On les regarde dans la pièce,
// on en applique un (il devient une nouvelle version) et on compare avec avant.
import { useMemo, useState } from 'react'
import { fmtPrice } from '../data/catalog'
import { aiReady, askIdea, checkProposal, proposalBudget, type CheckedProposal } from '../model/ai'
import { useProject, useStore } from '../store'
import { Icon, StoredImage } from './common'

type Phase = 'form' | 'loading' | 'results' | 'applied'

const EXAMPLES = [
  'Crée un coin bureau en gardant mon lit et en laissant l’accès à la porte-fenêtre',
  'Rends la chambre plus chaleureuse avec des couleurs inspirées de mes photos',
  'Libère de la place au sol sans retirer la coiffeuse',
]

export function IdeaPanel({ onClose }: { onClose: () => void }) {
  const project = useProject()
  const layout = useStore((s) => s.layout)
  const myFurniture = useStore((s) => s.myFurniture)
  const inspirations = useStore((s) => s.inspirations)
  const layoutPreview = useStore((s) => s.layoutPreview)
  const setLayoutPreview = useStore((s) => s.setLayoutPreview)
  const applyLayoutAsVersion = useStore((s) => s.applyLayoutAsVersion)
  const switchVersion = useStore((s) => s.switchVersion)
  const [phase, setPhase] = useState<Phase>('form')
  const [demande, setDemande] = useState('')
  const [chosen, setChosen] = useState<string[]>(() => inspirations.filter((i) => i.imageId || i.note).slice(0, 4).map((i) => i.id))
  const [error, setError] = useState('')
  const [results, setResults] = useState<CheckedProposal[]>([])
  const [applied, setApplied] = useState<{ before: string; after: string; title: string } | null>(null)
  const base = useMemo(() => layout, [phase === 'form']) // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    setLayoutPreview(null)
    onClose()
  }

  const send = async () => {
    if (!navigator.onLine) {
      setError("Pas de connexion Internet : l'assistant a besoin d'Internet. Le reste de l'application fonctionne hors connexion.")
      return
    }
    setPhase('loading')
    setError('')
    try {
      const props = await askIdea(
        demande.trim(),
        layout,
        myFurniture,
        inspirations.filter((i) => chosen.includes(i.id)),
      )
      const checked = props.map((p) => checkProposal(layout, p))
      if (!checked.length) throw new Error("L'assistant n'a pas fait de proposition. Reformulez la demande.")
      setResults(checked)
      setPhase('results')
      setLayoutPreview(checked[0].layout)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue.')
      setPhase('form')
    }
  }

  if (!aiReady()) {
    return (
      <aside className="idea-panel" aria-label="Demander une idée">
        <div className="sheet-head">
          <div>
            <strong>Demander une idée</strong>
          </div>
          <button type="button" className="icon-btn small" onClick={close} aria-label="Fermer">
            {Icon.close}
          </button>
        </div>
        <p className="hint-text">L'assistant n'est pas encore branché à cette version de l'application. Il sera disponible dès que le relais sera installé.</p>
      </aside>
    )
  }

  return (
    <aside className="idea-panel" aria-label="Demander une idée">
      <div className="sheet-head">
        <div>
          <strong>Demander une idée</strong>
          <span className="muted">{project?.name}</span>
        </div>
        <button type="button" className="icon-btn small" onClick={close} aria-label="Fermer">
          {Icon.close}
        </button>
      </div>

      {phase === 'form' && (
        <div className="idea-form">
          <label className="field">
            <span>Votre demande</span>
            <textarea rows={4} value={demande} onChange={(e) => setDemande(e.target.value)} placeholder="Exemple : crée un coin bureau en gardant mon lit…" />
          </label>
          <div className="choice-row">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="chip small-chip" onClick={() => setDemande(ex)}>
                {ex}
              </button>
            ))}
          </div>
          {inspirations.length > 0 && (
            <div className="field">
              <span>Inspirations à utiliser (4 au maximum)</span>
              <div className="idea-inspi">
                {inspirations.map((i) => {
                  const on = chosen.includes(i.id)
                  return (
                    <button
                      key={i.id}
                      type="button"
                      className={`idea-inspi-item ${on ? 'on' : ''}`}
                      onClick={() => setChosen(on ? chosen.filter((x) => x !== i.id) : chosen.length < 4 ? [...chosen, i.id] : chosen)}
                      aria-pressed={on}
                    >
                      {i.imageId ? <StoredImage id={i.imageId} /> : <span className="thumb-empty">{Icon.link}</span>}
                      <span>{i.note || (i.link ? 'Lien' : 'Photo')}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <p className="hint-text">
            Les meubles verrouillés ne bougeront pas. L'assistant propose deux idées ; vous les regardez dans la pièce avant de choisir. Chaque demande coûte environ 20 centimes.
          </p>
          {error && <p className="notice warn">{error}</p>}
          <button type="button" className="btn primary large" onClick={send} disabled={!demande.trim() && chosen.length === 0}>
            {Icon.spark} Demander deux idées
          </button>
        </div>
      )}

      {phase === 'loading' && (
        <div className="idea-loading" role="status">
          <span className="spinner" aria-hidden />
          <p>L'assistant étudie votre pièce{chosen.length ? ' et vos inspirations' : ''}…</p>
          <p className="hint-text">Cela prend en général une à deux minutes.</p>
        </div>
      )}

      {phase === 'results' && (
        <div className="idea-results">
          <div className="seg-small compare" role="group" aria-label="Comparer">
            <button type="button" className={!layoutPreview ? 'active' : ''} onClick={() => setLayoutPreview(null)}>
              Avant
            </button>
            {results.map((r, i) => (
              <button key={i} type="button" className={layoutPreview === r.layout ? 'active' : ''} onClick={() => setLayoutPreview(r.layout)}>
                Idée {i + 1}
              </button>
            ))}
          </div>
          {results.map((r, i) => {
            const budget = proposalBudget(r.layout)
            const shown = layoutPreview === r.layout
            return (
              <article key={i} className={`idea-card ${shown ? 'shown' : ''}`}>
                <h3>
                  Idée {i + 1} · {r.proposal.titre}
                </h3>
                <p>{r.proposal.explication}</p>
                {r.notes.length > 0 && (
                  <ul className="idea-notes">
                    {r.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                )}
                {budget > 0 && <p className="muted">Achats prévus : {fmtPrice(budget)} (meubles à prix connu)</p>}
                <div className="idea-actions">
                  {!shown && (
                    <button type="button" className="btn secondary" onClick={() => setLayoutPreview(r.layout)}>
                      Voir dans la pièce
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => {
                      const before = base.id
                      applyLayoutAsVersion(r.layout)
                      const after = useStore.getState().layout.id
                      setApplied({ before, after, title: r.layout.name })
                      setPhase('applied')
                    }}
                  >
                    Appliquer cette idée
                  </button>
                </div>
              </article>
            )
          })}
          <button type="button" className="btn ghost" onClick={() => (setLayoutPreview(null), setPhase('form'))}>
            Modifier la demande
          </button>
        </div>
      )}

      {phase === 'applied' && applied && (
        <div className="idea-applied">
          <p className="notice ok">
            {Icon.check} « {applied.title} » est appliquée comme nouvelle version. Votre aménagement précédent est conservé.
          </p>
          <div className="seg-small compare" role="group" aria-label="Comparer avec avant">
            <button type="button" className={layout.id === applied.before ? 'active' : ''} onClick={() => switchVersion(applied.before)}>
              Avant
            </button>
            <button type="button" className={layout.id === applied.after ? 'active' : ''} onClick={() => switchVersion(applied.after)}>
              Après
            </button>
          </div>
          <p className="hint-text">Touchez un meuble puis « Remplacer » pour choisir une autre pièce selon votre budget.</p>
          <button type="button" className="btn primary" onClick={close}>
            Terminer
          </button>
        </div>
      )}
    </aside>
  )
}
