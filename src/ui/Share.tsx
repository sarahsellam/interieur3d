// Partage par lien :
// - côté propriétaire : choisir une ou deux versions, poser une question, obtenir le lien, lire les avis, arrêter le partage ;
// - côté invité : voir la pièce en lecture seule (plan, 3D, hauteur des yeux), voter et commenter, sans compte.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { registerSharedFurniture } from '../data/catalog'
import {
  buildContent,
  createShare,
  myVote,
  readShare,
  rememberVote,
  sendAvis,
  shareReady,
  shareUrl,
  stopShare,
  versionLetter,
  type SharedData,
} from '../model/share'
import type { Layout, ShareRef, ViewMode } from '../model/types'
import { ROOM_TYPE_LABEL, VIEW_LABEL } from '../model/types'
import { useProject, useStore } from '../store'
import { Icon } from './common'
import { EyeLevelHint } from './Editor'
import { Plan2D } from './Plan2D'

const dateFr = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

function VersionThumb({ v }: { v: Layout }) {
  return v.thumb ? <img src={v.thumb} alt="" /> : <Plan2D layout={v} className="project-plan" />
}

/** Barres de résultats du vote */
function VoteBars({ data, names }: { data: SharedData; names: string[] }) {
  const total = data.votes.reduce((a, b) => a + b, 0)
  if (data.votes.length < 2) return null
  return (
    <div className="vote-bars">
      {data.votes.map((n, i) => {
        const pct = total ? Math.round((n / total) * 100) : 0
        return (
          <div key={i} className="vote-bar">
            <div className="vote-bar-label">
              <span>
                <strong>{versionLetter(i)}</strong> · {names[i]}
              </span>
              <span className="muted">
                {n} vote{n > 1 ? 's' : ''}
                {total ? ` · ${pct} %` : ''}
              </span>
            </div>
            <div className="vote-bar-track">
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Comments({ data, names }: { data: SharedData; names: string[] }) {
  const list = data.avis.filter((a) => a.commentaire).sort((a, b) => b.date - a.date)
  if (!list.length) return <p className="hint-text">Pas encore de commentaire.</p>
  return (
    <ul className="comments">
      {list.map((a, i) => (
        <li key={i}>
          <p>{a.commentaire}</p>
          <span className="muted">
            {a.prenom || 'Anonyme'}
            {a.version !== null && names.length > 1 ? ` · préfère ${versionLetter(a.version)}` : ''} · {dateFr(a.date)}
          </span>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------- Propriétaire

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function LinkBox({ id, question }: { id: string; question: string }) {
  const url = shareUrl(id)
  const [copied, setCopied] = useState(false)
  return (
    <div className="share-link">
      <input type="text" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Lien de partage" />
      <div className="share-link-actions">
        <button
          type="button"
          className={`btn ${copied ? 'saved' : 'secondary'}`}
          onClick={async () => {
            if (await copyText(url)) {
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }
          }}
        >
          {copied ? <>{Icon.check} Copié</> : <>{Icon.copy} Copier le lien</>}
        </button>
        {typeof navigator.share === 'function' && (
          <button type="button" className="btn primary" onClick={() => navigator.share({ title: 'Mon Intérieur 3D', text: question, url }).catch(() => undefined)}>
            {Icon.share} Envoyer…
          </button>
        )}
      </div>
    </div>
  )
}

function ShareItem({ r, open, onToggle }: { r: ShareRef; open: boolean; onToggle: () => void }) {
  const removeShare = useStore((s) => s.removeShare)
  const [data, setData] = useState<SharedData | null>(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    setError('')
    readShare(r.id, r.cle)
      .then((d) => alive && setData(d))
      .catch((e: Error & { status?: number }) => alive && setError(e.status === 404 ? 'Ce partage a été arrêté.' : e.message))
    return () => {
      alive = false
    }
  }, [open, r.id, r.cle])

  return (
    <li className={`share-item ${open ? 'open' : ''}`}>
      <button type="button" className="share-item-head" onClick={onToggle} aria-expanded={open}>
        <span>
          <strong>{r.question || 'Avis demandé'}</strong>
          <span className="muted">
            {r.versionNames.map((n, i) => (r.versionNames.length > 1 ? `${versionLetter(i)} : ${n}` : n)).join(' · ')} · {dateFr(r.createdAt)}
          </span>
        </span>
        {Icon.chevron}
      </button>
      {open && (
        <div className="share-item-body">
          <LinkBox id={r.id} question={r.question} />
          {error ? (
            <p className="form-error">{error}</p>
          ) : !data ? (
            <p className="hint-text">Chargement des avis…</p>
          ) : (
            <>
              <h3>
                {data.nbAvis} avis reçu{data.nbAvis > 1 ? 's' : ''}
              </h3>
              <VoteBars data={data} names={r.versionNames} />
              <Comments data={data} names={r.versionNames} />
            </>
          )}
          {confirm ? (
            <div className="confirm-inline">
              <span>Le lien ne fonctionnera plus et les avis seront effacés.</span>
              <button
                type="button"
                className="chip danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await stopShare(r.id, r.cle)
                    removeShare(r.id)
                  } catch (e) {
                    const err = e as Error & { status?: number }
                    // Déjà arrêté de l'autre côté : on le retire aussi d'ici
                    if (err.status === 404) removeShare(r.id)
                    else setError(err.message)
                  }
                  setBusy(false)
                  setConfirm(false)
                }}
              >
                Arrêter
              </button>
              <button type="button" className="chip" onClick={() => setConfirm(false)}>
                Annuler
              </button>
            </div>
          ) : (
            <button type="button" className="btn ghost danger-text" onClick={() => setConfirm(true)}>
              {Icon.close} Arrêter le partage
            </button>
          )}
        </div>
      )}
    </li>
  )
}

export function SharePanel({ onClose, beforeShare }: { onClose: () => void; beforeShare: () => Promise<void> }) {
  const project = useProject()
  const layout = useStore((s) => s.layout)
  const myFurniture = useStore((s) => s.myFurniture)
  const addShare = useStore((s) => s.addShare)
  const versions = project?.versions ?? []
  const [chosen, setChosen] = useState<string[]>(() => {
    const others = versions.filter((v) => v.id !== layout.id)
    const ids = [layout.id, ...(others.length ? [others[others.length - 1].id] : [])]
    return ids.sort((a, b) => versions.findIndex((v) => v.id === a) - versions.findIndex((v) => v.id === b))
  })
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const shares = project?.shares ?? []
  const defaultQuestion = chosen.length > 1 ? 'Laquelle préférez-vous ?' : 'Qu’en pensez-vous ?'

  // A et B suivent l'ordre des versions du projet
  const order = (ids: string[]) => [...ids].sort((a, b) => versions.findIndex((v) => v.id === a) - versions.findIndex((v) => v.id === b))
  const toggle = (id: string) => {
    if (chosen.includes(id)) setChosen(chosen.filter((x) => x !== id))
    else setChosen(order([...chosen, id].slice(-2)))
  }

  const create = async () => {
    if (!project || !chosen.length) return
    setBusy(true)
    setError('')
    try {
      // Enregistre la version ouverte (avec son aperçu) avant de l'envoyer
      await beforeShare()
      const fresh = useStore.getState().projects.find((p) => p.id === project.id) ?? project
      const picked = chosen.map((id) => fresh.versions.find((v) => v.id === id)).filter((v): v is Layout => !!v)
      const q = question.trim() || defaultQuestion
      const { id, cle } = await createShare(buildContent(fresh, picked, q, myFurniture))
      addShare({ id, cle, createdAt: Date.now(), question: q, versionNames: picked.map((v) => v.name) })
      setOpenId(id)
      setQuestion('')
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" aria-label="Partager">
      <div className="modal-card share-card">
        <div className="popover-head">
          <h2>Demander un avis</h2>
          <button type="button" className="icon-btn small" onClick={onClose} aria-label="Fermer">
            {Icon.close}
          </button>
        </div>

        {!shareReady() ? (
          <p className="hint-text">Le partage n’est pas encore disponible sur cette installation.</p>
        ) : (
          <section className="share-create">
            <p className="hint-text">
              Choisissez une ou deux versions. Vos proches ouvrent le lien sans compte, voient la pièce en 3D et votent. Seules ces versions sont partagées : vos photos, plans et
              inspirations restent sur cet appareil.
            </p>
            <div className="share-versions">
              {versions.map((v) => {
                const i = chosen.indexOf(v.id)
                return (
                  <button key={v.id} type="button" className={`share-version ${i >= 0 ? 'selected' : ''}`} onClick={() => toggle(v.id)} aria-pressed={i >= 0}>
                    <span className="share-version-img">
                      <VersionThumb v={v} />
                      {i >= 0 && chosen.length > 1 && <span className="share-letter">{versionLetter(i)}</span>}
                      {i >= 0 && chosen.length === 1 && <span className="share-letter">{Icon.check}</span>}
                    </span>
                    <span className="share-version-name">{v.name}</span>
                  </button>
                )
              })}
            </div>
            {versions.length > 1 && <p className="hint-text">{chosen.length === 2 ? 'Vos proches choisiront entre A et B.' : 'Touchez une deuxième version pour faire voter entre les deux.'}</p>}
            <label className="field">
              <span>Votre question</span>
              <input type="text" value={question} placeholder={defaultQuestion} maxLength={200} onChange={(e) => setQuestion(e.target.value)} />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button type="button" className="btn primary large" disabled={busy || !chosen.length} onClick={create}>
              {busy ? 'Création du lien…' : <>{Icon.link} Créer le lien</>}
            </button>
          </section>
        )}

        {shares.length > 0 && (
          <section>
            <h3 className="share-list-title">Mes liens partagés</h3>
            <ul className="share-list">
              {shares.map((r) => (
                <ShareItem key={r.id} r={r} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------- Invité

export function ShareViewer({ id }: { id: string }) {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const threeD = useStore((s) => s.threeD)
  const showSharedLayout = useStore((s) => s.showSharedLayout)
  const panelOpen = useStore((s) => s.panelOpen)
  const setPanelOpen = useStore((s) => s.setPanelOpen)
  const [data, setData] = useState<SharedData | null>(null)
  const [error, setError] = useState('')
  const [shown, setShown] = useState(0)
  const [vote, setVote] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [prenom, setPrenom] = useState('')
  const [sent, setSent] = useState(() => !!myVote(id))
  const [busy, setBusy] = useState(false)
  const [sendError, setSendError] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    readShare(id)
      .then((d) => {
        if (!alive) return
        registerSharedFurniture(d.contenu.meubles ?? [])
        showSharedLayout(d.contenu.versions[0])
        setData(d)
      })
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [id, showSharedLayout])

  const leave = () => {
    history.replaceState(null, '', location.pathname + location.search)
    useStore.getState().goHome()
  }

  if (error)
    return (
      <div className="share-message">
        <div className="modal-card">
          <h2>Lien indisponible</h2>
          <p>{error}</p>
          <button type="button" className="btn primary" onClick={leave}>
            Découvrir Mon Intérieur 3D
          </button>
        </div>
      </div>
    )
  if (!data) return <div className="share-message"><p className="hint-text">Chargement de la pièce partagée…</p></div>

  const { contenu } = data
  const names = contenu.versions.map((v) => v.name)
  const two = contenu.versions.length > 1
  const pick = (i: number) => {
    setShown(i)
    showSharedLayout(contenu.versions[i])
  }

  const submit = async () => {
    setBusy(true)
    setSendError('')
    try {
      await sendAvis(id, { version: two ? vote : null, commentaire: comment, prenom })
      rememberVote(id, two ? vote : null)
      setSent(true)
      bodyRef.current?.scrollTo({ top: 0 })
      setData(await readShare(id))
    } catch (e) {
      setSendError((e as Error).message)
    }
    setBusy(false)
  }

  return (
    <>
      <header className="editor-top share-top">
        <div className="top-left">
          <span className="logo small" aria-hidden>
            {Icon.home}
          </span>
          <div className="project-title">
            <span className="project-name-top">{contenu.projet.name}</span>
            <span className="share-sub">
              {ROOM_TYPE_LABEL[contenu.projet.roomType]} · partagé avec vous
            </span>
          </div>
        </div>
        <div className="segmented" role="tablist" aria-label="Type de vue">
          {(['plan', '3d', 'yeux'] as ViewMode[]).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'active' : ''} onClick={() => setView(v)} disabled={!threeD && v !== 'plan'}>
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
        <div className="top-right">
          <button type="button" className="btn ghost share-own" onClick={leave}>
            Créer ma pièce
          </button>
        </div>
      </header>

      <aside className={`panel share-panel ${panelOpen ? 'open' : 'closed'}`}>
        <button type="button" className="share-sheet-head" onClick={() => setPanelOpen(!panelOpen)} aria-expanded={panelOpen}>
          <span className="sheet-handle" aria-hidden>
            <span />
          </span>
          <span className="share-question">{contenu.question}</span>
          <span className="share-sheet-cta">{panelOpen ? 'Voir la pièce' : sent ? 'Voir les résultats' : 'Donner mon avis'}</span>
        </button>
        <div className="panel-body share-body" ref={bodyRef}>
          <h2 className="share-question-big">{contenu.question}</h2>

          {two && (
            <div className="share-versions">
              {contenu.versions.map((v, i) => (
                <button key={v.id} type="button" className={`share-version ${shown === i ? 'selected' : ''}`} onClick={() => pick(i)} aria-pressed={shown === i}>
                  <span className="share-version-img">
                    <VersionThumb v={v} />
                    <span className="share-letter">{versionLetter(i)}</span>
                  </span>
                  <span className="share-version-name">{v.name}</span>
                  <span className="share-version-see">{shown === i ? 'Affichée' : 'Voir'}</span>
                </button>
              ))}
            </div>
          )}

          {sent ? (
            <section className="share-thanks">
              <p className="share-thanks-title">{Icon.check} Merci pour votre avis !</p>
              <VoteBars data={data} names={names} />
              <h3>Commentaires</h3>
              <Comments data={data} names={names} />
            </section>
          ) : (
            <section className="share-form">
              {two && (
                <div className="field">
                  <span>Votre préférence</span>
                  <div className="vote-choice">
                    {names.map((_, i) => (
                      <button key={i} type="button" className={`chip big ${vote === i ? 'selected' : ''}`} onClick={() => (setVote(i), pick(i))}>
                        Je préfère {versionLetter(i)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <label className="field">
                <span>Un commentaire {two ? '(facultatif)' : ''}</span>
                <textarea rows={3} maxLength={600} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ce que vous aimez, ce que vous changeriez…" />
              </label>
              <label className="field">
                <span>Votre prénom (facultatif)</span>
                <input type="text" maxLength={40} value={prenom} onChange={(e) => setPrenom(e.target.value)} autoComplete="given-name" />
              </label>
              {sendError && <p className="form-error">{sendError}</p>}
              <button type="button" className="btn primary large full" disabled={busy || (two ? vote === null && !comment.trim() : !comment.trim())} onClick={submit}>
                {busy ? 'Envoi…' : 'Envoyer mon avis'}
              </button>
              <p className="hint-text">Pas besoin de compte. Votre avis est envoyé à la personne qui a partagé la pièce ; les autres invités voient votre commentaire avec l’initiale de votre prénom.</p>
            </section>
          )}
          <p className="share-made">
            Pièce créée avec <strong>Mon Intérieur 3D</strong>, gratuit.{' '}
            <button type="button" className="link-btn" onClick={leave}>
              Créer la mienne
            </button>
          </p>
        </div>
      </aside>
      <EyeLevelHint />
    </>
  )
}
