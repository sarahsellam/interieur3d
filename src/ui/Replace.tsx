// « Remplacer » : propose d'autres meubles du même type qui tiennent dans l'espace,
// avec un filtre de budget, un aperçu dans la pièce et une confirmation.
import { useMemo, useState } from 'react'
import { CATALOG, customToCatalog, fmtPrice, getItem, type CatalogItem } from '../data/catalog'
import { replacementFit } from '../model/geometry'
import { useStore } from '../store'
import { Icon } from './common'
import { ItemThumb } from './MyFurniture'

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

  const filterOn = range.min !== null || range.max !== null

  const { list, hiddenNoPrice } = useMemo(() => {
    if (!item || !current) return { list: [], hiddenNoPrice: 0 }
    const all: CatalogItem[] = [...myFurniture.map(customToCatalog), ...CATALOG]
    let hidden = 0
    const out = all
      .filter((c) => c.id !== item.modelId && (allTypes || c.category === current.category) && !c.floorLayer === !current.floorLayer)
      .filter((c) => {
        if (!filterOn) return true
        if (typeof c.price !== 'number') {
          hidden++
          return false
        }
        return (range.min === null || c.price >= range.min) && (range.max === null || c.price <= range.max)
      })
      .map((c) => ({ c, fit: replacementFit(layout, uid, c.id) }))
      .sort((a, b) => Number(b.fit.fits) - Number(a.fit.fits) || (a.c.price ?? Infinity) - (b.c.price ?? Infinity) || a.c.name.localeCompare(b.c.name))
    return { list: out, hiddenNoPrice: hidden }
  }, [item, current, myFurniture, allTypes, filterOn, range, layout, uid])

  if (!item || !current) return null
  const chosen = preview?.uid === uid ? list.find((x) => x.c.id === preview.item.modelId) : undefined

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
        <p className="empty">
          Aucune proposition {filterOn ? 'dans ce budget' : 'pour ce type de meuble'}. Ajoutez un meuble repéré en ligne avec « Ajouter depuis un lien » (onglet Meubles).
        </p>
      ) : (
        <div className={`proposals ${chosen ? 'compact' : ''}`}>
          {list.map(({ c, fit }) => (
            <article key={c.id} className={`proposal ${chosen?.c.id === c.id ? 'chosen' : ''}`}>
              <button type="button" className="proposal-main" onClick={() => previewReplace(uid, c.id)}>
                <ItemThumb c={c} className="proposal-img" />
                <span className="proposal-name">{c.name}</span>
                <span className="proposal-price">{typeof c.price === 'number' ? fmtPrice(c.price) : 'Prix non renseigné'}</span>
                <span className="muted">
                  {Math.round(c.width * 100)} × {Math.round(c.depth * 100)} × {Math.round(c.height * 100)} cm
                </span>
                <span className="muted">{c.custom ? c.vendor || 'Vendeur non renseigné' : 'Modèle de démonstration'}</span>
                <span className={`fit ${fit.fits ? 'ok' : 'ko'}`}>{fit.message}</span>
              </button>
              {c.custom && c.link && (
                <a className="proposal-link" href={c.link} target="_blank" rel="noreferrer">
                  {Icon.link} Voir le produit
                </a>
              )}
            </article>
          ))}
        </div>
      )}
      {!chosen && filterOn && hiddenNoPrice > 0 && (
        <p className="hint-text">
          {hiddenNoPrice} meuble{hiddenNoPrice > 1 ? 's' : ''} sans prix masqué{hiddenNoPrice > 1 ? 's' : ''} par le filtre de budget.
        </p>
      )}
      {!chosen && <p className="hint-text">Les propositions choisies selon l'ambiance de vos inspirations arriveront avec l'assistant IA.</p>}

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
