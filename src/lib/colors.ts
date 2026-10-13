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

export const CAPTURE_ORDER: FaceId[] = ['U', 'R', 'F', 'D', 'L', 'B']

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

function rgbDistance(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return dr * dr + dg * dg + db * db
}

export function nearestColor(rgb: Rgb): StickerColor {
  let best: StickerColor = 'U'
  let bestDist = Infinity
  for (const color of FACE_ORDER) {
    const dist = rgbDistance(rgb, REFERENCE_RGB[color])
    if (dist < bestDist) {
      bestDist = dist
      best = color
    }
  }
  return best
}

export function sampleCellAverage(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): Rgb {
  const inset = size * 0.25
  const sx = Math.round(x + inset)
  const sy = Math.round(y + inset)
  const sw = Math.max(1, Math.round(size - inset * 2))
  const sh = Math.max(1, Math.round(size - inset * 2))
  const data = ctx.getImageData(sx, sy, sw, sh).data
  let r = 0
  let g = 0
  let b = 0
  const count = sw * sh
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
  }
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  }
}

/** Sample a 3x3 face from an image drawn into a square canvas region. */
export function sampleFaceColors(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): StickerColor[] {
  const size = 300
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    return Array(9).fill('U') as StickerColor[]
  }

  const scale = Math.min(size / sourceWidth, size / sourceHeight)
  const dw = sourceWidth * scale
  const dh = sourceHeight * scale
  const dx = (size - dw) / 2
  const dy = (size - dh) / 2
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(source, dx, dy, dw, dh)

  const margin = size * 0.12
  const usable = size - margin * 2
  const cell = usable / 3
  const colors: StickerColor[] = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = margin + col * cell
      const y = margin + row * cell
      colors.push(nearestColor(sampleCellAverage(ctx, x, y, cell)))
    }
  }
  // Force center to nearest of remaining? Keep as sampled; editor can fix.
  return colors
}
