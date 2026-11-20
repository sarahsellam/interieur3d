// Panneau latéral (tablette/ordinateur) ou feuille du bas (téléphone).
import { useEffect, useState } from 'react'
import { CATALOG, CATEGORY_LABELS, assetUrl, type FurnitureCategory } from '../data/catalog'
import { FLOORS, WALL_COLORS, floorTexture } from '../data/finishes'
import { ROOM_LIMITS, useStore } from '../store'

type Tab = 'meubles' | 'piece'

function Catalog({ onAdded }: { onAdded: () => void }) {
  const addItem = useStore((s) => s.addItem)
  const cats = Object.keys(CATEGORY_LABELS) as FurnitureCategory[]
  return (
    <div className="catalog">
      {cats.map((cat) => (
        <section key={cat}>
          <h3>{CATEGORY_LABELS[cat]}</h3>
          <div className="cards">
            {CATALOG.filter((c) => c.category === cat).map((c) => (
              <button
                key={c.id}
                className="card"
                onClick={() => {
                  addItem(c.id)
                  onAdded()
                }}
                aria-label={`Ajouter : ${c.name}`}
              >
                <img src={assetUrl(`thumbs/${c.id}.webp`)} alt="" loading="lazy" draggable={false} />
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

function DimensionField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const step = 0.05
  const round = (v: number) => Math.round(v * 100) / 100
  return (
    <div className="dim-field">
      <div className="dim-head">
        <label>{label}</label>
        <div className="stepper">
          <button onClick={() => onChange(round(value - step))} aria-label={`Réduire ${label}`} disabled={value <= min}>−</button>
          <input
            type="text"
            inputMode="decimal"
            aria-label={label}
            key={value}
            defaultValue={value.toFixed(2).replace('.', ',')}
            onBlur={(e) => {
              const v = parseFloat(e.target.value.replace(',', '.'))
              if (!Number.isNaN(v)) onChange(round(v))
              else e.target.value = value.toFixed(2).replace('.', ',')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
          />
          <span className="unit">m</span>
          <button onClick={() => onChange(round(value + step))} aria-label={`Augmenter ${label}`} disabled={value >= max}>+</button>
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  )
}

function RoomSettings() {
  const room = useStore((s) => s.room)
  const setRoom = useStore((s) => s.setRoom)
  const wallColor = useStore((s) => s.wallColor)
  const setWallColor = useStore((s) => s.setWallColor)
  const floorId = useStore((s) => s.floorId)
  const setFloor = useStore((s) => s.setFloor)
  const resetProject = useStore((s) => s.resetProject)
  const [confirmReset, setConfirmReset] = useState(false)
  const area = (room.width * room.depth).toFixed(1).replace('.', ',')

  return (
    <div className="room-settings">
      <section>
        <h3>Dimensions <span className="muted">· {area} m²</span></h3>
        <DimensionField label="Largeur" value={room.width} min={ROOM_LIMITS.min} max={ROOM_LIMITS.max} onChange={(v) => setRoom({ width: v })} />
        <DimensionField label="Longueur" value={room.depth} min={ROOM_LIMITS.min} max={ROOM_LIMITS.max} onChange={(v) => setRoom({ depth: v })} />
        <DimensionField label="Hauteur sous plafond" value={room.height} min={ROOM_LIMITS.minHeight} max={ROOM_LIMITS.maxHeight} onChange={(v) => setRoom({ height: v })} />
      </section>
      <section>
        <h3>Couleur des murs</h3>
        <div className="swatches">
          {WALL_COLORS.map((c) => (
            <button
              key={c.hex}
              className={`swatch ${wallColor === c.hex ? 'active' : ''}`}
              style={{ background: c.hex }}
              onClick={() => setWallColor(c.hex)}
              title={c.name}
              aria-label={c.name}
            />
          ))}
          <label className="swatch custom" title="Couleur personnalisée">
            <input type="color" value={wallColor} onChange={(e) => setWallColor(e.target.value)} aria-label="Couleur personnalisée" />
            <span>+</span>
          </label>
        </div>
      </section>
      <section>
        <h3>Sol</h3>
        <div className="floors">
          {FLOORS.map((f) => (
            <button key={f.id} className={`floor ${floorId === f.id ? 'active' : ''}`} onClick={() => setFloor(f.id)}>
              <img src={floorTexture(f.id, 'diff')} alt="" loading="lazy" />
              <span>{f.name}</span>
            </button>
          ))}
        </div>
      </section>
      <section>
        {confirmReset ? (
          <div className="confirm-row">
            <span>Revenir à la pièce de départ ? Vos changements seront perdus.</span>
            <div>
              <button className="btn danger" onClick={() => { resetProject(); setConfirmReset(false) }}>Oui, recommencer</button>
              <button className="btn" onClick={() => setConfirmReset(false)}>Annuler</button>
            </div>
          </div>
        ) : (
          <button className="link-btn" onClick={() => setConfirmReset(true)}>Recommencer la pièce</button>
        )}
      </section>
    </div>
  )
}

export function SidePanel() {
  const [tab, setTab] = useState<Tab>('meubles')
  const [open, setOpen] = useState(true)
  const view = useStore((s) => s.view)
  // En visite, le panneau se replie pour laisser toute la place à la vue
  useEffect(() => {
    setOpen(view !== 'visite')
  }, [view])
  return (
    <aside className={`panel ${open ? 'open' : 'closed'}`}>
      <div className="sheet-handle" onClick={() => setOpen((o) => !o)} role="button" aria-label={open ? 'Réduire le panneau' : 'Ouvrir le panneau'}>
        <span />
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'meubles'} className={tab === 'meubles' ? 'active' : ''} onClick={() => { setTab('meubles'); setOpen(true) }}>
          Meubles
        </button>
        <button role="tab" aria-selected={tab === 'piece'} className={tab === 'piece' ? 'active' : ''} onClick={() => { setTab('piece'); setOpen(true) }}>
          Pièce
        </button>
      </div>
      <div className="panel-body">
        {tab === 'meubles' ? (
          <Catalog onAdded={() => { if (window.innerWidth < 768) setOpen(false) }} />
        ) : (
          <RoomSettings />
        )}
      </div>
    </aside>
  )
}
