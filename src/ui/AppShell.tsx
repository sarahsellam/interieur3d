// Tout ce qui fait de la page une « vraie » application installée :
// mise à jour proposée, aide à l'installation, hors connexion, sauvegarde dans un fichier.
import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { exportBackup, importBackup, offerFile } from '../model/backup'
import { useStore } from '../store'
import { Icon } from './common'

/** L'application est-elle ouverte depuis l'écran d'accueil (et non dans Safari) ? */
export const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

const isAppleMobile = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)

/** Bandeau « Nouvelle version disponible ». */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Vérifie s'il existe une nouvelle version toutes les heures
      if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
    },
  })
  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setOfflineReady(false), 6000)
    return () => clearTimeout(t)
  }, [offlineReady, setOfflineReady])
  if (needRefresh) {
    return (
      <div className="app-banner" role="status">
        <span>Une nouvelle version de l'application est disponible.</span>
        <button type="button" className="btn primary" onClick={() => (useStore.getState().dirty && useStore.getState().save(), updateServiceWorker(true))}>
          Mettre à jour
        </button>
        <button type="button" className="icon-btn small" onClick={() => setNeedRefresh(false)} aria-label="Plus tard">
          {Icon.close}
        </button>
      </div>
    )
  }
  if (offlineReady) {
    return (
      <div className="app-banner ok" role="status">
        {Icon.check} <span>L'application fonctionne maintenant aussi sans connexion (sauf l'assistant IA).</span>
      </div>
    )
  }
  return null
}

/** Petite pastille quand l'appareil est hors connexion. */
export function OfflineBadge() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => (window.removeEventListener('online', on), window.removeEventListener('offline', off))
  }, [])
  if (online) return null
  return <div className="offline-badge">Hors connexion · vos modifications sont enregistrées sur l'appareil</div>
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

const INSTALL_KEY = 'mi3d-aide-installation-masquee'

/** Explique comment installer l'application (iPad, iPhone) ou propose le bouton du navigateur (Android, ordinateur). */
export function InstallCard() {
  const [hidden, setHidden] = useState(() => {
    try {
      return !!localStorage.getItem(INSTALL_KEY)
    } catch {
      return false
    }
  })
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])
  if (isInstalled() || hidden || (!isAppleMobile() && !prompt)) return null
  const hide = () => {
    setHidden(true)
    try {
      localStorage.setItem(INSTALL_KEY, '1')
    } catch {
      /* stockage indisponible */
    }
  }
  return (
    <section className="install-card">
      <span className="install-icon" aria-hidden>
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" />
      </span>
      <div className="install-text">
        <h2>Installer l'application</h2>
        {prompt ? (
          <p>Ajoutez Mon Intérieur 3D à votre appareil : elle s'ouvrira en plein écran et fonctionnera aussi sans connexion.</p>
        ) : (
          <ol>
            <li>
              Touchez le bouton <strong>Partager</strong> <span className="share-glyph" aria-hidden>{Icon.share}</span> de Safari.
            </li>
            <li>
              Choisissez <strong>« Sur l'écran d'accueil »</strong>, puis <strong>Ajouter</strong>.
            </li>
            <li>Ouvrez ensuite l'application depuis son icône. Pour y retrouver vos projets créés ici, connectez-vous à votre compte (ou utilisez « Sauvegarde » plus bas).</li>
          </ol>
        )}
      </div>
      <div className="install-actions">
        {prompt && (
          <button type="button" className="btn primary" onClick={() => prompt.prompt().then(() => setPrompt(null))}>
            Installer
          </button>
        )}
        <button type="button" className="btn ghost" onClick={hide}>
          Plus tard
        </button>
      </div>
    </section>
  )
}

/** Sauvegarde dans un fichier et restauration. */
export function BackupSection() {
  const reload = useStore((s) => s.reloadFromStorage)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)
  return (
    <section className="home-section backup">
      <div className="section-head">
        <h2>Sauvegarde</h2>
      </div>
      <p className="hint-text">
        Sans compte, vos projets restent sur cet appareil. Enregistrez une copie dans un fichier pour les garder en sécurité ou les retrouver ailleurs, par exemple dans l'application installée sur l'écran
        d'accueil, qui ne partage pas ses données avec Safari.
      </p>
      <div className="choice-row">
        <button
          type="button"
          className="btn secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setMsg(null)
            try {
              const { file, counts } = await exportBackup()
              await offerFile(file)
              setMsg({ tone: 'ok', text: `Sauvegarde prête : ${counts.projects} projet${counts.projects > 1 ? 's' : ''} et ${counts.images} image${counts.images > 1 ? 's' : ''}. Choisissez « Enregistrer dans Fichiers ».` })
            } catch {
              setMsg({ tone: 'warn', text: "La sauvegarde n'a pas pu être créée. Réessayez." })
            }
            setBusy(false)
          }}
        >
          {Icon.download} Enregistrer mes projets dans un fichier
        </button>
        <button type="button" className="btn secondary" disabled={busy} onClick={() => input.current?.click()}>
          {Icon.upload} Importer une sauvegarde
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            setBusy(true)
            setMsg(null)
            try {
              const r = await importBackup(f)
              reload()
              setMsg({ tone: 'ok', text: `${r.projects} projet${r.projects > 1 ? 's' : ''} importé${r.projects > 1 ? 's' : ''}.` })
            } catch (err) {
              setMsg({ tone: 'warn', text: err instanceof Error && err.message.includes('Mon Intérieur') ? err.message : 'Ce fichier est illisible.' })
            }
            setBusy(false)
          }}
        />
      </div>
      {msg && <p className={`notice ${msg.tone}`}>{msg.text}</p>}
    </section>
  )
}

/** Demande au navigateur de ne pas effacer les données de l'application quand l'espace manque. */
export function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {})
}
