// Tableaux accrochés aux murs : affiche de la collection ou photo de l'appareil, avec cadre.
// Dessinés dans le repère du mur (x le long du mur, z vers la pièce) : ils suivent le mur
// (et disparaissent avec lui quand la vue 3D le masque).
import { Suspense, useEffect, useMemo, useState } from 'react'
import { Line, RoundedBox, useTexture } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { artUrl } from '../data/art'
import { imageUrl } from '../model/storage'
import type { WallDecor } from '../model/types'
import { useStore } from '../store'

const FRAME_COLOR = { chene: '#a77b4f', noir: '#2b2725', blanc: '#f2f0ec', sans: '#ffffff' } as const

function ArtPlane({ url, w, h, z }: { url: string; w: number; h: number; z: number }) {
  const tex = useTexture(url)
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
  }, [tex])
  return (
    <mesh position={[0, 0, z]}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={tex} roughness={0.85} envMapIntensity={0.4} />
    </mesh>
  )
}

/** Adresse de l'image : affiche de la collection, ou photo enregistrée dans l'appareil. */
function useDecorUrl(d: WallDecor) {
  const [url, setUrl] = useState<string | null>(d.imageId ? null : artUrl(d.art))
  useEffect(() => {
    let alive = true
    if (d.imageId) imageUrl(d.imageId).then((u) => alive && setUrl(u))
    else setUrl(artUrl(d.art))
    return () => {
      alive = false
    }
  }, [d.imageId, d.art])
  return url
}

export function DecorPiece({ d, u, selected }: { d: WallDecor; u: number; selected: boolean }) {
  const select = useStore((s) => s.select)
  const url = useDecorUrl(d)
  const fw = d.frame === 'sans' ? 0 : 0.028
  const depth = d.frame === 'sans' ? 0.022 : 0.03
  // Passe-partout blanc autour des photos encadrées
  const mat = d.imageId && d.frame !== 'sans' ? Math.min(d.width, d.height) * 0.08 : 0
  const W = d.width
  const H = d.height
  const frameMat = useMemo(() => new THREE.MeshStandardMaterial({ color: FRAME_COLOR[d.frame], roughness: d.frame === 'noir' ? 0.45 : 0.6, envMapIntensity: 0.7 }), [d.frame])
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8) return
    e.stopPropagation()
    select({ type: 'decor', id: d.id })
  }
  return (
    <group position={[u, d.y, 0.004]} onClick={onClick}>
      <RoundedBox args={[W + 2 * fw, H + 2 * fw, depth]} radius={0.004} smoothness={2} position={[0, 0, depth / 2]} material={frameMat} castShadow receiveShadow />
      {mat > 0 && (
        <mesh position={[0, 0, depth + 0.001]}>
          <planeGeometry args={[W, H]} />
          <meshStandardMaterial color="#f7f5f0" roughness={0.9} />
        </mesh>
      )}
      {url && (
        <Suspense fallback={null}>
          <ArtPlane url={url} w={W - 2 * mat} h={H - 2 * mat} z={depth + 0.002} />
        </Suspense>
      )}
      {selected && (
        // Contour bordeaux autour du cadre sélectionné
        <Line
          points={(() => {
            const x = (W + 2 * fw) / 2 + 0.03
            const y = (H + 2 * fw) / 2 + 0.03
            return [[-x, -y, depth + 0.004], [x, -y, depth + 0.004], [x, y, depth + 0.004], [-x, y, depth + 0.004], [-x, -y, depth + 0.004]] as [number, number, number][]
          })()}
          color="#742f45"
          lineWidth={3}
          toneMapped={false}
        />
      )}
    </group>
  )
}
