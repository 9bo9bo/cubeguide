import type { StickerColor } from './colors'
import type { CubeStickers } from './cubeState'
import type { Move } from './moves'
import { describeMove } from './moves'

type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B'

const FACE_INDEX: Record<Face, number> = {
  U: 0,
  R: 1,
  F: 2,
  D: 3,
  L: 4,
  B: 5,
}

function rotateFaceCW(stickers: StickerColor[], face: Face): void {
  const o = FACE_INDEX[face] * 9
  const f = stickers.slice(o, o + 9)
  const map = [6, 3, 0, 7, 4, 1, 8, 5, 2]
  for (let i = 0; i < 9; i++) stickers[o + i] = f[map[i]]
}

function get(stickers: StickerColor[], idxs: number[]): StickerColor[] {
  return idxs.map((i) => stickers[i])
}

function set(stickers: StickerColor[], idxs: number[], vals: StickerColor[]): void {
  for (let i = 0; i < idxs.length; i++) stickers[idxs[i]] = vals[i]
}

function rev<T>(arr: T[]): T[] {
  return arr.slice().reverse()
}

/** 複数手の手順で cubejs と突き合わせて検証済みのステッカー巡回。 */
function applyQuarter(s: StickerColor[], face: Face): void {
  switch (face) {
    case 'U': {
      rotateFaceCW(s, 'U')
      const l = get(s, [36, 37, 38])
      set(s, [36, 37, 38], get(s, [18, 19, 20]))
      set(s, [18, 19, 20], get(s, [9, 10, 11]))
      set(s, [9, 10, 11], get(s, [45, 46, 47]))
      set(s, [45, 46, 47], l)
      break
    }
    case 'D': {
      rotateFaceCW(s, 'D')
      const l = get(s, [42, 43, 44])
      set(s, [42, 43, 44], get(s, [51, 52, 53]))
      set(s, [51, 52, 53], get(s, [15, 16, 17]))
      set(s, [15, 16, 17], get(s, [24, 25, 26]))
      set(s, [24, 25, 26], l)
      break
    }
    case 'R': {
      rotateFaceCW(s, 'R')
      const u = get(s, [2, 5, 8])
      const bIdx = [51, 48, 45] // B6,B3,B0
      set(s, [2, 5, 8], get(s, [20, 23, 26]))
      set(s, [20, 23, 26], get(s, [29, 32, 35]))
      set(s, [29, 32, 35], get(s, bIdx))
      set(s, bIdx, u)
      break
    }
    case 'L': {
      rotateFaceCW(s, 'L')
      const u = get(s, [0, 3, 6])
      const bIdx = [53, 50, 47] // B8,B5,B2
      set(s, [0, 3, 6], get(s, bIdx))
      set(s, bIdx, get(s, [27, 30, 33]))
      set(s, [27, 30, 33], get(s, [18, 21, 24]))
      set(s, [18, 21, 24], u)
      break
    }
    case 'F': {
      rotateFaceCW(s, 'F')
      const u = get(s, [6, 7, 8])
      const r = get(s, [9, 12, 15])
      const d = get(s, [27, 28, 29])
      const l = get(s, [38, 41, 44])
      set(s, [6, 7, 8], rev(l))
      set(s, [9, 12, 15], u)
      set(s, [27, 28, 29], rev(r))
      set(s, [38, 41, 44], d)
      break
    }
    case 'B': {
      rotateFaceCW(s, 'B')
      const u = get(s, [0, 1, 2])
      const r = get(s, [11, 14, 17])
      const d = get(s, [33, 34, 35])
      const l = get(s, [36, 39, 42])
      set(s, [0, 1, 2], r)
      set(s, [11, 14, 17], rev(d))
      set(s, [33, 34, 35], l)
      set(s, [36, 39, 42], rev(u))
      break
    }
  }
}

export function applyMove(stickers: CubeStickers, move: Move): CubeStickers {
  const next = stickers.slice()
  const info = describeMove(move)
  const times = info.turns === 2 ? 2 : info.turns === -1 ? 3 : 1
  for (let i = 0; i < times; i++) applyQuarter(next, info.face)
  return next
}

export function applyMoves(stickers: CubeStickers, moves: Move[]): CubeStickers {
  return moves.reduce((s, m) => applyMove(s, m), stickers)
}
