// Projets partagés par lien, avec avis et vote entre deux versions.
// Chaque partage est un petit « Durable Object » (stockage SQLite de Cloudflare, offre gratuite) :
// il garde le contenu partagé, la liste des avis, et la clé secrète du propriétaire.
import { DurableObject } from 'cloudflare:workers'

export interface Avis {
  /** Index de la version préférée (0 = A, 1 = B), ou null s'il n'y a qu'une version */
  version: number | null
  commentaire: string
  prenom: string
  date: number
}

export interface PartageStocke {
  cle: string
  date: number
  /** Contenu envoyé par l'application (projet, versions, meubles personnels, question), en JSON */
  contenu: string
  nbVersions: number
}

const MAX_AVIS = 300

export class Partages extends DurableObject {
  async creer(p: PartageStocke) {
    await this.ctx.storage.put('partage', p)
    await this.ctx.storage.put('avis', [] as Avis[])
  }

  async lire(): Promise<{ partage: PartageStocke; avis: Avis[] } | null> {
    const partage = await this.ctx.storage.get<PartageStocke>('partage')
    if (!partage) return null
    return { partage, avis: (await this.ctx.storage.get<Avis[]>('avis')) ?? [] }
  }

  async ajouterAvis(a: Avis): Promise<'ok' | 'introuvable' | 'complet' | 'invalide'> {
    const partage = await this.ctx.storage.get<PartageStocke>('partage')
    if (!partage) return 'introuvable'
    if (a.version !== null && (a.version < 0 || a.version >= partage.nbVersions)) return 'invalide'
    const avis = (await this.ctx.storage.get<Avis[]>('avis')) ?? []
    if (avis.length >= MAX_AVIS) return 'complet'
    avis.push(a)
    await this.ctx.storage.put('avis', avis)
    return 'ok'
  }

  async supprimer(cle: string): Promise<boolean> {
    const partage = await this.ctx.storage.get<PartageStocke>('partage')
    if (!partage || partage.cle !== cle) return false
    await this.ctx.storage.deleteAll()
    return true
  }
}
