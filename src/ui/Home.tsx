// Accueil : créer un espace, retrouver ses projets récents, ses inspirations.
// Assistant de création en trois étapes : Mon espace → Mes inspirations → Mon aménagement.
import { useEffect, useState } from 'react'
import { useStore, ROOM_LIMITS } from '../store'
import type { RefImage, RoomType } from '../model/types'
import { ROOM_TYPE_LABEL } from '../model/types'
import type { StartKind } from '../model/templates'
import { deleteImage } from '../model/storage'
import { aiReady } from '../model/ai'
import { Icon, MeasureField } from './common'
import { InspirationBoard, ReferenceList } from './Inspirations'
import { BackupSection, InstallCard } from './AppShell'
import { AccountCard } from './Account'
import { ExportPanel } from './Export'
import { PrivacyPage } from './Privacy'
import { useGuide } from './Guide'
import { No3DCauses, VisitVideoButton } from './VisitVideo'
import { Plan2D } from './Plan2D'
import { PlanThumb } from './PlanDrawing'
import { usePlanStore } from '../planStore'
import { findFaces } from '../model/plan'
import { ImportButton } from './common'

const dateFr = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

export function Home() {
  const projects = useStore((s) => s.projects)
  const inspirations = useStore((s) => s.inspirations)
  const startWizard = useStore((s) => s.startWizard)
  const openProject = useStore((s) => s.openProject)
  const deleteProject = useStore((s) => s.deleteProject)
  const createProject = useStore((s) => s.createProject)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [showInspi, setShowInspi] = useState(false)
  const [pdfFor, setPdfFor] = useState<string | null>(null)
  const [privacy, setPrivacy] = useState(false)
  const pdfProject = projects.find((x) => x.id === pdfFor)
  const threeD = useStore((s) => s.threeD)
  // Retour à l'accueil : le guide de prise en main s'arrête
  useEffect(() => useGuide.getState().go(null), [])

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
          <h1>Aménagez votre pièce en 3D</h1>
          <p className="lead">Saisissez vos dimensions, placez fenêtres et meubles, comparez plusieurs versions et gardez celle que vous préférez. Vos projets restent privés ; avec un compte, vous les retrouvez sur tous vos appareils.</p>
          <div className="hero-actions">
            <button type="button" className="btn primary large" onClick={startWizard}>
              Créer mon espace
            </button>
            <button
              type="button"
              className="btn secondary large"
              onClick={() => {
                createProject({ name: 'Chambre exemple', roomType: 'chambre', start: 'exemple', room: { width: 3.6, depth: 4, height: 2.5 }, references: [] })
                // Guide de prise en main en trois actions (facultatif)
                useGuide.getState().start()
              }}
            >
              Essayer l'exemple
            </button>
            <VisitVideoButton />
          </div>
          {!threeD && (
            <div className="hint-text hero-note">
              Sur ce navigateur, la 3D n'est pas disponible : vous travaillerez sur le plan, qui reste entièrement utilisable, et la visite en vidéo montre le rendu 3D.
              <No3DCauses />
            </div>
          )}
        </div>
        <figure className="hero-visual">
          <img
            src={`${import.meta.env.BASE_URL}accueil/chambre-exemple.webp`}
            srcSet={`${import.meta.env.BASE_URL}accueil/chambre-exemple-720.webp 720w, ${import.meta.env.BASE_URL}accueil/chambre-exemple.webp 1440w`}
            sizes="(max-width: 860px) 100vw, 50vw"
            alt="La chambre d'exemple vue à hauteur des yeux : mur rose poudré, coiffeuse, fenêtre et porte-fenêtre"
          />
          <figcaption>La chambre d'exemple, à hauteur des yeux</figcaption>
        </figure>
      </section>

      <AccountCard />
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
                    <button type="button" className="project-thumb" onClick={() => openProject(p.id)} aria-label={`Reprendre ${p.name}`}>
                      {v?.thumb ? <img src={v.thumb} alt="" /> : v ? <Plan2D layout={v} className="project-plan" /> : <div className="img-placeholder" />}
                    </button>
                    <div className="project-body">
                      <span className="project-name">{p.name}</span>
                      <span className="project-meta">
                        {ROOM_TYPE_LABEL[p.roomType]} · {p.versions.length} version{p.versions.length > 1 ? 's' : ''} · {dateFr(p.updatedAt)}
                      </span>
                      {confirmId === p.id ? (
                        <div className="confirm-inline">
                          <span>Supprimer ce projet ?</span>
                          <button
                            type="button"
                            className="chip danger"
                            onClick={() => {
                              deleteProject(p.id)
                              setConfirmId(null)
                              setMenuId(null)
                            }}
                          >
                            Supprimer
                          </button>
                          <button type="button" className="chip" onClick={() => (setConfirmId(null), setMenuId(null))}>
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <div className="project-actions">
                          <button type="button" className="btn primary" onClick={() => openProject(p.id)}>
                            Reprendre
                          </button>
                          <div className="more">
                            <button type="button" className="icon-btn small" onClick={() => setMenuId(menuId === p.id ? null : p.id)} aria-label={`Autres actions pour ${p.name}`} aria-expanded={menuId === p.id}>
                              {Icon.more}
                            </button>
                            {menuId === p.id && (
                              <div className="more-menu" role="menu">
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setMenuId(null)
                                    openProject(p.id)
                                    useStore.getState().setShareOpen(true)
                                  }}
                                >
                                  {Icon.share} Partager pour avoir un avis
                                </button>
                                <button type="button" role="menuitem" onClick={() => (setMenuId(null), setPdfFor(p.id))}>
                                  {Icon.download} Plan PDF avec les cotes
                                </button>
                                <button type="button" role="menuitem" className="danger" onClick={() => setConfirmId(p.id)}>
                                  {Icon.trash} Supprimer le projet
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
          </div>
        )}
      </section>

      <ApartmentPlans />

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
      {pdfProject && (
        <ExportPanel
          onClose={() => setPdfFor(null)}
          name={pdfProject.name}
          layout={pdfProject.versions.find((v) => v.id === pdfProject.activeVersionId) ?? pdfProject.versions[0]}
        />
      )}
      <footer className="home-foot">
        <button type="button" className="link-btn" onClick={() => setPrivacy(true)}>
          Confidentialité et données
        </button>
        <a className="link-btn" href={`${location.pathname}?diagnostic`}>
          Tester la 3D sur cet appareil
        </a>
        <span className="muted">Mon Intérieur 3D · modèles 3D Poly Haven (CC0)</span>
      </footer>
      {privacy && <PrivacyPage onClose={() => setPrivacy(false)} />}
    </div>
  )
}

