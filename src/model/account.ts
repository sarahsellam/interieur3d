// Compte et synchronisation entre appareils.
// - Connexion par clé d'accès (Face ID / Touch ID / empreinte), sans mot de passe ni e-mail.
// - Les projets, plans d'appartement, inspirations, « Mes meubles » et leurs images sont envoyés
//   dans le relais ; chaque appareil connecté récupère ce qui a changé ailleurs.
// - Détection des changements : on garde l'empreinte de chaque élément tel qu'il a été synchronisé ;
//   un élément dont l'empreinte a changé est envoyé, un élément disparu est signalé comme supprimé.
// - En cas de modification des deux côtés, la plus récente l'emporte.
import { create } from 'zustand'
import { startAuthentication, startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { RELAIS_URL } from './ai'
import { imageUrl, loadInspirations, loadMyFurniture, loadPlans, loadProjects, putImage, saveInspirations, saveMyFurniture, savePlans, saveProjects, shrinkImage } from './storage'
import type { FloorPlan } from './plan'
import type { Inspiration, MyFurniture, Project } from './types'

const ACCOUNT_KEY = 'mi3d-compte-v1'
const SYNC_KEY = 'mi3d-sync-v1'

export interface Account {
  userId: string
  nom: string
  jeton: string
}

interface SyncMeta {
  userId: string
  seq: number
  /** Empreinte de chaque élément au moment de sa dernière synchronisation (« type:id » → empreinte) */
  hashes: Record<string, string>
  /** Images déjà présentes dans le compte */
  images: string[]
}

type ItemType = 'projet' | 'plan' | 'inspiration' | 'meuble'
interface Change {
  type: ItemType
  id: string
  at: number
  deleted?: boolean
  data?: unknown
}

const read = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
const write = (key: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* stockage plein ou indisponible */
  }
}

export const accountsAvailable = () => RELAIS_URL.length > 0 && typeof window !== 'undefined' && browserSupportsWebAuthn()

// ---------------------------------------------------------------- État visible dans l'interface

export type SyncStatus = 'idle' | 'sync' | 'ok' | 'erreur' | 'horsligne'

interface AccountState {
  account: Account | null
  status: SyncStatus
  lastSync: number
  error: string
  /** Code de secours à montrer une seule fois (juste après la création du compte) */
  recovery: string | null
  setRecovery: (c: string | null) => void
}

export const useAccount = create<AccountState>()((set) => ({
  account: read<Account>(ACCOUNT_KEY),
  status: 'idle',
  lastSync: 0,
  error: '',
  recovery: null,
  setRecovery: (recovery) => set({ recovery }),
}))

// ---------------------------------------------------------------- Appels au relais

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function api<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  if (!navigator.onLine) throw new ApiError('Pas de connexion internet pour le moment.', 0)
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) }
  if (init.body && typeof init.body === 'string') headers['Content-Type'] = 'application/json'
  const acc = useAccount.getState().account
  if (init.auth !== false && acc) headers.Authorization = `Bearer ${acc.jeton}`
  let res: Response
  try {
    res = await fetch(RELAIS_URL + path, { ...init, headers })
  } catch {
    throw new ApiError('Le serveur ne répond pas. Réessayez dans un instant.', 0)
  }
  if (res.headers.get('Content-Type')?.startsWith('image/')) return (await res.blob()) as T
  const body = (await res.json().catch(() => ({}))) as T & { erreur?: string }
  if (!res.ok) {
    if (res.status === 401 && init.auth !== false) signedOut()
    throw new ApiError(body.erreur ?? 'Une erreur est survenue.', res.status)
  }
  return body
}

function signedIn(a: Account) {
  write(ACCOUNT_KEY, a)
  // Changement de compte : on repart d'une synchronisation complète
  const meta = read<SyncMeta>(SYNC_KEY)
  if (!meta || meta.userId !== a.userId) write(SYNC_KEY, { userId: a.userId, seq: 0, hashes: {}, images: [] } satisfies SyncMeta)
  useAccount.setState({ account: a, status: 'idle', error: '' })
}

function signedOut() {
  write(ACCOUNT_KEY, null)
  write(SYNC_KEY, null)
  useAccount.setState({ account: null, status: 'idle', lastSync: 0, error: '' })
}

/** Messages clairs pour les refus de Face ID / Touch ID. */
function passkeyError(e: unknown): Error {
  const name = (e as Error)?.name
  if (name === 'NotAllowedError' || name === 'AbortError') return new Error('Opération annulée.')
  if (name === 'InvalidStateError') return new Error('Cet appareil a déjà une clé d’accès pour ce compte.')
  return e instanceof Error ? e : new Error('La clé d’accès n’a pas fonctionné.')
}

