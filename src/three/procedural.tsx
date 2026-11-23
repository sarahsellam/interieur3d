// Meubles « maison » construits par le code, avec de vraies textures PBR (Poly Haven, CC0).
// Ils sont paramétriques : changer leurs dimensions les reconstruit vraiment (pas d'étirement),
// et leur couleur teinte le tissu ou le bois. Formes arrondies, jamais de simples cubes.
import { useMemo } from 'react'
import { RoundedBox, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { texture } from '../data/finishes'
import { CUSTOM_PREFIX, getItem } from '../data/catalog'
import type { ItemDims, TextileMotif, Textiles } from '../model/types'

const DEFAULT_FABRIC = '#d8cdb9'
const DEFAULT_WOOD = '#c49a6c'

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

const mix = (a: string, b: string, t: number) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()

/** Tissu à motif (rayures, carreaux, pois) dessiné à la volée, avec le relief du lin. */
function usePatternFabric(color: string, motif: TextileMotif, repeat: number) {
  const [nor, rough] = useTexture([texture('linen_nor'), texture('linen_rough')])
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    g.fillStyle = color
    g.fillRect(0, 0, 256, 256)
    // Le motif est un ton plus soutenu (ou plus clair sur un tissu foncé)
    const dark = new THREE.Color(color).getHSL({ h: 0, s: 0, l: 0 }).l < 0.35
    const ink = mix(color, dark ? '#ffffff' : '#2b2624', dark ? 0.35 : 0.28)
    g.fillStyle = ink
    if (motif === 'rayures') for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 22, 256)
    if (motif === 'carreaux') {
      g.globalAlpha = 0.55
      for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 32, 256)
      for (let y = 0; y < 256; y += 64) g.fillRect(0, y, 256, 32)
      g.globalAlpha = 1
    }
    if (motif === 'pois')
      for (let y = 16; y < 256; y += 32)
        for (let x = (y / 32) % 2 ? 0 : 16; x < 256; x += 32) {
          g.beginPath()
          g.arc(x, y, 5, 0, Math.PI * 2)
          g.fill()
        }
    const map = new THREE.CanvasTexture(c)
    map.colorSpace = THREE.SRGBColorSpace
    map.wrapS = map.wrapT = THREE.RepeatWrapping
    map.repeat.set(repeat, repeat)
    const prep = (t: THREE.Texture) => {
      const k = t.clone()
      k.wrapS = k.wrapT = THREE.RepeatWrapping
      k.repeat.set(repeat * 2, repeat * 2)
      k.needsUpdate = true
      return k
    }
    return new THREE.MeshPhysicalMaterial({ map, normalMap: prep(nor), normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: prep(rough), roughness: 1, envMapIntensity: 0.6, sheen: 0.5, sheenRoughness: 0.8, sheenColor: new THREE.Color('#ffffff') })
  }, [nor, rough, color, motif, repeat])
}

/** Coussin décoratif carré, légèrement penché. */
function Cushion({ position, rotY = 0, color, size = 0.42 }: { position: [number, number, number]; rotY?: number; color: string; size?: number }) {
  const mat = useFabric('linen', 2, color, 1)
  return (
    <group position={position} rotation-y={rotY}>
      <RoundedBox args={[size, size, 0.14]} radius={0.06} smoothness={6} rotation-x={-0.32} material={mat} castShadow receiveShadow />
    </group>
  )
}

/** Bois de chêne (texture réelle en niveaux de gris) teinté de la couleur choisie. */
function useWood(color: string) {
  const [map, nor, rough] = useTexture([texture('wood_detail'), texture('wood_nor'), texture('wood_rough')])
  return useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace
    for (const t of [map, nor, rough]) t.wrapS = t.wrapT = THREE.RepeatWrapping
    return new THREE.MeshStandardMaterial({ map, normalMap: nor, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: rough, roughness: 0.85, color, envMapIntensity: 0.8 })
  }, [map, nor, rough, color])
}

function useMetal(color = '#b89a6a') {
  return useMemo(() => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.3 }), [color])
}

type P = { dims: ItemDims; color: string | null; textiles?: Textiles }

function Leg({ x, z, h, mat, r = 0.02 }: { x: number; z: number; h: number; mat: THREE.Material; r?: number }) {
  return (
    <mesh position={[x, h / 2, z]} material={mat} castShadow>
      <cylinderGeometry args={[r, r * 0.7, h, 16]} />
    </mesh>
  )
}

