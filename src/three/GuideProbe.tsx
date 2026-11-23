// Place le repère du guide de prise en main sur le point visé de la scène 3D.
import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { guideProbe } from '../ui/Guide'

export function GuideProbe() {
  const invalidate = useThree((s) => s.invalidate)
  const v = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    guideProbe.invalidate = invalidate
    return () => {
      guideProbe.invalidate = null
    }
  }, [invalidate])
  useFrame(({ camera, size }) => {
    if (import.meta.env.DEV) (window as unknown as { __cam: THREE.Camera }).__cam = camera
    const t = guideProbe.target?.()
    if (!t || !guideProbe.place) return
    v.set(t[0], t[1], t[2]).project(camera)
    guideProbe.place(((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height, v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05)
  })
  return null
}