export async function createAccount(nom: string) {
  const { defi, options } = await api<{ defi: string; options: Parameters<typeof startRegistration>[0]['optionsJSON'] }>('/compte/inscription/options', {
    method: 'POST',
    body: JSON.stringify({ nom }),
    auth: false,
  })
  let reponse
  try {
    reponse = await startRegistration({ optionsJSON: options })
  } catch (e) {
    throw passkeyError(e)
  }
  const r = await api<{ jeton: string; userId: string; nom: string; secours: string }>('/compte/inscription/verif', { method: 'POST', body: JSON.stringify({ defi, reponse }), auth: false })
  signedIn({ userId: r.userId, nom: r.nom, jeton: r.jeton })
  useAccount.getState().setRecovery(r.secours)
  void syncNow()
}

export async function signIn() {
  const { defi, options } = await api<{ defi: string; options: Parameters<typeof startAuthentication>[0]['optionsJSON'] }>('/compte/connexion/options', { method: 'POST', body: '{}', auth: false })
  let reponse
  try {
    reponse = await startAuthentication({ optionsJSON: options })
  } catch (e) {
    throw passkeyError(e)
  }
  const r = await api<{ jeton: string; userId: string; nom: string }>('/compte/connexion/verif', { method: 'POST', body: JSON.stringify({ defi, reponse }), auth: false })
  signedIn({ userId: r.userId, nom: r.nom ?? 'Mon compte', jeton: r.jeton })
  void syncNow()
}

export async function signInWithRecovery(code: string) {
  const r = await api<{ jeton: string; userId: string; nom: string }>('/compte/secours', { method: 'POST', body: JSON.stringify({ code }), auth: false })
  signedIn({ userId: r.userId, nom: r.nom ?? 'Mon compte', jeton: r.jeton })
  void syncNow()
}

/** Ajoute une clé d'accès à ce compte depuis cet appareil (utile après le code de secours). */
export async function addPasskey() {
  const { defi, options } = await api<{ defi: string; options: Parameters<typeof startRegistration>[0]['optionsJSON'] }>('/compte/cle/options', { method: 'POST', body: '{}' })
  let reponse
  try {
    reponse = await startRegistration({ optionsJSON: options })
  } catch (e) {
    throw passkeyError(e)
  }
  await api('/compte/cle/verif', { method: 'POST', body: JSON.stringify({ defi, reponse }) })
}

export async function newRecoveryCode() {
  const r = await api<{ secours: string }>('/compte/secours/nouveau', { method: 'POST', body: '{}' })
  useAccount.getState().setRecovery(r.secours)
}

export async function signOut() {
  await api('/compte/deconnexion', { method: 'POST', body: '{}' }).catch(() => undefined)
  signedOut()
}

export async function deleteAccount() {
  await api('/compte', { method: 'DELETE' })
  signedOut()
}

// ---------------------------------------------------------------- Synchronisation

/** Empreinte courte d'un texte (cyrb53). */
function hash(text: string) {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

interface LocalData {
  projet: Project[]
  plan: FloorPlan[]
  inspiration: Inspiration[]
  meuble: MyFurniture[]
}

const loadLocal = (): LocalData => ({ projet: loadProjects(), plan: loadPlans(), inspiration: loadInspirations(), meuble: loadMyFurniture() })
const saveLocal = (d: LocalData) => {
  saveProjects(d.projet)
  savePlans(d.plan)
  saveInspirations(d.inspiration)
  saveMyFurniture(d.meuble)
}

const TYPES: ItemType[] = ['projet', 'plan', 'inspiration', 'meuble']
const stamp = (type: ItemType, item: { updatedAt?: number }) => (type === 'projet' || type === 'plan' ? (item.updatedAt ?? Date.now()) : Date.now())

/** Toutes les images utilisées par les données. */
function imageIds(d: LocalData) {
  const ids = new Set<string>()
  d.projet.forEach((p) => p.references.forEach((r) => ids.add(r.id)))
  // Photos encadrées en tableau, dans toutes les versions
  d.projet.forEach((p) => p.versions.forEach((v) => (v.decor ?? []).forEach((x) => x.imageId && ids.add(x.imageId))))
  d.plan.forEach((p) => p.image && ids.add(p.image.id))
  d.inspiration.forEach((i) => i.imageId && ids.add(i.imageId))
  d.meuble.forEach((f) => f.imageId && ids.add(f.imageId))
  return [...ids]
}

let running: Promise<void> | null = null
let again = false

/** Lance une synchronisation (une seule à la fois ; une demande pendant l'envoi en relance une après). */
export function syncNow(): Promise<void> {
  if (!useAccount.getState().account) return Promise.resolve()
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      await syncOnce()
    } while (again)
  })().finally(() => (running = null))
  return running
}

