// Relais de « Mon Intérieur 3D » (Cloudflare Worker).
// Il garde la clé de l'API Claude à l'abri (secret ANTHROPIC_API_KEY) et rend deux services :
//   POST /idee     → deux propositions d'aménagement à partir de la pièce, des inspirations et d'une demande
//   POST /produit  → lecture d'une page produit (nom, photo, prix, dimensions, vendeur)
// Seul le site de l'application peut l'appeler (vérification de l'origine).
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'

export interface Env {
  ANTHROPIC_API_KEY: string
  /** Origines autorisées, séparées par des virgules */
  ALLOWED_ORIGINS: string
}

const MODEL = 'claude-opus-5-5'

// ---------------------------------------------------------------- Utilitaires HTTP

function cors(origin: string | null, env: Env) {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  const ok = origin && allowed.includes(origin)
  return {
    ok: !!ok,
    headers: {
      'Access-Control-Allow-Origin': ok ? origin! : allowed[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  }
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } })

// ---------------------------------------------------------------- /idee

const IdeaRequest = z.object({
  demande: z.string().max(1200),
  piece: z.unknown(),
  inspirations: z
    .array(
      z.object({
        note: z.string().max(600).default(''),
        image: z.string().max(1_600_000).optional(), // JPEG en base64
      }),
    )
    .max(4)
    .default([]),
})

const Placement = z.object({
  ref: z.string().describe("uid d'un meuble existant à garder ou déplacer, ou \"nouveau\" pour un meuble ajouté"),
  modelId: z.string().describe('Identifiant du meuble dans le catalogue fourni'),
  x: z.number().describe('Position du centre, en mètres, axe gauche-droite (0 = centre de la pièce)'),
  z: z.number().describe('Position du centre, en mètres, axe haut-bas du plan (0 = centre de la pièce)'),
  rotationDeg: z.number().describe('0 = face avant vers le mur 3, 90 = vers le mur 2, 180 = vers le mur 1, 270 = vers le mur 4'),
  couleur: z.string().nullable().describe('Couleur #rrggbb pour le meuble, ou null pour garder sa couleur'),
})

const Proposal = z.object({
  titre: z.string().describe('Nom court de la proposition (3 à 6 mots)'),
  explication: z.string().describe('2 ou 3 phrases simples : ce qui change et pourquoi'),
  murs: z
    .object({ nord: z.string().nullable(), est: z.string().nullable(), sud: z.string().nullable(), ouest: z.string().nullable() })
    .describe('Nouvelle couleur #rrggbb par mur (nord = mur 1, est = mur 2, sud = mur 3, ouest = mur 4), null pour ne pas changer'),
  sol: z.string().nullable().describe('Identifiant du sol proposé, ou null pour garder le sol actuel'),
  meubles: z.array(Placement).describe('Liste complète des meubles de la pièce après aménagement'),
})

const IdeaResponse = z.object({ propositions: z.array(Proposal) })

