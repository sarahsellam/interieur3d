// « Mes inspirations » : photos de la galerie ou liens (Pinterest…), avec ce qu'on aime dedans.
// « Références de la pièce » : plan importé et photos de la vraie pièce.
// Toute image peut être gardée visible à côté de la pièce pendant l'aménagement.
import { useEffect, useState } from 'react'
import { useProject, useStore } from '../store'
import type { Inspiration, RefImage } from '../model/types'
import { WALL_LABEL, WALL_ORDER } from '../model/types'
import { imageUrl } from '../model/storage'
import { extractPalette, suggestFromNote, type Suggestion } from '../model/inspiration'
import { getItem, ITEM_COLORS } from '../data/catalog'
import { Icon, ImportButton, StoredImage } from './common'

/** Choix de la cible d'une couleur : un mur, tous les murs ou le meuble sélectionné. */
function ColorApply({ hex, onDone }: { hex: string; onDone: () => void }) {
  const setWallColor = useStore((s) => s.setWallColor)
  const setAll = useStore((s) => s.setAllWallsColor)
  const setItemColor = useStore((s) => s.setItemColor)
  const selection = useStore((s) => s.selection)
  const selectedItem = useStore((s) => (s.selection?.type === 'item' ? s.layout.items.find((i) => i.uid === (s.selection as { id: string }).id) : undefined))
  const c = selectedItem ? getItem(selectedItem.modelId) : undefined
  const canItem = c && ITEM_COLORS[c.material].length > 0
  return (
    <div className="apply-menu">
      <span className="apply-title">
        <span className="dot" style={{ background: hex }} /> Appliquer à :
      </span>
      <div className="choice-row">
        {WALL_ORDER.map((w) => (
          <button key={w} type="button" className="chip" onClick={() => (setWallColor(w, hex), onDone())}>
            {WALL_LABEL[w]}
          </button>
        ))}
        <button type="button" className="chip" onClick={() => (setAll(hex), onDone())}>
          Tous les murs
        </button>
        {canItem && selection?.type === 'item' && (
          <button type="button" className="chip" onClick={() => (setItemColor(selection.id, hex), onDone())}>
            {c!.name}
          </button>
        )}
        <button type="button" className="chip ghost" onClick={onDone}>
          Annuler
        </button>
      </div>
      {!canItem && <span className="hint-text">Pour colorer un meuble, touchez-le d'abord dans la pièce.</span>}
    </div>
  )
}

/** Couleurs de la photo et idées tirées de la note, applicables à la pièce. */
function InspirationIdeas({ i, inEditor }: { i: Inspiration; inEditor: boolean }) {
  const update = useStore((s) => s.updateInspiration)
  const addItem = useStore((s) => s.addItem)
  const setItemColor = useStore((s) => s.setItemColor)
  const [applying, setApplying] = useState<string | null>(null)
  useEffect(() => {
    if (!i.imageId || i.palette) return
    let alive = true
    imageUrl(i.imageId)
      .then((u) => (u ? extractPalette(u) : null))
      .then((p) => alive && p && update(i.id, { palette: p }))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [i.imageId, i.palette, i.id, update])
  const ideas = suggestFromNote(i.note)
  const applyIdea = (s: Suggestion) => {
    if (s.kind === 'wall') return setApplying(s.color)
    addItem(s.modelId)
    const sel = useStore.getState().selection
    if (s.color && sel?.type === 'item') setItemColor(sel.id, s.color)
  }
  if (!i.palette?.length && !ideas.length) return null
  return (
    <div className="inspi-ideas">
      {i.palette && i.palette.length > 0 && (
        <div className="palette" aria-label="Couleurs de la photo">
          {i.palette.map((c) =>
            inEditor ? (
              <button key={c} type="button" className={`swatch small ${applying === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setApplying(applying === c ? null : c)} aria-label={`Utiliser la couleur ${c}`} />
            ) : (
              <span key={c} className="swatch small" style={{ background: c }} />
            ),
          )}
        </div>
      )}
      {inEditor && ideas.length > 0 && (
        <div className="choice-row">
          {ideas.map((s) => (
            <button key={s.label} type="button" className="chip idea" onClick={() => applyIdea(s)}>
              {s.kind === 'item' ? Icon.plus : <span className="dot" style={{ background: s.color }} />} {s.label}
            </button>
          ))}
        </div>
      )}
      {inEditor && applying && <ColorApply hex={applying} onDone={() => setApplying(null)} />}
    </div>
  )
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function InspirationBoard({ allowPin = false }: { allowPin?: boolean }) {
  const inspirations = useStore((s) => s.inspirations)
  const add = useStore((s) => s.addInspiration)
  const update = useStore((s) => s.updateInspiration)
  const remove = useStore((s) => s.removeInspiration)
  const pinned = useStore((s) => s.pinnedImage)
  const pin = useStore((s) => s.pinImage)
  const [link, setLink] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const addLink = () => {
    const url = link.trim()
    if (!url) return
    add({ link: /^https?:\/\//.test(url) ? url : `https://${url}`, note: '' })
    setLink('')
  }

  return (
    <div className="inspi">
      <div className="inspi-add">
        <ImportButton
          label={
            <>
              {Icon.image} Ajouter une photo
            </>
          }
          accept="image/*"
          multiple
          onImported={(ids) => ids.forEach((i) => add({ imageId: i.id, note: '' }))}
        />
        <div className="link-row">
          <input
            type="url"
            inputMode="url"
            placeholder="Coller un lien Pinterest…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addLink()}
            aria-label="Lien d'inspiration"
          />
          <button type="button" className="btn secondary" onClick={addLink} disabled={!link.trim()}>
            Ajouter
          </button>
        </div>
      </div>
      {inspirations.length === 0 && (
        <p className="empty">
          Ajoutez des photos qui vous plaisent, puis notez ce que vous aimez : « le mur vert », « le bois de la commode »…
        </p>
      )}
      <div className="inspi-grid">
        {inspirations.map((i) => (
          <article key={i.id} className={`inspi-card ${pinned && pinned === i.imageId ? 'pinned' : ''}`}>
            {i.imageId ? (
              <StoredImage id={i.imageId} className="inspi-img" />
            ) : (
              <a className="inspi-link" href={i.link} target="_blank" rel="noreferrer">
                {Icon.link}
                <span>{host(i.link ?? '')}</span>
              </a>
            )}
            <textarea
              rows={2}
              placeholder="Ce que j'aime…"
              defaultValue={i.note}
              onBlur={(e) => e.target.value !== i.note && update(i.id, { note: e.target.value })}
              aria-label="Ce que j'aime dans cette inspiration"
            />
            <InspirationIdeas i={i} inEditor={allowPin} />
            <div className="inspi-actions">
              {allowPin && i.imageId && (
                <button type="button" className="chip" onClick={() => pin(pinned === i.imageId ? null : i.imageId!)}>
                  {Icon.pin} {pinned === i.imageId ? 'Masquer' : 'Garder à côté'}
                </button>
              )}
              {confirmId === i.id ? (
                <>
                  <button type="button" className="chip danger" onClick={() => remove(i.id)}>
                    Supprimer
                  </button>
                  <button type="button" className="chip" onClick={() => setConfirmId(null)}>
                    Annuler
                  </button>
                </>
              ) : (
                <button type="button" className="chip ghost" onClick={() => setConfirmId(i.id)} aria-label="Supprimer cette inspiration">
                  {Icon.trash}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

/** Plan et photos de la pièce, en attente (assistant) ou rattachés au projet ouvert. */
export function ReferenceList({ refs, onAdd, onRemove, allowPin = false }: { refs: RefImage[]; onAdd: (r: RefImage[]) => void; onRemove: (id: string) => void; allowPin?: boolean }) {
  const pinned = useStore((s) => s.pinnedImage)
  const pin = useStore((s) => s.pinImage)
  return (
    <div className="refs">
      <div className="refs-buttons">
        <ImportButton label={<>{Icon.image} Importer un plan (image ou PDF)</>} accept="image/*,application/pdf,.pdf" onImported={(ids) => onAdd(ids.map((i) => ({ id: i.id, name: i.name, kind: 'plan' })))} />
        <ImportButton label={<>{Icon.image} Ajouter des photos de la pièce</>} accept="image/*" multiple onImported={(ids) => onAdd(ids.map((i) => ({ id: i.id, name: i.name, kind: 'photo' })))} />
      </div>
      {refs.length > 0 && (
        <div className="refs-grid">
          {refs.map((r) => (
            <figure key={r.id} className={`ref ${pinned === r.id ? 'pinned' : ''}`}>
              <StoredImage id={r.id} className="ref-img" alt={r.kind === 'plan' ? 'Plan' : 'Photo de la pièce'} />
              <figcaption>{r.kind === 'plan' ? 'Plan' : 'Photo'}</figcaption>
              <div className="ref-actions">
                {allowPin && (
                  <button type="button" className="chip" onClick={() => pin(pinned === r.id ? null : r.id)}>
                    {Icon.pin} {pinned === r.id ? 'Masquer' : 'Garder à côté'}
                  </button>
                )}
                <button type="button" className="chip ghost" onClick={() => onRemove(r.id)} aria-label="Retirer">
                  {Icon.trash}
                </button>
              </div>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}

/** Références du projet ouvert. */
export function ProjectReferences() {
  const project = useProject()
  const addReference = useStore((s) => s.addReference)
  const removeReference = useStore((s) => s.removeReference)
  if (!project) return null
  return <ReferenceList refs={project.references} onAdd={(rs) => rs.forEach(addReference)} onRemove={removeReference} allowPin />
}

/** Image gardée visible à côté de la pièce. */
export function PinnedImage() {
  const pinned = useStore((s) => s.pinnedImage)
  const pin = useStore((s) => s.pinImage)
  const [large, setLarge] = useState(false)
  if (!pinned) return null
  return (
    <aside className={`pinned-view ${large ? 'large' : ''}`} aria-label="Image de référence">
      <StoredImage id={pinned} className="pinned-img" alt="Référence" />
      <div className="pinned-bar">
        <button type="button" className="chip" onClick={() => setLarge((l) => !l)}>
          {large ? 'Réduire' : 'Agrandir'}
        </button>
        <button type="button" className="icon-btn small" onClick={() => pin(null)} aria-label="Fermer la référence">
          {Icon.close}
        </button>
      </div>
    </aside>
  )
}
