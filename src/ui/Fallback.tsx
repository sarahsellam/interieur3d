// Écrans de secours : navigateur sans 3D, ou erreur inattendue.
// Évite la page blanche et affiche des informations utiles pour le dépannage.
import { Component, type ReactNode } from 'react'

export function hasWebGL2() {
  try {
    const c = document.createElement('canvas')
    return !!c.getContext('webgl2')
  } catch {
    return false
  }
}

export function Problem({ title, detail, onHome }: { title: string; detail?: string; onHome?: () => void }) {
  return (
    <div className="problem">
      <div className="problem-box">
        <h1>{title}</h1>
        <p>Vos projets sont bien enregistrés sur cet appareil. Revenez à l'accueil pour les retrouver, ou rechargez la page.</p>
        <div className="problem-actions">
          {onHome && (
            <button type="button" className="btn primary" onClick={onHome}>
              Revenir à l'accueil
            </button>
          )}
          <button type="button" className="btn secondary" onClick={() => location.reload()}>
            Recharger la page
          </button>
        </div>
        <p>Si le problème continue, mettez à jour votre navigateur ou votre appareil, et envoyez une capture de cet écran.</p>
        <p className="problem-tech">
          {detail ? `${detail} · ` : ''}
          {navigator.userAgent}
        </p>
      </div>
    </div>
  )
}

export class ErrorBoundary extends Component<{ children: ReactNode; onHome?: () => void }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error)
      return (
        <Problem
          title="Un problème est survenu"
          detail={this.state.error.message}
          onHome={() => {
            this.props.onHome?.()
            this.setState({ error: null })
          }}
        />
      )
    return this.props.children
  }
}

/** Si la 3D plante en cours de route, on bascule sur le plan 2D au lieu de bloquer l'éditeur. */
export class SceneBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onFail()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}