const SYSTEM = `Tu es décorateur et architecte d'intérieur. Tu proposes des aménagements réalistes pour une pièce réelle décrite en JSON, en tenant compte des inspirations (photos et notes) et de la demande de la personne.

Repère de la pièce (vue du dessus) :
- origine au centre de la pièce, mètres ; x va de la gauche (mur 4, « ouest ») vers la droite (mur 2, « est ») ; z va du haut (mur 1, « nord ») vers le bas (mur 3, « sud »).
- Un meuble est décrit par le centre de son encombrement au sol (x, z), sa largeur (le long de sa face avant) et sa profondeur.
- rotationDeg : 0 = sa face avant regarde vers le mur 3 ; 90 = vers le mur 2 ; 180 = vers le mur 1 ; 270 = vers le mur 4. Un meuble « dos au mur 1 » a donc la rotation 0 ; un lit dont la tête est contre le mur 4 a la rotation 90.
- Avec une rotation de 90 ou 270, la largeur du meuble s'étend le long de l'axe z.

Règles à respecter strictement :
1. Les meubles verrouillés (verrouille: true) gardent exactement leur ref, leur modelId, leur position et leur rotation.
2. Chaque meuble reste entièrement dans la pièce et ne chevauche ni un autre meuble ni un placard, sauf le tapis (il peut passer sous les meubles) et une chaise ou un tabouret rangé sous une table, un bureau ou une coiffeuse.
3. Laisse libre la zone d'ouverture des portes et portes-fenêtres (un carré de la largeur du vantail devant elles) et garde des passages d'au moins 70 cm.
4. Ne place pas de meuble haut (plus de 1 m) devant une fenêtre ; un lit ou une commode basse sous une fenêtre est possible.
5. Pour un meuble déjà présent, réutilise sa ref ; pour un meuble ajouté, mets ref = "nouveau" et choisis son modelId dans le catalogue fourni uniquement.
6. Garde les meubles qui ont du sens ; retire seulement ceux qui gênent la demande, en le disant dans l'explication.
7. Les couleurs de murs restent sobres et réalistes (peintures de nuancier), inspirées des photos quand il y en a.

Donne exactement deux propositions vraiment différentes (par exemple deux dispositions, ou une disposition et une variante d'ambiance). Écris les titres et explications en français simple, sans jargon.`

async function handleIdea(req: Request, env: Env, headers: Record<string, string>) {
  const body = IdeaRequest.safeParse(await req.json().catch(() => null))
  if (!body.success) return json({ erreur: 'Demande illisible.' }, 400, headers)
  const { demande, piece, inspirations } = body.data

  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  inspirations.forEach((ins, i) => {
    if (ins.image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: ins.image } })
    content.push({ type: 'text', text: `Inspiration ${i + 1}${ins.note ? ` — ce que j'aime : ${ins.note}` : ''}` })
  })
  content.push({ type: 'text', text: `Ma pièce (JSON) :\n${JSON.stringify(piece)}` })
  content.push({ type: 'text', text: `Ma demande : ${demande || 'Propose-moi un meilleur aménagement inspiré de mes inspirations.'}` })

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      // En cas de refus par un filtre de sécurité, l'API relance la demande sur un modèle de secours
      fallbacks: 'default',
      output_config: { effort: 'high', format: betaZodOutputFormat(IdeaResponse) },
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    })
    if (response.stop_reason === 'refusal') return json({ erreur: "L'assistant n'a pas pu traiter cette demande." }, 422, headers)
    if (!response.parsed_output) return json({ erreur: "L'assistant a répondu dans un format inattendu. Réessayez." }, 502, headers)
    return json({ propositions: response.parsed_output.propositions.slice(0, 2), usage: response.usage }, 200, headers)
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ erreur: 'Trop de demandes en même temps. Réessayez dans une minute.' }, 429, headers)
    if (e instanceof Anthropic.AuthenticationError) return json({ erreur: 'La clé de l’API Claude est invalide ou absente dans le relais.' }, 500, headers)
    if (e instanceof Anthropic.APIError) return json({ erreur: `Erreur du service Claude (${e.status}).` }, 502, headers)
    return json({ erreur: 'Erreur inattendue du relais.' }, 500, headers)
  }
}

// ---------------------------------------------------------------- /produit

const ProductInfo = z.object({
  nom: z.string().nullable(),
  prix: z.number().nullable().describe('Prix en euros, nombre'),
  largeurCm: z.number().nullable(),
  profondeurCm: z.number().nullable(),
  hauteurCm: z.number().nullable(),
  categorie: z.enum(['lit', 'assise', 'table', 'rangement', 'deco']).nullable(),
})