function Knob({ x, y, z, mat }: { x: number; y: number; z: number; mat: THREE.Material }) {
  return (
    <mesh position={[x, y, z]} material={mat}>
      <sphereGeometry args={[0.016, 16, 12]} />
    </mesh>
  )
}

/** Canapé 3 places contemporain, lin, pieds en chêne. */
export function LinenSofa({ dims, color, textiles }: P) {
  const fabric = useFabric('linen', 4, color ?? DEFAULT_FABRIC, 0.8)
  const oak = useWood('#8a6a4a')
  const { width: W, depth: D, height: H } = dims
  const legH = 0.12
  const baseH = 0.2
  const seatY = legH + baseH
  const armW = Math.min(0.2, W * 0.1)
  const armH = Math.min(0.62, H * 0.78)
  const backD = Math.min(0.22, D * 0.25)
  const n = Math.max(1, Math.round((W - 2 * armW) / 0.6))
  const cushionW = (W - 2 * armW) / n
  const z0 = -D / 2
  return (
    <group>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Leg key={`${sx}${sz}`} x={sx * (W / 2 - 0.09)} z={sz * (D / 2 - 0.09)} h={legH} mat={oak} />))}
      <RoundedBox args={[W, baseH, D]} radius={0.04} smoothness={4} position={[0, legH + baseH / 2, 0]} material={fabric} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[armW, armH - legH, D]} radius={0.07} smoothness={5} position={[s * (W / 2 - armW / 2), legH + (armH - legH) / 2, 0]} material={fabric} castShadow receiveShadow />
      ))}
      <RoundedBox args={[W - 0.02, H - legH, backD]} radius={0.08} smoothness={5} position={[0, legH + (H - legH) / 2, z0 + backD / 2]} material={fabric} castShadow receiveShadow />
      {Array.from({ length: n }, (_, i) => {
        const x = -W / 2 + armW + cushionW * (i + 0.5)
        return (
          <group key={i}>
            <RoundedBox args={[cushionW - 0.012, 0.15, D - backD - 0.02]} radius={0.06} smoothness={5} position={[x, seatY + 0.075, z0 + backD + (D - backD) / 2 - 0.01]} material={fabric} castShadow receiveShadow />
            <RoundedBox args={[cushionW - 0.02, Math.min(0.42, H - seatY - 0.1), 0.17]} radius={0.08} smoothness={5} position={[x, seatY + 0.15 + 0.2, z0 + backD + 0.06]} rotation-x={-0.12} material={fabric} castShadow receiveShadow />
          </group>
        )
      })}
      {/* Coussins décoratifs, posés contre le dossier, vers les accoudoirs */}
      {(textiles?.coussins ?? []).slice(0, 3).map((col, i, all) => {
        const slots = all.length === 1 ? [-1] : all.length === 2 ? [-1, 1] : [-1, 1, 0]
        const x = slots[i] === 0 ? 0 : slots[i] * (W / 2 - armW - 0.3)
        return <Cushion key={i} color={col} position={[x, seatY + 0.36, z0 + backD + 0.2]} rotY={slots[i] * -0.12} size={0.44} />
      })}
    </group>
  )
}

