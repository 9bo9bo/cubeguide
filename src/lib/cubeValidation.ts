import { COLOR_NAMES, FACE_ORDER, FACE_SHORT, type FaceId, type StickerColor } from './colors'

/** 各コーナーのステッカー番号（URFDLB 順・各面 9 枚・行優先）。U/D 面のステッカーを先頭に置く。 */
const CORNER_FACELETS: number[][] = [
  [8, 9, 20], // URF
  [6, 18, 38], // UFL
  [0, 36, 47], // ULB
  [2, 45, 11], // UBR
  [29, 26, 15], // DFR
  [27, 44, 24], // DLF
  [33, 53, 42], // DBL
  [35, 17, 51], // DRB
]

const CORNER_COLORS: FaceId[][] = [
  ['U', 'R', 'F'],
  ['U', 'F', 'L'],
  ['U', 'L', 'B'],
  ['U', 'B', 'R'],
  ['D', 'F', 'R'],
  ['D', 'L', 'F'],
  ['D', 'B', 'L'],
  ['D', 'R', 'B'],
]

const EDGE_FACELETS: number[][] = [
  [5, 10], // UR
  [7, 19], // UF
  [3, 37], // UL
  [1, 46], // UB
  [32, 16], // DR
  [28, 25], // DF
  [30, 43], // DL
  [34, 52], // DB
  [23, 12], // FR
  [21, 41], // FL
  [50, 39], // BL
  [48, 14], // BR
]

const EDGE_COLORS: FaceId[][] = [
  ['U', 'R'],
  ['U', 'F'],
  ['U', 'L'],
  ['U', 'B'],
  ['D', 'R'],
  ['D', 'F'],
  ['D', 'L'],
  ['D', 'B'],
  ['F', 'R'],
  ['F', 'L'],
  ['B', 'L'],
  ['B', 'R'],
]

interface PieceKind {
  name: '角' | '辺'
  slots: number[][]
  colors: FaceId[][]
  /** 向きの数（コーナーは 3、エッジは 2）。 */
  n: number
}

const CORNERS: PieceKind = { name: '角', slots: CORNER_FACELETS, colors: CORNER_COLORS, n: 3 }
const EDGES: PieceKind = { name: '辺', slots: EDGE_FACELETS, colors: EDGE_COLORS, n: 2 }

const OPPOSITE: Record<FaceId, FaceId> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' }

const POSITION_NAMES = ['左上', '上', '右上', '左', '中央', '右', '左下', '下', '右下']

const ENUMERATION_BUDGET = 60000

export type Draft = (StickerColor | null)[]

export interface CubeIssue {
  message: string
  /** 強調表示するステッカーの番号。 */
  facelets: number[]
  /** ワンタップで適用できる、キューブ全体の修正案。 */
  fix?: { label: string; stickers: Draft }
}

export interface CubeAnalysis {
  issues: CubeIssue[]
  /** 入力済みのステッカーから確定する色（未入力のマスのみ）。 */
  suggestions: Map<number, StickerColor>
}

export function faceletName(index: number): string {
  return `${FACE_SHORT[FACE_ORDER[Math.floor(index / 9)]]}面の${POSITION_NAMES[index % 9]}`
}

function slotLabel(kind: PieceKind, slot: number): string {
  return `${kind.colors[slot].map((f) => FACE_SHORT[f]).join('・')}の${kind.name}`
}

function slotWhere(kind: PieceKind, slot: number): string {
  return kind.slots[slot].map(faceletName).join('／')
}

function colorList(colors: FaceId[]): string {
  return colors.map((c) => COLOR_NAMES[c]).join('・')
}

interface Placement {
  piece: number
  ori: number
}

function placementColor(kind: PieceKind, pl: Placement, k: number): FaceId {
  return kind.colors[pl.piece][(k - pl.ori + kind.n) % kind.n]
}

function intrinsicCandidates(kind: PieceKind, slot: number, f: Draft): Placement[] {
  const out: Placement[] = []
  const facelets = kind.slots[slot]
  for (let piece = 0; piece < kind.colors.length; piece++) {
    for (let ori = 0; ori < kind.n; ori++) {
      const pl = { piece, ori }
      if (facelets.every((idx, k) => f[idx] === null || f[idx] === placementColor(kind, pl, k))) {
        out.push(pl)
      }
    }
  }
  return out
}

