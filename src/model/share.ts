// Partage d'un projet par lien : envoi au relais, lecture, avis, arrêt du partage.
// Seules les versions choisies sont envoyées (pas les photos de référence ni les inspirations).
import { CUSTOM_PREFIX } from '../data/catalog'
import { RELAIS_URL } from './ai'
import type { Layout, MyFurniture, RoomType } from './types'

export interface SharedContent {
  projet: { name: string; roomType: RoomType }
  question: string
  versions: Layout[]
  meubles: MyFurniture[]
}

export interface SharedAvis {
  version: number | null
  commentaire: string
  prenom: string
  date: number
}

export interface SharedData {
  contenu: SharedContent
  date: number
  votes: number[]
  nbAvis: number
  avis: SharedAvis[]
}

export const shareReady = () => RELAIS_URL.length > 0

/** Adresse publique d'un partage (l'application lit « #partage-… » au démarrage). */
export const shareUrl = (id: string) => `${location.origin}${location.pathname}#partage-${id}`

export const shareIdFromHash = (hash = location.hash) => /^#partage-([a-z0-9]{10})$/.exec(hash)?.[1] ?? null

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!navigator.onLine) throw new Error('Pas de connexion internet pour le moment.')
  let res: Response
  try {
    res = await fetch(RELAIS_URL + path, { ...init, headers: { 'Content-Type': 'application/json' } })
  } catch {
    throw new Error('Le serveur de partage ne répond pas. Réessayez dans un instant.')
  }
  const body = (await res.json().catch(() => ({}))) as T & { erreur?: string }
  if (!res.ok) throw Object.assign(new Error(body.erreur ?? 'Une erreur est survenue.'), { status: res.status })
  return body
}

export function buildContent(p: { name: string; roomType: RoomType }, versions: Layout[], question: string, myFurniture: MyFurniture[]): SharedContent {
  const used = new Set(versions.flatMap((v) => v.items.map((i) => i.modelId)))
  return {
    projet: { name: p.name, roomType: p.roomType },
    question: question.trim().slice(0, 200),
    versions,
    // Les photos de « Mes meubles » restent dans l'appareil : seul le lien vers la photo du site marchand est partagé
    meubles: myFurniture.filter((f) => used.has(CUSTOM_PREFIX + f.id)).map((f) => ({ ...f, imageId: undefined })),
  }
}

export const createShare = (c: SharedContent) => call<{ id: string; cle: string }>('/partage', { method: 'POST', body: JSON.stringify(c) })

export const readShare = (id: string, cle?: string) => call<SharedData>(`/partage/${id}${cle ? `?cle=${encodeURIComponent(cle)}` : ''}`)

export const sendAvis = (id: string, a: { version: number | null; commentaire: string; prenom: string }) =>
  call<{ ok: true }>(`/partage/${id}/avis`, { method: 'POST', body: JSON.stringify(a) })

export const stopShare = (id: string, cle: string) => call<{ ok: true }>(`/partage/${id}?cle=${encodeURIComponent(cle)}`, { method: 'DELETE' })

/** Lettre affichée pour une version (A, B) */
export const versionLetter = (i: number) => String.fromCharCode(65 + i)

/** Avis déjà donné sur cet appareil (pour ne pas voter deux fois par mégarde) */
const AVIS_KEY = (id: string) => `mi3d-avis-${id}`
export function myVote(id: string): { version: number | null } | null {
  try {
    const raw = localStorage.getItem(AVIS_KEY(id))
    return raw ? (JSON.parse(raw) as { version: number | null }) : null
  } catch {
    return null
  }
}
export function rememberVote(id: string, version: number | null) {
  try {
    localStorage.setItem(AVIS_KEY(id), JSON.stringify({ version }))
  } catch {
    /* stockage indisponible */
  }
}