function meta(html: string, names: string[]) {
  for (const n of names) {
    const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${n}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["']${n}["']`, 'i')
    const m = html.match(re)
    if (m) return (m[1] ?? m[2]).trim()
  }
  return null
}

function textOf(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

async function handleProduct(req: Request, env: Env, headers: Record<string, string>) {
  const body = (await req.json().catch(() => null)) as { url?: string } | null
  let url: URL
  try {
    url = new URL(body?.url ?? '')
    if (!/^https?:$/.test(url.protocol)) throw new Error()
  } catch {
    return json({ erreur: 'Lien invalide.' }, 400, headers)
  }
  const page = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', 'Accept-Language': 'fr-FR,fr;q=0.9' },
    redirect: 'follow',
  }).catch(() => null)
  if (!page || !page.ok) return json({ erreur: 'La boutique ne répond pas à la lecture automatique.', lu: false }, 200, headers)
  const html = (await page.text()).slice(0, 1_500_000)

  // 1. Informations publiées pour les réseaux sociaux et les moteurs de recherche
  const out: Record<string, unknown> = {
    nom: meta(html, ['og:title', 'twitter:title']),
    image: meta(html, ['og:image', 'twitter:image']),
    prix: null as number | null,
    vendeur: meta(html, ['og:site_name']) ?? url.hostname.replace(/^www\./, ''),
  }
  const p = meta(html, ['product:price:amount', 'og:price:amount'])
  if (p) out.prix = parseFloat(p.replace(',', '.'))
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1])
      const list = Array.isArray(data) ? data : data['@graph'] ?? [data]
      const prod = list.find((d: { '@type'?: string | string[] }) => [d['@type']].flat().includes('Product'))
      if (prod) {
        out.nom ??= prod.name
        const img = Array.isArray(prod.image) ? prod.image[0] : prod.image
        out.image ??= typeof img === 'string' ? img : img?.url
        const offer = Array.isArray(prod.offers) ? prod.offers[0] : prod.offers
        const price = parseFloat(String(offer?.price ?? offer?.lowPrice ?? '').replace(',', '.'))
        if (!Number.isNaN(price)) out.prix ??= price
      }
    } catch {
      /* bloc illisible */
    }
  }

  // 2. Le texte de la page, lu par Claude, pour les dimensions (rarement publiées ailleurs) et ce qui manque
  const text = textOf(html).slice(0, 14000)
  if (text.length > 200) {
    try {
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
      const r = await client.beta.messages.parse({
        model: MODEL,
        max_tokens: 2000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: betaZodOutputFormat(ProductInfo) },
        system: "Tu extrais les informations d'une fiche produit de meuble. Réponds null pour toute information absente du texte ; n'invente rien. Dimensions en centimètres, prix en euros.",
        messages: [{ role: 'user', content: `Page : ${url.toString()}\n\n${text}` }],
      })
      const info = r.parsed_output
      if (info) {
        out.nom ??= info.nom
        out.prix ??= info.prix
        out.largeur = info.largeurCm
        out.profondeur = info.profondeurCm
        out.hauteur = info.hauteurCm
        out.categorie = info.categorie
      }
    } catch {
      /* l'extraction par l'IA est un bonus : on renvoie ce qu'on a déjà */
    }
  }
  return json({ lu: true, ...out }, 200, headers)
}

// ---------------------------------------------------------------- Point d'entrée

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { ok, headers } = cors(req.headers.get('Origin'), env)
    if (req.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers })
    const path = new URL(req.url).pathname
    if (req.method === 'GET' && path === '/') return json({ service: 'Relais Mon Intérieur 3D', ok: true }, 200, headers)
    if (!ok) return json({ erreur: 'Origine non autorisée.' }, 403, headers)
    if (!env.ANTHROPIC_API_KEY) return json({ erreur: 'Le relais n’a pas encore de clé API Claude.' }, 500, headers)
    if (req.method === 'POST' && path === '/idee') return handleIdea(req, env, headers)
    if (req.method === 'POST' && path === '/produit') return handleProduct(req, env, headers)
    return json({ erreur: 'Adresse inconnue.' }, 404, headers)
  },
}
