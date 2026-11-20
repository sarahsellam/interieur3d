// Éléments d'architecture réalistes : murs découpés, fenêtres, portes, plinthes, corniches.
// Chaque mur est décrit par un segment (début → fin) sur sa face intérieure ;
// le repère local du mur est : x le long du mur, y vers le haut, z vers l'intérieur de la pièce.
// Ce système servira aussi pour les appartements tracés depuis un plan (étape 3).
import { useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

export interface WallOpening {
  id: string
  kind: 'fenetre' | 'porte'
  /** Position du centre le long du mur depuis le début du segment (m) */
  u: number
  width: number
  height: number
  sill: number
}

export interface WallSpec {
  key: string
  /** Début et fin de la face intérieure, coordonnées (x, z) */
  a: [number, number]
  b: [number, number]
  thickness: number
  height: number
  openings: WallOpening[]
  /** Prolonge le mur aux deux extrémités pour fermer les angles */
  extendEnds?: boolean
}

export interface ArchMaterials {
  wall: THREE.Material
  trim: THREE.Material
  frame: THREE.Material
  glass: THREE.Material
  metal: THREE.Material
  sill: THREE.Material
  ceiling: THREE.Material
}

/** Matrice de placement du repère local d'un mur. */
export function wallFrame(spec: WallSpec) {
  const [ax, az] = spec.a
  const [bx, bz] = spec.b
  const dx = bx - ax
  const dz = bz - az
  const length = Math.hypot(dx, dz)
  const angle = Math.atan2(-dz, dx)
  return { length, angle, position: [ax, 0, az] as [number, number, number] }
}

function wallGeometry(spec: WallSpec, length: number) {
  const T = spec.thickness
  const H = spec.height
  const ext = spec.extendEnds ? T : 0
  const doors = spec.openings.filter((o) => o.kind === 'porte').sort((p, q) => p.u - q.u)
  const shape = new THREE.Shape()
  shape.moveTo(-ext, 0)
  for (const d of doors) {
    const u0 = Math.max(0.02, d.u - d.width / 2)
    const u1 = Math.min(length - 0.02, d.u + d.width / 2)
    shape.lineTo(u0, 0)
    shape.lineTo(u0, d.height)
    shape.lineTo(u1, d.height)
    shape.lineTo(u1, 0)
  }
  shape.lineTo(length + ext, 0)
  shape.lineTo(length + ext, H)
  shape.lineTo(-ext, H)
  shape.closePath()
  for (const w of spec.openings.filter((o) => o.kind === 'fenetre')) {
    const u0 = w.u - w.width / 2
    const u1 = w.u + w.width / 2
    const hole = new THREE.Path()
    hole.moveTo(u0, w.sill)
    hole.lineTo(u0, w.sill + w.height)
    hole.lineTo(u1, w.sill + w.height)
    hole.lineTo(u1, w.sill)
    hole.closePath()
    shape.holes.push(hole)
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 1 })
  geo.translate(0, 0, -T)
  geo.computeVertexNormals()
  return geo
}

