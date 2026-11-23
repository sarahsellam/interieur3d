// « Remplacer » : propose d'autres meubles du même type qui tiennent dans l'espace,
// avec un filtre de budget, un aperçu dans la pièce et une confirmation.
import { useMemo, useState } from 'react'
import { CATALOG, REFERENCE_ITEMS, customToCatalog, fmtPrice, getItem, CUSTOM_PREFIX, type CatalogItem } from '../data/catalog'
import { replacementFit } from '../model/geometry'
import { useStore } from '../store'
import { Icon } from './common'
import { FurnitureForm, ItemThumb } from './MyFurniture'
import { itemDims } from '../model/geometry'

type Range = { min: number | null; max: number | null }

const PRESETS: { label: string; range: Range }[] = [
  { label: 'Moins de 50 €', range: { min: null, max: 50 } },
  { label: '50 à 100 €', range: { min: 50, max: 100 } },
  { label: '100 à 300 €', range: { min: 100, max: 300 } },
  { label: 'Plus de 300 €', range: { min: 300, max: null } },
]

const sameRange = (a: Range, b: Range) => a.min === b.min && a.max === b.max
const parse = (v: string) => {
  const n = parseFloat(v.replace(',', '.').replace(/\s/g, ''))
  return Number.isNaN(n) ? null : n
}

const KIND_TITLES: Record<string, string> = {
  coiffeuse: 'Coiffeuses',
  commode: 'Commodes',
  chevet: 'Tables de chevet',
  lit: 'Lits',
  armoire: 'Armoires',
  bureau: 'Bureaux',
  plante: 'Plantes',
  tapis: 'Tapis',
  fauteuil: 'Fauteuils',
  canape: 'Canapés',
  chaise: 'Chaises',
  tabouret: 'Tabourets',
  table: 'Tables',
  'table-basse': 'Tables basses',
  etagere: 'Étagères',
  buffet: 'Buffets',
}
const kindTitle = (c: CatalogItem) => (c.kind && KIND_TITLES[c.kind]) || 'Meubles équivalents'
const dateFr = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

function Proposal({ c, fit, chosen, onPick }: { c: CatalogItem; fit: { fits: boolean; message: string }; chosen: boolean; onPick: () => void }) {
  return (
    <article className={`proposal ${chosen ? 'chosen' : ''} ${c.reference ? 'is-ref' : ''}`}>
      <button type="button" className="proposal-main" onClick={onPick}>
        <ItemThumb c={c} className="proposal-img" />
        <span className="proposal-name">{c.name}</span>
        <span className="proposal-price">{typeof c.price === 'number' ? fmtPrice(c.price) : 'Prix non renseigné'}</span>
        <span className="muted">
          {Math.round(c.width * 100)} × {Math.round(c.depth * 100)} × {Math.round(c.height * 100)} cm{c.note ? ` · ${c.note}` : ''}
        </span>
        <span className="muted">
          {c.reference ? `${c.vendor} · prix relevé le ${dateFr(c.checkedAt!)}` : c.custom ? c.vendor || 'Mon meuble' : 'Modèle 3D de démonstration'}
        </span>
        <span className={`fit ${fit.fits ? 'ok' : 'ko'}`}>{fit.message}</span>
      </button>
      {c.link && (
        <a className="proposal-link" href={c.link} target="_blank" rel="noreferrer">
          {Icon.link} Voir le produit
        </a>
      )}
    </article>
  )
}

