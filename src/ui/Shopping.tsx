// « Ma liste d'achats » : tous les meubles à acheter du projet, regroupés par magasin,
// avec total par magasin, cases « Acheté », liens vers les produits, et export (PDF ou texte).
// Le paiement se fait chez chaque magasin : l'application ne vend rien elle-même.
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { fmtPrice, getItem, itemPrice, type CatalogItem } from '../data/catalog'
import { offerFile } from '../model/backup'
import type { Layout, PlacedItem } from '../model/types'
import { useProject, useStore } from '../store'
import { Icon } from './common'
import { ItemThumb } from './MyFurniture'

interface Line {
  key: string
  c: CatalogItem
  items: PlacedItem[]
  qty: number
  unit: number | null
  bought: boolean
}

interface Store {
  vendor: string
  lines: Line[]
  total: number
  remaining: number
  missing: number
}

const NO_VENDOR = 'Magasin à choisir'

/** Les achats du projet, regroupés par magasin puis par produit (quantités). */
export function shoppingList(layout: Layout): { stores: Store[]; total: number; remaining: number; count: number } {
  const lines = new Map<string, Line>()
  for (const it of layout.items) {
    if (it.status !== 'a-acheter') continue
    const c = getItem(it.modelId)
    if (!c) continue
    const unit = itemPrice(it)
    const key = `${it.modelId}|${unit ?? ''}|${it.color ?? ''}|${it.bought ? 1 : 0}`
    const l = lines.get(key)
    if (l) {
      l.items.push(it)
      l.qty++
    } else lines.set(key, { key, c, items: [it], qty: 1, unit, bought: !!it.bought })
  }
  const by = new Map<string, Store>()
  for (const l of lines.values()) {
    const vendor = l.c.vendor?.trim() || NO_VENDOR
    const st = by.get(vendor) ?? { vendor, lines: [], total: 0, remaining: 0, missing: 0 }
    st.lines.push(l)
    if (l.unit === null) st.missing += l.qty
    else {
      st.total += l.unit * l.qty
      if (!l.bought) st.remaining += l.unit * l.qty
    }
    by.set(vendor, st)
  }
  const stores = [...by.values()].sort((a, b) => Number(a.vendor === NO_VENDOR) - Number(b.vendor === NO_VENDOR) || b.total - a.total)
  // Ordre stable (une ligne cochée ne saute pas ailleurs sous le doigt)
  for (const s of stores) s.lines.sort((a, b) => a.c.name.localeCompare(b.c.name) || Number(a.bought) - Number(b.bought))
  return {
    stores,
    total: stores.reduce((a, s) => a + s.total, 0),
    remaining: stores.reduce((a, s) => a + s.remaining, 0),
    count: stores.reduce((a, s) => a + s.lines.reduce((n, l) => n + l.qty, 0), 0),
  }
}

/** Amazon accepte plusieurs produits dans un seul lien « ajouter au panier » (identifiant ASIN). */
function amazonCartUrl(lines: Line[]): string | null {
  const parts: string[] = []
  let host = ''
  for (const l of lines) {
    const m = /^https?:\/\/(www\.amazon\.[a-z.]+)\/(?:.*\/)?(?:dp|gp\/product)\/([A-Z0-9]{10})/.exec(l.c.link ?? '')
    if (!m || l.bought) continue
    host = m[1]
    const n = parts.length / 2 + 1
    parts.push(`ASIN.${n}=${m[2]}`, `Quantity.${n}=${l.qty}`)
  }
  return parts.length ? `https://${host}/gp/aws/cart/add.html?${parts.join('&')}` : null
}

/** Texte de la liste, pour l'envoyer par message ou la copier. */
function listText(name: string, stores: Store[], remaining: number) {
  const out = [`Liste d'achats · ${name}`, '']
  for (const s of stores) {
    out.push(`${s.vendor}${s.total ? ` · ${fmtPrice(s.total)}` : ''}`)
    for (const l of s.lines) out.push(`${l.bought ? '[x]' : '[ ]'} ${l.qty > 1 ? `${l.qty} × ` : ''}${l.c.name}${l.unit !== null ? ` · ${fmtPrice(l.unit * l.qty)}` : ''}${l.c.link ? `\n    ${l.c.link}` : ''}`)
    out.push('')
  }
  out.push(`Reste à acheter : ${fmtPrice(remaining)}`)
  return out.join('\n').replace(/[  ]/g, ' ')
}

