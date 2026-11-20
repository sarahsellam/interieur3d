// Éclairage d'ambiance : panorama 360° d'un intérieur réel (Poly Haven, CC0),
// utilisé pour les reflets et la lumière indirecte (non affiché en fond).
import { useMemo } from 'react'
import { useTexture, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { assetUrl } from '../data/catalog'

export function AmbientEnvironment({ intensity }: { intensity: number }) {
  const tex = useTexture(assetUrl('hdr/interieur.webp'))
  useMemo(() => {
    tex.mapping = THREE.EquirectangularReflectionMapping
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
  }, [tex])
  return <Environment map={tex} environmentIntensity={intensity} />
}
