// Écran « plan d'appartement » : le plan à tracer, ou la visite 3D de l'appartement.
import { Suspense, lazy } from 'react'
import { usePlanStore } from '../planStore'
import { useStore } from '../store'
import { SceneBoundary } from './Fallback'
import { PlanCanvas, PlanEditorUI, PlanTopBar } from './PlanEditor'

const ApartmentScene = lazy(() => import('../three/ApartmentScene').then((m) => ({ default: m.ApartmentScene })))

export function ApartmentScreen({ quality }: { quality: 'high' | 'low' }) {
  const plan = usePlanStore((s) => s.plan)
  const view = usePlanStore((s) => s.view)
  const setView = usePlanStore((s) => s.setView)
  const threeD = useStore((s) => s.threeD)
  const disable3D = useStore((s) => s.disable3D)
  if (!plan) return null
  const show3D = view !== 'plan' && threeD
  return (
    <div className="app plan-app">
      <div className="viewport">
        {show3D ? (
          <SceneBoundary
            onFail={() => {
              disable3D()
              setView('plan')
            }}
          >
            <Suspense fallback={<div className="plan-loading">Préparation de la 3D…</div>}>
              <ApartmentScene plan={plan} view={view} quality={quality} />
            </Suspense>
          </SceneBoundary>
        ) : (
          <PlanCanvas />
        )}
      </div>
      <PlanTopBar threeD={threeD} />
      <PlanEditorUI />
      {view === 'yeux' && (
        <div className="plan-visit-hint" role="note">
          Glissez pour regarder autour de vous, touchez le sol pour avancer. Les portes sont ouvertes : passez d'une pièce à l'autre.
        </div>
      )}
    </div>
  )
}
