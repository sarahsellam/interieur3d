// Vidéo de visite de la chambre exemple (tournée avec le moteur 3D de l'application),
// pour découvrir le rendu même quand la 3D n'est pas disponible sur l'appareil.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './common'

const base = import.meta.env.BASE_URL

export function VisitVideoButton({ className = 'btn ghost large', label = 'Voir la visite en vidéo' }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {Icon.play} {label}
      </button>
      {open &&
        createPortal(
          <div className="modal video-modal" role="dialog" aria-modal="true" aria-label="Visite vidéo de la chambre exemple" onClick={() => setOpen(false)}>
            <div className="video-card" onClick={(e) => e.stopPropagation()}>
              <div className="popover-head">
                <h2>La chambre exemple en visite</h2>
                <button type="button" className="icon-btn small" onClick={() => setOpen(false)} aria-label="Fermer">
                  {Icon.close}
                </button>
              </div>
              <video src={`${base}accueil/visite.mp4`} poster={`${base}accueil/visite.webp`} controls autoPlay muted playsInline preload="metadata" />
              <p className="hint-text">Vue d'ensemble, puis visite à hauteur des yeux : tout est calculé par l'application, comme dans votre propre pièce.</p>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

/** Pourquoi la 3D peut manquer, en clair. */
export function No3DCauses() {
  return (
    <details className="no3d-causes">
      <summary>Pourquoi ?</summary>
      <p>Sur iPad et iPhone, la 3D fonctionne avec Safari à partir d'iOS 15. Elle est coupée par le mode Isolement d'iOS (Réglages › Confidentialité et sécurité), ou quand WebGL est désactivé dans les réglages avancés de Safari. Sur ordinateur, activez l'accélération matérielle du navigateur.</p>
    </details>
  )
}
