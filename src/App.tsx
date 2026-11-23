import { useEffect, useMemo } from 'react'
import { Scene } from './three/Scene'
import { ThumbScene } from './three/ThumbScene'
import { preloadCatalog } from './three/Furniture'
import { EditorUI, Loader } from './ui/Editor'
import { Home, Wizard } from './ui/Home'
import { CATALOG } from './data/catalog'
import { SceneBoundary } from './ui/Fallback'
import { Plan2D } from './ui/Plan2D'
import { useStore } from './store'
import { usePlanStore } from './planStore'
import { startAutoSync } from './model/account'
import { ShareViewer } from './ui/Share'
import { ApartmentScreen } from './ui/Apartment'
import { shareIdFromHash } from './model/share'
import { OfflineBadge, UpdateBanner, requestPersistentStorage } from './ui/AppShell'

requestPersistentStorage()

// Synchronisation du compte (si la personne est connectée)
startAutoSync({
  onRemoteChange: () => useStore.getState().reloadFromStorage(),
  subscribe: (cb) => {
    useStore.subscribe((s, p) => {
      if (s.projects !== p.projects || s.inspirations !== p.inspirations || s.myFurniture !== p.myFurniture) cb()
    })
    usePlanStore.subscribe((s, p) => s.plans !== p.plans && cb())
  },
})

// Lien de partage (…#partage-xxxxxxxxxx) : on ouvre directement la pièce partagée
const sharedAtStart = shareIdFromHash()
if (sharedAtStart) useStore.getState().openShare(sharedAtStart)

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
  const shareId = useStore((s) => s.shareId)
  useEffect(() => {
    const onHash = () => {
      const id = shareIdFromHash()
      if (id && id !== useStore.getState().shareId) useStore.getState().openShare(id)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useMemo(() => {
    if (!thumb) preloadCatalog(CATALOG.map((c) => c.file))
  }, [thumb])
  if (thumb) return <ThumbScene id={thumb} />
  // Mode spécial (?vitrine) : rendu plein écran de la chambre d'exemple, pour l'image de l'accueil
  if (new URLSearchParams(location.search).has('vitrine')) return <Vitrine />
  // Mode spécial (?video) : tournage de la vidéo de visite (caméra pilotée par le script d'enregistrement)
  if (new URLSearchParams(location.search).has('video')) return <VideoStudio />
  return (
    <>
      <UpdateBanner />
      <OfflineBadge />
      {screenName === 'partage' && shareId ? (
        <SharedScreen key={shareId} id={shareId} quality={quality} />
      ) : screenName === 'appartement' ? (
        <ApartmentScreen quality={quality} />
      ) : screenName === 'accueil' ? (
        <Home />
      ) : screenName === 'assistant' ? (
        <Wizard />
      ) : (
        <EditorScreen quality={quality} />
      )}
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

/** Pièce partagée par quelqu'un, en lecture seule, avec le vote */
function SharedScreen({ id, quality }: { id: string; quality: 'high' | 'low' }) {
  const threeD = useStore((s) => s.threeD)
  const disable3D = useStore((s) => s.disable3D)
  const layout = useStore((s) => s.layout)
  const ready = useStore((s) => !!s.layoutPreview)
  return (
    <div className="app share-app">
      {ready &&
        (threeD ? (
          <div className="viewport">
            <SceneBoundary onFail={disable3D}>
              <Scene quality={quality} />
            </SceneBoundary>
          </div>
        ) : (
          <div className="viewport plan2d-wrap">
            <Plan2D layout={layout} className="plan2d" />
          </div>
        ))}
      <ShareViewer id={id} />
      {ready && threeD && <Loader />}
    </div>
  )
}

function VideoStudio() {
  useMemo(() => {
    useStore.setState({ view: '3d' })
    ;(window as unknown as { __setView: (v: string) => void }).__setView = (v) => useStore.setState({ view: v as '3d' | 'yeux' })
  }, [])
  return (
    <div className="app">
      <div className="viewport">
        <Scene quality="high" video />
      </div>
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
