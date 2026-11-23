// Comptes sans mot de passe (clés d'accès / passkeys : Face ID, Touch ID, empreinte)
// et synchronisation des projets entre appareils.
// - Un Durable Object « Comptes » par personne : ses clés d'accès, ses sessions, ses données et ses images.
// - Un Durable Object « Defis » unique : les défis WebAuthn en cours (valables 5 minutes).
// Aucun mot de passe, aucun e-mail : seule la clé d'accès (gardée dans le trousseau iCloud / Google) ouvre le compte.
import { DurableObject } from 'cloudflare:workers'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server'

// ---------------------------------------------------------------- Outils

const enc = new TextEncoder()

export function randomId(n: number) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(n))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

export async function sha256(text: string) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(text))
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('')
}

const b64url = {
  encode(bytes: Uint8Array) {
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  },
  decode(text: string) {
    const s = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4))
    return Uint8Array.from(s, (c) => c.charCodeAt(0))
  },
}

// ---------------------------------------------------------------- Défis WebAuthn

interface Defi {
  challenge: string
  exp: number
  userId?: string
  nom?: string
}

export class Defis extends DurableObject {
  async poser(key: string, d: Defi) {
    await this.ctx.storage.put(key, d)
    // Ménage : une alarme efface les défis expirés
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + 10 * 60_000)
  }
  async prendre(key: string): Promise<Defi | null> {
    const d = await this.ctx.storage.get<Defi>(key)
    if (!d) return null
    await this.ctx.storage.delete(key)
    return d.exp > Date.now() ? d : null
  }
  async alarm() {
    const all = await this.ctx.storage.list<Defi>()
    const old = [...all].filter(([, d]) => d.exp < Date.now()).map(([k]) => k)
    if (old.length) await this.ctx.storage.delete(old)
    if (all.size > old.length) await this.ctx.storage.setAlarm(Date.now() + 10 * 60_000)
  }
}

// ---------------------------------------------------------------- Compte d'une personne

interface Profil {
  userId: string
  nom: string
  createdAt: number
  secours: string // empreinte du code de secours
}

interface Cle {
  id: string
  publicKey: string // base64url
  counter: number
  transports?: string[]
  createdAt: number
}

export interface Changement {
  type: string
  id: string
  /** Moment de la modification sur l'appareil (ms) : la plus récente l'emporte */
  at: number
  deleted?: boolean
  data?: unknown
}

const TYPES = new Set(['projet', 'plan', 'inspiration', 'meuble'])
const MAX_ITEM = 1_500_000
const MAX_IMAGES = 400 * 1024 * 1024

