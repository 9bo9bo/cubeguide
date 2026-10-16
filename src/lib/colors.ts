export type FaceId = 'U' | 'R' | 'F' | 'D' | 'L' | 'B'

export type StickerColor = FaceId

export const FACE_ORDER: FaceId[] = ['U', 'R', 'F', 'D', 'L', 'B']

export const FACE_LABELS: Record<FaceId, string> = {
  U: '上面（白）',
  D: '下面（黄）',
  F: '前面（緑）',
  B: '後面（青）',
  R: '右面（赤）',
  L: '左面（橙）',
}

export const FACE_SHORT: Record<FaceId, string> = {
  U: '上',
  D: '下',
  F: '前',
  B: '後',
  R: '右',
  L: '左',
}

/** Faces touching each edge of a face as drawn in the net (top, right, bottom, left). */
export const FACE_NEIGHBORS: Record<FaceId, { top: FaceId; right: FaceId; bottom: FaceId; left: FaceId }> = {
  U: { top: 'B', right: 'R', bottom: 'F', left: 'L' },
  L: { top: 'U', right: 'F', bottom: 'D', left: 'B' },
  F: { top: 'U', right: 'R', bottom: 'D', left: 'L' },
  R: { top: 'U', right: 'B', bottom: 'D', left: 'F' },
  B: { top: 'U', right: 'L', bottom: 'D', left: 'R' },
  D: { top: 'F', right: 'R', bottom: 'B', left: 'L' },
}

/** How to hold the cube (white up, green toward you) to see each face as drawn. */
export const FACE_VIEW_HINT: Record<FaceId, string> = {
  F: '白を上・緑を手前にして、そのまま正面から見ます。',
  R: '白を上にしたまま、キューブを左へ90°回して赤を正面にします。',
  B: '白を上にしたまま、キューブを180°回して青を正面にします。',
  L: '白を上にしたまま、キューブを右へ90°回して橙を正面にします。',
  U: '緑を手前にしたまま、上から白面をのぞき込みます（奥の青側が上辺）。',
  D: '緑を手前にしたまま、キューブを持ち上げて下から黄面を見ます（緑側が上辺）。',
}

/** Standard Western color scheme (hex) */
export const COLOR_HEX: Record<StickerColor, string> = {
  U: '#f5f5f5',
  D: '#f5d547',
  F: '#2f9e44',
  B: '#1c7ed6',
  R: '#e03131',
  L: '#f76707',
}

export const COLOR_NAMES: Record<StickerColor, string> = {
  U: '白',
  D: '黄',
  F: '緑',
  B: '青',
  R: '赤',
  L: '橙',
}

export const CAPTURE_ORDER: FaceId[] = ['F', 'R', 'B', 'L', 'U', 'D']

export interface Rgb {
  r: number
  g: number
  b: number
}

const REFERENCE_RGB: Record<StickerColor, Rgb> = {
  U: { r: 245, g: 245, b: 245 },
  D: { r: 245, g: 213, b: 71 },
  F: { r: 47, g: 158, b: 68 },
  B: { r: 28, g: 126, b: 214 },
  R: { r: 224, g: 49, b: 49 },
  L: { r: 247, g: 103, b: 7 },
}

interface Lab {
  l: number
  a: number
  b: number
}

function toLab({ r, g, b }: Rgb): Lab {
  const lin = (v: number) => {
    const c = Math.min(Math.max(v, 0), 255) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)]
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27) * t / 116 + 16 / 116)
  const [fx, fy, fz] = [f(x), f(y), f(z)]
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) }
}

function labDistance(p: Lab, q: Lab): number {
  // Lightness varies most with shading, so hue/chroma differences weigh more.
  const dl = (p.l - q.l) * 0.6
  const da = p.a - q.a
  const db = p.b - q.b
  return dl * dl + da * da + db * db
}

function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Raw (camera) RGB of each center seen so far; centers have a known color. */
export type Calibration = Partial<Record<StickerColor, Rgb>>

/** Raw RGB of the 9 cells for each captured face. */
export type FaceSamples = Partial<Record<FaceId, Rgb[]>>

