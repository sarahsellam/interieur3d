// « Mes meubles » : meubles trouvés sur Internet (ou déjà chez soi), ajoutés depuis un lien
// ou à la main, puis placés dans les projets avec une représentation 3D simplifiée.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { assetUrl, CATEGORY_LABELS, fmtPrice, type CatalogItem, type FurnitureCategory } from '../data/catalog'
import { readProductLink } from '../model/productLink'
import type { MyFurniture } from '../model/types'
import { uid } from '../model/types'
import { useStore } from '../store'
import { Icon, ImportButton, MeasureField, StoredImage } from './common'

/** Vignette d'un meuble : photo du produit pour « Mes meubles », rendu 3D pour le catalogue. */
export function ItemThumb({ c, className }: { c: CatalogItem; className?: string }) {
  if (c.custom) {
    if (c.imageId) return <StoredImage id={c.imageId} className={className} />
    if (c.imageUrl) return <img src={c.imageUrl} alt="" className={className} loading="lazy" referrerPolicy="no-referrer" draggable={false} />
    return (
      <span className={`thumb-empty ${className ?? ''}`} style={{ background: c.color }}>
        {Icon.image}
      </span>
    )
  }
  return <img src={assetUrl(`thumbs/${c.id}.webp`)} alt="" className={className} loading="lazy" draggable={false} />
}

const FURNI_COLORS = ['#d8cdb9', '#efebe4', '#b9b6b0', '#55524e', '#a3ad94', '#3e4a5c', '#b9765a', '#ddb8b0', '#c49a6c', '#7a5338']

const emptyDraft = (): MyFurniture => ({
  id: uid(),
  name: '',
  category: 'rangement',
  width: 0.8,
  depth: 0.45,
  height: 0.8,
  price: null,
  vendor: '',
  link: '',
  color: '#d8cdb9',
  owned: false,
  createdAt: Date.now(),
})

