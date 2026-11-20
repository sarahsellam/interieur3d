import { useMemo } from 'react'
import { Scene } from './three/Scene'
import { ThumbScene } from './three/ThumbScene'
import { preloadCatalog } from './three/Furniture'
import { SidePanel } from './ui/Panels'
import { Hint, Loader, SelectionBar, TopBar, VisitHint } from './ui/Overlay'
import { CATALOG } from './data/catalog'
import { Problem, hasWebGL2 } from './ui/Fallback'

/** Qualité graphique : réduite sur les petits téléphones pour rester fluide. */
function detectQuality(): 'high' | 'low' {
  const p = new URLSearchParams(location.search).get('qualite')
  if (p === 'haute') return 'high'
  if (p === 'basse') return 'low'
  const small = Math.min(screen.width, screen.height) < 500
  return small ? 'low' : 'high'
}

export default function App() {
  const thumb = new URLSearchParams(location.search).get('thumb')
  const quality = useMemo(detectQuality, [])
  useMemo(() => { if (!thumb) preloadCatalog(CATALOG.map((c) => c.file)) }, [thumb])
  if (thumb) return <ThumbScene id={thumb} />
  if (!hasWebGL2()) return <Problem title="Ce navigateur ne peut pas afficher la 3D" detail="WebGL 2 indisponible" />
  return (
    <div className="app">
      <div className="viewport">
        <Scene quality={quality} />
      </div>
      <TopBar />
      <SidePanel />
      <SelectionBar />
      <Hint />
      <VisitHint />
      <Loader />
    </div>
  )
}
