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

export function Problem({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="problem">
      <div className="problem-box">
        <h1>{title}</h1>
        <p>
          Mettez à jour votre appareil (Réglages, Général, Mise à jour logicielle), puis rouvrez cette page dans Safari.
          Si le problème continue, faites une capture de cet écran et envoyez-la.
        </p>
        <p className="problem-tech">
          {detail ? `${detail} · ` : ''}
          {navigator.userAgent}
        </p>
      </div>
    </div>
  )
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) return <Problem title="L'application n'a pas pu démarrer" detail={this.state.error.message} />
    return this.props.children
  }
}