/** Plans d'appartement : importer un plan (photo ou PDF), le tracer, le visiter en 3D. */
function ApartmentPlans() {
  const plans = usePlanStore((s) => s.plans)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const open = (id: string) => {
    usePlanStore.getState().openPlan(id)
    useStore.setState({ screen: 'appartement' })
  }
  const create = async (imageId?: string) => {
    await usePlanStore.getState().createPlan('Mon appartement', imageId)
    useStore.setState({ screen: 'appartement' })
  }
  return (
    <section className="home-section">
      <div className="section-head">
        <h2>Plans d'appartement</h2>
      </div>
      <div className="plan-intro">
        <p className="hint-text">
          Importez le plan de votre logement (photo ou PDF), réglez l'échelle, tracez les murs du bout du doigt, placez portes et fenêtres, nommez les pièces. Puis visitez tout l'appartement en 3D et aménagez chaque pièce.
        </p>
        <div className="hero-actions">
          <ImportButton label={<>{Icon.plan} Importer un plan</>} accept="image/*,application/pdf" className="btn primary" onImported={([f]) => create(f.id)} />
          <button type="button" className="btn secondary" onClick={() => create()}>
            Dessiner sans plan
          </button>
        </div>
      </div>
      {plans.length > 0 && (
        <div className="project-grid">
          {[...plans]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((p) => {
              const rooms = findFaces(p).length
              return (
                <article key={p.id} className="project-card">
                  <button type="button" className="project-thumb" onClick={() => open(p.id)} aria-label={`Reprendre ${p.name}`}>
                    <PlanThumb plan={p} className="project-plan" />
                  </button>
                  <div className="project-body">
                    <span className="project-name">{p.name}</span>
                    <span className="project-meta">
                      {rooms ? `${rooms} pièce${rooms > 1 ? 's' : ''}` : 'À tracer'} · {dateFr(p.updatedAt)}
                    </span>
                    {confirmId === p.id ? (
                      <div className="confirm-inline">
                        <span>Supprimer ce plan ?</span>
                        <button type="button" className="chip danger" onClick={() => (usePlanStore.getState().deletePlan(p.id), setConfirmId(null), setMenuId(null))}>
                          Supprimer
                        </button>
                        <button type="button" className="chip" onClick={() => (setConfirmId(null), setMenuId(null))}>
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <div className="project-actions">
                        <button type="button" className="btn primary" onClick={() => open(p.id)}>
                          Reprendre
                        </button>
                        <div className="more">
                          <button type="button" className="icon-btn small" onClick={() => setMenuId(menuId === p.id ? null : p.id)} aria-label={`Autres actions pour ${p.name}`} aria-expanded={menuId === p.id}>
                            {Icon.more}
                          </button>
                          {menuId === p.id && (
                            <div className="more-menu" role="menu">
                              <button type="button" role="menuitem" className="danger" onClick={() => setConfirmId(p.id)}>
                                {Icon.trash} Supprimer le plan
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
        </div>
      )}
    </section>
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

  const photos = refs.filter((r) => r.kind === 'photo').length
  const [autoScan, setAutoScan] = useState(true)
  const [estimate, setEstimate] = useState(false)
  const scanOn = photos > 0 && autoScan && aiReady()
  const finish = () => {
    createProject({ name, roomType, start: scanOn && start === 'exemple' ? 'vide' : start, room, references: refs })
    // Les photos sont lues dès l'ouverture de la pièce
    if (scanOn) useStore.getState().setScan({ auto: true, estimate })
  }

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
            {photos > 0 && aiReady() && (
              <>
                <label className="check-row">
                  <input type="checkbox" checked={autoScan} onChange={(e) => setAutoScan(e.target.checked)} />
                  <span>
                    <strong>Placer automatiquement les meubles, portes et fenêtres de mes photos</strong>
                    <br />
                    <span className="muted">Le mur qu'on voit en face sur la 1ʳᵉ photo devient le mur 1. Environ 15 centimes par lecture.</span>
                  </span>
                </label>
                {autoScan && (
                  <label className="check-row">
                    <input type="checkbox" checked={estimate} onChange={(e) => setEstimate(e.target.checked)} />
                    <span>Je n'ai pas mesuré : estimer les dimensions d'après les photos</span>
                  </label>
                )}
              </>
            )}
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