async function syncOnce() {
  const acc = useAccount.getState().account
  if (!acc) return
  if (!navigator.onLine) {
    useAccount.setState({ status: 'horsligne' })
    return
  }
  useAccount.setState({ status: 'sync', error: '' })
  try {
    const meta: SyncMeta = read<SyncMeta>(SYNC_KEY) ?? { userId: acc.userId, seq: 0, hashes: {}, images: [] }
    const local = loadLocal()

    // 1. Ce qui a changé sur cet appareil
    const changes: Change[] = []
    const present = new Set<string>()
    for (const type of TYPES) {
      for (const item of local[type] as { id: string; updatedAt?: number }[]) {
        const key = `${type}:${item.id}`
        present.add(key)
        const h = hash(JSON.stringify(item))
        if (meta.hashes[key] !== h) changes.push({ type, id: item.id, at: stamp(type, item), data: item })
      }
    }
    for (const key of Object.keys(meta.hashes)) {
      if (present.has(key)) continue
      const [type, id] = key.split(/:(.*)/s) as [ItemType, string]
      changes.push({ type, id, at: Date.now(), deleted: true })
    }

    // 2. Images d'abord (pour qu'un autre appareil les trouve en recevant le projet)
    await pushImages(local, meta)

    // 3. Envoi par paquets d'environ 4 Mo, puis réception de ce qui a changé ailleurs
    const batches: Change[][] = [[]]
    let size = 0
    for (const c of changes) {
      const s = JSON.stringify(c).length
      if (size + s > 4_000_000 && batches[batches.length - 1].length) {
        batches.push([])
        size = 0
      }
      batches[batches.length - 1].push(c)
      size += s
    }
    const received: Change[] = []
    for (const batch of batches) {
      const r = await api<{ seq: number; changes: Change[] }>('/compte/sync', { method: 'POST', body: JSON.stringify({ depuis: meta.seq, changements: batch }) })
      for (const c of batch) {
        const key = `${c.type}:${c.id}`
        if (c.deleted) delete meta.hashes[key]
        else meta.hashes[key] = hash(JSON.stringify(c.data))
      }
      received.push(...r.changes)
      meta.seq = r.seq
    }

    // 4. Application des changements reçus (plus récents que ceux de cet appareil)
    if (received.length) {
      const fresh = loadLocal()
      for (const c of received) {
        if (!TYPES.includes(c.type)) continue
        const list = fresh[c.type] as { id: string }[]
        const key = `${c.type}:${c.id}`
        const idx = list.findIndex((x) => x.id === c.id)
        if (c.deleted) {
          if (idx >= 0) list.splice(idx, 1)
          delete meta.hashes[key]
        } else {
          if (idx >= 0) list[idx] = c.data as { id: string }
          else list.unshift(c.data as { id: string })
          meta.hashes[key] = hash(JSON.stringify(c.data))
        }
      }
      saveLocal(fresh)
      await pullImages(fresh)
      applying = true
      try {
        onRemoteChange?.()
      } finally {
        applying = false
      }
    }
    write(SYNC_KEY, meta)
    useAccount.setState({ status: 'ok', lastSync: Date.now() })
  } catch (e) {
    const err = e as ApiError
    useAccount.setState({ status: err.status === 0 ? 'horsligne' : 'erreur', error: err.message })
  }
}

async function pushImages(local: LocalData, meta: SyncMeta) {
  const known = new Set(meta.images)
  const candidates = imageIds(local).filter((id) => !known.has(id))
  if (!candidates.length) return
  const { manquantes } = await api<{ manquantes: string[] }>('/compte/images/manquantes', { method: 'POST', body: JSON.stringify({ ids: candidates }) })
  const missing = new Set(manquantes)
  for (const id of candidates) {
    if (missing.has(id)) {
      const url = await imageUrl(id)
      if (!url) continue // image absente de cet appareil aussi
      let blob = await (await fetch(url)).blob()
      if (blob.size > 1_800_000) blob = await shrinkImage(blob, 1600)
      await api(`/compte/image/${id}`, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } })
    }
    known.add(id)
  }
  meta.images = [...known]
  write(SYNC_KEY, meta)
}

async function pullImages(local: LocalData) {
  for (const id of imageIds(local)) {
    if (await imageUrl(id)) continue
    try {
      const blob = await api<Blob>(`/compte/image/${id}`)
      await putImage(id, blob)
    } catch {
      /* image pas encore envoyée par l'autre appareil : on réessaiera */
    }
  }
}

// ---------------------------------------------------------------- Synchronisation automatique

let onRemoteChange: (() => void) | undefined
/** Pendant qu'on applique les changements reçus, on ne relance pas d'envoi */
let applying = false
let timer: ReturnType<typeof setTimeout> | undefined

/** Synchronise peu après chaque changement, au retour sur l'application et toutes les deux minutes. */
export function startAutoSync(opts: { onRemoteChange: () => void; subscribe: (cb: () => void) => void }) {
  onRemoteChange = opts.onRemoteChange
  const soon = (delay = 4000) => {
    clearTimeout(timer)
    timer = setTimeout(() => void syncNow(), delay)
  }
  opts.subscribe(() => !applying && soon())
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && soon(300))
  window.addEventListener('online', () => soon(300))
  setInterval(() => document.visibilityState === 'visible' && void syncNow(), 120_000)
  soon(800)
}
