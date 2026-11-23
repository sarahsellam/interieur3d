// « Mon compte » sur l'accueil : créer un compte avec Face ID / Touch ID, se connecter sur un autre appareil,
// code de secours, synchronisation, déconnexion, suppression.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  accountsAvailable,
  addPasskey,
  createAccount,
  deleteAccount,
  newRecoveryCode,
  signIn,
  signInWithRecovery,
  signOut,
  syncNow,
  useAccount,
} from '../model/account'
import { Icon } from './common'

const time = (t: number) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

/** Code de secours, montré une seule fois. */
function RecoveryModal() {
  const code = useAccount((s) => s.recovery)
  const setRecovery = useAccount((s) => s.setRecovery)
  const [copied, setCopied] = useState(false)
  if (!code) return null
  const group = (t: string) => (t.toUpperCase().match(/.{1,4}/g) ?? []).join(' ')
  const [u, secret] = code.split('-')
  const pretty = `${group(u)} – ${group(secret ?? '')}`
  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" aria-label="Code de secours">
      <div className="modal-card">
        <h2>Votre code de secours</h2>
        <p className="hint-text">
          Gardez-le précieusement (dans vos notes ou une photo). Il permet de retrouver votre compte si vous perdez tous vos appareils. Il ne sera plus affiché.
        </p>
        <p className="recovery-code" aria-label="Code de secours">
          {pretty}
        </p>
        <div className="modal-foot">
          <button
            type="button"
            className={`btn ${copied ? 'saved' : 'secondary'}`}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code)
                setCopied(true)
              } catch {
                /* copie impossible : le code reste affiché */
              }
            }}
          >
            {copied ? <>{Icon.check} Copié</> : <>{Icon.copy} Copier</>}
          </button>
          <button type="button" className="btn primary" onClick={() => setRecovery(null)}>
            J'ai gardé mon code
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function SignedOut() {
  const [mode, setMode] = useState<'choix' | 'creer' | 'secours'>('choix')
  const [nom, setNom] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }
  return (
    <div className="account-body">
      <div className="account-text">
        <h2>Vos projets sur tous vos appareils</h2>
        <p className="hint-text">
          Créez un compte gratuit, sans mot de passe : Face ID ou Touch ID suffit. Vos pièces, plans et inspirations se retrouvent sur votre iPad, votre iPhone et votre ordinateur, et restent privés.
        </p>
      </div>
      {mode === 'choix' && (
        <div className="account-actions">
          <button type="button" className="btn primary" onClick={() => setMode('creer')}>
            Créer mon compte
          </button>
          <button type="button" className="btn secondary" disabled={busy} onClick={() => run(signIn)}>
            {busy ? 'Connexion…' : "J'ai déjà un compte"}
          </button>
          <button type="button" className="link-btn" onClick={() => setMode('secours')}>
            Utiliser mon code de secours
          </button>
        </div>
      )}
      {mode === 'creer' && (
        <form
          className="account-form"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => createAccount(nom))
          }}
        >
          <label className="field">
            <span>Votre prénom (il s'affiche seulement pour vous)</span>
            <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="given-name" maxLength={40} autoFocus />
          </label>
          <div className="account-actions">
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'Création…' : 'Créer avec Face ID ou Touch ID'}
            </button>
            <button type="button" className="btn ghost" onClick={() => setMode('choix')}>
              Annuler
            </button>
          </div>
        </form>
      )}
      {mode === 'secours' && (
        <form
          className="account-form"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => signInWithRecovery(code))
          }}
        >
          <label className="field">
            <span>Code de secours</span>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="off" autoComplete="off" spellCheck={false} autoFocus />
          </label>
          <div className="account-actions">
            <button type="submit" className="btn primary" disabled={busy || !code.trim()}>
              {busy ? 'Vérification…' : 'Retrouver mon compte'}
            </button>
            <button type="button" className="btn ghost" onClick={() => setMode('choix')}>
              Annuler
            </button>
          </div>
        </form>
      )}
      {error && error !== 'Opération annulée.' && <p className="form-error">{error}</p>}
    </div>
  )
}

