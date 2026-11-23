// Linge de lit, coussins et tableaux : les réglages dans le panneau et dans les fiches.
import { useState } from 'react'
import { ART, ART_SIZES, FRAME_LABEL, TEXTILE_COLORS, artUrl } from '../data/art'
import { getItem } from '../data/catalog'
import { imageSize } from '../model/storage'
import type { PlacedItem, TextileMotif, WallDecor } from '../model/types'
import { WALL_LABEL, WALL_ORDER } from '../model/types'
import { useStore } from '../store'
import { Icon, ImportButton, StoredImage, Swatches } from './common'

// ---------------------------------------------------------------- Linge de lit et coussins

const MOTIFS: { id: TextileMotif; label: string }[] = [
  { id: 'uni', label: 'Uni' },
  { id: 'rayures', label: 'Rayures' },
  { id: 'carreaux', label: 'Carreaux' },
  { id: 'pois', label: 'Pois' },
]

/** Ce meuble peut-il recevoir du linge ou des coussins ? */
export function textileKind(it: PlacedItem): 'lit' | 'canape' | null {
  const c = getItem(it.modelId)
  const base = c?.base ?? it.modelId
  if (base === 'lit_double' || base === 'lit_simple') return 'lit'
  if (base === 'sofa_lin') return 'canape'
  return null
}

