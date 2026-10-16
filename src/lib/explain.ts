import type { FaceId } from './colors'
import { applyMove } from './cubeLogic'
import type { CubeStickers } from './cubeState'
import { CORNER_COLORS, CORNER_FACELETS, EDGE_COLORS, EDGE_FACELETS } from './cubeValidation'
import type { Move } from './moves'

export interface CubeMetrics {
  /** 向きが揃っているエッジの数（12 個中）。 */
  edgesOriented: number
  /** 向きが揃っているコーナーの数（8 個中）。 */
  cornersOriented: number
  /** 中段の 4 か所に入っている中段エッジの数。 */
  sliceEdges: number
  /** 正しい位置・向きに収まっているピースの数（20 個中）。 */
  solvedPieces: number
}

export interface MoveExplanation {
  phase: 1 | 2
  title: string
  detail: string
  /** この手を回したあとの進み具合。 */
  stats: { label: string; value: string }[]
}

const isUD = (c: FaceId) => c === 'U' || c === 'D'
const isFB = (c: FaceId) => c === 'F' || c === 'B'

/**
 * 2 フェーズ法の基準での向き。コーナーは白か黄の面が上下面にあれば揃っている。
 * エッジは白か黄を持つなら同様に、持たない中段エッジは緑か青が前後面にあれば揃っている。
 */
export function cubeMetrics(s: CubeStickers): CubeMetrics {
  let edgesOriented = 0
  let cornersOriented = 0
  let sliceEdges = 0
  let solvedPieces = 0

  CORNER_FACELETS.forEach((slot, i) => {
    if (isUD(s[slot[0]])) cornersOriented++
    if (slot.every((f, j) => s[f] === CORNER_COLORS[i][j])) solvedPieces++
  })

  EDGE_FACELETS.forEach((slot, i) => {
    const [a, b] = slot.map((f) => s[f])
    const hasUD = isUD(a) || isUD(b)
    if (hasUD ? isUD(a) : isFB(a)) edgesOriented++
    if (i >= 8 && !hasUD) sliceEdges++
    if (a === EDGE_COLORS[i][0] && b === EDGE_COLORS[i][1]) solvedPieces++
  })

  return { edgesOriented, cornersOriented, sliceEdges, solvedPieces }
}

function inPhase2Group(m: CubeMetrics): boolean {
  return m.edgesOriented === 12 && m.cornersOriented === 8 && m.sliceEdges === 4
}

/** フェーズ 2 で使う、揃えた向きを崩さない回し方。 */
function isPhase2Move(move: Move): boolean {
  return move[0] === 'U' || move[0] === 'D' || move.endsWith('2')
}

/** フェーズ 2 に入る位置。以降の手がすべてフェーズ 2 の回し方になる最初の位置を選ぶ。 */
export function phaseBoundary(metrics: CubeMetrics[], moves: Move[]): number {
  let k = moves.length
  while (k > 0 && isPhase2Move(moves[k - 1])) k--
  while (k < moves.length && !inPhase2Group(metrics[k])) k++
  return k
}

function phase1Detail(before: CubeMetrics, after: CubeMetrics, last: boolean): string {
  if (last) {
    return 'この手で下準備が完了します。エッジ 12 個とコーナー 8 個の向きがすべて揃い、中段のエッジ 4 個が中段に集まります。'
  }
  const gains: string[] = []
  const de = after.edgesOriented - before.edgesOriented
  const dc = after.cornersOriented - before.cornersOriented
  const ds = after.sliceEdges - before.sliceEdges
  if (de > 0) gains.push(`エッジの向きが ${de} 個揃い`)
  if (dc > 0) gains.push(`コーナーの向きが ${dc} 個揃い`)
  if (ds > 0) gains.push(`中段のエッジが ${ds} 個中段に入り`)
  if (gains.length > 0) return `この手で${gains.join('、')}ます。`
  if (de < 0 || dc < 0 || ds < 0) {
    return 'いったん崩れるように見えますが、このあとの手で向きをまとめて揃えるための回り道です。'
  }
  return '数は変わりませんが、次の手で向きを揃えやすい場所へピースを運んでいます。'
}

function phase2Detail(
  before: CubeMetrics,
  after: CubeMetrics,
  first: boolean,
  last: boolean,
): string {
  const lead = first
    ? 'ここから仕上げです。揃えた向きを崩さないよう、上下面以外は 180° だけ回します。'
    : ''
  if (last) return `${lead}最後の一手でキューブが完成します。`
  const d = after.solvedPieces - before.solvedPieces
  if (d > 0) return `${lead}この手で ${d} 個のピースが正しい位置に収まります。`
  if (d < 0)
    return `${lead}揃ったピースを一時的にどかして、別のピースを入れ替える通り道をつくります。`
  return `${lead}ピースの並びを入れ替えて、正しい位置へ近づけています。`
}

/** 解法の各手について、2 フェーズ法のどの段階で何を進めているかを説明する。 */
export function explainSolution(initial: CubeStickers, moves: Move[]): MoveExplanation[] {
  const metrics: CubeMetrics[] = [cubeMetrics(initial)]
  let s = initial
  for (const m of moves) {
    s = applyMove(s, m)
    metrics.push(cubeMetrics(s))
  }
  const k = phaseBoundary(metrics, moves)

  return moves.map((_, i) => {
    const before = metrics[i]
    const after = metrics[i + 1]
    if (i < k) {
      return {
        phase: 1,
        title: `下準備（フェーズ 1）${i + 1} / ${k} 手`,
        detail: phase1Detail(before, after, i === k - 1),
        stats: [
          { label: 'エッジの向き', value: `${after.edgesOriented}/12` },
          { label: 'コーナーの向き', value: `${after.cornersOriented}/8` },
          { label: '中段エッジ', value: `${after.sliceEdges}/4` },
        ],
      }
    }
    return {
      phase: 2,
      title: `仕上げ（フェーズ 2）${i - k + 1} / ${moves.length - k} 手`,
      detail: phase2Detail(before, after, i === k, i === moves.length - 1),
      stats: [{ label: '正しい位置のピース', value: `${after.solvedPieces}/20` }],
    }
  })
}