function SignedIn() {
  const account = useAccount((s) => s.account)!
  const status = useAccount((s) => s.status)
  const lastSync = useAccount((s) => s.lastSync)
  const syncError = useAccount((s) => s.error)
  const [menu, setMenu] = useState(false)
  const [confirm, setConfirm] = useState<'deconnexion' | 'suppression' | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true)
    setMsg('')
    try {
      await fn()
      if (ok) setMsg(ok)
    } catch (e) {
      const m = (e as Error).message
      if (m !== 'Opération annulée.') setMsg(m)
    }
    setBusy(false)
    setMenu(false)
  }
  const state =
    status === 'sync'
      ? 'Synchronisation…'
      : status === 'horsligne'
        ? 'Hors connexion : vos changements partiront au retour du réseau'
        : status === 'erreur'
          ? syncError || 'La synchronisation a échoué'
          : lastSync
            ? `Synchronisé à ${time(lastSync)}`
            : 'Synchronisation prête'
  return (
    <div className="account-body">
      <div className="account-text">
        <h2>Bonjour {account.nom}</h2>
        <p className={`account-state ${status}`}>
          <span className="dot" aria-hidden /> {state}
        </p>
        <p className="hint-text">Vos projets, plans et inspirations sont enregistrés dans votre compte et apparaissent sur tous vos appareils connectés.</p>
      </div>
      <div className="account-actions">
        <button type="button" className="btn secondary" disabled={status === 'sync'} onClick={() => void syncNow()}>
          Synchroniser maintenant
        </button>
        <div className="more">
          <button type="button" className="icon-btn small" onClick={() => setMenu(!menu)} aria-label="Réglages du compte" aria-expanded={menu}>
            {Icon.more}
          </button>
          {menu && (
            <div className="more-menu" role="menu">
              <button type="button" role="menuitem" disabled={busy} onClick={() => run(addPasskey, 'Clé d’accès ajoutée : cet appareil peut maintenant se connecter avec Face ID ou Touch ID.')}>
                {Icon.lock} Ajouter Face ID sur cet appareil
              </button>
              <button type="button" role="menuitem" disabled={busy} onClick={() => run(newRecoveryCode)}>
                {Icon.swap} Nouveau code de secours
              </button>
              <button type="button" role="menuitem" onClick={() => (setConfirm('deconnexion'), setMenu(false))}>
                {Icon.close} Se déconnecter
              </button>
              <button type="button" role="menuitem" className="danger" onClick={() => (setConfirm('suppression'), setMenu(false))}>
                {Icon.trash} Supprimer mon compte
              </button>
            </div>
          )}
        </div>
      </div>
      {confirm === 'deconnexion' && (
        <div className="confirm-inline">
          <span>Vos projets restent sur cet appareil, mais ne seront plus synchronisés.</span>
          <button type="button" className="chip" onClick={() => run(signOut).then(() => setConfirm(null))}>
            Se déconnecter
          </button>
          <button type="button" className="chip ghost" onClick={() => setConfirm(null)}>
            Annuler
          </button>
        </div>
      )}
      {confirm === 'suppression' && (
        <div className="confirm-inline">
          <span>Tout ce qui est enregistré dans votre compte sera effacé. Les projets de cet appareil restent ici.</span>
          <button type="button" className="chip danger" onClick={() => run(deleteAccount).then(() => setConfirm(null))}>
            Supprimer définitivement
          </button>
          <button type="button" className="chip ghost" onClick={() => setConfirm(null)}>
            Annuler
          </button>
        </div>
      )}
      {msg && <p className="hint-text account-msg">{msg}</p>}
    </div>
  )
}

export function AccountCard() {
  const account = useAccount((s) => s.account)
  const [supported] = useState(accountsAvailable)
  useEffect(() => {
    if (account) void syncNow()
  }, [account])
  if (!supported) return null
  return (
    <section className="account-card" aria-label="Mon compte">
      <span className="account-icon" aria-hidden>
        {Icon.lock}
      </span>
      {account ? <SignedIn /> : <SignedOut />}
      <RecoveryModal />
    </section>
  )
}
