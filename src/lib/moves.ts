export type Move =
  | 'U'
  | "U'"
  | 'U2'
  | 'D'
  | "D'"
  | 'D2'
  | 'R'
  | "R'"
  | 'R2'
  | 'L'
  | "L'"
  | 'L2'
  | 'F'
  | "F'"
  | 'F2'
  | 'B'
  | "B'"
  | 'B2'

export interface MoveInfo {
  move: Move
  face: 'U' | 'D' | 'R' | 'L' | 'F' | 'B'
  /** 90° 単位の回転数: +1 = その面を正面から見て時計回り、-1 = 反時計回り、+2 = 180° */
  turns: 1 | -1 | 2
  labelJa: string
  hintJa: string
}

const FACE_JA: Record<MoveInfo['face'], string> = {
  U: '上面',
  D: '下面',
  R: '右面',
  L: '左面',
  F: '前面',
  B: '後面',
}

function buildInfo(move: Move): MoveInfo {
  const face = move[0] as MoveInfo['face']
  const suffix = move.slice(1)
  const turns: 1 | -1 | 2 = suffix === "'" ? -1 : suffix === '2' ? 2 : 1
  const dir =
    turns === 2 ? '180°回転' : turns === 1 ? '時計回りに90°' : '反時計回りに90°'
  return {
    move,
    face,
    turns,
    labelJa: `${FACE_JA[face]}を${dir}`,
    hintJa: `${move} — ${FACE_JA[face]}を${dir}してください`,
  }
}

export function parseAlgorithm(algo: string): Move[] {
  const trimmed = algo.trim()
  if (!trimmed) return []
  return trimmed.split(/\s+/).filter(Boolean) as Move[]
}

/** 手順を逆にたどる手順（各手を逆回転にして逆順に並べる）。 */
export function invertMoves(moves: Move[]): Move[] {
  return moves
    .slice()
    .reverse()
    .map((m) => (m.endsWith('2') ? m : m.endsWith("'") ? m[0] : `${m}'`) as Move)
}

export function describeMove(move: Move): MoveInfo {
  return buildInfo(move)
}

/** Three.js アニメーション用の回転軸と符号（ワールド座標、Y 軸が上）。 */
export function moveAxis(face: MoveInfo['face']): {
  axis: 'x' | 'y' | 'z'
  /** 層の座標: -1, 0, 1 のいずれか */
  layer: -1 | 0 | 1
  /** アニメーションの回転角（ラジアン、正の向きは軸に対する右ねじの法則） */
  angleForTurns: (turns: 1 | -1 | 2) => number
} {
  // キューブの向き: U=+Y, D=-Y, F=+Z, B=-Z, R=+X, L=-X
  switch (face) {
    case 'R':
      return {
        axis: 'x',
        layer: 1,
        angleForTurns: (t) => -((t === 2 ? 2 : t) * Math.PI) / 2,
      }
    case 'L':
      return {
        axis: 'x',
        layer: -1,
        angleForTurns: (t) => ((t === 2 ? 2 : t) * Math.PI) / 2,
      }
    case 'U':
      return {
        axis: 'y',
        layer: 1,
        angleForTurns: (t) => -((t === 2 ? 2 : t) * Math.PI) / 2,
      }
    case 'D':
      return {
        axis: 'y',
        layer: -1,
        angleForTurns: (t) => ((t === 2 ? 2 : t) * Math.PI) / 2,
      }
    case 'F':
      return {
        axis: 'z',
        layer: 1,
        angleForTurns: (t) => -((t === 2 ? 2 : t) * Math.PI) / 2,
      }
    case 'B':
      return {
        axis: 'z',
        layer: -1,
        angleForTurns: (t) => ((t === 2 ? 2 : t) * Math.PI) / 2,
      }
  }
}
