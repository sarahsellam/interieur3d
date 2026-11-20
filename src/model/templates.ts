// Points de départ d'un projet : pièce vide, pièce meublée ou exemple à tester.
import { FLOORS } from '../data/finishes'
import { clampOffset } from './geometry'
import type { Layout, Opening, PlacedItem, Room, RoomType, WallSide } from './types'
import { uid } from './types'

export type StartKind = 'vide' | 'meublee' | 'exemple'

const WHITE = '#ece8e1'
const walls = (c: Partial<Record<WallSide, string>> = {}): Record<WallSide, string> => ({ nord: WHITE, est: WHITE, sud: WHITE, ouest: WHITE, ...c })

const item = (modelId: string, x: number, z: number, rot = 0, extra: Partial<PlacedItem> = {}): PlacedItem => ({ uid: uid(), modelId, x, z, rot, ...extra })

const op = (o: Omit<Opening, 'id'>): Opening => ({ id: uid(), ...o })

export function newLayout(room: Room, name = 'Version 1'): Layout {
  return {
    id: uid(),
    name,
    room,
    wallColors: walls(),
    floorId: FLOORS[0].id,
    openings: [],
    items: [],
    updatedAt: Date.now(),
  }
}

/** Ouvertures de base : une fenêtre et une porte, adaptées aux dimensions. */
function basicOpenings(room: Room): Opening[] {
  const win = op({ kind: 'fenetre', wall: 'nord', offset: 0, width: Math.min(1.2, room.width - 0.6), height: 1.35, sill: 0.9 })
  const door = op({ kind: 'porte', wall: 'sud', offset: 0, width: 0.83, height: 2.04, sill: 0, hinge: 'droite', swing: 'interieur' })
  door.offset = clampOffset(room, door, room.width / 2)
  return [win, door]
}

function furnishedBedroom(room: Room): PlacedItem[] {
  const W = room.width / 2
  return [
    item('rug_wool', 0, 0.2, Math.PI / 2),
    item('lit_double', -W + 1.06, 0.1, Math.PI / 2),
    item('chevet', -W + 0.2, 0.1 - 1.1, Math.PI / 2),
    item('chevet', -W + 0.2, 0.1 + 1.1, Math.PI / 2),
    item('commode', W - 0.26, 0.3, -Math.PI / 2),
  ]
}

function furnishedLiving(room: Room): PlacedItem[] {
  return [
    item('rug_wool', 0, 0.3),
    item('sofa_lin', 0, room.depth / 2 - 0.6, Math.PI),
    item('modern_coffee_table_01', 0, 0.3),
    item('modern_wooden_cabinet', 0, -room.depth / 2 + 0.27),
    item('potted_plant_02', -room.width / 2 + 0.4, room.depth / 2 - 0.4, 0.6),
  ]
}

function furnishedOffice(room: Room): PlacedItem[] {
  return [item('bureau', 0, -room.depth / 2 + 0.31), item('dining_chair_02', 0, -room.depth / 2 + 0.75, Math.PI), item('wooden_display_shelves_01', room.width / 2 - 0.19, 0, -Math.PI / 2)]
}

/** Chambre d'exemple (3,60 × 4,00 m) avec un mur rose à tester. */
export function exampleBedroom(): Layout {
  const room: Room = { width: 3.6, depth: 4.0, height: 2.5 }
  const l = newLayout(room)
  l.wallColors = walls({ nord: '#e3c4bd' })
  l.floorId = 'herringbone_parquet'
  l.openings = [
    op({ kind: 'fenetre', wall: 'nord', offset: 0.6, width: 1.2, height: 1.35, sill: 0.9 }),
    op({ kind: 'porte-fenetre', wall: 'est', offset: -0.6, width: 1.4, height: 2.15, sill: 0, swing: 'interieur' }),
    op({ kind: 'porte', wall: 'sud', offset: 0.9, width: 0.83, height: 2.04, sill: 0, hinge: 'droite', swing: 'interieur' }),
    op({ kind: 'placard', wall: 'sud', offset: -0.75, width: 1.6, height: 2.3, sill: 0, depth: 0.6 }),
  ]
  l.items = [
    item('rug_wool', 0.2, 0.1, Math.PI / 2),
    item('lit_double', -0.74, 0.1, Math.PI / 2),
    item('chevet', -1.6, -0.99, Math.PI / 2),
    item('chevet', -1.6, 1.19, Math.PI / 2),
    item('coiffeuse', -0.55, -1.775, 0),
    item('tabouret', -0.55, -1.45, Math.PI),
    item('commode', 1.55, 0.75, -Math.PI / 2),
    item('potted_plant_02', -1.5, -1.68, 0.5),
  ]
  return l
}

export function startLayout(kind: StartKind, roomType: RoomType, room: Room): Layout {
  if (kind === 'exemple') return exampleBedroom()
  const l = newLayout(room)
  l.openings = basicOpenings(room)
  if (kind === 'meublee') {
    l.items = roomType === 'chambre' ? furnishedBedroom(room) : roomType === 'bureau' ? furnishedOffice(room) : furnishedLiving(room)
    if (roomType === 'chambre') l.floorId = 'herringbone_parquet'
  }
  return l
}
