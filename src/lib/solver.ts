import { toSolverString, validateDraft, type CubeStickers } from './cubeState'
import { parseAlgorithm, type Move } from './moves'
import type { SolverRequest, SolverResponse } from './solver.worker'

const SOLVE_TIMEOUT_MS = 20000

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, (res: SolverResponse) => void>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<SolverResponse>) => {
      const resolve = pending.get(event.data.id)
      pending.delete(event.data.id)
      resolve?.(event.data)
    }
  }
  return worker
}

function resetWorker(): void {
  worker?.terminate()
  worker = null
  for (const [id, resolve] of pending) resolve({ id, ok: false, error: 'terminated' })
  pending.clear()
}

function request(
  body: { type: 'warmup' } | { type: 'solve'; facelets: string },
  timeoutMs: number,
): Promise<SolverResponse> {
  const id = nextId++
  const w = getWorker()
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      resetWorker()
      resolve({ id, ok: false, error: 'timeout' })
    }, timeoutMs)
    pending.set(id, (res) => {
      clearTimeout(timer)
      resolve(res)
    })
    w.postMessage({ id, ...body } satisfies SolverRequest)
  })
}

/** 初回の解法計算が速くなるよう、ソルバーのテーブルをバックグラウンドで構築する。 */
export function warmupSolver(): void {
  void request({ type: 'warmup' }, 60000)
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

export async function solveCube(stickers: CubeStickers): Promise<SolveResult | SolveError> {
  const validation = validateDraft(stickers)
  if (!validation.ok) {
    return { ok: false, errors: validation.issues.map((i) => i.message) }
  }

  const res = await request({ type: 'solve', facelets: toSolverString(stickers) }, SOLVE_TIMEOUT_MS)
  if (!res.ok) {
    return {
      ok: false,
      errors: [
        res.error === 'timeout'
          ? '解法の計算が時間内に終わりませんでした。色の割り当てを確認してください。'
          : '配置が不正です。角や辺の向き・入れ替えを含め、実物と同じ色になっているか確認してください。',
      ],
    }
  }
  return { ok: true, moves: parseAlgorithm(res.algorithm), algorithm: res.algorithm }
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
