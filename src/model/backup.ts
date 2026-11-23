// Sauvegarde dans un fichier : tous les projets, versions, inspirations, « Mes meubles »
// et leurs images. Sert de copie de secours et à passer de Safari à l'application installée
// (sur iPad et iPhone, les deux ne partagent pas leurs données).
import type { Inspiration, MyFurniture, Project } from './types'
import type { FloorPlan } from './plan'
import { imageUrl, loadInspirations, loadMyFurniture, loadPlans, loadProjects, putImage, saveInspirations, saveMyFurniture, savePlans, saveProjects } from './storage'

interface BackupFile {
  application: 'mon-interieur-3d'
  version: 1
  date: string
  projects: Project[]
  inspirations: Inspiration[]
  myFurniture: MyFurniture[]
  /** Plans d'appartement (ajoutés après la première version des sauvegardes) */
  plans?: FloorPlan[]
  /** Images en data URL, par identifiant */
  images: Record<string, string>
}

async function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(b)
  })
}

export async function exportBackup(): Promise<{ file: File; counts: { projects: number; images: number } }> {
  const projects = loadProjects()
  const inspirations = loadInspirations()
  const myFurniture = loadMyFurniture()
  const plans = loadPlans()
  const ids = new Set<string>()
  plans.forEach((p) => p.image && ids.add(p.image.id))
  projects.forEach((p) => p.references.forEach((r) => ids.add(r.id)))
  projects.forEach((p) => p.versions.forEach((v) => (v.decor ?? []).forEach((x) => x.imageId && ids.add(x.imageId))))
  inspirations.forEach((i) => i.imageId && ids.add(i.imageId))
  myFurniture.forEach((f) => f.imageId && ids.add(f.imageId))
  const images: Record<string, string> = {}
  for (const id of ids) {
    const url = await imageUrl(id)
    if (!url) continue
    images[id] = await blobToDataUrl(await (await fetch(url)).blob())
  }
  const data: BackupFile = { application: 'mon-interieur-3d', version: 1, date: new Date().toISOString(), projects, inspirations, myFurniture, plans, images }
  const day = new Date().toISOString().slice(0, 10)
  const file = new File([JSON.stringify(data)], `mon-interieur-3d-${day}.json`, { type: 'application/json' })
  return { file, counts: { projects: projects.length, images: Object.keys(images).length } }
}

/** Propose d'enregistrer le fichier (feuille de partage sur iPad/iPhone, téléchargement ailleurs). */
export async function offerFile(file: File) {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Sauvegarde Mon Intérieur 3D' })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}

const mergeById = <T extends { id: string }>(current: T[], incoming: T[], newer: (a: T, b: T) => boolean) => {
  const map = new Map(current.map((x) => [x.id, x]))
  for (const x of incoming) {
    const cur = map.get(x.id)
    if (!cur || newer(x, cur)) map.set(x.id, x)
  }
  return [...map.values()]
}

/** Ajoute le contenu d'une sauvegarde (les éléments plus récents remplacent les anciens). */
export async function importBackup(file: File): Promise<{ projects: number }> {
  const data = JSON.parse(await file.text()) as BackupFile
  if (data.application !== 'mon-interieur-3d') throw new Error("Ce fichier n'est pas une sauvegarde de Mon Intérieur 3D.")
  for (const [id, dataUrl] of Object.entries(data.images ?? {})) {
    await putImage(id, await (await fetch(dataUrl)).blob())
  }
  saveProjects(mergeById(loadProjects(), data.projects ?? [], (a, b) => a.updatedAt > b.updatedAt))
  saveInspirations(mergeById(loadInspirations(), data.inspirations ?? [], () => false))
  saveMyFurniture(mergeById(loadMyFurniture(), data.myFurniture ?? [], (a, b) => a.createdAt > b.createdAt))
  savePlans(mergeById(loadPlans(), data.plans ?? [], (a, b) => a.updatedAt > b.updatedAt))
  return { projects: (data.projects ?? []).length }
}
