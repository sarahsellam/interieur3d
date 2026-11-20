// Lecture d'une page produit à partir de son lien.
// Beaucoup de boutiques bloquent la lecture directe depuis une application web :
// dans ce cas on déduit ce qu'on peut de l'adresse elle-même (vendeur, nom, dimensions),
// et l'utilisateur complète. Une lecture complète demandera un petit relais (étape IA).
import type { MyFurniture } from './types'

export type ProductDraft = Partial<Pick<MyFurniture, 'name' | 'price' | 'vendor' | 'imageUrl' | 'width' | 'depth' | 'height' | 'category'>> & {
  /** true si la page elle-même a pu être lue */
  fromPage: boolean
}

const CATEGORY_WORDS: [MyFurniture['category'], RegExp][] = [
  ['lit', /\b(lit|sommier|tete-de-lit|t[eê]te de lit|bed)\b/i],
  ['assise', /\b(canap[eé]|sofa|fauteuil|chaise|tabouret|banc|pouf|armchair|chair|stool)\b/i],
  ['table', /\b(table|bureau|coiffeuse|console|desk)\b/i],
  ['rangement', /\b(commode|armoire|[eé]tag[eè]re|buffet|chevet|biblioth[eè]que|meuble|dresser|wardrobe|shelf|cabinet)\b/i],
]

export function guessCategory(text: string): MyFurniture['category'] {
  for (const [cat, re] of CATEGORY_WORDS) if (re.test(text)) return cat
  return 'deco'
}

/** Dimensions écrites comme « 160x200 », « 120 x 45 x 80 cm », « L120 P45 H80 ». */
export function guessDims(text: string): Partial<Pick<MyFurniture, 'width' | 'depth' | 'height'>> {
  const t = text.replace(/,/g, '.')
  const m = t.match(/(\d{2,3}(?:\.\d)?)\s*[x×*]\s*(\d{2,3}(?:\.\d)?)(?:\s*[x×*]\s*(\d{2,3}(?:\.\d)?))?\s*(cm)?/i)
  if (m) {
    const a = parseFloat(m[1]) / 100
    const b = parseFloat(m[2]) / 100
    const c = m[3] ? parseFloat(m[3]) / 100 : undefined
    return c ? { width: a, depth: b, height: c } : { width: a, depth: b }
  }
  const out: Partial<Pick<MyFurniture, 'width' | 'depth' | 'height'>> = {}
  const l = t.match(/\b(?:l|larg(?:eur)?)\.?\s*:?\s*(\d{2,3})\s*cm/i)
  const p = t.match(/\b(?:p|prof(?:ondeur)?)\.?\s*:?\s*(\d{2,3})\s*cm/i)
  const h = t.match(/\b(?:h|haut(?:eur)?)\.?\s*:?\s*(\d{2,3})\s*cm/i)
  if (l) out.width = parseInt(l[1]) / 100
  if (p) out.depth = parseInt(p[1]) / 100
  if (h) out.height = parseInt(h[1]) / 100
  return out
}

/** Ce qu'on peut déduire de l'adresse seule. */
export function draftFromUrl(raw: string): ProductDraft {
  try {
    const url = new URL(raw)
    const vendor = url.hostname.replace(/^www\d?\./, '')
    const segments = url.pathname.split('/').map(decodeURIComponent).filter(Boolean)
    // Le segment le plus « parlant » : celui qui contient le plus de mots
    // On garde les vrais mots et les petits nombres (« 3 tiroirs »), pas les références ni les mesures
    const words = (seg: string) =>
      seg
        .replace(/\.(html?|php|aspx?)$/i, '')
        .split(/[-_+]+/)
        .filter((w) => w && !/^\d{3,}$/.test(w) && !/^[a-z]*\d[a-z\d]{4,}$/i.test(w) && !/^\d+x\d+/i.test(w) && !/^(cm|mm|m|p|dp|ref|prod|product|produit)$/i.test(w))
    const best = segments.map(words).sort((a, b) => b.length - a.length)[0] ?? []
    const name = best.length >= 2 ? best.join(' ').replace(/^./, (c) => c.toUpperCase()) : undefined
    const text = segments.join(' ')
    return { vendor, name, category: name ? guessCategory(name) : undefined, ...guessDims(text), fromPage: false }
  } catch {
    return { fromPage: false }
  }
}

function meta(doc: Document, ...names: string[]) {
  for (const n of names) {
    const el = doc.querySelector(`meta[property="${n}"], meta[name="${n}"], meta[itemprop="${n}"]`)
    const v = el?.getAttribute('content')
    if (v) return v
  }
  return undefined
}

/** Essaie de lire la page produit ; sinon renvoie ce qu'on déduit de l'adresse. */
export async function readProductLink(raw: string): Promise<ProductDraft> {
  const base = draftFromUrl(raw)
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 7000)
    const res = await fetch(raw, { signal: ctrl.signal, credentials: 'omit' })
    clearTimeout(timer)
    if (!res.ok) return base
    const html = await res.text()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const found: ProductDraft = { fromPage: true }
    // Données structurées (schema.org Product), utilisées par beaucoup de boutiques
    for (const s of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
      try {
        const data = JSON.parse(s.textContent ?? '')
        const list = Array.isArray(data) ? data : data['@graph'] ?? [data]
        const product = list.find((d: { '@type'?: string | string[] }) => [d['@type']].flat().includes('Product'))
        if (product) {
          found.name ??= product.name
          const img = Array.isArray(product.image) ? product.image[0] : product.image
          found.imageUrl ??= typeof img === 'string' ? img : img?.url
          const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers
          const price = parseFloat(String(offer?.price ?? offer?.lowPrice ?? '').replace(',', '.'))
          if (!Number.isNaN(price)) found.price = price
        }
      } catch {
        /* bloc illisible : on continue */
      }
    }
    found.name ??= meta(doc, 'og:title', 'twitter:title') ?? doc.title
    found.imageUrl ??= meta(doc, 'og:image', 'twitter:image')
    const metaPrice = meta(doc, 'product:price:amount', 'og:price:amount', 'price')
    if (found.price === undefined && metaPrice) {
      const p = parseFloat(metaPrice.replace(',', '.'))
      if (!Number.isNaN(p)) found.price = p
    }
    const desc = meta(doc, 'og:description', 'description') ?? ''
    const dims = guessDims(`${found.name ?? ''} ${desc}`)
    return { ...base, ...dims, ...Object.fromEntries(Object.entries(found).filter(([, v]) => v !== undefined)), category: guessCategory(found.name ?? base.name ?? ''), fromPage: true }
  } catch {
    return base
  }
}