export function calibrationFromSamples(samples: FaceSamples): Calibration {
  const calibration: Calibration = {}
  for (const face of FACE_ORDER) {
    const cells = samples[face]
    if (cells) calibration[face] = cells[4]
  }
  return calibration
}

/**
 * Expected camera RGB for each color. Colors whose center was captured use the
 * measured value; others are the reference color under the estimated light
 * (white balance from the white center if seen, otherwise overall brightness).
 */
export function expectedColors(calibration: Calibration): Record<StickerColor, Rgb> {
  const seen = FACE_ORDER.filter((c) => calibration[c])
  let gain: Rgb = { r: 1, g: 1, b: 1 }
  const white = calibration.U
  if (white) {
    const clamp = (v: number) => Math.min(Math.max(v, 0.4), 3)
    gain = {
      r: clamp(REFERENCE_RGB.U.r / Math.max(white.r, 1)),
      g: clamp(REFERENCE_RGB.U.g / Math.max(white.g, 1)),
      b: clamp(REFERENCE_RGB.U.b / Math.max(white.b, 1)),
    }
  } else if (seen.length > 0) {
    const ratio =
      seen.reduce((sum, c) => sum + luminance(REFERENCE_RGB[c]) / Math.max(luminance(calibration[c]!), 1), 0) /
      seen.length
    const k = Math.min(Math.max(ratio, 0.4), 3)
    gain = { r: k, g: k, b: k }
  }
  const out = {} as Record<StickerColor, Rgb>
  for (const c of FACE_ORDER) {
    out[c] = calibration[c] ?? {
      r: REFERENCE_RGB[c].r / gain.r,
      g: REFERENCE_RGB[c].g / gain.g,
      b: REFERENCE_RGB[c].b / gain.b,
    }
  }
  return out
}

/** Classifies a face; the center is known, so it also calibrates the others. */
export function classifyFace(cells: Rgb[], center: StickerColor, calibration: Calibration): StickerColor[] {
  const expected = expectedColors({ ...calibration, [center]: cells[4] })
  const refs = FACE_ORDER.map((c) => ({ color: c, lab: toLab(expected[c]) }))
  return cells.map((rgb, i) => {
    if (i === 4) return center
    const lab = toLab(rgb)
    let best = refs[0]
    let bestDist = Infinity
    for (const ref of refs) {
      const d = labDistance(lab, ref.lab)
      if (d < bestDist) {
        bestDist = d
        best = ref
      }
    }
    return best.color
  })
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function sampleCell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): Rgb {
  const inset = size * 0.28
  const sx = Math.round(x + inset)
  const sy = Math.round(y + inset)
  const sw = Math.max(1, Math.round(size - inset * 2))
  const sh = Math.max(1, Math.round(size - inset * 2))
  const data = ctx.getImageData(sx, sy, sw, sh).data
  const r: number[] = []
  const g: number[] = []
  const b: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    r.push(data[i])
    g.push(data[i + 1])
    b.push(data[i + 2])
  }
  return { r: median(r), g: median(g), b: median(b) }
}

/** Fraction of the square crop left outside the 3x3 guide on each side. */
export const GUIDE_MARGIN = 0.12

/**
 * Reads the 9 cells inside the guide frame. The guide sits over the centered
 * square crop of the source, matching how the viewport displays it.
 */
export function sampleFaceRgb(source: CanvasImageSource, sourceWidth: number, sourceHeight: number): Rgb[] {
  const size = 300
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return Array.from({ length: 9 }, () => ({ ...REFERENCE_RGB.U }))

  const side = Math.min(sourceWidth, sourceHeight)
  ctx.drawImage(source, (sourceWidth - side) / 2, (sourceHeight - side) / 2, side, side, 0, 0, size, size)

  const margin = size * GUIDE_MARGIN
  const cell = (size - margin * 2) / 3
  const cells: Rgb[] = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      cells.push(sampleCell(ctx, margin + col * cell, margin + row * cell, cell))
    }
  }
  return cells
}
