// Éditeur « Mon aménagement » : la pièce au centre, les outils autour.
import { useEffect, useMemo, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { CATALOG, CATEGORY_LABELS, ITEM_COLORS, fmtPrice, getItem, itemPrice, type FurnitureCategory } from '../data/catalog'
import { FLOORS, WALL_COLORS, floorTexture } from '../data/finishes'
import { budgetOf, itemDims, overlapsOf, wallLength } from '../model/geometry'
import { OPENING_LABEL, VIEW_LABEL, WALL_LABEL, WALL_ORDER, type Opening, type OpeningKind, type ViewMode, type WallSide } from '../model/types'
import { ROOM_LIMITS, useProject, useStore } from '../store'
import { captureThumb } from '../three/capture'
import { SharePanel } from './Share'
import { CompareButton, ComparePanel } from './Compare'
import { Guide } from './Guide'
import { PassagesCard, PassagesChip } from './Passages'
import { No3DCauses, VisitVideoButton } from './VisitVideo'
import { Icon, MeasureField, Swatches, fmtM } from './common'
import { InspirationBoard, PinnedImage, ProjectReferences } from './Inspirations'
import { ItemThumb, MyFurnitureSection } from './MyFurniture'
import { ReplacePanel } from './Replace'
import { IdeaPanel } from './Idea'

const OPENING_KINDS: OpeningKind[] = ['fenetre', 'porte-fenetre', 'porte', 'placard', 'niche']

async function saveWithThumb() {
  const thumb = await captureThumb()
  useStore.getState().save(thumb || undefined)
}

// ---------------------------------------------------------------- Barre du haut

function VersionMenu({ onClose, onShare }: { onClose: () => void; onShare: () => void }) {
  const project = useProject()
  const layout = useStore((s) => s.layout)
  const switchVersion = useStore((s) => s.switchVersion)
  const duplicateVersion = useStore((s) => s.duplicateVersion)
  const renameVersion = useStore((s) => s.renameVersion)
  const deleteVersion = useStore((s) => s.deleteVersion)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  if (!project) return null
  return (
    <div className="popover versions" role="dialog" aria-label="Versions de l'aménagement">
      <div className="popover-head">
        <strong>Versions</strong>
        <button type="button" className="icon-btn small" onClick={onClose} aria-label="Fermer">
          {Icon.close}
        </button>
      </div>
      <p className="hint-text">Dupliquez la version en cours pour essayer une autre idée sans perdre la première.</p>
      <div className="version-list">
        {project.versions.map((v) => {
          const active = v.id === layout.id
          const thumb = active ? layout.thumb ?? v.thumb : v.thumb
          return (
            <div key={v.id} className={`version ${active ? 'active' : ''}`}>
              <button type="button" className="version-thumb" onClick={() => switchVersion(v.id)} aria-label={`Ouvrir ${v.name}`}>
                {thumb ? <img src={thumb} alt="" /> : <div className="img-placeholder" />}
              </button>
              <div className="version-info">
                <input type="text" defaultValue={v.name} onBlur={(e) => e.target.value !== v.name && renameVersion(v.id, e.target.value)} aria-label="Nom de la version" />
                <span className="version-state">{active ? 'Ouverte' : 'Toucher l\'image pour ouvrir'}</span>
              </div>
              {project.versions.length > 1 &&
                (confirmId === v.id ? (
                  <button type="button" className="chip danger" onClick={() => deleteVersion(v.id)}>
                    Confirmer
                  </button>
                ) : (
                  <button type="button" className="icon-btn small" onClick={() => setConfirmId(v.id)} aria-label={`Supprimer ${v.name}`}>
                    {Icon.trash}
                  </button>
                ))}
            </div>
          )
        })}
      </div>
      <button
        type="button"
        className="btn primary"
        onClick={async () => {
          await saveWithThumb()
          duplicateVersion()
          setTimeout(saveWithThumb, 600)
        }}
      >
        {Icon.copy} Dupliquer cette version
      </button>
      {project.versions.length > 1 && (
        <button
          type="button"
          className="btn secondary"
          onClick={() => {
            onClose()
            useStore.getState().setCompareOpen(true)
          }}
        >
          {Icon.swap} Comparer deux versions
        </button>
      )}
      <button type="button" className="btn secondary" onClick={onShare}>
        {Icon.share} Demander un avis sur mes versions
      </button>
    </div>
  )
}

/** Budget des achats prévus (les meubles « Déjà possédé » ne comptent pas). */
function BudgetButton() {
  const layout = useStore((s) => s.layout)
  const select = useStore((s) => s.select)
  const [open, setOpen] = useState(false)
  const b = useMemo(() => budgetOf(layout, itemPrice), [layout])
  return (
    <div className="budget">
      <button type="button" className="budget-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="muted">À acheter</span>
        <strong>{fmtPrice(b.total)}</strong>
      </button>
      {open && (
        <div className="popover right budget-pop" role="dialog" aria-label="Budget">
          <div className="popover-head">
            <strong>Budget de {layout.name.toLowerCase()}</strong>
            <button type="button" className="icon-btn small" onClick={() => setOpen(false)} aria-label="Fermer">
              {Icon.close}
            </button>
          </div>
          {b.toBuy.length === 0 ? (
            <p className="hint-text">Aucun achat prévu. Touchez un meuble et choisissez « À acheter » pour l'ajouter au budget.</p>
          ) : (
            <div className="budget-list">
              {b.toBuy.map((it) => {
                const c = getItem(it.modelId)
                const p = itemPrice(it)
                return (
                  <button
                    key={it.uid}
                    type="button"
                    className="budget-line"
                    onClick={() => {
                      select({ type: 'item', id: it.uid })
                      setOpen(false)
                    }}
                  >
                    {c && <ItemThumb c={c} className="budget-img" />}
                    <span className="budget-name">{c?.name ?? 'Meuble'}</span>
                    <span className={p === null ? 'muted' : ''}>{p === null ? 'Prix à saisir' : fmtPrice(p)}</span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="budget-total">
            <span>Total des achats prévus</span>
            <strong>{fmtPrice(b.total)}</strong>
          </div>
          {b.missing > 0 && (
            <p className="hint-text">
              {b.missing} achat{b.missing > 1 ? 's' : ''} sans prix : touchez la ligne pour saisir le prix.
            </p>
          )}
          <p className="hint-text">{b.owned.length} meuble{b.owned.length > 1 ? 's' : ''} déjà possédé{b.owned.length > 1 ? 's' : ''}, non compté{b.owned.length > 1 ? 's' : ''}.</p>
        </div>
      )}
    </div>
  )
}

function TopBar() {
  const project = useProject()
  const layout = useStore((s) => s.layout)
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const savedAt = useStore((s) => s.savedAt)
  const dirty = useStore((s) => s.dirty)
  const goHome = useStore((s) => s.goHome)
  const [menu, setMenu] = useState(false)
  const [flash, setFlash] = useState(false)
  const threeD = useStore((s) => s.threeD)
  const ideaOpen = useStore((s) => s.ideaOpen)
  const setIdeaOpen = useStore((s) => s.setIdeaOpen)
  const sharing = useStore((s) => s.shareOpen)
  const setSharing = useStore((s) => s.setShareOpen)

  useEffect(() => {
    if (!savedAt) return
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 2200)
    return () => clearTimeout(t)
  }, [savedAt])

  return (
    <header className="editor-top">
      <div className="top-left">
        <button
          type="button"
          className="icon-btn"
          onClick={async () => {
            await saveWithThumb()
            goHome()
          }}
          aria-label="Accueil"
        >
          {Icon.home}
        </button>
        <div className="project-title">
          <span className="project-name-top">{project?.name}</span>
          <button type="button" className="version-btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
            <span className="version-name">{layout.name}</span> {Icon.chevron}
          </button>
        </div>
        {menu && <VersionMenu onClose={() => setMenu(false)} onShare={() => (setMenu(false), setSharing(true))} />}
        <CompareButton />
      </div>
      <div className="segmented" role="tablist" aria-label="Type de vue">
        {(['plan', '3d', 'yeux'] as ViewMode[]).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            className={view === v ? 'active' : ''}
            onClick={() => setView(v)}
            disabled={!threeD && v !== 'plan'}
            title={!threeD && v !== 'plan' ? 'La 3D n’est pas disponible sur ce navigateur' : undefined}
          >
            {VIEW_LABEL[v]}
          </button>
        ))}
      </div>
      <div className="top-right">
        <button type="button" className={`btn idea-btn ${ideaOpen ? 'on' : ''}`} onClick={() => setIdeaOpen(!ideaOpen)}>
          {Icon.spark} <span className="idea-label">Demander une idée</span>
        </button>
        <button type="button" className="btn share-btn" onClick={() => setSharing(true)} title="Partager pour demander un avis">
          {Icon.share} <span className="share-label">Partager</span>
        </button>
        {sharing && <SharePanel onClose={() => setSharing(false)} beforeShare={saveWithThumb} />}
        <BudgetButton />
        <button type="button" className="icon-btn" onClick={undo} disabled={!canUndo} aria-label="Annuler" title="Annuler">
          {Icon.undo}
        </button>
        <button type="button" className="icon-btn" onClick={redo} disabled={!canRedo} aria-label="Rétablir" title="Rétablir">
          {Icon.redo}
        </button>
        <button type="button" className={`btn ${flash ? 'saved' : 'primary'}`} onClick={saveWithThumb}>
          {flash ? (
            <>
              {Icon.check} Enregistré
            </>
          ) : dirty ? (
            'Enregistrer'
          ) : (
            'Enregistré'
          )}
        </button>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------- Panneau latéral

function Catalog({ onAdded }: { onAdded: () => void }) {
  const addItem = useStore((s) => s.addItem)
  const cats = Object.keys(CATEGORY_LABELS) as FurnitureCategory[]
  return (
    <div className="catalog">
      <MyFurnitureSection />
      {cats.map((cat) => (
        <section key={cat}>
          <h3>{CATEGORY_LABELS[cat]}</h3>
          <div className="cards">
            {CATALOG.filter((c) => c.category === cat).map((c) => (
              <button
                key={c.id}
                type="button"
                className="card"
                onClick={() => {
                  addItem(c.id)
                  onAdded()
                }}
                aria-label={`Ajouter : ${c.name}`}
              >
                <span className="card-img">
                  <ItemThumb c={c} />
                  <span className="card-plus" aria-hidden>
                    {Icon.plus}
                  </span>
                </span>
                <span className="card-name">{c.name}</span>
                <span className="card-dims">
                  {Math.round(c.width * 100)} × {Math.round(c.depth * 100)} × {Math.round(c.height * 100)} cm
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
      <p className="credits">
        Modèles 3D et textures : <a href="https://polyhaven.com" target="_blank" rel="noreferrer">Poly Haven</a> (licence CC0).
      </p>
    </div>
  )
}

function RoomSettings() {
  const layout = useStore((s) => s.layout)
  const setRoom = useStore((s) => s.setRoom)
  const setFloor = useStore((s) => s.setFloor)
  const select = useStore((s) => s.select)
  const selection = useStore((s) => s.selection)
  const addOpening = useStore((s) => s.addOpening)
  const [wall, setWall] = useState<WallSide>('nord')
  const { room } = layout
  const area = (room.width * room.depth).toFixed(1).replace('.', ',')

  return (
    <div className="room-settings">
      <section>
        <h3>
          Dimensions <span className="muted">· {area} m²</span>
        </h3>
        <MeasureField label="Largeur" value={room.width} min={ROOM_LIMITS.min} max={ROOM_LIMITS.max} onChange={(width) => setRoom({ width })} />
        <MeasureField label="Longueur" value={room.depth} min={ROOM_LIMITS.min} max={ROOM_LIMITS.max} onChange={(depth) => setRoom({ depth })} />
        <MeasureField label="Hauteur sous plafond" value={room.height} min={ROOM_LIMITS.minHeight} max={ROOM_LIMITS.maxHeight} onChange={(height) => setRoom({ height })} />
      </section>

      <section>
        <h3>Murs</h3>
        <p className="hint-text">Touchez un mur pour changer sa couleur.</p>
        <div className="row-list">
          {WALL_ORDER.map((w) => (
            <button key={w} type="button" className={`row-item ${selection?.type === 'wall' && selection.id === w ? 'active' : ''}`} onClick={() => select({ type: 'wall', id: w })}>
              <span className="dot" style={{ background: layout.wallColors[w] }} />
              <span>{WALL_LABEL[w]}</span>
              <span className="muted">{fmtM(wallLength(room, w))}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Ouvertures et rangements</h3>
        {layout.openings.length > 0 && (
          <div className="row-list">
            {layout.openings.map((o) => (
              <button key={o.id} type="button" className={`row-item ${selection?.type === 'opening' && selection.id === o.id ? 'active' : ''}`} onClick={() => select({ type: 'opening', id: o.id })}>
                <span>{OPENING_LABEL[o.kind]}</span>
                <span className="muted">
                  {WALL_LABEL[o.wall]} · {Math.round(o.width * 100)} cm
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="add-opening">
          <label className="field inline">
            <span>Ajouter sur</span>
            <select value={wall} onChange={(e) => setWall(e.target.value as WallSide)}>
              {WALL_ORDER.map((w) => (
                <option key={w} value={w}>
                  {WALL_LABEL[w]}
                </option>
              ))}
            </select>
          </label>
          <div className="choice-row">
            {OPENING_KINDS.map((k) => (
              <button key={k} type="button" className="chip" onClick={() => addOpening(k, wall)}>
                {Icon.plus} {OPENING_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h3>Sol</h3>
        <div className="floors">
          {FLOORS.map((f) => (
            <button key={f.id} type="button" className={`floor ${layout.floorId === f.id ? 'active' : ''}`} onClick={() => setFloor(f.id)}>
              <img src={floorTexture(f.id, 'diff')} alt="" loading="lazy" />
              <span>{f.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Plan et photos de la pièce</h3>
        <ProjectReferences />
      </section>
    </div>
  )
}

type Tab = 'meubles' | 'piece' | 'inspi'

function SidePanel() {
  const [tab, setTab] = useState<Tab>('meubles')
  const open = useStore((s) => s.panelOpen)
  const setPanelOpen = useStore((s) => s.setPanelOpen)
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => setPanelOpen(typeof v === 'function' ? v(useStore.getState().panelOpen) : v)
  const view = useStore((s) => s.view)
  // À hauteur des yeux (et sur téléphone), le panneau se replie pour laisser toute la place à la pièce
  useEffect(() => setPanelOpen(view !== 'yeux' && window.innerWidth > 860), [view, setPanelOpen])
  const choose = (t: Tab) => {
    setTab(t)
    setOpen(true)
  }
  return (
    <aside className={`panel ${open ? 'open' : 'closed'}`}>
      <div className="sheet-handle" onClick={() => setOpen((o) => !o)} role="button" aria-label={open ? 'Réduire le panneau' : 'Ouvrir le panneau'}>
        <span />
      </div>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'meubles'} className={tab === 'meubles' && open ? 'active' : ''} onClick={() => choose('meubles')}>
          Meubles
        </button>
        <button type="button" role="tab" aria-selected={tab === 'piece'} className={tab === 'piece' && open ? 'active' : ''} onClick={() => choose('piece')}>
          Pièce
        </button>
        <button type="button" role="tab" aria-selected={tab === 'inspi'} className={tab === 'inspi' && open ? 'active' : ''} onClick={() => choose('inspi')}>
          Mes inspirations
        </button>
        {open && (
          <button type="button" className="icon-btn small panel-collapse" onClick={() => setOpen(false)} aria-label="Replier le panneau">
            {Icon.chevron}
          </button>
        )}
      </div>
      <div className="panel-body">
        {tab === 'meubles' && <Catalog onAdded={() => window.innerWidth < 768 && setOpen(false)} />}
        {tab === 'piece' && <RoomSettings />}
        {tab === 'inspi' && <InspirationBoard allowPin />}
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------- Panneau de sélection (en bas)

function ItemControls({ id }: { id: string }) {
  const item = useStore((s) => s.layout.items.find((i) => i.uid === id))
  const room = useStore((s) => s.layout.room)
  const rotateItem = useStore((s) => s.rotateItem)
  const moveItem = useStore((s) => s.moveItem)
  const setItemColor = useStore((s) => s.setItemColor)
  const setItemDims = useStore((s) => s.setItemDims)
  const toggleLock = useStore((s) => s.toggleLock)
  const duplicateItem = useStore((s) => s.duplicateItem)
  const removeItem = useStore((s) => s.removeItem)
  const select = useStore((s) => s.select)
  const setItemStatus = useStore((s) => s.setItemStatus)
  const setItemPrice = useStore((s) => s.setItemPrice)
  const [sub, setSub] = useState<'move' | 'color' | 'dims' | null>(null)
  const [replacing, setReplacing] = useState(false)
  if (!item) return null
  const c = getItem(item.modelId)
  if (!c) return null
  if (replacing) return <ReplacePanel uid={item.uid} onClose={() => setReplacing(false)} />
  const price = itemPrice(item)
  const toBuy = item.status === 'a-acheter'
  const d = itemDims(item)
  const deg = Math.round((item.rot * 180) / Math.PI) % 360
  const nudge = (dx: number, dz: number) => moveItem(item.uid, item.x + dx, item.z + dz)
  const colors = ITEM_COLORS[c.material]
  const locked = !!item.locked
  return (
    <>
      <div className="sheet-head">
        <div>
          <strong className="item-name">{c.name}</strong>
          <span className="muted">
            {Math.round(d.width * 100)} × {Math.round(d.depth * 100)} × {Math.round(d.height * 100)} cm · {deg}°{locked ? ' · verrouillé' : ''}
          </span>
          {(c.reference || c.custom) && (c.vendor || c.link) && (
            <span className="item-source">
              {c.vendor}
              {c.link && (
                <a href={c.link} target="_blank" rel="noreferrer">
                  {Icon.link} Voir le produit
                </a>
              )}
            </span>
          )}
        </div>
        <button type="button" className="icon-btn small" onClick={() => select(null)} aria-label="Fermer">
          {Icon.close}
        </button>
      </div>
      <div className="status-row">
        <div className="seg-small" role="group" aria-label="Statut du meuble">
          <button type="button" className={!toBuy ? 'active' : ''} onClick={() => setItemStatus(item.uid, 'possede')}>
            Déjà possédé
          </button>
          <button type="button" className={toBuy ? 'active' : ''} onClick={() => setItemStatus(item.uid, 'a-acheter')}>
            À acheter
          </button>
        </div>
        {toBuy && (
          <label className="price-field">
            <input
              key={`${item.uid}-${price}`}
              type="text"
              inputMode="decimal"
              defaultValue={price ?? ''}
              placeholder="Prix"
              aria-label="Prix"
              onBlur={(e) => {
                const v = parseFloat(e.target.value.replace(',', '.').replace(/\s/g, ''))
                setItemPrice(item.uid, Number.isNaN(v) ? null : v)
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            <span>€</span>
          </label>
        )}
        {c.custom && (
          <span className="muted small-note">
            3D simplifiée{c.vendor ? ` · ${c.vendor}` : ''}
            {c.link && (
              <>
                {' · '}
                <a href={c.link} target="_blank" rel="noreferrer">
                  Voir le produit
                </a>
              </>
            )}
          </span>
        )}
      </div>
      <div className="tool-row">
        <button type="button" className="tool" onClick={() => setReplacing(true)}>
          {Icon.swap}
          <span>Remplacer</span>
        </button>
        <button type="button" className={`tool ${sub === 'move' ? 'on' : ''}`} onClick={() => setSub(sub === 'move' ? null : 'move')} disabled={locked}>
          {Icon.move}
          <span>Déplacer</span>
        </button>
        <button type="button" className="tool" onClick={() => rotateItem(item.uid, Math.PI / 12)} disabled={locked}>
          {Icon.rotL}
          <span>15°</span>
        </button>
        <button type="button" className="tool" onClick={() => rotateItem(item.uid, -Math.PI / 2)} disabled={locked}>
          {Icon.rotR}
          <span>90°</span>
        </button>
        {colors.length > 0 && (
          <button type="button" className={`tool ${sub === 'color' ? 'on' : ''}`} onClick={() => setSub(sub === 'color' ? null : 'color')}>
            {Icon.palette}
            <span>Couleur</span>
          </button>
        )}
        <button type="button" className={`tool ${sub === 'dims' ? 'on' : ''}`} onClick={() => setSub(sub === 'dims' ? null : 'dims')} disabled={locked}>
          {Icon.ruler}
          <span>Dimensions</span>
        </button>
        <button type="button" className="tool" onClick={() => duplicateItem(item.uid)}>
          {Icon.copy}
          <span>Dupliquer</span>
        </button>
        <button type="button" className={`tool ${locked ? 'on' : ''}`} onClick={() => toggleLock(item.uid)}>
          {locked ? Icon.lock : Icon.unlock}
          <span>{locked ? 'Verrouillé' : 'Verrouiller'}</span>
        </button>
        <button type="button" className="tool danger" onClick={() => removeItem(item.uid)}>
          {Icon.trash}
          <span>Supprimer</span>
        </button>
      </div>
      {sub === 'move' && !locked && (
        <div className="sub-panel move-pad">
          <p className="hint-text">Glissez le meuble avec le doigt, ou ajustez de 5 cm :</p>
          <div className="pad">
            <button type="button" className="icon-btn" onClick={() => nudge(0, -0.05)} aria-label="Vers le haut du plan">
              {Icon.arrow}
            </button>
            <div className="pad-mid">
              <button type="button" className="icon-btn rot-l" onClick={() => nudge(-0.05, 0)} aria-label="Vers la gauche">
                {Icon.arrow}
              </button>
              <button type="button" className="icon-btn rot-r" onClick={() => nudge(0.05, 0)} aria-label="Vers la droite">
                {Icon.arrow}
              </button>
            </div>
            <button type="button" className="icon-btn rot-d" onClick={() => nudge(0, 0.05)} aria-label="Vers le bas du plan">
              {Icon.arrow}
            </button>
          </div>
          <span className="muted">
            Position : {fmtM(item.x + room.width / 2)} du mur 4, {fmtM(item.z + room.depth / 2)} du mur 1
          </span>
        </div>
      )}
      {sub === 'color' && (
        <div className="sub-panel">
          <Swatches colors={colors} value={item.color} onChange={(hex) => setItemColor(item.uid, hex)} originalLabel="Couleur d'origine" />
        </div>
      )}
      {sub === 'dims' && !locked && (
        <div className="sub-panel dims-row">
          <MeasureField compact unit="cm" label="Largeur" value={d.width} min={0.1} max={6} onChange={(width) => setItemDims(item.uid, { ...d, width })} />
          <MeasureField compact unit="cm" label="Profondeur" value={d.depth} min={0.05} max={6} onChange={(depth) => setItemDims(item.uid, { ...d, depth })} />
          <MeasureField compact unit="cm" label="Hauteur" value={d.height} min={0.01} max={3} onChange={(height) => setItemDims(item.uid, { ...d, height })} />
          {item.dims && (
            <button type="button" className="chip" onClick={() => setItemDims(item.uid, undefined)}>
              Dimensions d'origine
            </button>
          )}
        </div>
      )}
    </>
  )
}

function WallControls({ side }: { side: WallSide }) {
  const layout = useStore((s) => s.layout)
  const setWallColor = useStore((s) => s.setWallColor)
  const setAll = useStore((s) => s.setAllWallsColor)
  const addOpening = useStore((s) => s.addOpening)
  const select = useStore((s) => s.select)
  const color = layout.wallColors[side]
  return (
    <>
      <div className="sheet-head">
        <div>
          <strong>{WALL_LABEL[side]}</strong>
          <span className="muted">{fmtM(wallLength(layout.room, side))} · {WALL_COLORS.find((c) => c.hex === color)?.name ?? 'Couleur personnalisée'}</span>
        </div>
        <button type="button" className="icon-btn small" onClick={() => select(null)} aria-label="Fermer">
          {Icon.close}
        </button>
      </div>
      <div className="sub-panel">
        <Swatches colors={WALL_COLORS} value={color} onChange={(hex) => hex && setWallColor(side, hex)} />
        <button type="button" className="chip" onClick={() => setAll(color)}>
          Appliquer à tous les murs
        </button>
      </div>
      <div className="choice-row">
        {OPENING_KINDS.map((k) => (
          <button key={k} type="button" className="chip" onClick={() => addOpening(k, side)}>
            {Icon.plus} {OPENING_LABEL[k]}
          </button>
        ))}
      </div>
    </>
  )
}

function OpeningControls({ id }: { id: string }) {
  const o = useStore((s) => s.layout.openings.find((x) => x.id === id))
  const room = useStore((s) => s.layout.room)
  const update = useStore((s) => s.updateOpening)
  const remove = useStore((s) => s.removeOpening)
  const select = useStore((s) => s.select)
  if (!o) return null
  const len = wallLength(room, o.wall)
  const fromStart = len / 2 + o.offset - o.width / 2
  const set = (patch: Partial<Opening>) => update(o.id, patch)
  const hasSill = o.kind === 'fenetre' || o.kind === 'niche'
  const hasDepth = o.kind === 'placard' || o.kind === 'niche'
  return (
    <>
      <div className="sheet-head">
        <div>
          <strong>{OPENING_LABEL[o.kind]}</strong>
          <span className="muted">{WALL_LABEL[o.wall]} · glissez-la le long du mur pour la déplacer</span>
        </div>
        <button type="button" className="icon-btn small" onClick={() => select(null)} aria-label="Fermer">
          {Icon.close}
        </button>
      </div>
      <div className="sub-panel dims-row">
        <MeasureField compact unit="cm" label="Largeur" value={o.width} min={0.3} max={len} onChange={(width) => set({ width })} />
        <MeasureField compact unit="cm" label="Hauteur" value={o.height} min={0.3} max={room.height} onChange={(height) => set({ height })} />
        {hasSill && <MeasureField compact unit="cm" label="Allège" value={o.sill} min={0} max={room.height - 0.3} onChange={(sill) => set({ sill })} />}
        {hasDepth && <MeasureField compact unit="cm" label="Profondeur" value={o.depth ?? (o.kind === 'placard' ? 0.6 : 0.1)} min={0.05} max={o.kind === 'niche' ? 0.12 : 1.2} onChange={(depth) => set({ depth })} />}
        <MeasureField compact unit="cm" label="Depuis l'angle" value={fromStart} min={0} max={len - o.width} onChange={(v) => set({ offset: v + o.width / 2 - len / 2 })} />
      </div>
      <div className="choice-row">
        {o.kind === 'porte' && (
          <>
            <button type="button" className={`chip ${o.hinge !== 'gauche' ? 'selected' : ''}`} onClick={() => set({ hinge: 'droite' })}>
              Charnières à droite
            </button>
            <button type="button" className={`chip ${o.hinge === 'gauche' ? 'selected' : ''}`} onClick={() => set({ hinge: 'gauche' })}>
              Charnières à gauche
            </button>
          </>
        )}
        {(o.kind === 'porte' || o.kind === 'porte-fenetre') && (
          <>
            <button type="button" className={`chip ${o.swing !== 'exterieur' ? 'selected' : ''}`} onClick={() => set({ swing: 'interieur' })}>
              S'ouvre vers la pièce
            </button>
            <button type="button" className={`chip ${o.swing === 'exterieur' ? 'selected' : ''}`} onClick={() => set({ swing: 'exterieur' })}>
              S'ouvre vers l'extérieur
            </button>
          </>
        )}
        <button type="button" className="chip danger" onClick={() => remove(o.id)}>
          {Icon.trash} Supprimer
        </button>
      </div>
    </>
  )
}

function SelectionSheet() {
  const selection = useStore((s) => s.selection)
  if (!selection) return null
  return (
    <div className="selection-sheet" role="region" aria-label="Élément sélectionné">
      {selection.type === 'item' && <ItemControls key={selection.id} id={selection.id} />}
      {selection.type === 'wall' && <WallControls side={selection.id} />}
      {selection.type === 'opening' && <OpeningControls key={selection.id} id={selection.id} />}
    </div>
  )
}

// ---------------------------------------------------------------- Alertes, aimantation, aide

function OverlapBanner() {
  const layout = useStore((s) => s.layout)
  const select = useStore((s) => s.select)
  const dragging = useStore((s) => s.dragging)
  const overlaps = useMemo(() => overlapsOf(layout), [layout])
  if (!overlaps.length || dragging) return null
  const first = overlaps[0]
  const target = first.a.kind === 'item' ? first.a : first.b
  return (
    <button type="button" className="overlap-banner" onClick={() => select({ type: 'item', id: target.id })}>
      {Icon.alert}
      <span>
        <strong>{first.a.label}</strong> chevauche <strong>{first.b.label.toLowerCase()}</strong>
        {overlaps.length > 1 && <span className="muted"> · {overlaps.length - 1} autre{overlaps.length > 2 ? 's' : ''}</span>}
      </span>
    </button>
  )
}

function SnapChips() {
  const snap = useStore((s) => s.snap)
  const setSnap = useStore((s) => s.setSnap)
  return (
    <div className="snap-chips" role="group" aria-label="Alignement">
      <span className="muted">Aligner</span>
      <button type="button" className={`chip ${snap.grid ? 'selected' : ''}`} onClick={() => setSnap({ grid: !snap.grid })} aria-pressed={snap.grid}>
        {Icon.grid} Grille
      </button>
      <button type="button" className={`chip ${snap.walls ? 'selected' : ''}`} onClick={() => setSnap({ walls: !snap.walls })} aria-pressed={snap.walls}>
        {Icon.magnet} Murs
      </button>
      <PassagesChip />
    </div>
  )
}

/** Prévient, sans bloquer, que l'éditeur fonctionne en plan 2D. */
function No3DNotice() {
  const threeD = useStore((s) => s.threeD)
  const [hidden, setHidden] = useState(false)
  if (threeD || hidden) return null
  return (
    <div className="no3d-notice" role="status">
      <span>
        <strong>3D indisponible sur ce navigateur.</strong> Le plan reste utilisable : touchez un meuble pour le déplacer ou le remplacer.
        <span className="no3d-links">
          <VisitVideoButton className="chip" label="Voir la visite en vidéo" />
          <No3DCauses />
        </span>
      </span>
      <button type="button" className="icon-btn small" onClick={() => setHidden(true)} aria-label="Masquer">
        {Icon.close}
      </button>
    </div>
  )
}

const HINT_KEY = 'mi3d-aide-yeux'

export function EyeLevelHint() {
  const view = useStore((s) => s.view)
  const [seen, setSeen] = useState(() => {
    try {
      return !!localStorage.getItem(HINT_KEY)
    } catch {
      return false
    }
  })
  if (view !== 'yeux' || seen) return null
  return (
    <div className="hint" role="note">
      <p>
        <strong>Vous êtes dans la pièce, à 1,60 m.</strong> Glissez le doigt pour regarder autour de vous, touchez le sol pour y aller, écartez deux doigts pour avancer.
      </p>
      <button
        type="button"
        className="btn primary"
        onClick={() => {
          setSeen(true)
          try {
            localStorage.setItem(HINT_KEY, '1')
          } catch {
            /* stockage indisponible */
          }
        }}
      >
        C'est parti
      </button>
    </div>
  )
}

export function Loader() {
  const { active, progress } = useProgress()
  const [shown, setShown] = useState(true)
  useEffect(() => {
    if (!active && progress >= 100) {
      const t = setTimeout(() => setShown(false), 300)
      return () => clearTimeout(t)
    }
  }, [active, progress])
  if (!shown) return null
  return (
    <div className={`loader ${!active && progress >= 100 ? 'done' : ''}`}>
      <div className="loader-box">
        <span>Préparation de la pièce…</span>
        <div className="bar">
          <div style={{ width: `${Math.round(progress)}%` }} />
        </div>
      </div>
    </div>
  )
}

/** Raccourcis clavier (iPad avec clavier, ordinateur). */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const st = useStore.getState()
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) st.redo()
        else st.undo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && st.selection?.type === 'item') {
        st.removeItem(st.selection.id)
      } else if (e.key === 'Escape') st.select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export function EditorUI() {
  useShortcuts()
  const ideaOpen = useStore((s) => s.ideaOpen)
  const setIdeaOpen = useStore((s) => s.setIdeaOpen)
  return (
    <>
      {ideaOpen && <IdeaPanel onClose={() => setIdeaOpen(false)} />}
      <TopBar />
      <SidePanel />
      <No3DNotice />
      <OverlapBanner />
      <SnapChips />
      <PassagesCard />
      <PinnedImage />
      <SelectionSheet />
      <EyeLevelHint />
      <ComparePanel />
      <Guide />
    </>
  )
}