export class Comptes extends DurableObject {
  private ready = false
  private setup() {
    if (this.ready) return
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS items (type TEXT, id TEXT, at INTEGER, seq INTEGER, deleted INTEGER, data TEXT, PRIMARY KEY (type, id))`)
    this.ctx.storage.sql.exec(`CREATE INDEX IF NOT EXISTS items_seq ON items(seq)`)
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, data BLOB, size INTEGER)`)
    this.ready = true
  }

  async creer(p: Profil, cle: Cle, session: string) {
    this.setup()
    if (await this.ctx.storage.get('profil')) throw new Error('Compte déjà existant')
    await this.ctx.storage.put({ profil: p, cles: [cle], sessions: { [session]: Date.now() }, seq: 0 })
  }

  async profil() {
    const p = await this.ctx.storage.get<Profil>('profil')
    if (!p) return null
    const cles = (await this.ctx.storage.get<Cle[]>('cles')) ?? []
    return { userId: p.userId, nom: p.nom, createdAt: p.createdAt, nbCles: cles.length }
  }

  async cle(id: string) {
    const cles = (await this.ctx.storage.get<Cle[]>('cles')) ?? []
    return cles.find((c) => c.id === id) ?? null
  }
  async cles() {
    return ((await this.ctx.storage.get<Cle[]>('cles')) ?? []).map((c) => ({ id: c.id, transports: c.transports }))
  }
  async ajouterCle(c: Cle) {
    const cles = (await this.ctx.storage.get<Cle[]>('cles')) ?? []
    await this.ctx.storage.put('cles', [...cles.filter((x) => x.id !== c.id), c])
  }
  async compteur(id: string, counter: number) {
    const cles = (await this.ctx.storage.get<Cle[]>('cles')) ?? []
    await this.ctx.storage.put('cles', cles.map((c) => (c.id === id ? { ...c, counter } : c)))
  }

  async ouvrirSession(hash: string) {
    const s = (await this.ctx.storage.get<Record<string, number>>('sessions')) ?? {}
    // Au plus 30 appareils connectés : on oublie les plus anciens
    const kept = Object.entries(s).sort((a, b) => b[1] - a[1]).slice(0, 29)
    await this.ctx.storage.put('sessions', { ...Object.fromEntries(kept), [hash]: Date.now() })
  }
  async session(hash: string) {
    const s = (await this.ctx.storage.get<Record<string, number>>('sessions')) ?? {}
    return !!s[hash]
  }
  async fermerSession(hash: string) {
    const s = (await this.ctx.storage.get<Record<string, number>>('sessions')) ?? {}
    delete s[hash]
    await this.ctx.storage.put('sessions', s)
  }

  async secours(hash: string) {
    const p = await this.ctx.storage.get<Profil>('profil')
    return !!p && p.secours === hash
  }
  async nouveauSecours(hash: string) {
    const p = await this.ctx.storage.get<Profil>('profil')
    if (p) await this.ctx.storage.put('profil', { ...p, secours: hash })
  }

  /** Échange des modifications : on reçoit celles de l'appareil, on renvoie celles faites ailleurs depuis « since ». */
  async sync(since: number, changes: Changement[]) {
    this.setup()
    const sql = this.ctx.storage.sql
    let seq = (await this.ctx.storage.get<number>('seq')) ?? 0
    const refused: Changement[] = []
    for (const c of changes) {
      if (!TYPES.has(c.type) || typeof c.id !== 'string' || c.id.length > 80) continue
      const data = c.deleted ? null : JSON.stringify(c.data ?? null)
      if (data && data.length > MAX_ITEM) continue
      const cur = sql.exec<{ at: number }>('SELECT at FROM items WHERE type = ? AND id = ?', c.type, c.id).toArray()[0]
      // La modification la plus récente l'emporte
      if (cur && cur.at > c.at) {
        refused.push(c)
        continue
      }
      seq++
      sql.exec(
        'INSERT INTO items (type, id, at, seq, deleted, data) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(type, id) DO UPDATE SET at = excluded.at, seq = excluded.seq, deleted = excluded.deleted, data = excluded.data',
        c.type,
        c.id,
        Math.floor(c.at),
        seq,
        c.deleted ? 1 : 0,
        data,
      )
    }
    await this.ctx.storage.put('seq', seq)
    const sent = new Set(changes.filter((c) => !refused.includes(c)).map((c) => `${c.type}:${c.id}`))
    const out = sql
      .exec<{ type: string; id: string; at: number; deleted: number; data: string | null }>('SELECT type, id, at, deleted, data FROM items WHERE seq > ? ORDER BY seq', since)
      .toArray()
      .filter((r) => !sent.has(`${r.type}:${r.id}`))
      .map((r) => ({ type: r.type, id: r.id, at: r.at, deleted: !!r.deleted, data: r.data ? JSON.parse(r.data) : undefined }))
    return { seq, changes: out }
  }

  async manquantes(ids: string[]) {
    this.setup()
    const have = new Set(this.ctx.storage.sql.exec<{ id: string }>('SELECT id FROM images').toArray().map((r) => r.id))
    return ids.filter((id) => !have.has(id))
  }
  async mettreImage(id: string, bytes: ArrayBuffer): Promise<'ok' | 'plein'> {
    this.setup()
    const used = this.ctx.storage.sql.exec<{ s: number | null }>('SELECT SUM(size) AS s FROM images').toArray()[0]?.s ?? 0
    if (used + bytes.byteLength > MAX_IMAGES) return 'plein'
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO images (id, data, size) VALUES (?, ?, ?)', id, bytes, bytes.byteLength)
    return 'ok'
  }
  async image(id: string): Promise<ArrayBuffer | null> {
    this.setup()
    const r = this.ctx.storage.sql.exec<{ data: ArrayBuffer }>('SELECT data FROM images WHERE id = ?', id).toArray()[0]
    return r ? r.data : null
  }

  async supprimer() {
    await this.ctx.storage.deleteAll()
    this.ready = false
  }
}

// ---------------------------------------------------------------- Routes HTTP

export interface CompteEnv {
  COMPTES: DurableObjectNamespace<Comptes>
  DEFIS: DurableObjectNamespace<Defis>
}

type J = (body: unknown, status?: number) => Response

const compte = (env: CompteEnv, userId: string) => env.COMPTES.get(env.COMPTES.idFromName(userId))
const defis = (env: CompteEnv) => env.DEFIS.get(env.DEFIS.idFromName('defis'))