/** Lit avec tête de lit capitonnée, sommier tapissier, matelas, couette, oreillers et plaid. */
export function Bed({ dims, color, textiles }: P) {
  const frame = useFabric('linen', 4, color ?? DEFAULT_FABRIC, 0.8)
  const sheet = useFabric('linen', 5, textiles?.draps ?? '#f4f1ec', 0.5)
  const duvetPlain = useFabric('linen', 5, textiles?.couette ?? '#ebe5da', 0.9)
  const duvetPattern = usePatternFabric(textiles?.couette ?? '#ebe5da', textiles?.motif ?? 'uni', 3)
  const duvet = textiles?.motif && textiles.motif !== 'uni' ? duvetPattern : duvetPlain
  const throwMat = useFabric('rug_wool', 3, textiles?.plaid ?? '#d9cdb8', 1)
  const showThrow = textiles?.plaid !== null
  const oak = useWood('#8a6a4a')
  const { width: W, depth: D, height: H } = dims
  const legH = 0.08
  const baseH = 0.26
  const mattressH = 0.2
  const headT = 0.09
  const top = legH + baseH + mattressH
  const z0 = -D / 2
  const bodyD = D - headT
  const zc = z0 + headT + bodyD / 2
  const panels = Math.max(2, Math.round(W / 0.32))
  const pw = (W - 0.04) / panels
  const pillows = W > 1.25 ? 2 : 1
  const pillowW = Math.min(0.65, (W - 0.2) / pillows - 0.04)
  return (
    <group>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Leg key={`${sx}${sz}`} x={sx * (W / 2 - 0.08)} z={zc + sz * (bodyD / 2 - 0.08)} h={legH} mat={oak} r={0.025} />))}
      {/* Sommier tapissier */}
      <RoundedBox args={[W, baseH, bodyD]} radius={0.03} smoothness={4} position={[0, legH + baseH / 2, zc]} material={frame} castShadow receiveShadow />
      {/* Matelas */}
      <RoundedBox args={[W - 0.06, mattressH, bodyD - 0.04]} radius={0.06} smoothness={5} position={[0, legH + baseH + mattressH / 2, zc]} material={sheet} castShadow receiveShadow />
      {/* Couette repliée sur les deux tiers */}
      <RoundedBox args={[W + 0.02, 0.07, bodyD * 0.68]} radius={0.035} smoothness={5} position={[0, top + 0.02, z0 + headT + bodyD * 0.66]} material={duvet} castShadow receiveShadow />
      <RoundedBox args={[W + 0.04, mattressH * 0.8, 0.05]} radius={0.025} smoothness={4} position={[0, top - mattressH * 0.35, D / 2 - 0.005]} material={duvet} castShadow receiveShadow />
      {/* Plaid au pied du lit */}
      {showThrow && <RoundedBox args={[W + 0.05, 0.03, 0.34]} radius={0.015} smoothness={4} position={[0, top + 0.07, D / 2 - 0.26]} material={throwMat} castShadow receiveShadow />}
      {/* Coussins décoratifs devant les oreillers */}
      {(textiles?.coussins ?? []).slice(0, 3).map((col, i, all) => {
        const n = all.length
        const span = Math.min(W - 0.5, 0.5 * (n - 1))
        const x = n === 1 ? 0 : -span / 2 + (span / (n - 1)) * i
        return <Cushion key={i} color={col} position={[x, top + 0.2, z0 + headT + 0.55]} rotY={n === 1 ? 0 : (i - (n - 1) / 2) * -0.15} size={n === 3 && i === 1 ? 0.36 : 0.42} />
      })}
      {/* Oreillers */}
      {Array.from({ length: pillows }, (_, i) => {
        const x = pillows === 1 ? 0 : (i === 0 ? -1 : 1) * (pillowW / 2 + 0.03)
        return <RoundedBox key={i} args={[pillowW, 0.12, 0.46]} radius={0.045} smoothness={6} position={[x, top + 0.1, z0 + headT + 0.3]} rotation-x={-0.5} material={sheet} castShadow receiveShadow />
      })}
      {/* Tête de lit à côtes */}
      {Array.from({ length: panels }, (_, i) => (
        <RoundedBox key={i} args={[pw - 0.008, H - 0.03, headT]} radius={0.04} smoothness={5} position={[-W / 2 + 0.02 + pw * (i + 0.5), (H - 0.03) / 2 + 0.03, z0 + headT / 2]} material={frame} castShadow receiveShadow />
      ))}
    </group>
  )
}

/** Caisson en bois sur pieds avec tiroirs (chevet, commode). */
function DrawerChest({ dims, color, cols, rows }: P & { cols: number; rows: number }) {
  const wood = useWood(color ?? DEFAULT_WOOD)
  const brass = useMetal()
  const gap = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a2420', roughness: 1 }), [])
  const { width: W, depth: D, height: H } = dims
  const legH = Math.min(0.14, H * 0.2)
  const bodyH = H - legH
  const fw = (W - 0.04) / cols
  const fh = (bodyH - 0.06) / rows
  return (
    <group>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Leg key={`${sx}${sz}`} x={sx * (W / 2 - 0.04)} z={sz * (D / 2 - 0.04)} h={legH} mat={wood} r={0.018} />))}
      <RoundedBox args={[W, bodyH, D]} radius={0.012} smoothness={3} position={[0, legH + bodyH / 2, 0]} material={wood} castShadow receiveShadow />
      {/* Joints creux entre les façades de tiroirs */}
      <mesh position={[0, legH + bodyH / 2 - 0.01, D / 2 + 0.0005]} material={gap}>
        <planeGeometry args={[W - 0.04, bodyH - 0.06]} />
      </mesh>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const x = -W / 2 + 0.02 + fw * (c + 0.5)
          const y = legH + 0.02 + fh * (r + 0.5)
          return (
            <group key={`${r}-${c}`}>
              <RoundedBox args={[fw - 0.006, fh - 0.006, 0.02]} radius={0.005} smoothness={3} position={[x, y, D / 2 + 0.009]} material={wood} castShadow receiveShadow />
              <Knob x={x} y={y} z={D / 2 + 0.03} mat={brass} />
            </group>
          )
        }),
      )}
    </group>
  )
}

