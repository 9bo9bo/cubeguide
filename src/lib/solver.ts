import Cube from 'cubejs'
import { validateStickers, toSolverString, type CubeStickers } from './cubeState'
import { parseAlgorithm, type Move } from './moves'

let solverReady: Promise<void> | null = null

export function ensureSolver(): Promise<void> {
  if (!solverReady) {
    solverReady = new Promise((resolve) => {
      setTimeout(() => {
        Cube.initSolver()
        resolve()
      }, 0)
    })
  }
  return solverReady
}

export interface SolveResult {
  ok: true
  moves: Move[]
  algorithm: string
}

export interface SolveError {
  ok: false
  errors: string[]
}

export async function solveCube(
  stickers: CubeStickers,
): Promise<SolveResult | SolveError> {
  const validation = validateStickers(stickers)
  if (!validation.ok) {
    return { ok: false, errors: validation.errors }
  }

  await ensureSolver()

  const facelet = toSolverString(stickers)
  try {
    const cube = Cube.fromString(facelet)
    if (cube.isSolved()) {
      return { ok: true, moves: [], algorithm: '' }
    }
    const algorithm = cube.solve()
    if (!algorithm) {
      return {
        ok: false,
        errors: ['この配置は物理的に解けません。色の割り当てを確認してください。'],
      }
    }
    return { ok: true, moves: parseAlgorithm(algorithm), algorithm }
  } catch {
    return {
      ok: false,
      errors: [
        '配置が不正です。角や辺の向き・入れ替えを含め、実物と同じ色になっているか確認してください。',
      ],
    }
  }
}

export function scrambleMoves(count = 25): Move[] {
  const faces = ['U', 'D', 'R', 'L', 'F', 'B'] as const
  const suffixes = ['', "'", '2'] as const
  const moves: Move[] = []
  let lastFace: string | null = null
  while (moves.length < count) {
    const face = faces[Math.floor(Math.random() * faces.length)]
    if (face === lastFace) continue
    lastFace = face
    const suf = suffixes[Math.floor(Math.random() * suffixes.length)]
    moves.push(`${face}${suf}` as Move)
  }
  return moves
}