async function newSession(env: CompteEnv, userId: string) {
  const token = randomId(32)
  await compte(env, userId).ouvrirSession(await sha256(token))
  return `${userId}.${token}`
}

/** Vérifie le jeton « Authorization: Bearer <compte>.<secret> ». */
async function auth(req: Request, env: CompteEnv) {
  const h = req.headers.get('Authorization') ?? ''
  const m = /^Bearer ([a-z0-9]{16})\.([a-z0-9]{32})$/.exec(h)
  if (!m) return null
  const ok = await compte(env, m[1]).session(await sha256(m[2]))
  return ok ? { userId: m[1], hash: await sha256(m[2]) } : null
}

export async function routeCompte(req: Request, env: CompteEnv, origin: string, path: string, j: J, headers: Record<string, string>): Promise<Response | null> {
  if (!path.startsWith('/compte')) return null
  const rpID = new URL(origin).hostname
  const body = async <T,>() => (await req.json().catch(() => ({}))) as T

  // --- Création du compte
  if (req.method === 'POST' && path === '/compte/inscription/options') {
    const { nom } = await body<{ nom?: string }>()
    const userId = randomId(16)
    const name = String(nom ?? '').trim().slice(0, 40) || 'Mon compte'
    const options = await generateRegistrationOptions({
      rpName: 'Mon Intérieur 3D',
      rpID,
      userName: name,
      userDisplayName: name,
      userID: new Uint8Array(enc.encode(userId)),
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    })
    const defi = randomId(20)
    await defis(env).poser(defi, { challenge: options.challenge, exp: Date.now() + 5 * 60_000, userId, nom: name })
    return j({ defi, options })
  }
  if (req.method === 'POST' && path === '/compte/inscription/verif') {
    const { defi, reponse } = await body<{ defi?: string; reponse?: RegistrationResponseJSON }>()
    const d = defi ? await defis(env).prendre(defi) : null
    if (!d || !d.userId || !reponse) return j({ erreur: 'La demande a expiré. Réessayez.' }, 400)
    const v = await verifyRegistrationResponse({ response: reponse, expectedChallenge: d.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false }).catch(() => null)
    if (!v?.verified) return j({ erreur: 'La clé d’accès n’a pas pu être vérifiée.' }, 400)
    const c = v.registrationInfo.credential
    const code = randomId(20)
    const token = randomId(32)
    await compte(env, d.userId).creer(
      { userId: d.userId, nom: d.nom ?? 'Mon compte', createdAt: Date.now(), secours: await sha256(code) },
      { id: c.id, publicKey: b64url.encode(c.publicKey), counter: c.counter, transports: c.transports, createdAt: Date.now() },
      await sha256(token),
    )
    return j({ jeton: `${d.userId}.${token}`, userId: d.userId, nom: d.nom, secours: `${d.userId}-${code}` })
  }

  // --- Connexion
  if (req.method === 'POST' && path === '/compte/connexion/options') {
    const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred' })
    const defi = randomId(20)
    await defis(env).poser(defi, { challenge: options.challenge, exp: Date.now() + 5 * 60_000 })
    return j({ defi, options })
  }
  if (req.method === 'POST' && path === '/compte/connexion/verif') {
    const { defi, reponse } = await body<{ defi?: string; reponse?: AuthenticationResponseJSON }>()
    const d = defi ? await defis(env).prendre(defi) : null
    if (!d || !reponse) return j({ erreur: 'La demande a expiré. Réessayez.' }, 400)
    const handle = reponse.response?.userHandle
    const userId = handle ? new TextDecoder().decode(b64url.decode(handle)) : ''
    if (!/^[a-z0-9]{16}$/.test(userId)) return j({ erreur: 'Clé d’accès inconnue.' }, 404)
    const stub = compte(env, userId)
    const cle = await stub.cle(reponse.id)
    if (!cle) return j({ erreur: 'Ce compte n’existe plus ou cette clé d’accès en a été retirée.' }, 404)
    const v = await verifyAuthenticationResponse({
      response: reponse,
      expectedChallenge: d.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: { id: cle.id, publicKey: b64url.decode(cle.publicKey), counter: cle.counter, transports: cle.transports },
      requireUserVerification: false,
    }).catch(() => null)
    if (!v?.verified) return j({ erreur: 'La clé d’accès n’a pas pu être vérifiée.' }, 400)
    await stub.compteur(cle.id, v.authenticationInfo.newCounter)
    const p = await stub.profil()
    return j({ jeton: await newSession(env, userId), userId, nom: p?.nom })
  }

  // --- Code de secours (si tous les appareils sont perdus)
  if (req.method === 'POST' && path === '/compte/secours') {
    const { code } = await body<{ code?: string }>()
    // Espaces, tirets longs ou absence de tiret sont acceptés
    const clean = String(code ?? '').toLowerCase().replace(/[\s\u2013\u2014-]/g, '')
    const m = /^([a-z0-9]{16})([a-z0-9]{20})$/.exec(clean)
    if (!m) return j({ erreur: 'Ce code n’a pas le bon format.' }, 400)
    const stub = compte(env, m[1])
    if (!(await stub.secours(await sha256(m[2])))) return j({ erreur: 'Code de secours incorrect.' }, 403)
    const p = await stub.profil()
    return j({ jeton: await newSession(env, m[1]), userId: m[1], nom: p?.nom })
  }

  // --- Tout le reste demande d'être connecté
  const a = await auth(req, env)
  if (!a) return j({ erreur: 'Session expirée : reconnectez-vous.' }, 401)
  const stub = compte(env, a.userId)

  if (req.method === 'GET' && path === '/compte') return j(await stub.profil())
  if (req.method === 'POST' && path === '/compte/deconnexion') {
    await stub.fermerSession(a.hash)
    return j({ ok: true })
  }
  if (req.method === 'DELETE' && path === '/compte') {
    await stub.supprimer()
    return j({ ok: true })
  }
  if (req.method === 'POST' && path === '/compte/secours/nouveau') {
    const code = randomId(20)
    await stub.nouveauSecours(await sha256(code))
    return j({ secours: `${a.userId}-${code}` })
  }
  // Ajouter une clé d'accès (après une connexion par code de secours, ou pour un autre appareil)
  if (req.method === 'POST' && path === '/compte/cle/options') {
    const p = await stub.profil()
    const options = await generateRegistrationOptions({
      rpName: 'Mon Intérieur 3D',
      rpID,
      userName: p?.nom ?? 'Mon compte',
      userID: new Uint8Array(enc.encode(a.userId)),
      attestationType: 'none',
      excludeCredentials: await stub.cles(),
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    })
    const defi = randomId(20)
    await defis(env).poser(defi, { challenge: options.challenge, exp: Date.now() + 5 * 60_000, userId: a.userId })
    return j({ defi, options })
  }
  if (req.method === 'POST' && path === '/compte/cle/verif') {
    const { defi, reponse } = await body<{ defi?: string; reponse?: RegistrationResponseJSON }>()
    const d = defi ? await defis(env).prendre(defi) : null
    if (!d || d.userId !== a.userId || !reponse) return j({ erreur: 'La demande a expiré. Réessayez.' }, 400)
    const v = await verifyRegistrationResponse({ response: reponse, expectedChallenge: d.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false }).catch(() => null)
    if (!v?.verified) return j({ erreur: 'La clé d’accès n’a pas pu être vérifiée.' }, 400)
    const c = v.registrationInfo.credential
    await stub.ajouterCle({ id: c.id, publicKey: b64url.encode(c.publicKey), counter: c.counter, transports: c.transports, createdAt: Date.now() })
    return j({ ok: true })
  }

  // --- Synchronisation
  if (req.method === 'POST' && path === '/compte/sync') {
    const { depuis, changements } = await body<{ depuis?: number; changements?: Changement[] }>()
    const list = Array.isArray(changements) ? changements.slice(0, 500) : []
    return j(await stub.sync(Number(depuis) || 0, list))
  }
  if (req.method === 'POST' && path === '/compte/images/manquantes') {
    const { ids } = await body<{ ids?: string[] }>()
    return j({ manquantes: await stub.manquantes((ids ?? []).filter((x) => typeof x === 'string').slice(0, 2000)) })
  }
  const img = /^\/compte\/image\/([A-Za-z0-9_-]{4,40})$/.exec(path)
  if (img && req.method === 'PUT') {
    const bytes = await req.arrayBuffer()
    if (bytes.byteLength > 1_900_000) return j({ erreur: 'Image trop lourde.' }, 413)
    const r = await stub.mettreImage(img[1], bytes)
    return r === 'ok' ? j({ ok: true }) : j({ erreur: 'Espace de stockage plein.' }, 507)
  }
  if (img && req.method === 'GET') {
    const data = await stub.image(img[1])
    if (!data) return j({ erreur: 'Image introuvable.' }, 404)
    return new Response(data, { headers: { ...headers, 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable' } })
  }
  return j({ erreur: 'Adresse inconnue.' }, 404)
}
