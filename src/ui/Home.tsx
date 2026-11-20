// Accueil : créer un espace, retrouver ses projets récents, ses inspirations.
// Assistant de création en trois étapes : Mon espace → Mes inspirations → Mon aménagement.
import { useState } from 'react'
import { useStore, ROOM_LIMITS } from '../store'
import type { RefImage, RoomType } from '../model/types'
import { ROOM_TYPE_LABEL } from '../model/types'
import type { StartKind } from '../model/templates'
import { deleteImage } from '../model/storage'
import { Icon, MeasureField } from './common'
import { InspirationBoard, ReferenceList } from './Inspirations'
import { BackupSection, InstallCard } from './AppShell'

const dateFr = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

export function Home() {
  const projects = useStore((s) => s.projects)
  const inspirations = useStore((s) => s.inspirations)
  const startWizard = useStore((s) => s.startWizard)
  const openProject = useStore((s) => s.openProject)
  const deleteProject = useStore((s) => s.deleteProject)
  const createProject = useStore((s) => s.createProject)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [showInspi, setShowInspi] = useState(false)

  return (
    <div className="home">
      <header className="home-head">
        <div className="brand">
          <span className="logo" aria-hidden>
            {Icon.home}
          </span>
          <span className="brand-name">Mon Intérieur 3D</span>
        </div>
      </header>

      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">Aménagement d'intérieur</p>
          <h1>Recréez votre pièce, essayez, gardez l'aménagement que vous préférez.</h1>
          <p className="lead">Saisissez vos dimensions, placez vos fenêtres et vos meubles, comparez plusieurs versions. Vos projets restent privés, sur cet appareil.</p>
          <div className="hero-actions">
            <button type="button" className="btn primary large" onClick={startWizard}>
              Créer mon espace
            </button>
            <button
              type="button"
              className="btn secondary large"
              onClick={() => createProject({ name: 'Chambre exemple', roomType: 'chambre', start: 'exemple', room: { width: 3.6, depth: 4, height: 2.5 }, references: [] })}
            >
              Essayer l'exemple
            </button>
          </div>
        </div>
      </section>

      <InstallCard />

      <section className="home-section">
        <div className="section-head">
          <h2>Projets récents</h2>
        </div>
        {projects.length === 0 ? (
          <p className="empty">Aucun projet pour l'instant. Touchez « Créer mon espace » pour commencer par votre chambre.</p>
        ) : (
          <div className="project-grid">
            {[...projects]
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((p) => {
                const v = p.versions.find((x) => x.id === p.activeVersionId) ?? p.versions[0]
                return (
                  <article key={p.id} className="project-card">
                    <button type="button" className="project-open" onClick={() => openProject(p.id)}>
                      {v?.thumb ? <img src={v.thumb} alt="" /> : <div className="img-placeholder" />}
                      <span className="project-name">{p.name}</span>
                      <span className="project-meta">
                        {ROOM_TYPE_LABEL[p.roomType]} · {p.versions.length} version{p.versions.length > 1 ? 's' : ''} · {dateFr(p.updatedAt)}
                      </span>
                    </button>
                    {confirmId === p.id ? (
                      <div className="confirm-inline">
                        <span>Supprimer ce projet ?</span>
                        <button
                          type="button"
                          className="chip danger"
                          onClick={() => {
                            deleteProject(p.id)
                            setConfirmId(null)
                          }}
                        >
                          Supprimer
                        </button>
                        <button type="button" className="chip" onClick={() => setConfirmId(null)}>
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="icon-btn small project-del" onClick={() => setConfirmId(p.id)} aria-label={`Supprimer ${p.name}`}>
                        {Icon.trash}
                      </button>
                    )}
                  </article>
                )
              })}
          </div>
        )}
      </section>

      <section className="home-section">
        <div className="section-head">
          <h2>Mes inspirations</h2>
          <button type="button" className="btn ghost" onClick={() => setShowInspi((v) => !v)}>
            {showInspi ? 'Fermer' : inspirations.length ? `Voir les ${inspirations.length}` : 'Ajouter'}
          </button>
        </div>
        {showInspi ? <InspirationBoard /> : inspirations.length === 0 && <p className="empty">Gardez ici les photos et les liens qui vous inspirent.</p>}
      </section>

      <BackupSection />
    </div>
  )
}