export function ReplacePanel({ uid, onClose }: { uid: string; onClose: () => void }) {
  const layout = useStore((s) => s.layout)
  const myFurniture = useStore((s) => s.myFurniture)
  const preview = useStore((s) => s.preview)
  const previewReplace = useStore((s) => s.previewReplace)
  const cancelPreview = useStore((s) => s.cancelPreview)
  const confirmReplace = useStore((s) => s.confirmReplace)
  const item = layout.items.find((i) => i.uid === uid)
  const current = item ? getItem(item.modelId) : undefined
  const [range, setRange] = useState<Range>({ min: null, max: null })
  const [minText, setMinText] = useState('')
  const [maxText, setMaxText] = useState('')
  const [allTypes, setAllTypes] = useState(false)

  const [showNoPrice, setShowNoPrice] = useState(false)
  const [adding, setAdding] = useState(false)
  const filterOn = range.min !== null || range.max !== null

  const { similar, others, hiddenNoPrice } = useMemo(() => {
    if (!item || !current) return { similar: [], others: [], hiddenNoPrice: 0 }
    const all: CatalogItem[] = [...myFurniture.map(customToCatalog), ...REFERENCE_ITEMS, ...CATALOG]
    let hidden = 0
    const rows = all
      .filter((c) => c.id !== item.modelId && (allTypes || c.category === current.category) && !c.floorLayer === !current.floorLayer)
      .filter((c) => {
        if (!filterOn) return true
        // Sans prix connu : masqué par le filtre de budget, sauf si on demande à le voir
        if (typeof c.price !== 'number') {
          if (showNoPrice) return true
          hidden++
          return false
        }
        return (range.min === null || c.price >= range.min) && (range.max === null || c.price <= range.max)
      })
      .map((c) => ({ c, fit: replacementFit(layout, uid, c.id) }))
      // D'abord ce qui tient, puis les vraies références et mes meubles (prix connu), puis par prix
      .sort(
        (a, b) =>
          Number(b.fit.fits) - Number(a.fit.fits) ||
          Number(typeof b.c.price === 'number') - Number(typeof a.c.price === 'number') ||
          (a.c.price ?? Infinity) - (b.c.price ?? Infinity) ||
          a.c.name.localeCompare(b.c.name),
      )
    // Même sous-type (coiffeuse ↔ coiffeuse) en premier ; mes meubles comptent selon leur catégorie
    const same = (c: CatalogItem) => (current.kind && c.kind ? c.kind === current.kind : c.category === current.category)
    return { similar: rows.filter((r) => same(r.c)), others: rows.filter((r) => !same(r.c)), hiddenNoPrice: hidden }
  }, [item, current, myFurniture, allTypes, filterOn, range, layout, uid, showNoPrice])
  const list = [...similar, ...others]

  if (!item || !current) return null
  // Meuble en aperçu (même s'il sort du filtre, par exemple un meuble que l'on vient d'ajouter)
  const chosenItem = preview?.uid === uid ? getItem(preview.item.modelId) : undefined
  const chosen = chosenItem ? (list.find((x) => x.c.id === chosenItem.id) ?? { c: chosenItem, fit: replacementFit(layout, uid, chosenItem.id) }) : undefined

  const close = () => {
    cancelPreview()
    onClose()
  }

  return (
    <div className="replace">
      <div className="sheet-head">
        <div>
          <strong>Remplacer : {current.name}</strong>
          <span className="muted">Touchez une proposition pour la voir dans la pièce.</span>
        </div>
        <button type="button" className="icon-btn small" onClick={close} aria-label="Fermer">
          {Icon.close}
        </button>
      </div>

      <div className={`budget-filter ${chosen ? 'collapsed' : ''}`}>
        <div className="choice-row">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`chip ${sameRange(range, p.range) ? 'selected' : ''}`}
              onClick={() => {
                const next = sameRange(range, p.range) ? { min: null, max: null } : p.range
                setRange(next)
                setMinText(next.min?.toString() ?? '')
                setMaxText(next.max?.toString() ?? '')
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="range-row">
          <label>
            <span>Min</span>
            <input type="text" inputMode="decimal" value={minText} placeholder="—" onChange={(e) => setMinText(e.target.value)} onBlur={() => setRange({ ...range, min: parse(minText) })} />
            <span className="unit">€</span>
          </label>
          <label>
            <span>Max</span>
            <input type="text" inputMode="decimal" value={maxText} placeholder="—" onChange={(e) => setMaxText(e.target.value)} onBlur={() => setRange({ ...range, max: parse(maxText) })} />
            <span className="unit">€</span>
          </label>
          <button type="button" className={`chip ${allTypes ? 'selected' : ''}`} onClick={() => setAllTypes((v) => !v)}>
            Tous les types
          </button>
        </div>
      </div>

      {chosen && (
        <button type="button" className="chip ghost show-filters" onClick={cancelPreview}>
          Revenir aux filtres de budget
        </button>
      )}
      {list.length === 0 ? (
        <p className="empty">Aucune proposition {filterOn ? 'dans ce budget' : 'pour ce type de meuble'}.</p>
      ) : (
        <>
          {similar.length > 0 && (
            <>
              {others.length > 0 && !chosen && <h4 className="proposals-title">{kindTitle(current)}</h4>}
              <div className={`proposals ${chosen ? 'compact' : ''}`}>
                {similar.map((r) => (
                  <Proposal key={r.c.id} {...r} chosen={chosen?.c.id === r.c.id} onPick={() => previewReplace(uid, r.c.id)} />
                ))}
              </div>
            </>
          )}
          {others.length > 0 && (
            <>
              {!chosen && <h4 className="proposals-title">Autres meubles du même type</h4>}
              <div className={`proposals ${chosen ? 'compact' : ''}`}>
                {others.map((r) => (
                  <Proposal key={r.c.id} {...r} chosen={chosen?.c.id === r.c.id} onPick={() => previewReplace(uid, r.c.id)} />
                ))}
              </div>
            </>
          )}
        </>
      )}
      {!chosen && (
        <button type="button" className="btn secondary add-own" onClick={() => setAdding(true)}>
          {Icon.link} Ajouter mon propre lien
        </button>
      )}
      {adding && (
        <FurnitureForm
          preset={{ category: current.category, ...itemDims(item) }}
          onClose={(saved) => {
            setAdding(false)
            // Le meuble ajouté est essayé tout de suite à la même place
            if (saved) previewReplace(uid, CUSTOM_PREFIX + saved.id)
          }}
        />
      )}
      {!chosen && filterOn && (hiddenNoPrice > 0 || showNoPrice) && (
        <p className="hint-text no-price">
          {showNoPrice ? 'Les meubles sans prix connu sont affichés.' : `${hiddenNoPrice} meuble${hiddenNoPrice > 1 ? 's' : ''} sans prix connu masqué${hiddenNoPrice > 1 ? 's' : ''} par le budget.`}{' '}
          <button type="button" className="link-btn" onClick={() => setShowNoPrice(!showNoPrice)}>
            {showNoPrice ? 'Les masquer' : 'Les afficher'}
          </button>
        </p>
      )}

      {chosen && (
        <div className={`preview-bar ${chosen.fit.fits ? '' : 'warn'}`}>
          <span>
            Aperçu : <strong>{chosen.c.name}</strong>
            {!chosen.fit.fits && <> · {chosen.fit.message}</>}
          </span>
          <div className="preview-actions">
            <button type="button" className="btn ghost" onClick={cancelPreview}>
              Annuler l'aperçu
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                confirmReplace()
                onClose()
              }}
            >
              {chosen.fit.fits ? 'Confirmer' : 'Confirmer quand même'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
