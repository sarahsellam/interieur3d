// Structure des données d'un projet.
// Un projet (« Ma chambre ») contient une ou plusieurs versions d'aménagement
// que l'on peut comparer. Tout est enregistré dans le navigateur de l'appareil.

export type WallSide = 'nord' | 'est' | 'sud' | 'ouest'

/** Ordre de lecture des murs (dans le sens des aiguilles d'une montre vu du dessus). */
export const WALL_ORDER: WallSide[] = ['nord', 'est', 'sud', 'ouest']

/** Nom affiché pour chaque mur (les points cardinaux ne parlent à personne). */
export const WALL_LABEL: Record<WallSide, string> = {
  nord: 'Mur 1',
  est: 'Mur 2',
  sud: 'Mur 3',
  ouest: 'Mur 4',
}

export interface Room {
  /** Largeur intérieure (axe x), en mètres */
  width: number
  /** Longueur intérieure (axe z), en mètres */
  depth: number
  /** Hauteur sous plafond, en mètres */
  height: number
}

export type OpeningKind = 'fenetre' | 'porte-fenetre' | 'porte' | 'placard' | 'niche'

export const OPENING_LABEL: Record<OpeningKind, string> = {
  fenetre: 'Fenêtre',
  'porte-fenetre': 'Porte-fenêtre',
  porte: 'Porte',
  placard: 'Placard intégré',
  niche: 'Niche',
}

/** Élément posé sur un mur : fenêtre, porte, porte-fenêtre, placard intégré ou niche. */
export interface Opening {
  id: string
  kind: OpeningKind
  wall: WallSide
  /** Position du centre le long du mur, depuis le milieu du mur (m) */
  offset: number
  width: number
  height: number
  /** Hauteur du bas de l'ouverture au-dessus du sol (allège) */
  sill: number
  /** Profondeur : vers la pièce pour un placard, dans le mur pour une niche */
  depth?: number
  /** Côté des charnières, vu depuis la pièce */
  hinge?: 'gauche' | 'droite'
  /** Sens d'ouverture d'une porte */
  swing?: 'interieur' | 'exterieur'
}

export interface ItemDims {
  width: number
  depth: number
  height: number
}

export interface PlacedItem {
  uid: string
  modelId: string
  x: number
  z: number
  /** Rotation autour de l'axe vertical, en radians */
  rot: number
  /** Couleur choisie (null ou absent : couleur d'origine) */
  color?: string | null
  /** Dimensions personnalisées (absent : dimensions du catalogue) */
  dims?: ItemDims
  /** Verrouillé : ne peut plus être déplacé par erreur */
  locked?: boolean
  /** Déjà possédé ou à acheter (absent : déjà possédé) */
  status?: ItemStatus
  /** Prix saisi pour cet exemplaire (sinon celui de la fiche « Mes meubles ») */
  price?: number | null
}

export type ItemStatus = 'possede' | 'a-acheter'

/** Meuble ajouté par l'utilisateur (trouvé sur Internet ou déjà chez soi). */
export interface MyFurniture {
  id: string
  name: string
  category: 'lit' | 'assise' | 'table' | 'rangement' | 'deco'
  width: number
  depth: number
  height: number
  price?: number | null
  vendor?: string
  link?: string
  /** Photo enregistrée dans l'appareil */
  imageId?: string
  /** Photo distante (adresse trouvée sur la page du produit) */
  imageUrl?: string
  color: string
  /** Déjà possédé : placé comme « Déjà possédé » plutôt que « À acheter » */
  owned?: boolean
  createdAt: number
}

/** Une version d'aménagement : la pièce et tout ce qu'elle contient. */
export interface Layout {
  id: string
  name: string
  room: Room
  wallColors: Record<WallSide, string>
  floorId: string
  openings: Opening[]
  items: PlacedItem[]
  updatedAt: number
  /** Petite image de la vue 3D (JPEG en data URL) */
  thumb?: string
}

export type RoomType = 'chambre' | 'salon' | 'bureau' | 'cuisine' | 'salle-de-bain'

export const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  chambre: 'Chambre',
  salon: 'Salon',
  bureau: 'Bureau',
  cuisine: 'Cuisine',
  'salle-de-bain': 'Salle de bain',
}

/** Image de référence de la pièce (plan importé ou photo), stockée dans l'appareil. */
export interface RefImage {
  id: string
  kind: 'plan' | 'photo'
  name: string
}

export interface Project {
  id: string
  name: string
  roomType: RoomType
  createdAt: number
  updatedAt: number
  versions: Layout[]
  activeVersionId: string
  references: RefImage[]
  /** Liens de partage créés pour ce projet (la clé permet de lire les avis et d'arrêter le partage) */
  shares?: ShareRef[]
}

/** Un lien de partage envoyé à des proches */
export interface ShareRef {
  id: string
  cle: string
  createdAt: number
  question: string
  versionNames: string[]
}

/** Une inspiration : photo et/ou lien, avec ce qu'on aime dedans. */
export interface Inspiration {
  id: string
  imageId?: string
  link?: string
  note: string
  createdAt: number
  /** Couleurs principales de la photo (calculées une fois) */
  palette?: string[]
}

export type ViewMode = 'plan' | '3d' | 'yeux'

export const VIEW_LABEL: Record<ViewMode, string> = {
  plan: 'Plan',
  '3d': 'Vue 3D',
  yeux: 'À hauteur des yeux',
}

export type Selection = { type: 'item'; id: string } | { type: 'wall'; id: WallSide } | { type: 'opening'; id: string } | null

export const uid = () => Math.random().toString(36).slice(2, 10)
