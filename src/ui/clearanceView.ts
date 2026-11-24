// Ce que l'on montre des passages : tout (bouton « Passages ») ou seulement la zone de l'élément sélectionné.
import { useMemo } from 'react'
import { findGaps, openingZone, openingZones, type Gap, type OpeningZone } from '../model/clearance'
import type { Layout, Selection } from '../model/types'

export function clearanceFor(layout: Layout, passages: boolean, selection: Selection): { gaps: Gap[]; zones: OpeningZone[] } {
  if (passages) return { gaps: findGaps(layout), zones: openingZones(layout) }
  // Sans le bouton « Passages » : la zone d'ouverture de ce qui est sélectionné (tiroirs, porte, placard)
  if (selection?.type === 'item') return { gaps: [], zones: openingZones(layout).filter((z) => z.item?.uid === selection.id) }
  if (selection?.type === 'opening') {
    const o = layout.openings.find((x) => x.id === selection.id)
    const z = o ? openingZone(layout, o) : null
    return { gaps: [], zones: z ? [z] : [] }
  }
  return { gaps: [], zones: [] }
}

export function useClearance(layout: Layout, passages: boolean, selection: Selection) {
  return useMemo(() => clearanceFor(layout, passages, selection), [layout, passages, selection])
}
