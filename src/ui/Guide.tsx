// Guide de prise en main de la chambre exemple, en trois actions courtes et facultatives :
// 1. déplacer un meuble, 2. changer la couleur d'un mur (sur une copie), 3. comparer les deux versions.
// Un repère animé montre où toucher : sur la 3D (projection du point visé), sur le plan 2D, ou sur un bouton.
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import type { Layout } from '../model/types'
import { useStore } from '../store'
import { Icon } from './common'

type Step = 1 | 2 | 3 | 4

interface GuideState {
  step: Step | null
  /** État de la pièce au début de l'étape (pour savoir quand l'action est faite) */
  snap: Layout | null
  start: () => void
  go: (s: Step | null) => void
}

export const useGuide = create<GuideState>()((set) => ({
  step: null,
  snap: null,
  start: () => set({ step: 1, snap: JSON.parse(JSON.stringify(useStore.getState().layout)) as Layout }),
  go: (step) => set({ step, snap: step ? (JSON.parse(JSON.stringify(useStore.getState().layout)) as Layout) : null }),
}))

/** Liaison avec la scène 3D : point visé (monde) et placement du repère à l'écran. */
export const guideProbe = {
  target: null as null | (() => [number, number, number] | null),
  place: null as null | ((x: number, y: number, visible: boolean) => void),
  invalidate: null as null | (() => void),
}

const STEPS: Record<1 | 2 | 3, { title: string; text: string }> = {
  1: { title: 'Déplacez un meuble', text: 'Touchez la commode, puis faites-la glisser. Vous pouvez aussi utiliser les flèches de sa fiche.' },
  2: { title: "Changez la couleur d'un mur", text: 'Une copie « Version 2 » a été créée pour essayer sans perdre l’originale. Touchez le mur rose, puis choisissez une couleur.' },
  3: { title: 'Comparez vos deux versions', text: 'Touchez « Comparer » pour voir la version 1 et la version 2 côte à côte, avec le budget de chacune.' },
}

/** Point visé par l'étape en cours (coordonnées de la pièce, en mètres). */
function targetFor(step: Step, l: Layout): [number, number, number] | null {
  if (step === 1) {
    const it = l.items.find((i) => i.modelId === 'commode') ?? [...l.items].sort((a, b) => b.x - a.x)[0]
    return it ? [it.x, 0.85, it.z] : null
  }
  if (step === 2) return [0, 1.3, -l.room.depth / 2 + 0.02]
  return null
}

export function Guide() {
  const step = useGuide((s) => s.step)
  const snap = useGuide((s) => s.snap)
  const go = useGuide((s) => s.go)
  const layout = useStore((s) => s.layout)
  const compareOpen = useStore((s) => s.compareOpen)
  const threeD = useStore((s) => s.threeD)
  const view = useStore((s) => s.view)
  const ringRef = useRef<HTMLDivElement>(null)
  const [, force] = useState(0)

  // Étape réussie ?
  useEffect(() => {
    if (!step || !snap) return
    if (step === 1) {
      const moved = layout.items.some((it) => {
        const o = snap.items.find((x) => x.uid === it.uid)
        return o && (Math.hypot(o.x - it.x, o.z - it.z) > 0.04 || Math.abs(o.rot - it.rot) > 0.01)
      })
      if (moved && !useStore.getState().dragging) {
        // Étape 2 : on essaie la couleur sur une copie, pour pouvoir comparer ensuite
        useStore.getState().select(null)
        useStore.getState().duplicateVersion()
        go(2)
      }
    } else if (step === 2) {
      if (layout.id !== snap.id) return
      const changed = (Object.keys(layout.wallColors) as (keyof Layout['wallColors'])[]).some((w) => layout.wallColors[w] !== snap.wallColors[w])
      if (changed) go(3)
    } else if (step === 3 && compareOpen) go(4)
  }, [layout, compareOpen, step, snap, go])

  // Repère : projection 3D, plan 2D ou bouton
  useEffect(() => {
    const ring = ringRef.current
    const place = (x: number, y: number, visible: boolean) => {
      if (!ring) return
      ring.style.transform = `translate(${x}px, ${y}px)`
      ring.style.opacity = visible ? '1' : '0'
    }
    if (!step || step === 4) {
      guideProbe.target = null
      return
    }
    if (step === 3) {
      guideProbe.target = null
      let raf = 0
      const loop = () => {
        const el = document.querySelector('[data-guide="comparer"]')
        if (el) {
          const r = el.getBoundingClientRect()
          place(r.left + r.width / 2, r.top + r.height / 2, true)
        }
        raf = requestAnimationFrame(loop)
      }
      loop()
      return () => cancelAnimationFrame(raf)
    }
    if (threeD) {
      guideProbe.target = () => targetFor(step, useStore.getState().layout)
      guideProbe.place = place
      guideProbe.invalidate?.()
      return () => {
        guideProbe.target = null
      }
    }
    // Plan 2D (sans 3D) : on passe par les coordonnées du dessin SVG
    let raf = 0
    const loop = () => {
      const svg = document.querySelector('svg.plan2d') as SVGSVGElement | null
      const t = targetFor(step, useStore.getState().layout)
      const m = svg?.getScreenCTM()
      if (svg && t && m) {
        const p = new DOMPoint(t[0], t[2]).matrixTransform(m)
        place(p.x, p.y, true)
      }
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [step, threeD, view])

  useEffect(() => force((n) => n + 1), [step])

  if (!step) return null
  const close = () => go(null)

  if (step === 4)
    return (
      <div className="guide-card done" role="dialog" aria-label="Prise en main terminée">
        <p className="guide-progress">{Icon.check} Prise en main terminée</p>
        <h3>Bravo, vous avez l'essentiel !</h3>
        <p>Déplacer, changer une couleur, comparer : vous pouvez maintenant créer votre propre pièce.</p>
        <div className="guide-actions">
          <button type="button" className="btn primary" onClick={close}>
            Continuer
          </button>
        </div>
      </div>
    )

  const s = STEPS[step]
  return (
    <>
      <div className="guide-ring" ref={ringRef} aria-hidden>
        <span />
      </div>
      <div className="guide-card" role="dialog" aria-label="Prise en main">
        <div className="guide-head">
          <p className="guide-progress">
            Prise en main · {step}/3
          </p>
          <button type="button" className="icon-btn small" onClick={close} aria-label="Fermer le guide">
            {Icon.close}
          </button>
        </div>
        <h3>{s.title}</h3>
        <p>{s.text}</p>
        <div className="guide-dots" aria-hidden>
          {[1, 2, 3].map((n) => (
            <span key={n} className={n < step ? 'done' : n === step ? 'on' : ''} />
          ))}
        </div>
        <div className="guide-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              if (step === 1) {
                useStore.getState().duplicateVersion()
                go(2)
              } else go((step + 1) as Step)
            }}
          >
            Passer cette étape
          </button>
        </div>
      </div>
    </>
  )
}
