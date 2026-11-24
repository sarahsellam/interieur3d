// Plan PDF de la pièce, à l'échelle, pour un artisan ou pour faire ses achats :
// murs, portes et fenêtres, cotes (dimensions intérieures et position des ouvertures),
// meubles numérotés, légende (dimensions, statut, prix), couleurs des murs, sol, budget.
// Format A4 paysage ; l'échelle (1:20, 1:25, 1:50…) est choisie pour que la pièce tienne.
import { getItem, itemPrice } from '../data/catalog'
import { FLOORS, WALL_COLORS } from '../data/finishes'
import { budgetOf, itemDims, openingCenter, openingDepth, wallAxes, wallLength } from './geometry'
import type { Layout, Opening, PlacedItem } from './types'
import { OPENING_LABEL, WALL_LABEL, WALL_ORDER } from './types'

type V = [number, number]
const T = 0.12 // épaisseur des murs dessinés (m)

/** Le PDF n'utilise que des caractères latins simples : espaces insécables remplacés. */
const t = (s: string) => s.replace(/[  ]/g, ' ').replace(/[‘’]/g, "'")
const eur = (v: number) => t(`${v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`)
const cm = (m: number) => `${Math.round(m * 100)}`

export async function roomPlanPdf(layout: Layout, projectName: string): Promise<File> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const PW = 297
  const PH = 210
  const M = 12
  const INK = '#292321'
  const SOFT = '#6e625c'
  const BORD = '#742f45'

  // ---- En-tête
  doc.setTextColor(INK)
  doc.setFont('times', 'normal')
  doc.setFontSize(20)
  doc.text(t(projectName), M, M + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(SOFT)
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  doc.text(t(`${layout.name} · ${date} · Mon Intérieur 3D`), M, M + 12)

  // ---- Zone du plan (gauche) et échelle
  const room = layout.room
  const legendW = 92
  const area = { x: M + 10, y: M + 26, w: PW - 2 * M - legendW - 26, h: PH - M - (M + 26) - 14 }
  const margin = 0.75 // place pour les cotes autour de la pièce (m)
  const needW = room.width + 2 * (T + margin)
  const needH = room.depth + 2 * (T + margin)
  const scales = [20, 25, 30, 40, 50, 75, 100, 150, 200]
  const scale = scales.find((s) => (needW * 1000) / s <= area.w && (needH * 1000) / s <= area.h) ?? 200
  const k = 1000 / scale // mm sur la page pour 1 m
  const cx = area.x + area.w / 2
  const cy = area.y + area.h / 2
  const P = (p: V): V => [cx + p[0] * k, cy + p[1] * k]

  const poly = (pts: V[], style: 'S' | 'F' | 'FD') => {
    const q = pts.map(P)
    const segs = q.slice(1).map((p, i) => [p[0] - q[i][0], p[1] - q[i][1]])
    doc.lines(segs, q[0][0], q[0][1], [1, 1], style, true)
  }
  const line = (a: V, b: V) => {
    const [x1, y1] = P(a)
    const [x2, y2] = P(b)
    doc.line(x1, y1, x2, y2)
  }
  const add = (a: V, b: V, s = 1): V => [a[0] + b[0] * s, a[1] + b[1] * s]

  // ---- Sol (léger) et murs
  const W2 = room.width / 2
  const D2 = room.depth / 2
  doc.setFillColor('#f5f1ea')
  poly([[-W2, -D2], [W2, -D2], [W2, D2], [-W2, D2]], 'F')
  doc.setFillColor(INK)
  doc.setDrawColor(INK)
  const ring: V[] = [[-W2 - T, -D2 - T], [W2 + T, -D2 - T], [W2 + T, D2 + T], [-W2 - T, D2 + T]]
  // Quatre bandes de mur
  poly([ring[0], ring[1], [W2, -D2], [-W2, -D2]], 'F')
  poly([ring[1], ring[2], [W2, D2], [W2, -D2]], 'F')
  poly([ring[2], ring[3], [-W2, D2], [W2, D2]], 'F')
  poly([ring[3], ring[0], [-W2, -D2], [-W2, D2]], 'F')

  // ---- Ouvertures
  const opening = (o: Opening) => {
    const ax = wallAxes(room, o.wall)
    const c = openingCenter(room, o)
    const C: V = [c.x, c.z]
    const dir = ax.dir as V
    const inw = ax.inward as V
    const s0 = add(C, dir, -o.width / 2)
    const s1 = add(C, dir, o.width / 2)
    const out = (p: V, d: number) => add(p, inw, -d)
    doc.setLineWidth(0.25)
    doc.setDrawColor(INK)
    if (o.kind === 'placard') {
      const d = openingDepth(o)
      doc.setFillColor('#ffffff')
      poly([s0, s1, add(s1, inw, d), add(s0, inw, d)], 'FD')
      doc.setLineWidth(0.15)
      line(s0, add(s1, inw, d))
      line(s1, add(s0, inw, d))
      return
    }
    // Trou dans le mur
    doc.setFillColor('#ffffff')
    poly([s0, s1, out(s1, T), out(s0, T)], 'F')
    if (o.kind === 'niche') {
      doc.setFillColor('#f5f1ea')
      poly([s0, s1, out(s1, Math.min(openingDepth(o), T - 0.02)), out(s0, Math.min(openingDepth(o), T - 0.02))], 'FD')
      return
    }
    if (o.kind !== 'porte') {
      line(out(s0, T * 0.4), out(s1, T * 0.4))
      line(out(s0, T * 0.6), out(s1, T * 0.6))
      line(s0, out(s0, T))
      line(s1, out(s1, T))
    }
    const swing = (o.swing ?? 'interieur') === 'interieur' ? 1 : -1
    const leaf = (hinge: V, len: number, towards: number) => {
      const open = add(hinge, inw, len * swing)
      doc.setLineWidth(0.35)
      line(hinge, open)
      // Arc de débattement en pointillés
      doc.setLineWidth(0.15)
      doc.setLineDashPattern([0.8, 0.6], 0)
      const n = 18
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * (Math.PI / 2)
        const a1 = ((i + 1) / n) * (Math.PI / 2)
        const pt = (a: number) => add(add(hinge, dir, len * towards * Math.cos(a)), inw, len * swing * Math.sin(a))
        line(pt(a0), pt(a1))
      }
      doc.setLineDashPattern([], 0)
    }
    if (o.kind === 'porte-fenetre') {
      leaf(s0, o.width / 2, 1)
      leaf(s1, o.width / 2, -1)
    } else if (o.kind === 'porte') {
      const hinge = o.hinge === 'gauche' ? s0 : s1
      leaf(hinge, o.width, o.hinge === 'gauche' ? 1 : -1)
    }
  }
  layout.openings.forEach(opening)

  // ---- Meubles (numérotés)
  const items = layout.items.filter((it) => getItem(it.modelId))
  const footprint = (it: PlacedItem): V[] => {
    const d = itemDims(it)
    const c = Math.cos(it.rot)
    const s = Math.sin(it.rot)
    return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as V[]).map(([sx, sz]) => {
      const x = (sx * d.width) / 2
      const z = (sz * d.depth) / 2
      return [it.x + x * c + z * s, it.z - x * s + z * c] as V
    })
  }
  // Tapis d'abord (en dessous), puis les autres
  const order = [...items].sort((a, b) => Number(!!getItem(b.modelId)?.floorLayer) - Number(!!getItem(a.modelId)?.floorLayer))
  for (const it of order) {
    const rug = getItem(it.modelId)?.floorLayer
    doc.setLineWidth(rug ? 0.15 : 0.3)
    doc.setDrawColor(rug ? SOFT : INK)
    doc.setFillColor(rug ? '#efe9df' : '#ffffff')
    if (rug) doc.setLineDashPattern([1, 0.8], 0)
    poly(footprint(it), 'FD')
    doc.setLineDashPattern([], 0)
    if (!rug) {
      // Face avant : trait épais
      const f = footprint(it)
      doc.setLineWidth(0.7)
      line(f[2], f[3])
    }
  }
  items.forEach((it, i) => {
    const [x, y] = P([it.x, it.z])
    doc.setFillColor(BORD)
    doc.circle(x, y, 2.6, 'F')
    doc.setTextColor('#ffffff')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text(String(i + 1), x, y + 0.9, { align: 'center' })
  })
  doc.setFont('helvetica', 'normal')

  // ---- Cotes : dimensions intérieures et chaîne des ouvertures sur chaque mur
  doc.setTextColor(INK)
  doc.setDrawColor(SOFT)
  doc.setLineWidth(0.15)
  const dimLine = (a: V, b: V, off: V, label: string) => {
    const A = add(a, off)
    const B = add(b, off)
    line(a, add(a, off, 1.15))
    line(b, add(b, off, 1.15))
    line(A, B)
    // Petites barres obliques aux extrémités (style architecte)
    for (const p of [A, B]) {
      const [x, y] = P(p)
      doc.line(x - 1, y + 1, x + 1, y - 1)
    }
    const [mx, my] = P([(A[0] + B[0]) / 2, (A[1] + B[1]) / 2])
    const vertical = Math.abs(a[0] - b[0]) < 1e-6
    doc.setFontSize(6.5)
    if (vertical) doc.text(label, mx - 1.2, my, { angle: 90, align: 'center' })
    else doc.text(label, mx, my - 1.2, { align: 'center' })
  }
  for (const w of WALL_ORDER) {
    const ax = wallAxes(room, w)
    const L = wallLength(room, w)
    const dir = ax.dir as V
    const outward: V = [-ax.inward[0], -ax.inward[1]]
    // Points le long du mur : coin, bords des ouvertures, coin
    const cuts = layout.openings
      .filter((o) => o.wall === w)
      .flatMap((o) => {
        const u = L / 2 + o.offset
        return [u - o.width / 2, u + o.width / 2]
      })
      .sort((p, q) => p - q)
    const us = [0, ...cuts, L]
    const near = add([0, 0], outward, T + 0.22)
    const total = t(`${WALL_LABEL[w]} · ${cm(L)}`)
    if (!cuts.length) dimLine(ax.a as V, ax.b as V, near, total)
    else {
      for (let i = 0; i < us.length - 1; i++) {
        if (us[i + 1] - us[i] < 0.02) continue
        dimLine(add(ax.a as V, dir, us[i]), add(ax.a as V, dir, us[i + 1]), near, cm(us[i + 1] - us[i]))
      }
      // Longueur totale intérieure, plus loin, avec le nom du mur
      dimLine(ax.a as V, ax.b as V, add([0, 0], outward, T + 0.5), total)
    }
  }

  // ---- Échelle graphique et note
  const sbY = PH - M - 4
  const one = k // 1 m
  doc.setFillColor(INK)
  doc.rect(area.x, sbY, one, 1.2, 'F')
  doc.setFillColor('#ffffff')
  doc.setDrawColor(INK)
  doc.rect(area.x + one, sbY, one, 1.2, 'FD')
  doc.setFontSize(6.5)
  doc.setTextColor(INK)
  doc.text('0', area.x, sbY - 1, { align: 'center' })
  doc.text('1 m', area.x + one, sbY - 1, { align: 'center' })
  doc.text('2 m', area.x + 2 * one, sbY - 1, { align: 'center' })
  doc.setTextColor(SOFT)
  doc.text(t(`Échelle 1:${scale} (imprimer à 100 %, sans ajustement) · cotes intérieures en cm · hauteur sous plafond ${cm(room.height)} cm`), area.x + 2 * one + 6, sbY + 1)

  // ---- Légende (droite)
  const lx = PW - M - legendW
  let ly = M + 26
  doc.setTextColor(INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(t(`Pièce : ${cm(room.width)} × ${cm(room.depth)} cm · ${(room.width * room.depth).toFixed(1).replace('.', ',')} m²`), lx, ly)
  ly += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  const floor = FLOORS.find((f) => f.id === layout.floorId)?.name
  if (floor) {
    doc.text(t(`Sol : ${floor}`), lx, ly)
    ly += 4.5
  }
  // Couleurs des murs
  for (const w of WALL_ORDER) {
    const hex = layout.wallColors[w]
    doc.setFillColor(hex)
    doc.setDrawColor('#cccccc')
    doc.rect(lx, ly - 2.6, 3.2, 3.2, 'FD')
    const name = WALL_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? 'couleur personnalisée'
    doc.text(t(`${WALL_LABEL[w]} : ${name} (${hex.toUpperCase()})`), lx + 5, ly)
    ly += 4.5
  }
  if (layout.openings.length) {
    ly += 1.5
    doc.setFont('helvetica', 'bold')
    doc.text('Ouvertures', lx, ly)
    doc.setFont('helvetica', 'normal')
    ly += 4.5
    for (const o of layout.openings) {
      doc.text(t(`${OPENING_LABEL[o.kind]} · ${WALL_LABEL[o.wall]} · ${cm(o.width)} × ${cm(o.height)} cm${o.sill > 0 ? ` · allège ${cm(o.sill)} cm` : ''}`), lx, ly)
      ly += 4
    }
  }

  ly += 3
  doc.setFont('helvetica', 'bold')
  doc.text('Meubles', lx, ly)
  doc.text('Statut', lx + 62, ly)
  doc.text('Prix', lx + legendW, ly, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  ly += 1.5
  doc.setDrawColor('#d9d2c8')
  doc.line(lx, ly, lx + legendW, ly)
  ly += 4
  items.forEach((it, i) => {
    if (ly > PH - M - 18) return
    const c = getItem(it.modelId)!
    const d = itemDims(it)
    const name = doc.splitTextToSize(t(c.name), 52)[0] as string
    doc.setTextColor(BORD)
    doc.setFont('helvetica', 'bold')
    doc.text(String(i + 1), lx, ly)
    doc.setTextColor(INK)
    doc.setFont('helvetica', 'normal')
    doc.text(name, lx + 5, ly)
    doc.setTextColor(SOFT)
    doc.setFontSize(6.5)
    doc.text(t(`${cm(d.width)} × ${cm(d.depth)} × ${cm(d.height)} cm${c.vendor ? ` · ${c.vendor}` : ''}`), lx + 5, ly + 3)
    doc.setFontSize(7.5)
    const toBuy = it.status === 'a-acheter'
    doc.setTextColor(toBuy ? BORD : SOFT)
    doc.text(toBuy ? 'À acheter' : 'Possédé', lx + 62, ly)
    const p = itemPrice(it)
    doc.setTextColor(INK)
    if (toBuy) doc.text(p === null ? '—' : eur(p), lx + legendW, ly, { align: 'right' })
    ly += 7
  })
  const b = budgetOf(layout, itemPrice)
  doc.setDrawColor('#d9d2c8')
  doc.line(lx, ly - 3, lx + legendW, ly - 3)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(INK)
  doc.text('Total à acheter', lx, ly + 2)
  doc.setTextColor(BORD)
  doc.text(eur(b.total), lx + legendW, ly + 2, { align: 'right' })
  if (b.missing) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(SOFT)
    doc.text(t(`${b.missing} meuble${b.missing > 1 ? 's' : ''} sans prix`), lx, ly + 6)
  }

  const safe = (projectName + ' ' + layout.name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
  return new File([doc.output('blob')], `plan-${safe || 'piece'}.pdf`, { type: 'application/pdf' })
}