function impossibleReason(kind: PieceKind, colors: FaceId[]): string {
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      if (colors[i] === colors[j]) return `1つの${kind.name}に${COLOR_NAMES[colors[i]]}が2枚あります`
      if (OPPOSITE[colors[i]] === colors[j]) {
        return `${COLOR_NAMES[colors[i]]}と${COLOR_NAMES[colors[j]]}は反対側の面の色なので、同じ${kind.name}には並びません`
      }
    }
  }
  return '3色の並び順が実物と逆（鏡写し）です'
}

function permutationParity(perm: number[]): number {
  let parity = 0
  for (let i = 0; i < perm.length; i++) {
    for (let j = i + 1; j < perm.length; j++) {
      if (perm[i] > perm[j]) parity ^= 1
    }
  }
  return parity
}

interface KindState {
  cands: Placement[][]
  issues: CubeIssue[]
}

/** 位置ごとの候補を求め、明らかな矛盾は該当するステッカーと一緒に報告する。 */
function propagate(kind: PieceKind, f: Draft): KindState {
  const issues: CubeIssue[] = []
  const cands = kind.slots.map((_, s) => intrinsicCandidates(kind, s, f))

  cands.forEach((c, s) => {
    if (c.length > 0) return
    const facelets = kind.slots[s].filter((idx) => f[idx] !== null)
    const colors = facelets.map((idx) => f[idx]!) as FaceId[]
    issues.push({
      message: `${slotLabel(kind, s)}（${facelets.map(faceletName).join('／')}）が ${colorList(colors)} になっています。${impossibleReason(kind, colors)}。`,
      facelets,
    })
  })
  if (issues.length > 0) return { cands, issues }

  const pieceOf = (c: Placement[]) => (c.length > 0 && c.every((p) => p.piece === c[0].piece) ? c[0].piece : -1)

  let changed = true
  while (changed) {
    changed = false
    const owner = new Map<number, number>()
    for (let s = 0; s < cands.length; s++) {
      const piece = pieceOf(cands[s])
      if (piece < 0) continue
      const other = owner.get(piece)
      if (other !== undefined) {
        const colors = kind.colors[piece]
        issues.push({
          message: `${slotLabel(kind, other)}と${slotLabel(kind, s)}が、どちらも ${colorList(colors)} の${kind.name}になっています。同じパーツは1つしかありません。`,
          facelets: [...kind.slots[other], ...kind.slots[s]].filter((idx) => f[idx] !== null),
        })
        return { cands, issues }
      }
      owner.set(piece, s)
    }

    for (let s = 0; s < cands.length; s++) {
      const mine = pieceOf(cands[s])
      const next = cands[s].filter((p) => p.piece === mine || !owner.has(p.piece))
      if (next.length === 0) {
        const blockers = [...new Set(cands[s].map((p) => owner.get(p.piece)!))]
        issues.push({
          message: `${slotLabel(kind, s)}（${slotWhere(kind, s)}）に入る${kind.name}が残っていません。当てはまる${kind.name}は${blockers.map((b) => slotLabel(kind, b)).join('・')}で使われています。`,
          facelets: [s, ...blockers].flatMap((x) => kind.slots[x]).filter((idx) => f[idx] !== null),
        })
        return { cands, issues }
      }
      if (next.length !== cands[s].length) {
        cands[s] = next
        changed = true
      }
    }

    for (let piece = 0; piece < kind.colors.length; piece++) {
      if (owner.has(piece)) continue
      const homes = cands.map((c, s) => (c.some((p) => p.piece === piece) ? s : -1)).filter((s) => s >= 0)
      if (homes.length === 0) {
        issues.push({
          message: `${colorList(kind.colors[piece])}の${kind.name}を置ける場所がありません。塗った${kind.name}の色を確認してください。`,
          facelets: [],
        })
        return { cands, issues }
      }
      if (homes.length === 1) {
        const s = homes[0]
        const next = cands[s].filter((p) => p.piece === piece)
        if (next.length !== cands[s].length) {
          cands[s] = next
          changed = true
        }
      }
    }
  }
  return { cands, issues }
}