/** Profil mouluré extrudé le long du mur (plinthe, corniche). */
function profileGeometry(points: [number, number][], length: number, curve?: { at: number; control: [number, number] }) {
  const s = new THREE.Shape()
  points.forEach(([x, y], i) => {
    if (i === 0) s.moveTo(-x, y)
    else if (curve && i === curve.at) s.quadraticCurveTo(-curve.control[0], curve.control[1], -x, y)
    else s.lineTo(-x, y)
  })
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false, curveSegments: 6 })
  g.rotateY(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

function Baseboards({ spec, length, mat }: { spec: WallSpec; length: number; mat: THREE.Material }) {
  // Plinthe de 9 cm à bord arrondi, interrompue au droit des portes
  const pieces = useMemo(() => {
    const doors = spec.openings.filter((o) => o.kind === 'porte').map((d) => [d.u - d.width / 2 - 0.07, d.u + d.width / 2 + 0.07]).sort((p, q) => p[0] - q[0])
    const spans: [number, number][] = []
    let start = 0
    for (const [d0, d1] of doors) {
      if (d0 > start + 0.02) spans.push([start, d0])
      start = Math.max(start, d1)
    }
    if (length > start + 0.02) spans.push([start, length])
    return spans.map(([u0, u1]) => ({
      u0,
      geo: profileGeometry([[0, 0], [0.014, 0], [0.014, 0.074], [0.004, 0.09], [0, 0.09]], u1 - u0, { at: 3, control: [0.014, 0.088] }),
    }))
  }, [spec.openings, length])
  return (
    <>
      {pieces.map((p) => (
        <mesh key={p.u0} geometry={p.geo} material={mat} position={[p.u0, 0, 0]} receiveShadow castShadow />
      ))}
    </>
  )
}

function Cornice({ length, height, mat }: { length: number; height: number; mat: THREE.Material }) {
  const geo = useMemo(
    () => profileGeometry([[0, height - 0.055], [0, height], [0.055, height], [0.055, height - 0.008], [0.008, height - 0.055]], length, { at: 4, control: [0.052, height - 0.052] }),
    [length, height],
  )
  return <mesh geometry={geo} material={mat} receiveShadow />
}

/** Barre à arêtes adoucies (jamais d'angles vifs « cube »). */
function Bar({ p, s, mat, r = 0.005, shadow = true }: { p: [number, number, number]; s: [number, number, number]; mat: THREE.Material; r?: number; shadow?: boolean }) {
  return <RoundedBox args={s} radius={Math.min(r, Math.min(...s) / 2.2)} smoothness={3} position={p} material={mat} castShadow={shadow} receiveShadow />
}

/** Fenêtre à deux battants : dormant, ouvrants, vitrage, appui intérieur et crémone. */
function WindowUnit({ o, T, m }: { o: WallOpening; T: number; m: ArchMaterials }) {
  const u0 = o.u - o.width / 2
  const v0 = o.sill
  const W = o.width
  const H = o.height
  const z = -T * 0.62 // plan de la menuiserie, en retrait du nu intérieur
  const fw = 0.055 // largeur du dormant
  const fd = 0.07
  const cw = 0.06 // largeur des montants d'ouvrant
  const cd = 0.058
  const innerW = W - 2 * fw
  const leafW = innerW / 2
  const leaves = [u0 + fw + leafW / 2, u0 + fw + leafW * 1.5]
  const leafH = H - 2 * fw
  const yc = v0 + H / 2
  return (
    <group>
      {/* Dormant */}
      <Bar p={[u0 + fw / 2, yc, z]} s={[fw, H, fd]} mat={m.frame} />
      <Bar p={[u0 + W - fw / 2, yc, z]} s={[fw, H, fd]} mat={m.frame} />
      <Bar p={[o.u, v0 + H - fw / 2, z]} s={[W, fw, fd]} mat={m.frame} />
      <Bar p={[o.u, v0 + fw / 2, z]} s={[W, fw, fd]} mat={m.frame} />
      {leaves.map((cx, i) => (
        <group key={i}>
          <Bar p={[cx - leafW / 2 + cw / 2, yc, z + 0.012]} s={[cw, leafH, cd]} mat={m.frame} />
          <Bar p={[cx + leafW / 2 - cw / 2, yc, z + 0.012]} s={[cw, leafH, cd]} mat={m.frame} />
          <Bar p={[cx, yc + leafH / 2 - cw / 2, z + 0.012]} s={[leafW, cw, cd]} mat={m.frame} />
          <Bar p={[cx, yc - leafH / 2 + cw * 0.6, z + 0.012]} s={[leafW, cw * 1.2, cd]} mat={m.frame} />
          {/* Vitrage : ne bloque pas la lumière du soleil */}
          <mesh position={[cx, yc, z + 0.01]} material={m.glass} renderOrder={1}>
            <planeGeometry args={[leafW - 2 * cw + 0.01, leafH - 2.2 * cw + 0.01]} />
          </mesh>
        </group>
      ))}
      {/* Crémone (poignée) */}
      <Bar p={[o.u + cw * 0.5, yc, z + 0.012 + cd / 2 + 0.008]} s={[0.022, 0.06, 0.014]} mat={m.metal} r={0.004} shadow={false} />
      <Bar p={[o.u + cw * 0.5, yc - 0.045, z + 0.012 + cd / 2 + 0.03]} s={[0.016, 0.11, 0.016]} mat={m.metal} r={0.007} shadow={false} />
      {/* Appui intérieur (tablette) */}
      <Bar p={[o.u, v0 - 0.016, (z + 0.035) / 2]} s={[W + 0.08, 0.032, -z + 0.035]} mat={m.sill} r={0.006} />
    </group>
  )
}

/** Porte intérieure à deux panneaux moulurés, chambranle et béquille. */
function DoorUnit({ o, T, m }: { o: WallOpening; T: number; m: ArchMaterials }) {
  const W = o.width
  const H = o.height
  const u0 = o.u - W / 2
  const leafT = 0.04
  const zl = -T / 2
  const aw = 0.07 // largeur du chambranle
  const faceZ = zl + leafT / 2
  const panel = (y0: number, y1: number) => {
    const x0 = u0 + 0.12
    const x1 = u0 + W - 0.12
    const t = 0.022
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2
    return (
      <group key={y0}>
        <Bar p={[cx, y1 - t / 2, faceZ + 0.004]} s={[x1 - x0, t, 0.01]} mat={m.trim} r={0.004} shadow={false} />
        <Bar p={[cx, y0 + t / 2, faceZ + 0.004]} s={[x1 - x0, t, 0.01]} mat={m.trim} r={0.004} shadow={false} />
        <Bar p={[x0 + t / 2, cy, faceZ + 0.004]} s={[t, y1 - y0, 0.01]} mat={m.trim} r={0.004} shadow={false} />
        <Bar p={[x1 - t / 2, cy, faceZ + 0.004]} s={[t, y1 - y0, 0.01]} mat={m.trim} r={0.004} shadow={false} />
      </group>
    )
  }
  return (
    <group>
      {/* Vantail */}
      <Bar p={[o.u, (H - 0.008) / 2 + 0.006, zl]} s={[W - 0.012, H - 0.014, leafT]} mat={m.trim} r={0.004} />
      {panel(1.12, H - 0.16)}
      {panel(0.16, 0.98)}
      {/* Ébrasement (habillage de l'épaisseur du mur) */}
      <Bar p={[u0 - 0.009, H / 2, -T / 2]} s={[0.018, H, T]} mat={m.trim} r={0.003} />
      <Bar p={[u0 + W + 0.009, H / 2, -T / 2]} s={[0.018, H, T]} mat={m.trim} r={0.003} />
      <Bar p={[o.u, H + 0.009, -T / 2]} s={[W + 0.036, 0.018, T]} mat={m.trim} r={0.003} />
      {/* Chambranle côté pièce */}
      <Bar p={[u0 - aw / 2 + 0.01, (H + aw) / 2, 0.008]} s={[aw, H + aw, 0.016]} mat={m.trim} r={0.006} />
      <Bar p={[u0 + W + aw / 2 - 0.01, (H + aw) / 2, 0.008]} s={[aw, H + aw, 0.016]} mat={m.trim} r={0.006} />
      <Bar p={[o.u, H + aw / 2 - 0.01, 0.008]} s={[W + 2 * aw - 0.04, aw, 0.016]} mat={m.trim} r={0.006} />
      {/* Béquille et rosace */}
      <mesh position={[u0 + W - 0.075, 1.02, faceZ + 0.006]} rotation-x={Math.PI / 2} material={m.metal}>
        <cylinderGeometry args={[0.026, 0.026, 0.012, 24]} />
      </mesh>
      <mesh position={[u0 + W - 0.075, 1.02, faceZ + 0.035]} rotation-x={Math.PI / 2} material={m.metal}>
        <cylinderGeometry args={[0.009, 0.009, 0.05, 16]} />
      </mesh>
      <mesh position={[u0 + W - 0.13, 1.02, faceZ + 0.058]} rotation-z={Math.PI / 2} material={m.metal}>
        <capsuleGeometry args={[0.009, 0.1, 6, 12]} />
      </mesh>
    </group>
  )
}

export function Wall({ spec, m, groupRef }: { spec: WallSpec; m: ArchMaterials; groupRef?: (g: THREE.Group | null) => void }) {
  const { length, angle, position } = wallFrame(spec)
  const geo = useMemo(() => wallGeometry(spec, length), [spec, length])
  return (
    <group ref={groupRef} position={position} rotation-y={angle}>
      <mesh geometry={geo} material={m.wall} receiveShadow castShadow />
      <Baseboards spec={spec} length={length} mat={m.trim} />
      <Cornice length={length} height={spec.height} mat={m.ceiling} />
      {spec.openings.map((o) =>
        o.kind === 'fenetre' ? <WindowUnit key={o.id} o={o} T={spec.thickness} m={m} /> : <DoorUnit key={o.id} o={o} T={spec.thickness} m={m} />,
      )}
    </group>
  )
}
