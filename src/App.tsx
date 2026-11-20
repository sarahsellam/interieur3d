import { useMemo } from 'react'
import { Scene } from './three/Scene'
import { ThumbScene } from './three/ThumbScene'
import { preloadCatalog } from './three/Furniture'
import { EditorUI, Loader } from './ui/Editor'
import { Home, Wizard } from './ui/Home'
import { CATALOG } from './data/catalog'
import { SceneBoundary } from './ui/Fallback'
import { Plan2D } from './ui/Plan2D'
import { useStore } from './store'
import { OfflineBadge, UpdateBanner, requestPersistentStorage } from './ui/AppShell'

requestPersistentStorage()

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
  const screenName = useStore((s) => s.screen)
  useMemo(() => {
    if (!thumb) preloadCatalog(CATALOG.map((c) => c.file))
  }, [thumb])
  if (thumb) return <ThumbScene id={thumb} />
  // Mode spécial (?vitrine) : rendu plein écran de la chambre d'exemple, pour l'image de l'accueil
  if (new URLSearchParams(location.search).has('vitrine')) return <Vitrine />
  return (
    <>
      <UpdateBanner />
      <OfflineBadge />
      {screenName === 'accueil' ? <Home /> : screenName === 'assistant' ? <Wizard /> : <EditorScreen quality={quality} />}
    </>
  )
}

function EditorScreen({ quality }: { quality: 'high' | 'low' }) {
  const threeD = useStore((s) => s.threeD)
  const disable3D = useStore((s) => s.disable3D)
  const layout = useStore((s) => s.layout)
  return (
    <div className="app">
      {threeD ? (
        <div className="viewport">
          <SceneBoundary onFail={disable3D}>
            <Scene quality={quality} />
          </SceneBoundary>
        </div>
      ) : (
        <div className="viewport plan2d-wrap">
          <Plan2D layout={layout} interactive className="plan2d" />
        </div>
      )}
      <EditorUI />
      {threeD && <Loader />}
    </div>
  )
}

function Vitrine() {
  useMemo(() => useStore.setState({ view: 'yeux' }), [])
  return (
    <div className="app">
      <div className="viewport">
        <Scene quality="high" />
      </div>
    </div>
  )
}