interface Enumeration {
  complete: boolean
  counts: [number, number]
  /** パリティごと: ステッカー -> 全候補で一致した色。候補間で食い違う場合は 'x'。 */
  agree: [Map<number, FaceId | 'x'>, Map<number, FaceId | 'x'>]
}

/** ねじれ・反転の合計条件を満たす矛盾のない埋め方を、探索上限の範囲ですべて列挙する。 */
function enumerate(kind: PieceKind, cands: Placement[][]): Enumeration {
  const order = cands.map((_, s) => s).sort((a, b) => cands[a].length - cands[b].length)
  const used = new Array(kind.colors.length).fill(false)
  const perm = new Array<number>(cands.length)
  const chosen = new Array<Placement>(cands.length)
  const result: Enumeration = { complete: true, counts: [0, 0], agree: [new Map(), new Map()] }
  let nodes = 0

  const visit = (depth: number, oriSum: number) => {
    if (!result.complete) return
    if (++nodes > ENUMERATION_BUDGET) {
      result.complete = false
      return
    }
    if (depth === order.length) {
      if (oriSum % kind.n !== 0) return
      const parity = permutationParity(perm)
      result.counts[parity]++
      const agree = result.agree[parity]
      kind.slots.forEach((facelets, s) => {
        facelets.forEach((idx, k) => {
          const color = placementColor(kind, chosen[s], k)
          const prev = agree.get(idx)
          if (prev === undefined) agree.set(idx, color)
          else if (prev !== color) agree.set(idx, 'x')
        })
      })
      return
    }
    const s = order[depth]
    for (const pl of cands[s]) {
      if (used[pl.piece]) continue
      used[pl.piece] = true
      perm[s] = pl.piece
      chosen[s] = pl
      visit(depth + 1, oriSum + pl.ori)
      used[pl.piece] = false
    }
  }
  visit(0, 0)
  return result
}

function collectAgreement(e: Enumeration, parities: number[], f: Draft, out: Map<number, StickerColor>): void {
  const live = parities.filter((p) => e.counts[p] > 0)
  if (live.length === 0) return
  for (const [idx, color] of e.agree[live[0]]) {
    if (f[idx] !== null || color === 'x') continue
    if (live.every((p) => e.agree[p].get(idx) === color)) out.set(idx, color)
  }
}

function collectFromCandidates(kind: PieceKind, cands: Placement[][], f: Draft, out: Map<number, StickerColor>): void {
  cands.forEach((c, s) => {
    if (c.length === 0) return
    kind.slots[s].forEach((idx, k) => {
      if (f[idx] !== null) return
      const color = placementColor(kind, c[0], k)
      if (c.every((pl) => placementColor(kind, pl, k) === color)) out.set(idx, color)
    })
  })
}

function analyzePieces(f: Draft, withEnumeration: boolean): CubeAnalysis {
  const suggestions = new Map<number, StickerColor>()
  const corners = propagate(CORNERS, f)
  const edges = propagate(EDGES, f)
  const issues = [...corners.issues, ...edges.issues]
  if (issues.length > 0) return { issues, suggestions }

  collectFromCandidates(CORNERS, corners.cands, f, suggestions)
  collectFromCandidates(EDGES, edges.cands, f, suggestions)
  if (!withEnumeration) return { issues, suggestions }

  const ce = enumerate(CORNERS, corners.cands)
  const ee = enumerate(EDGES, edges.cands)
  const complete = f.every((s) => s !== null)

  if (ce.complete && ce.counts[0] + ce.counts[1] === 0) {
    issues.push({
      message: complete
        ? '角が1つねじれた状態になっています（このままでは揃えられません）。'
        : '残りのマスをどう塗っても、角のねじれが解消しません。塗った角の色の並びを確認してください。',
      facelets: [],
    })
  }
  if (ee.complete && ee.counts[0] + ee.counts[1] === 0) {
    issues.push({
      message: complete
        ? '辺が1つ反転した状態になっています（このままでは揃えられません）。'
        : '残りのマスをどう塗っても、辺の反転が解消しません。塗った辺の色の並びを確認してください。',
      facelets: [],
    })
  }
  if (issues.length > 0) return { issues, suggestions }

  const parities = (e: Enumeration) => [0, 1].filter((p) => e.counts[p] > 0)
  let cornerParities = [0, 1]
  let edgeParities = [0, 1]
  if (ce.complete && ee.complete) {
    const shared = parities(ce).filter((p) => parities(ee).includes(p))
    if (shared.length === 0) {
      issues.push({
        message: complete
          ? '2つのパーツが入れ替わった状態になっています（このままでは揃えられません）。'
          : '残りのマスをどう塗っても、パーツの入れ替わりが解消しません。',
        facelets: [],
      })
      return { issues, suggestions }
    }
    cornerParities = shared
    edgeParities = shared
  }
  if (ce.complete) collectAgreement(ce, cornerParities, f, suggestions)
  if (ee.complete) collectAgreement(ee, edgeParities, f, suggestions)
  return { issues, suggestions }
}