/** Armoire à deux portes, poignées verticales, socle. */
function Wardrobe({ dims, color }: P) {
  const wood = useWood(color ?? DEFAULT_WOOD)
  const brass = useMetal()
  const { width: W, depth: D, height: H } = dims
  const n = Math.max(1, Math.round(W / 0.55))
  const dw = (W - 0.03) / n
  return (
    <group>
      <RoundedBox args={[W - 0.04, 0.07, D - 0.04]} radius={0.005} smoothness={2} position={[0, 0.035, -0.01]} material={wood} receiveShadow />
      <RoundedBox args={[W, H - 0.07, D - 0.03]} radius={0.012} smoothness={3} position={[0, 0.07 + (H - 0.07) / 2, -0.015]} material={wood} castShadow receiveShadow />
      {Array.from({ length: n }, (_, i) => {
        const x = -W / 2 + 0.015 + dw * (i + 0.5)
        const hx = i % 2 === 0 ? x + dw / 2 - 0.05 : x - dw / 2 + 0.05
        return (
          <group key={i}>
            <RoundedBox args={[dw - 0.006, H - 0.1, 0.022]} radius={0.006} smoothness={3} position={[x, 0.08 + (H - 0.1) / 2, D / 2 - 0.016]} material={wood} castShadow receiveShadow />
            <RoundedBox args={[0.014, 0.32, 0.018]} radius={0.006} smoothness={3} position={[hx, 1.05, D / 2 + 0.008]} material={brass} />
          </group>
        )
      })}
    </group>
  )
}

/** Plateau sur pieds fuselés avec ceinture à tiroir (bureau, coiffeuse). */
function TableWithDrawer({ W, D, topY, wood, brass }: { W: number; D: number; topY: number; wood: THREE.Material; brass: THREE.Material }) {
  const apronH = 0.11
  return (
    <group>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Leg key={`${sx}${sz}`} x={sx * (W / 2 - 0.04)} z={sz * (D / 2 - 0.04)} h={topY - 0.025} mat={wood} r={0.02} />))}
      <RoundedBox args={[W, 0.028, D]} radius={0.01} smoothness={3} position={[0, topY - 0.014, 0]} material={wood} castShadow receiveShadow />
      <RoundedBox args={[W - 0.06, apronH, D - 0.08]} radius={0.006} smoothness={2} position={[0, topY - 0.028 - apronH / 2, -0.01]} material={wood} castShadow receiveShadow />
      <RoundedBox args={[W * 0.45, apronH - 0.02, 0.018]} radius={0.004} smoothness={2} position={[0, topY - 0.028 - apronH / 2, D / 2 - 0.045]} material={wood} />
      <Knob x={0} y={topY - 0.028 - apronH / 2} z={D / 2 - 0.025} mat={brass} />
    </group>
  )
}

/** Coiffeuse : table à tiroir et miroir à cadre de bois. */
function DressingTable({ dims, color }: P) {
  const wood = useWood(color ?? DEFAULT_WOOD)
  const brass = useMetal()
  const mirror = useMemo(() => new THREE.MeshStandardMaterial({ color: '#dfe6e8', metalness: 1, roughness: 0.03, envMapIntensity: 1.3 }), [])
  const { width: W, depth: D, height: H } = dims
  // Coiffeuse basse (sans miroir) : simple table à tiroir
  if (H < 1.05) return <TableWithDrawer W={W} D={D} topY={H} wood={wood} brass={brass} />
  const topY = Math.min(0.76, H * 0.55)
  const mw = Math.min(0.62, W * 0.62)
  const mh = Math.max(0.3, H - topY - 0.04)
  const my = topY + 0.02 + mh / 2
  const mz = -D / 2 + 0.06
  return (
    <group>
      <TableWithDrawer W={W} D={D} topY={topY} wood={wood} brass={brass} />
      {/* Cadre du miroir et glace */}
      <RoundedBox args={[mw, mh, 0.035]} radius={0.015} smoothness={4} position={[0, my, mz]} rotation-x={-0.06} material={wood} castShadow receiveShadow />
      <mesh position={[0, my, mz + 0.019]} rotation-x={-0.06} material={mirror}>
        <planeGeometry args={[mw - 0.07, mh - 0.07]} />
      </mesh>
      <RoundedBox args={[mw * 0.7, 0.03, 0.12]} radius={0.01} smoothness={3} position={[0, topY + 0.015, mz]} material={wood} castShadow />
    </group>
  )
}