/** PDF A4 de la liste, avec cases à cocher et liens cliquables. */
async function listPdf(name: string, versionName: string, stores: Store[], total: number, remaining: number): Promise<File> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const t = (s: string) => s.replace(/[  ]/g, ' ').replace(/[‘’]/g, "'")
  const M = 16
  let y = M + 6
  doc.setFont('times', 'normal')
  doc.setFontSize(20)
  doc.text(t(`Liste d'achats · ${name}`), M, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor('#6e625c')
  doc.text(t(`${versionName} · ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} · Mon Intérieur 3D`), M, y)
  y += 10
  for (const s of stores) {
    if (y > 260) {
      doc.addPage()
      y = M + 4
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor('#742f45')
    doc.text(t(s.vendor), M, y)
    if (s.total) doc.text(t(fmtPrice(s.total)), 210 - M, y, { align: 'right' })
    y += 2
    doc.setDrawColor('#d9d2c8')
    doc.line(M, y, 210 - M, y)
    y += 6
    for (const l of s.lines) {
      if (y > 275) {
        doc.addPage()
        y = M + 4
      }
      doc.setDrawColor('#292321')
      doc.rect(M, y - 3.4, 3.8, 3.8)
      if (l.bought) {
        doc.line(M + 0.6, y - 1.4, M + 1.6, y - 0.2)
        doc.line(M + 1.6, y - 0.2, M + 3.4, y - 3)
      }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(l.bought ? '#9a8f88' : '#292321')
      doc.text(t(`${l.qty > 1 ? `${l.qty} × ` : ''}${l.c.name}`), M + 7, y)
      doc.text(l.unit === null ? 'prix ?' : t(fmtPrice(l.unit * l.qty)), 210 - M, y, { align: 'right' })
      y += 4.2
      doc.setFontSize(7.5)
      doc.setTextColor('#6e625c')
      const d = `${Math.round(l.c.width * 100)} × ${Math.round(l.c.depth * 100)} × ${Math.round(l.c.height * 100)} cm`
      doc.text(t(d), M + 7, y)
      if (l.c.link) doc.textWithLink('Voir le produit', M + 50, y, { url: l.c.link })
      y += 6.5
    }
    y += 3
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor('#292321')
  doc.text('Total des achats', M, y + 2)
  doc.text(t(fmtPrice(total)), 210 - M, y + 2, { align: 'right' })
  doc.setTextColor('#742f45')
  doc.text('Reste à acheter', M, y + 8)
  doc.text(t(fmtPrice(remaining)), 210 - M, y + 8, { align: 'right' })
  return new File([doc.output('blob')], 'liste-achats.pdf', { type: 'application/pdf' })
}

function StoreBlock({ s, onSelect }: { s: Store; onSelect: (uid: string) => void }) {
  const setBought = useStore((x) => x.setBought)
  // Ouvrir les produits d'un magasin un par un (un toucher par produit : les navigateurs bloquent les ouvertures multiples)
  const [next, setNext] = useState(0)
  const links = s.lines.filter((l) => !l.bought && l.c.link)
  const amazon = /amazon/i.test(s.vendor) ? amazonCartUrl(s.lines) : null
  return (
    <section className="shop-store">
      <div className="shop-store-head">
        <div>
          <h3>{s.vendor}</h3>
          <span className="muted">
            {s.total ? fmtPrice(s.total) : 'Prix à saisir'}
            {s.remaining !== s.total && ` · reste ${fmtPrice(s.remaining)}`}
            {s.missing > 0 && ` · ${s.missing} sans prix`}
          </span>
        </div>
        {amazon ? (
          <a className="btn primary" href={amazon} target="_blank" rel="noreferrer">
            Tout ajouter au panier Amazon
          </a>
        ) : (
          links.length > 0 && (
            <a
              className="btn secondary"
              href={links[Math.min(next, links.length - 1)].c.link}
              target="_blank"
              rel="noreferrer"
              onClick={() => setNext((n) => (n + 1) % links.length)}
            >
              {Icon.link}{' '}
              {links.length === 1 ? `Ouvrir chez ${s.vendor}` : `Ouvrir chez ${s.vendor} (${Math.min(next, links.length - 1) + 1}/${links.length})`}
            </a>
          )
        )}
      </div>
      <ul className="shop-lines">
        {s.lines.map((l) => (
          <li key={l.key} className={l.bought ? 'bought' : ''}>
            <label className="shop-check" aria-label={`Acheté : ${l.c.name}`}>
              <input type="checkbox" checked={l.bought} onChange={(e) => setBought(l.items.map((i) => i.uid), e.target.checked)} />
            </label>
            <button type="button" className="shop-thumb" onClick={() => onSelect(l.items[0].uid)} aria-label={`Voir ${l.c.name} dans la pièce`}>
              <ItemThumb c={l.c} className="shop-img" />
            </button>
            <div className="shop-info">
              <span className="shop-name">
                {l.qty > 1 && <strong>{l.qty} × </strong>}
                {l.c.name}
              </span>
              <span className="muted">
                {Math.round(l.c.width * 100)} × {Math.round(l.c.depth * 100)} × {Math.round(l.c.height * 100)} cm
                {l.c.checkedAt && ' · prix relevé'}
              </span>
              {l.c.link ? (
                <a href={l.c.link} target="_blank" rel="noreferrer" className="shop-link">
                  {Icon.link} Voir le produit
                </a>
              ) : (
                <span className="muted">Pas de lien : touchez la photo, puis « Remplacer » ou « Ajouter mon propre lien »</span>
              )}
            </div>
            <span className="shop-price">{l.unit === null ? <span className="muted">Prix ?</span> : fmtPrice(l.unit * l.qty)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ShoppingList({ onClose }: { onClose: () => void }) {
  const project = useProject()
  const layout = useStore((s) => s.layout)
  const select = useStore((s) => s.select)
  const list = useMemo(() => shoppingList(layout), [layout])
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pdf, setPdf] = useState<File | null>(null)
  const name = project?.name ?? 'Ma pièce'
  // La liste a changé : le PDF préparé n'est plus à jour
  useEffect(() => setPdf(null), [layout])

  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" aria-label="Ma liste d'achats">
      <div className="modal-card shop-card">
        <div className="popover-head">
          <h2>Ma liste d'achats</h2>
          <button type="button" className="icon-btn small" onClick={onClose} aria-label="Fermer">
            {Icon.close}
          </button>
        </div>
        {list.count === 0 ? (
          <p className="hint-text">Aucun achat prévu. Touchez un meuble dans la pièce et choisissez « À acheter », ou remplacez-le par un produit du commerce.</p>
        ) : (
          <>
            <div className="shop-summary">
              <div>
                <span className="muted">Total</span>
                <strong>{fmtPrice(list.total)}</strong>
              </div>
              <div>
                <span className="muted">Reste à acheter</span>
                <strong className="shop-remaining">{fmtPrice(list.remaining)}</strong>
              </div>
              <div>
                <span className="muted">{list.stores.length > 1 ? 'Magasins' : 'Magasin'}</span>
                <strong>{list.stores.filter((s) => s.vendor !== NO_VENDOR).length || '—'}</strong>
              </div>
            </div>
            <p className="hint-text">Chaque achat se fait sur le site du magasin. Cochez ce que vous avez acheté : le reste à payer se met à jour.</p>
            {list.stores.map((s) => (
              <StoreBlock
                key={s.vendor}
                s={s}
                onSelect={(uid) => {
                  onClose()
                  select({ type: 'item', id: uid })
                }}
              />
            ))}
            <div className="modal-foot shop-foot">
              <button
                type="button"
                className={`btn ${copied ? 'saved' : 'ghost'}`}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(listText(name, list.stores, list.remaining))
                    setCopied(true)
                  } catch {
                    /* copie impossible */
                  }
                }}
              >
                {copied ? <>{Icon.check} Copiée</> : <>{Icon.copy} Copier la liste</>}
              </button>
              {pdf ? (
                <button type="button" className="btn primary" onClick={() => offerFile(pdf, `Liste d'achats · ${name}`)}>
                  {Icon.share} Enregistrer ou envoyer le PDF
                </button>
              ) : (
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    setPdf(await listPdf(name, layout.name, list.stores, list.total, list.remaining))
                    setBusy(false)
                  }}
                >
                  {Icon.download} {busy ? 'Préparation…' : 'Liste en PDF'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