const CLOCKWISE = [6, 3, 0, 7, 4, 1, 8, 5, 2]
const TURN_LABELS = ['時計回りに90°', '180°', '反時計回りに90°']

function rotateFace(f: Draft, face: FaceId, quarterTurns: number): Draft {
  const next = f.slice()
  const o = FACE_ORDER.indexOf(face) * 9
  for (let t = 0; t < quarterTurns; t++) {
    const cur = next.slice(o, o + 9)
    for (let i = 0; i < 9; i++) next[o + i] = cur[CLOCKWISE[i]]
  }
  return next
}

/** 1 面を回転させるだけで入力済みのステッカーが矛盾しなくなる修正を探す。 */
function findRotationFix(f: Draft): CubeIssue | null {
  // 局所的な矛盾は軽く確認できるが、未完成のキューブのねじれ・パリティの問題は
  // 回転で解消するかを確かめるのに全列挙が必要になる。
  const complete = f.every((s) => s !== null)
  const thorough = complete || analyzePieces(f, false).issues.length === 0
  for (const face of FACE_ORDER) {
    for (let t = 1; t <= 3; t++) {
      const rotated = rotateFace(f, face, t)
      if (rotated.every((s, i) => s === f[i])) continue
      if (analyzePieces(rotated, thorough).issues.length > 0) continue
      const facelets = Array.from({ length: 9 }, (_, i) => FACE_ORDER.indexOf(face) * 9 + i)
      return {
        message: `${FACE_SHORT[face]}面を${TURN_LABELS[t - 1]}回した向きなら矛盾がなくなります。${FACE_SHORT[face]}面を回した向きで入力している可能性があります。`,
        facelets,
        fix: { label: `${FACE_SHORT[face]}面を${TURN_LABELS[t - 1]}回す`, stickers: rotated },
      }
    }
  }
  return null
}

const MAX_PIECE_ISSUES = 3

const ORIENTATION_HINT =
  'いずれかの面を回転した向きで入力している可能性があります。各面の上辺がどの面に接しているか確認してください。'

/**
 * 入力済みのステッカー（中央マスは標準の向き）に矛盾がないか調べ、色が確定する
 * マスを導く。cubejs は実現不可能な状態で終了しないことがあるため、完成した
 * キューブもこのチェックを通してから解法を計算する。
 */
export function analyzeDraft(f: Draft): CubeAnalysis {
  const result = analyzePieces(f, true)
  if (result.issues.length === 0) return result

  const issues = result.issues.slice(0, MAX_PIECE_ISSUES)
  if (result.issues.length > MAX_PIECE_ISSUES) {
    issues.push({
      message: `ほか ${result.issues.length - MAX_PIECE_ISSUES} か所のパーツも不整合です。`,
      facelets: result.issues.slice(MAX_PIECE_ISSUES).flatMap((i) => i.facelets),
    })
  }
  const fix = findRotationFix(f)
  if (fix) issues.unshift(fix)
  else issues.push({ message: ORIENTATION_HINT, facelets: [] })
  return { issues, suggestions: new Map() }
}