function Desk({ dims, color }: P) {
  const wood = useWood(color ?? DEFAULT_WOOD)
  const brass = useMetal()
  return <TableWithDrawer W={dims.width} D={dims.depth} topY={dims.height} wood={wood} brass={brass} />
}

/** Tabouret rembourré sur pieds en chêne. */
function Stool({ dims, color }: P) {
  const fabric = useFabric('linen', 3, color ?? DEFAULT_FABRIC, 0.8)
  const oak = useWood('#8a6a4a')
  const { width: W, depth: D, height: H } = dims
  return (
    <group>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Leg key={`${sx}${sz}`} x={sx * (W / 2 - 0.05)} z={sz * (D / 2 - 0.05)} h={H - 0.1} mat={oak} r={0.018} />))}
      <RoundedBox args={[W, 0.12, D]} radius={0.05} smoothness={5} position={[0, H - 0.06, 0]} material={fabric} castShadow receiveShadow />
    </group>
  )
}

/** Tapis en laine à chevrons, bords arrondis. */
export function WoolRug({ dims, color }: P) {
  const wool = useFabric('rug_wool', 1, color ?? '#e8e2d8', 1.2)
  const { width: W, depth: D } = dims
  const geo = useMemo(() => {
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
  }, [W, D])
  return <mesh geometry={geo} material={wool} receiveShadow />
}

/**
 * Représentation simplifiée d'un meuble ajouté depuis un lien ou à la main :
 * une forme sobre selon son type (lit, assise, table, rangement), aux dimensions saisies.
 * Elle est signalée comme telle dans l'interface.
 */
function SimplifiedFurniture({ dims, color, category }: P & { category: string }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: color ?? '#cbbfae', roughness: 0.75, envMapIntensity: 0.6 }), [color])
  const { width: W, depth: D, height: H } = dims
  const r = Math.min(0.03, Math.min(W, D, H) / 4)
  if (category === 'table') {
    const t = Math.min(0.04, H * 0.1)
    return (
      <group>
        <RoundedBox args={[W, t, D]} radius={Math.min(r, t / 2.2)} smoothness={3} position={[0, H - t / 2, 0]} material={mat} castShadow receiveShadow />
        {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Leg key={`${sx}${sz}`} x={sx * (W / 2 - 0.05)} z={sz * (D / 2 - 0.05)} h={H - t} mat={mat} r={0.02} />))}
      </group>
    )
  }
  if (category === 'assise' || category === 'lit') {
    const seatH = Math.min(category === 'lit' ? 0.5 : 0.45, H * 0.55)
    const backD = Math.min(0.2, D * 0.25)
    return (
      <group>
        <RoundedBox args={[W, seatH, D]} radius={r * 2} smoothness={4} position={[0, seatH / 2, 0]} material={mat} castShadow receiveShadow />
        <RoundedBox args={[W, H, backD]} radius={r * 2} smoothness={4} position={[0, H / 2, -D / 2 + backD / 2]} material={mat} castShadow receiveShadow />
      </group>
    )
  }
  return <RoundedBox args={[W, H, D]} radius={r} smoothness={3} position={[0, H / 2, 0]} material={mat} castShadow receiveShadow />
}

export function ProceduralModel({ id, dims, color, textiles }: { id: string } & P) {
  if (id.startsWith(CUSTOM_PREFIX)) {
    const c = getItem(id)
    return <SimplifiedFurniture dims={dims} color={color ?? c?.color ?? null} category={c?.category ?? 'rangement'} />
  }
  // Une référence du commerce est dessinée avec le meuble du catalogue qui lui ressemble
  switch (getItem(id)?.base ?? id) {
    case 'sofa_lin':
      return <LinenSofa dims={dims} color={color} textiles={textiles} />
    case 'rug_wool':
      return <WoolRug dims={dims} color={color} />
    case 'lit_double':
    case 'lit_simple':
      return <Bed dims={dims} color={color} textiles={textiles} />
    case 'chevet':
      return <DrawerChest dims={dims} color={color} cols={1} rows={2} />
    case 'commode':
      return <DrawerChest dims={dims} color={color} cols={dims.width > 0.9 ? 2 : 1} rows={3} />
    case 'armoire':
      return <Wardrobe dims={dims} color={color} />
    case 'coiffeuse':
      return <DressingTable dims={dims} color={color} />
    case 'bureau':
      return <Desk dims={dims} color={color} />
    case 'tabouret':
      return <Stool dims={dims} color={color} />
    default:
      return null
  }
}
