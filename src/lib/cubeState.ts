import type { FaceId, StickerColor } from './colors'
import { FACE_ORDER } from './colors'

/** 54 stickers in URFDLB order, 9 each (row-major). */
export type CubeStickers = StickerColor[]

export function createSolvedStickers(): CubeStickers {
  const stickers: StickerColor[] = []
  for (const face of FACE_ORDER) {
    for (let i = 0; i < 9; i++) stickers.push(face)
  }
  return stickers
}

export function createEmptyStickers(): CubeStickers {
  return Array(54).fill('U') as StickerColor[]
}

export function faceOffset(face: FaceId): number {
  return FACE_ORDER.indexOf(face) * 9
}

export function getFace(stickers: CubeStickers, face: FaceId): StickerColor[] {
  const o = faceOffset(face)
  return stickers.slice(o, o + 9)
}

export function setFace(
  stickers: CubeStickers,
  face: FaceId,
  faceColors: StickerColor[],
): CubeStickers {
  const next = stickers.slice()
  const o = faceOffset(face)
  for (let i = 0; i < 9; i++) next[o + i] = faceColors[i]
  return next
}

export function setSticker(
  stickers: CubeStickers,
  face: FaceId,
  index: number,
  color: StickerColor,
): CubeStickers {
  const next = stickers.slice()
  next[faceOffset(face) + index] = color
  return next
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

export function validateStickers(stickers: CubeStickers): ValidationResult {
  const errors: string[] = []
  if (stickers.length !== 54) {
    return { ok: false, errors: ['ステッカー数が不正です。'] }
  }

  const counts: Record<StickerColor, number> = {
    U: 0,
    R: 0,
    F: 0,
    D: 0,
    L: 0,
    B: 0,
  }
  for (const s of stickers) counts[s]++
  for (const face of FACE_ORDER) {
    if (counts[face] !== 9) {
      errors.push(`${face}色が ${counts[face]} 枚です（9枚である必要があります）。`)
    }
  }

  const centers = FACE_ORDER.map((f) => stickers[faceOffset(f) + 4])
  const centerSet = new Set(centers)
  if (centerSet.size !== 6) {
    errors.push('各面の中心色が重複しています。中心は6色それぞれ1つにしてください。')
  }

  return { ok: errors.length === 0, errors }
}

/**
 * Remap sticker colors so centers match URFDLB face letters expected by cubejs.
 * User may have photographed with arbitrary orientation of whole cube, but
 * centers define which color is which face.
 */
export function toSolverString(stickers: CubeStickers): string {
  // After validation, centers should be unique. Map observed center color → face letter.
  // stickers store colors as FaceId letters already representing absolute colors
  // (U=white etc). Centers of each face slot should equal that face's color for
  // a correctly oriented cube. If user holds cube with white on U etc., centers match.
  //
  // If centers are permuted (cube rotated in hand), we remap so that whatever color
  // is on physical U center becomes 'U' in the string for that face position... 
  // Actually cubejs fromString expects: position U1..U9 have colors of the pieces,
  // where 'U' means the color of the U center (white). So stickers as FaceId where
  // U=white works IF white center is on U face.
  //
  // Remap: let centerColor[face] = stickers[faceOffset(face)+4]
  // We need color X that sits on face F's center. The facelet string uses letters
  // meaning "the color belonging to face X". So letter = which face has that color as center.
  const colorToFace = {} as Record<StickerColor, FaceId>
  for (const face of FACE_ORDER) {
    const centerColor = stickers[faceOffset(face) + 4]
    colorToFace[centerColor] = face
  }
  return stickers.map((c) => colorToFace[c]).join('')
}

export type CaptureProgress = Partial<Record<FaceId, StickerColor[]>>

export function mergeCapture(
  stickers: CubeStickers,
  progress: CaptureProgress,
): CubeStickers {
  let next = stickers.slice()
  for (const face of FACE_ORDER) {
    const faceColors = progress[face]
    if (faceColors) next = setFace(next, face, faceColors)
  }
  return next
}