export function FurnitureForm({ initial, onClose }: { initial?: MyFurniture; onClose: (saved?: MyFurniture) => void }) {
  const save = useStore((s) => s.saveMyFurniture)
  const [f, setF] = useState<MyFurniture>(initial ?? emptyDraft())
  const [reading, setReading] = useState(false)
  const [info, setInfo] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)
  const set = (patch: Partial<MyFurniture>) => setF((x) => ({ ...x, ...patch }))

  const readLink = async () => {
    const link = f.link?.trim()
    if (!link) return
    const url = /^https?:\/\//.test(link) ? link : `https://${link}`
    setReading(true)
    setInfo(null)
    const d = await readProductLink(url)
    setReading(false)
    const filled: string[] = []
    const patch: Partial<MyFurniture> = { link: url }
    if (d.name && !f.name) (patch.name = d.name), filled.push('le nom')
    if (d.vendor && !f.vendor) (patch.vendor = d.vendor), filled.push('le vendeur')
    if (typeof d.price === 'number') (patch.price = d.price), filled.push('le prix')
    if (d.imageUrl && !f.imageId) (patch.imageUrl = d.imageUrl), filled.push('la photo')
    if (d.width) (patch.width = d.width), filled.push('les dimensions')
    if (d.depth) patch.depth = d.depth
    if (d.height) patch.height = d.height
    if (d.category) patch.category = d.category
    set(patch)
    setInfo(
      d.fromPage
        ? { tone: 'ok', text: `Trouvé sur la page : ${filled.join(', ') || 'peu d’informations'}. Vérifiez et complétez si besoin.` }
        : {
            tone: 'warn',
            text: `Ce site ne laisse pas l'application lire sa page. ${filled.length ? `J'ai déduit ${filled.join(', ')} de l'adresse. ` : ''}Complétez le reste à la main (le prix et les dimensions sont sur la page du produit).`,
          },
    )
  }

  const valid = f.name.trim() && f.width > 0 && f.depth > 0 && f.height > 0

  // Affichée au-dessus de toute l'application (et non dans le panneau, qui la rognerait)
  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" aria-label="Ajouter un meuble">
      <div className="modal-card">
        <div className="popover-head">
          <h2>{initial ? 'Modifier le meuble' : 'Ajouter un meuble'}</h2>
          <button type="button" className="icon-btn small" onClick={() => onClose()} aria-label="Fermer">
            {Icon.close}
          </button>
        </div>

        <div className="field">
          <span>Lien du produit</span>
          <div className="link-row">
            <input type="url" inputMode="url" placeholder="Collez l'adresse de la page du produit" value={f.link ?? ''} onChange={(e) => set({ link: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && readLink()} />
            <button type="button" className="btn secondary" onClick={readLink} disabled={!f.link?.trim() || reading}>
              {reading ? 'Lecture…' : 'Récupérer'}
            </button>
          </div>
          {info && <p className={`notice ${info.tone}`}>{info.text}</p>}
        </div>

        <div className="form-photo">
          <div className="form-photo-img">
            {f.imageId ? <StoredImage id={f.imageId} /> : f.imageUrl ? <img src={f.imageUrl} alt="" referrerPolicy="no-referrer" /> : <span className="thumb-empty">{Icon.image}</span>}
          </div>
          <div className="form-photo-actions">
            <ImportButton label={<>{Icon.image} {f.imageId || f.imageUrl ? 'Changer la photo' : 'Ajouter une photo de la galerie'}</>} accept="image/*" onImported={([i]) => set({ imageId: i.id, imageUrl: undefined })} />
          </div>
        </div>

        <label className="field">
          <span>Nom</span>
          <input type="text" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Commode 3 tiroirs en chêne" />
        </label>

        <div className="field">
          <span>Type de meuble</span>
          <div className="choice-row">
            {(Object.keys(CATEGORY_LABELS) as FurnitureCategory[]).map((k) => (
              <button key={k} type="button" className={`chip ${f.category === k ? 'selected' : ''}`} onClick={() => set({ category: k })}>
                {CATEGORY_LABELS[k]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Dimensions</span>
          <div className="dims-row">
            <MeasureField compact unit="cm" label="Largeur" value={f.width} min={0.05} max={6} onChange={(width) => set({ width })} />
            <MeasureField compact unit="cm" label="Profondeur" value={f.depth} min={0.02} max={6} onChange={(depth) => set({ depth })} />
            <MeasureField compact unit="cm" label="Hauteur" value={f.height} min={0.01} max={3} onChange={(height) => set({ height })} />
          </div>
        </div>

        <div className="form-two">
          <label className="field">
            <span>Prix (€)</span>
            <input
              type="text"
              inputMode="decimal"
              value={f.price ?? ''}
              placeholder="Non renseigné"
              onChange={(e) => {
                const v = parseFloat(e.target.value.replace(',', '.'))
                set({ price: Number.isNaN(v) ? null : v })
              }}
            />
          </label>
          <label className="field">
            <span>Vendeur</span>
            <input type="text" value={f.vendor ?? ''} onChange={(e) => set({ vendor: e.target.value })} placeholder="Nom de la boutique" />
          </label>
        </div>

        <div className="field">
          <span>Couleur de la représentation 3D</span>
          <div className="swatches">
            {FURNI_COLORS.map((c) => (
              <button key={c} type="button" className={`swatch ${f.color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => set({ color: c })} aria-label={`Couleur ${c}`} />
            ))}
            <label className="swatch custom" title="Autre couleur">
              <input type="color" value={f.color} onChange={(e) => set({ color: e.target.value })} aria-label="Autre couleur" />
              <span>+</span>
            </label>
          </div>
          <p className="hint-text">Pas de modèle 3D exact pour ce meuble : il apparaîtra sous une forme simplifiée, à ses vraies dimensions.</p>
        </div>

        <div className="field">
          <span>Ce meuble</span>
          <div className="choice-row">
            <button type="button" className={`chip ${!f.owned ? 'selected' : ''}`} onClick={() => set({ owned: false })}>
              À acheter
            </button>
            <button type="button" className={`chip ${f.owned ? 'selected' : ''}`} onClick={() => set({ owned: true })}>
              Déjà possédé
            </button>
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={() => onClose()}>
            Annuler
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!valid}
            onClick={() => {
              const saved = { ...f, name: f.name.trim() }
              save(saved)
              onClose(saved)
            }}
          >
            Enregistrer dans Mes meubles
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function MyFurnitureSection() {
  const myFurniture = useStore((s) => s.myFurniture)
  const place = useStore((s) => s.placeMyFurniture)
  const remove = useStore((s) => s.removeMyFurniture)
  const [form, setForm] = useState<{ initial?: MyFurniture } | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  return (
    <section className="my-furniture">
      <h3>Mes meubles</h3>
      <button type="button" className="btn primary full" onClick={() => setForm({})}>
        {Icon.link} Ajouter depuis un lien
      </button>
      {myFurniture.length === 0 ? (
        <p className="hint-text">Collez le lien d'un meuble repéré en ligne, ou saisissez un meuble que vous avez déjà.</p>
      ) : (
        <div className="cards">
          {myFurniture.map((f) => (
            <div key={f.id} className="card my">
              <button type="button" className="card-main" onClick={() => place(f.id)} aria-label={`Placer : ${f.name}`}>
                <span className="card-img">
                  <ItemThumb c={{ id: '', name: f.name, category: f.category, file: '', width: f.width, depth: f.depth, height: f.height, frontOffset: 0, material: 'bois', author: '', source: '', custom: true, imageId: f.imageId, imageUrl: f.imageUrl, color: f.color }} />
                  <span className="card-plus" aria-hidden>
                    {Icon.plus}
                  </span>
                  <span className="badge">3D simplifiée</span>
                </span>
                <span className="card-name">{f.name}</span>
                <span className="card-dims">
                  {typeof f.price === 'number' ? fmtPrice(f.price) : 'Prix non renseigné'} · {Math.round(f.width * 100)} × {Math.round(f.depth * 100)} × {Math.round(f.height * 100)} cm
                </span>
              </button>
              <div className="card-actions">
                {confirmId === f.id ? (
                  <>
                    <button type="button" className="chip danger" onClick={() => remove(f.id)}>
                      Supprimer
                    </button>
                    <button type="button" className="chip" onClick={() => setConfirmId(null)}>
                      Non
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="chip ghost" onClick={() => setForm({ initial: f })}>
                      Modifier
                    </button>
                    <button type="button" className="chip ghost" onClick={() => setConfirmId(f.id)} aria-label={`Supprimer ${f.name}`}>
                      {Icon.trash}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {form && <FurnitureForm initial={form.initial} onClose={() => setForm(null)} />}
    </section>
  )
}
