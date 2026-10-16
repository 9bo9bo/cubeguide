import type { FaceId, StickerColor } from './colors'
import { COLOR_NAMES, FACE_ORDER } from './colors'
import { analyzeDraft, type CubeIssue } from './cubeValidation'

/** URFDLB 順に各面 9 枚（行優先）並べた 54 枚のステッカー。 */
export type CubeStickers = StickerColor[]

/** ユーザーが入力中のステッカー。`null` は未入力。 */
export type DraftStickers = (StickerColor | null)[]

export const CENTER_INDEX = 4

export function createSolvedStickers(): CubeStickers {
  const stickers: StickerColor[] = []
  for (const face of FACE_ORDER) {
    for (let i = 0; i < 9; i++) stickers.push(face)
  }
  return stickers
}

/** 中央マスだけを埋めた状態。中央マスは標準の向きに固定する。 */
export function createEmptyDraft(): DraftStickers {
  const draft: DraftStickers = []
  for (const face of FACE_ORDER) {
    for (let i = 0; i < 9; i++) draft.push(i === CENTER_INDEX ? face : null)
  }
  return draft
}

export function faceOffset(face: FaceId): number {
  return FACE_ORDER.indexOf(face) * 9
}

export function getFace<T>(stickers: T[], face: FaceId): T[] {
  const o = faceOffset(face)
  return stickers.slice(o, o + 9)
}

export function setFace<T>(stickers: T[], face: FaceId, faceColors: T[]): T[] {
  const next = stickers.slice()
  const o = faceOffset(face)
  for (let i = 0; i < 9; i++) next[o + i] = faceColors[i]
  return next
}

export function setSticker<T>(stickers: T[], face: FaceId, index: number, color: T): T[] {
  const next = stickers.slice()
  next[faceOffset(face) + index] = color
  return next
}

export function countColors(stickers: DraftStickers): Record<StickerColor, number> {
  const counts: Record<StickerColor, number> = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 }
  for (const s of stickers) if (s) counts[s]++
  return counts
}

export interface ValidationResult {
  ok: boolean
  issues: CubeIssue[]
  /** 未入力のステッカーの数。 */
  missing: number
  /** 入力済みの色から確定する色。キーはステッカーの番号。 */
  suggestions: Map<number, StickerColor>
}

export function validateDraft(draft: DraftStickers): ValidationResult {
  const suggestions = new Map<number, StickerColor>()
  if (draft.length !== 54) {
    return { ok: false, issues: [{ message: 'ステッカー数が不正です。', facelets: [] }], missing: 0, suggestions }
  }
  const missing = draft.filter((s) => s === null).length
  const issues: CubeIssue[] = []

  const centers = FACE_ORDER.map((f) => draft[faceOffset(f) + CENTER_INDEX])
  if (centers.some((c, i) => c !== FACE_ORDER[i])) {
    issues.push({ message: '中心の色が標準の配置になっていません。', facelets: [] })
    return { ok: false, issues, missing, suggestions }
  }

  const counts = countColors(draft)
  for (const color of FACE_ORDER) {
    if (counts[color] > 9 || (missing === 0 && counts[color] !== 9)) {
      issues.push({
        message: `${COLOR_NAMES[color]}が ${counts[color]} 枚あります（9枚である必要があります）。`,
        facelets: draft.flatMap((s, i) => (s === color && i % 9 !== CENTER_INDEX ? [i] : [])),
      })
    }
  }

  const analysis = analyzeDraft(draft)
  issues.push(...analysis.issues)
  if (issues.length === 0) {
    for (const [idx, color] of analysis.suggestions) suggestions.set(idx, color)
  }

  return { ok: missing === 0 && issues.length === 0, issues, missing, suggestions }
}

/**
 * cubejs の面記号は「その面の中央マスの色」を表すので、観測した各色を
 * その色の中央マスを持つ面に対応づける。
 */
export function toSolverString(stickers: CubeStickers): string {
  const colorToFace = {} as Record<StickerColor, FaceId>
  for (const face of FACE_ORDER) {
    colorToFace[stickers[faceOffset(face) + CENTER_INDEX]] = face
  }
  return stickers.map((c) => colorToFace[c]).join('')
}

export type CaptureProgress = Partial<Record<FaceId, StickerColor[]>>

/** 撮影した面で入力中の状態を上書きする。中央マスはその面の色に固定したまま。 */
export function mergeCapture(draft: DraftStickers, progress: CaptureProgress): DraftStickers {
  let next = draft.slice()
  for (const face of FACE_ORDER) {
    const faceColors = progress[face]
    if (!faceColors) continue
    const fixed: DraftStickers = faceColors.slice()
    fixed[CENTER_INDEX] = face
    next = setFace(next, face, fixed)
  }
  return next
}
