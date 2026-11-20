// Meubles construits par le code, avec de vraies textures PBR (Poly Haven, CC0) :
// canapé moderne en lin et tapis en laine. Formes arrondies, jamais de simples cubes.
import { useMemo } from 'react'
import { RoundedBox, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { texture } from '../data/finishes'

function useFabric(name: string, repeat: number, color: string, normal = 1) {
  const [map, nor, rough] = useTexture([texture(`${name}_diff`), texture(`${name}_nor`), texture(`${name}_rough`)])
  return useMemo(() => {
    const prep = (t: THREE.Texture) => {
      const c = t.clone()
      c.wrapS = c.wrapT = THREE.RepeatWrapping
      c.repeat.set(repeat, repeat)
      c.needsUpdate = true
      return c
    }
    const m = prep(map)
    m.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshPhysicalMaterial({
      map: m,
      normalMap: prep(nor),
      normalScale: new THREE.Vector2(normal, normal),
      roughnessMap: prep(rough),
      roughness: 1,
      color,
      envMapIntensity: 0.6,
      sheen: 0.5,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color('#ffffff'),
    })
  }, [map, nor, rough, repeat, color, normal])
}

/** Canapé 3 places contemporain : 220 × 95 × 80 cm, lin naturel, pieds en chêne. */
export function LinenSofa() {
  const fabric = useFabric('linen', 4, '#d8cdb9', 0.8)
  const oak = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.55 }), [])
  const W = 2.2
  const D = 0.95
  const legH = 0.12
  const baseH = 0.2
  const seatY = legH + baseH
  const armW = 0.2
  const armH = 0.62
  const backD = 0.22
  const backH = 0.8
  const cushionW = (W - 2 * armW) / 3
  const z0 = -D / 2
  return (
    <group>
      {/* Pieds */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (W / 2 - 0.09), legH / 2, sz * (D / 2 - 0.09)]} material={oak} castShadow>
            <cylinderGeometry args={[0.022, 0.016, legH, 16]} />
          </mesh>
        )),
      )}
      {/* Socle */}
      <RoundedBox args={[W, baseH, D]} radius={0.04} smoothness={4} position={[0, legH + baseH / 2, 0]} material={fabric} castShadow receiveShadow />
      {/* Accoudoirs */}
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[armW, armH - legH, D]} radius={0.07} smoothness={5} position={[s * (W / 2 - armW / 2), legH + (armH - legH) / 2, 0]} material={fabric} castShadow receiveShadow />
      ))}
      {/* Dossier */}
      <RoundedBox args={[W - 0.02, backH - legH, backD]} radius={0.08} smoothness={5} position={[0, legH + (backH - legH) / 2, z0 + backD / 2]} material={fabric} castShadow receiveShadow />
      {/* Coussins d'assise et de dossier */}
      {[0, 1, 2].map((i) => {
        const x = -W / 2 + armW + cushionW * (i + 0.5)
        return (
          <group key={i}>
            <RoundedBox args={[cushionW - 0.012, 0.15, D - backD - 0.02]} radius={0.06} smoothness={5} position={[x, seatY + 0.075, z0 + backD + (D - backD) / 2 - 0.01]} material={fabric} castShadow receiveShadow />
            <RoundedBox args={[cushionW - 0.02, 0.42, 0.17]} radius={0.08} smoothness={5} position={[x, seatY + 0.15 + 0.2, z0 + backD + 0.06]} rotation-x={-0.12} material={fabric} castShadow receiveShadow />
          </group>
        )
      })}
    </group>
  )
}

/** Tapis en laine à chevrons, 230 × 160 cm, bords arrondis. */
export function WoolRug() {
  const wool = useFabric('rug_wool', 3, '#e8e2d8', 1.2)
  const geo = useMemo(() => {
    const W = 2.3
    const D = 1.6
    const r = 0.03
    const s = new THREE.Shape()
    s.moveTo(-W / 2 + r, -D / 2)
    s.lineTo(W / 2 - r, -D / 2)
    s.quadraticCurveTo(W / 2, -D / 2, W / 2, -D / 2 + r)
    s.lineTo(W / 2, D / 2 - r)
    s.quadraticCurveTo(W / 2, D / 2, W / 2 - r, D / 2)
    s.lineTo(-W / 2 + r, D / 2)
    s.quadraticCurveTo(-W / 2, D / 2, -W / 2, D / 2 - r)
    s.lineTo(-W / 2, -D / 2 + r)
    s.quadraticCurveTo(-W / 2, -D / 2, -W / 2 + r, -D / 2)
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.006, bevelSegments: 3, curveSegments: 6 })
    g.rotateX(-Math.PI / 2)
    g.translate(0, 0.003, 0)
    // Coordonnées de texture en mètres, divisées par la taille du motif
    const pos = g.attributes.position
    const uv = g.attributes.uv
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 1.5, pos.getZ(i) / 1.5)
    return g
  }, [])
  const mat = useMemo(() => {
    const m = wool.clone()
    for (const k of ['map', 'normalMap', 'roughnessMap'] as const) {
      const t = (m as THREE.MeshStandardMaterial)[k]
      if (t) t.repeat.set(1, 1)
    }
    return m
  }, [wool])
  return <mesh geometry={geo} material={mat} receiveShadow />
}

export function ProceduralModel({ id }: { id: string }) {
  if (id === 'sofa_lin') return <LinenSofa />
  if (id === 'rug_wool') return <WoolRug />
  return null
}
