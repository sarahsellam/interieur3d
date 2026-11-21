// Enregistrement dans l'appareil.
// - Les projets (pièces, versions, meubles) : localStorage, en texte.
// - Les images (plans, photos, inspirations) : IndexedDB, plus adapté aux fichiers lourds.
// Rien ne quitte l'appareil : les projets sont privés.
import { get, set, del } from 'idb-keyval'
import type { Inspiration, MyFurniture, Project } from './types'
import type { FloorPlan } from './plan'

const PROJECTS_KEY = 'mi3d-projets-v1'
const INSPI_KEY = 'mi3d-inspirations-v1'
const FURNITURE_KEY = 'mi3d-mes-meubles-v1'
const PLANS_KEY = 'mi3d-plans-v1'

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export const loadProjects = () => readJSON<Project[]>(PROJECTS_KEY, [])
export const saveProjects = (p: Project[]) => writeJSON(PROJECTS_KEY, p)
export const loadInspirations = () => readJSON<Inspiration[]>(INSPI_KEY, [])
export const saveInspirations = (i: Inspiration[]) => writeJSON(INSPI_KEY, i)
export const loadMyFurniture = () => readJSON<MyFurniture[]>(FURNITURE_KEY, [])
export const saveMyFurniture = (f: MyFurniture[]) => writeJSON(FURNITURE_KEY, f)
export const loadPlans = () => readJSON<FloorPlan[]>(PLANS_KEY, [])
export const savePlans = (p: FloorPlan[]) => writeJSON(PLANS_KEY, p)

// ---------- Images ----------

const imageKey = (id: string) => `image:${id}`
const urlCache = new Map<string, string>()

export async function putImage(id: string, blob: Blob) {
  await set(imageKey(id), blob)
}

export async function deleteImage(id: string) {
  urlCache.delete(id)
  await del(imageKey(id))
}

/** Adresse locale (blob:) d'une image enregistrée, mise en cache. */
export async function imageUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id)
  if (cached) return cached
  try {
    const blob = await get<Blob>(imageKey(id))
    if (!blob) return null
    const url = URL.createObjectURL(blob)
    urlCache.set(id, url)
    return url
  } catch {
    return null
  }
}

/** Réduit une image à 2000 px maximum (JPEG) pour économiser la place. */
export async function shrinkImage(file: Blob, max = 2000): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.86))
}

/** Convertit la première page d'un PDF en image. */
export async function pdfFirstPage(file: Blob): Promise<Blob> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.js?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const page = await doc.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: Math.min(3, 2200 / Math.max(base.width, base.height)) })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport }).promise
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PDF illisible'))), 'image/jpeg', 0.88))
}

/** Prépare un fichier choisi par l'utilisateur (photo ou PDF) et l'enregistre. Renvoie son identifiant. */
export async function importImageFile(file: File): Promise<string> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  const blob = isPdf ? await pdfFirstPage(file) : await shrinkImage(file)
  const id = Math.random().toString(36).slice(2, 12)
  await putImage(id, blob)
  return id
}

/** Dimensions en pixels d'une image enregistrée. */
export async function imageSize(id: string): Promise<{ width: number; height: number } | null> {
  const url = await imageUrl(id)
  if (!url) return null
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = url
  })
}