const STARTS: { id: StartKind; title: string; text: string }[] = [
  { id: 'vide', title: 'Pièce vide', text: 'Les murs, une fenêtre et une porte. Vous placez tout.' },
  { id: 'meublee', title: 'Pièce meublée', text: 'Quelques meubles de base, déjà en place.' },
  { id: 'exemple', title: 'Exemple à tester', text: 'Une chambre complète de 3,60 × 4,00 m avec un mur rose.' },
]

export function Wizard() {
  const goHome = useStore((s) => s.goHome)
  const createProject = useStore((s) => s.createProject)
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('Ma chambre')
  const [roomType, setRoomType] = useState<RoomType>('chambre')
  const [start, setStart] = useState<StartKind>('vide')
  const [room, setRoom] = useState({ width: 3.6, depth: 4, height: 2.5 })
  const [refs, setRefs] = useState<RefImage[]>([])

  const finish = () => createProject({ name, roomType, start, room, references: refs })

  return (
    <div className="wizard">
      <header className="wizard-head">
        <button type="button" className="btn ghost" onClick={goHome}>
          Annuler
        </button>
        <ol className="steps" aria-label="Étapes">
          <li className={step === 1 ? 'current' : 'done'}>
            <span>1</span> Mon espace
          </li>
          <li className={step === 2 ? 'current' : ''}>
            <span>2</span> Mes inspirations
          </li>
          <li>
            <span>3</span> Mon aménagement
          </li>
        </ol>
        <span className="wizard-spacer" />
      </header>

      {step === 1 ? (
        <main className="wizard-body">
          <h1>Mon espace</h1>
          <section className="form-block">
            <label className="field">
              <span>Nom du projet</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="field">
              <span>Type de pièce</span>
              <div className="choice-row">
                {(Object.keys(ROOM_TYPE_LABEL) as RoomType[]).map((t) => (
                  <button key={t} type="button" className={`chip big ${roomType === t ? 'selected' : ''}`} onClick={() => setRoomType(t)}>
                    {ROOM_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="form-block">
            <h2>Pour commencer</h2>
            <div className="start-grid">
              {STARTS.map((s) => (
                <button key={s.id} type="button" className={`start-card ${start === s.id ? 'selected' : ''}`} onClick={() => setStart(s.id)}>
                  <strong>{s.title}</strong>
                  <span>{s.text}</span>
                </button>
              ))}
            </div>
          </section>

          {start !== 'exemple' && (
            <section className="form-block">
              <h2>Dimensions intérieures</h2>
              <p className="hint-text">Mesurez de mur à mur. Vous pourrez tout ajuster ensuite.</p>
              <div className="dims-row">
                <MeasureField label="Largeur" value={room.width} min={ROOM_LIMITS.min} max={ROOM_LIMITS.max} onChange={(width) => setRoom({ ...room, width })} />
                <MeasureField label="Longueur" value={room.depth} min={ROOM_LIMITS.min} max={ROOM_LIMITS.max} onChange={(depth) => setRoom({ ...room, depth })} />
                <MeasureField label="Hauteur" value={room.height} min={ROOM_LIMITS.minHeight} max={ROOM_LIMITS.maxHeight} onChange={(height) => setRoom({ ...room, height })} />
              </div>
            </section>
          )}

          <section className="form-block">
            <h2>Plan et photos de la pièce</h2>
            <p className="hint-text">Facultatif. Ils restent visibles comme références pendant que vous construisez la pièce.</p>
            <ReferenceList
              refs={refs}
              onAdd={(r) => setRefs([...refs, ...r])}
              onRemove={(id) => {
                deleteImage(id)
                setRefs(refs.filter((x) => x.id !== id))
              }}
            />
          </section>

          <footer className="wizard-foot">
            <button type="button" className="btn primary large" onClick={() => setStep(2)}>
              Continuer
            </button>
          </footer>
        </main>
      ) : (
        <main className="wizard-body">
          <h1>Mes inspirations</h1>
          <p className="lead">Ajoutez des photos ou des liens, et notez ce que vous aimez. Vous pourrez en garder une visible à côté de votre pièce.</p>
          <InspirationBoard />
          <footer className="wizard-foot">
            <button type="button" className="btn ghost" onClick={() => setStep(1)}>
              Retour
            </button>
            <button type="button" className="btn primary large" onClick={finish}>
              Passer à mon aménagement
            </button>
          </footer>
        </main>
      )}
    </div>
  )
}
