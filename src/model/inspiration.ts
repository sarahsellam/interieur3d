// Exploiter une inspiration sans IA :
// - couleurs principales d'une photo (regroupement des pixels proches) ;
// - suggestions tirées de la note (« commode en bois clair », « mur vert »…).

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

/** 5 couleurs principales de l'image, de la plus présente à la moins présente. */
export async function extractPalette(url: string, count = 5): Promise<string[]> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = url
  await img.decode()
  const S = 64
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, S, S)
  const data = ctx.getImageData(0, 0, S, S).data
  const px: [number, number, number][] = []
  for (let i = 0; i < data.length; i += 4) px.push([data[i], data[i + 1], data[i + 2]])
  // k-moyennes simples, départ réparti sur la luminosité
  const k = 8
  const sorted = [...px].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]))
  let centers = Array.from({ length: k }, (_, i) => sorted[Math.floor(((i + 0.5) / k) * sorted.length)].slice() as [number, number, number])
  let sizes = new Array(k).fill(0)
  for (let it = 0; it < 10; it++) {
    const sums = centers.map(() => [0, 0, 0])
    sizes = new Array(k).fill(0)
    for (const p of px) {
      let best = 0
      let bd = Infinity
      centers.forEach((ce, j) => {
        const d = (p[0] - ce[0]) ** 2 + (p[1] - ce[1]) ** 2 + (p[2] - ce[2]) ** 2
        if (d < bd) (bd = d), (best = j)
      })
      sums[best][0] += p[0]
      sums[best][1] += p[1]
      sums[best][2] += p[2]
      sizes[best]++
    }
    centers = centers.map((ce, j) => (sizes[j] ? [sums[j][0] / sizes[j], sums[j][1] / sizes[j], sums[j][2] / sizes[j]] : ce))
  }
  const order = centers.map((ce, j) => ({ ce, n: sizes[j] })).sort((a, b) => b.n - a.n)
  const out: [number, number, number][] = []
  for (const { ce, n } of order) {
    if (!n) continue
    if (out.every((o) => Math.abs(o[0] - ce[0]) + Math.abs(o[1] - ce[1]) + Math.abs(o[2] - ce[2]) > 40)) out.push(ce)
    if (out.length === count) break
  }
  return out.map((c) => hex(...c))
}

export type Suggestion =
  | { kind: 'item'; modelId: string; color: string | null; label: string }
  | { kind: 'wall'; color: string; label: string }

const FURNITURE: [RegExp, string, string][] = [
  [/table basse/, 'modern_coffee_table_01', 'Table basse'],
  [/table de chevet|chevet/, 'chevet', 'Table de chevet'],
  [/coiffeuse/, 'coiffeuse', 'Coiffeuse'],
  [/canap[eé]|sofa/, 'sofa_lin', 'Canapé'],
  [/fauteuil/, 'mid_century_lounge_chair', 'Fauteuil'],
  [/tabouret|pouf/, 'tabouret', 'Tabouret'],
  [/chaise/, 'dining_chair_02', 'Chaise'],
  [/bureau/, 'bureau', 'Bureau'],
  [/commode/, 'commode', 'Commode'],
  [/armoire|penderie/, 'armoire', 'Armoire'],
  [/[eé]tag[eè]re|biblioth[eè]que/, 'wooden_display_shelves_01', 'Étagère'],
  [/buffet|meuble tv/, 'modern_wooden_cabinet', 'Buffet bas'],
  [/tapis/, 'rug_wool', 'Tapis'],
  [/plante/, 'potted_plant_02', 'Plante'],
  [/\blit\b/, 'lit_double', 'Lit'],
  [/\btable\b/, 'wooden_table_02', 'Table'],
]

// Couleurs : [mot, teinte pour un meuble, teinte pour un mur, nom affiché]
const COLORS: [RegExp, string, string, string][] = [
  [/bois clair|ch[eê]ne clair|blond/, '#d9b98f', '#e2d8c8', 'bois clair'],
  [/bois fonc[eé]|noyer/, '#7a5338', '#8c8178', 'bois foncé'],
  [/ch[eê]ne|\bbois\b/, '#b88d5e', '#c9b39d', 'chêne'],
  [/vert (fonc[eé]|bouteille|for[eê]t)/, '#4f6150', '#7f8b7f', 'vert foncé'],
  [/vert|sauge|olive/, '#a3ad94', '#b9c0ad', 'vert sauge'],
  [/vieux rose/, '#b98a86', '#b98a86', 'vieux rose'],
  [/rose/, '#ddb8b0', '#e3c4bd', 'rose poudré'],
  [/terracotta|terre cuite|rouille/, '#b9765a', '#b9765a', 'terracotta'],
  [/bordeaux/, '#742f45', '#b98a86', 'bordeaux'],
  [/bleu/, '#3e4a5c', '#bcc6cc', 'bleu'],
  [/noir/, '#3a3633', '#55524e', 'noir'],
  [/gris/, '#9a958e', '#cdc5b8', 'gris'],
  [/blanc|cr[eè]me|ivoire/, '#efebe4', '#ece8e1', 'blanc cassé'],
  [/beige|lin|naturel/, '#d8cdb9', '#e2d8c8', 'lin naturel'],
]

/** Suggestions tirées de la note : meubles (avec leur couleur) et couleurs de murs. */
export function suggestFromNote(note: string): Suggestion[] {
  const out: Suggestion[] = []
  const phrases = note
    .toLowerCase()
    .split(/[,;.\n]|\bet\b|\bavec\b/)
    .map((p) => p.trim())
    .filter(Boolean)
  for (const p of phrases) {
    const color = COLORS.find(([re]) => re.test(p))
    const furn = /\bmur|murs|peinture|paroi\b/.test(p) ? undefined : FURNITURE.find(([re]) => re.test(p))
    if (furn) {
      out.push({ kind: 'item', modelId: furn[1], color: color ? color[1] : null, label: `${furn[2]}${color ? ` · ${color[3]}` : ''}` })
    } else if (color) {
      out.push({ kind: 'wall', color: color[2], label: `Mur ${color[3]}` })
    }
  }
  // Pas de doublons
  return out.filter((s, i) => out.findIndex((o) => o.label === s.label) === i).slice(0, 6)
}