export function TextilesPanel({ item }: { item: PlacedItem }) {
  const setTextiles = useStore((s) => s.setTextiles)
  const kind = textileKind(item)
  const t = item.textiles ?? {}
  const cushions = t.coussins ?? []
  const [slot, setSlot] = useState(0)
  if (!kind) return null
  const setCount = (n: number) => {
    const base = cushions.length ? cushions : ['#e2b9ae', '#a3ad94', '#cdb898']
    const next = Array.from({ length: n }, (_, i) => base[i] ?? base[base.length - 1])
    setTextiles(item.uid, { coussins: next })
    setSlot(Math.min(slot, Math.max(0, n - 1)))
  }
  return (
    <div className="sub-panel textiles">
      {kind === 'lit' && (
        <>
          <div className="textile-row">
            <span className="textile-label">Couette</span>
            <Swatches colors={TEXTILE_COLORS} value={t.couette ?? null} onChange={(hex) => setTextiles(item.uid, { couette: hex ?? undefined })} originalLabel="Couleur d'origine" />
          </div>
          <div className="textile-row">
            <span className="textile-label">Motif</span>
            <div className="choice-row">
              {MOTIFS.map((m) => (
                <button key={m.id} type="button" className={`chip ${(t.motif ?? 'uni') === m.id ? 'selected' : ''}`} onClick={() => setTextiles(item.uid, { motif: m.id })}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="textile-row">
            <span className="textile-label">Draps et taies</span>
            <Swatches colors={TEXTILE_COLORS} value={t.draps ?? null} onChange={(hex) => setTextiles(item.uid, { draps: hex ?? undefined })} originalLabel="Blanc d'origine" />
          </div>
          <div className="textile-row">
            <span className="textile-label">Plaid</span>
            <div className="choice-row">
              <button type="button" className={`chip ${t.plaid === null ? 'selected' : ''}`} onClick={() => setTextiles(item.uid, { plaid: null })}>
                Sans plaid
              </button>
            </div>
            <Swatches colors={TEXTILE_COLORS} value={t.plaid ?? null} onChange={(hex) => setTextiles(item.uid, { plaid: hex ?? undefined })} allowCustom />
          </div>
        </>
      )}
      <div className="textile-row">
        <span className="textile-label">Coussins</span>
        <div className="choice-row">
          {[0, 1, 2, 3].map((n) => (
            <button key={n} type="button" className={`chip ${cushions.length === n ? 'selected' : ''}`} onClick={() => setCount(n)}>
              {n === 0 ? 'Aucun' : n}
            </button>
          ))}
        </div>
        {cushions.length > 0 && (
          <>
            <div className="cushion-slots" role="group" aria-label="Coussin à colorer">
              {cushions.map((c, i) => (
                <button key={i} type="button" className={`cushion-slot ${slot === i ? 'active' : ''}`} style={{ background: c }} onClick={() => setSlot(i)} aria-label={`Coussin ${i + 1}`}>
                  {i + 1}
                </button>
              ))}
              <span className="muted">Touchez un coussin, puis une couleur</span>
            </div>
            <Swatches
              colors={TEXTILE_COLORS}
              value={cushions[slot] ?? null}
              onChange={(hex) => hex && setTextiles(item.uid, { coussins: cushions.map((c, i) => (i === slot ? hex : c)) })}
            />
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Tableaux : collection (panneau Meubles)

export function DecorSection({ onAdded }: { onAdded: () => void }) {
  const addDecor = useStore((s) => s.addDecor)
  return (
    <section className="decor-section">
      <h3>Tableaux</h3>
      <div className="cards art-cards">
        {ART.map((a) => (
          <button
            key={a.id}
            type="button"
            className="card"
            onClick={() => {
              addDecor(a.id)
              onAdded()
            }}
            aria-label={`Accrocher : ${a.name}`}
          >
            <span className="card-img art-img">
              <img src={artUrl(a.id, true)} alt="" loading="lazy" style={{ aspectRatio: `1 / ${a.ratio}` }} />
              <span className="card-plus" aria-hidden>
                {Icon.plus}
              </span>
            </span>
            <span className="card-name">{a.name}</span>
          </button>
        ))}
      </div>
      <ImportButton
        label={<>{Icon.image} Encadrer une de mes photos</>}
        accept="image/*"
        className="btn secondary full"
        onImported={async ([f]) => {
          const size = await imageSize(f.id)
          addDecor('photo', { imageId: f.id, ratio: size ? size.height / size.width : 4 / 3 })
          onAdded()
        }}
      />
    </section>
  )
}

// ---------------------------------------------------------------- Tableau sélectionné

export function DecorControls({ id }: { id: string }) {
  const d = useStore((s) => (s.layout.decor ?? []).find((x) => x.id === id))
  const update = useStore((s) => s.updateDecor)
  const remove = useStore((s) => s.removeDecor)
  const select = useStore((s) => s.select)
  const [sub, setSub] = useState<'art' | null>(null)
  if (!d) return null
  const ratio = d.height / d.width
  const name = d.imageId ? 'Ma photo' : (ART.find((a) => a.id === d.art)?.name ?? 'Tableau')
  const set = (patch: Partial<WallDecor>, key?: string) => update(d.id, patch, key)
  const resize = (short: number) => {
    // Le côté court prend la taille choisie, l'autre suit les proportions de l'image
    const w = ratio >= 1 ? short : short / ratio
    set({ width: Math.round(w * 100) / 100, height: Math.round(w * ratio * 100) / 100 })
  }
  const short = Math.min(d.width, d.height)
  return (
    <>
      <div className="sheet-head">
        <div>
          <strong>Tableau · {name}</strong>
          <span className="muted">
            {Math.round(d.width * 100)} × {Math.round(d.height * 100)} cm · {WALL_LABEL[d.wall]} · centre à {Math.round(d.y * 100)} cm du sol
          </span>
        </div>
        <button type="button" className="icon-btn small" onClick={() => select(null)} aria-label="Fermer">
          {Icon.close}
        </button>
      </div>
      <div className="decor-grid">
        <div className="textile-row">
          <span className="textile-label">Position</span>
          <div className="decor-pad">
            <button type="button" className="icon-btn rot-l" onClick={() => set({ offset: d.offset - 0.05 }, `pos-${d.id}`)} aria-label="Vers la gauche">
              {Icon.arrow}
            </button>
            <button type="button" className="icon-btn" onClick={() => set({ y: d.y + 0.05 }, `pos-${d.id}`)} aria-label="Plus haut">
              {Icon.arrow}
            </button>
            <button type="button" className="icon-btn rot-d" onClick={() => set({ y: d.y - 0.05 }, `pos-${d.id}`)} aria-label="Plus bas">
              {Icon.arrow}
            </button>
            <button type="button" className="icon-btn rot-r" onClick={() => set({ offset: d.offset + 0.05 }, `pos-${d.id}`)} aria-label="Vers la droite">
              {Icon.arrow}
            </button>
          </div>
        </div>
        <div className="textile-row">
          <span className="textile-label">Taille</span>
          <div className="choice-row">
            {ART_SIZES.map((s) => (
              <button key={s.label} type="button" className={`chip ${Math.abs(short - s.short) < 0.01 ? 'selected' : ''}`} onClick={() => resize(s.short)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="textile-row">
          <span className="textile-label">Cadre</span>
          <div className="choice-row">
            {(Object.keys(FRAME_LABEL) as WallDecor['frame'][]).map((f) => (
              <button key={f} type="button" className={`chip ${d.frame === f ? 'selected' : ''}`} onClick={() => set({ frame: f })}>
                {FRAME_LABEL[f]}
              </button>
            ))}
          </div>
        </div>
        <div className="textile-row">
          <span className="textile-label">Mur</span>
          <div className="choice-row">
            {WALL_ORDER.map((w) => (
              <button key={w} type="button" className={`chip ${d.wall === w ? 'selected' : ''}`} onClick={() => set({ wall: w, offset: 0 })}>
                {WALL_LABEL[w]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="tool-row">
        <button type="button" className={`tool ${sub === 'art' ? 'on' : ''}`} onClick={() => setSub(sub === 'art' ? null : 'art')}>
          {Icon.image}
          <span>Changer d'image</span>
        </button>
        <button type="button" className="tool danger" onClick={() => remove(d.id)}>
          {Icon.trash}
          <span>Retirer</span>
        </button>
      </div>
      {sub === 'art' && (
        <div className="sub-panel art-choice">
          {ART.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`art-thumb ${!d.imageId && d.art === a.id ? 'active' : ''}`}
              onClick={() => {
                const w = a.ratio >= 1 ? short : short / a.ratio
                set({ art: a.id, imageId: undefined, width: Math.round(w * 100) / 100, height: Math.round(w * a.ratio * 100) / 100 })
              }}
              aria-label={a.name}
            >
              <img src={artUrl(a.id, true)} alt="" />
            </button>
          ))}
          {d.imageId && (
            <span className="art-thumb active">
              <StoredImage id={d.imageId} />
            </span>
          )}
          <ImportButton
            label={<>{Icon.image} Ma photo</>}
            accept="image/*"
            className="chip"
            onImported={async ([f]) => {
              const size = await imageSize(f.id)
              const r = size ? size.height / size.width : 4 / 3
              const w = r >= 1 ? short : short / r
              set({ art: 'photo', imageId: f.id, width: Math.round(w * 100) / 100, height: Math.round(w * r * 100) / 100 })
            }}
          />
        </div>
      )}
    </>
  )
}
