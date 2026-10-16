import { useMemo, useState, type CSSProperties } from 'react'
import {
  COLOR_HEX,
  COLOR_NAMES,
  FACE_LABELS,
  FACE_NEIGHBORS,
  FACE_ORDER,
  FACE_SHORT,
  FACE_VIEW_HINT,
  type FaceId,
  type StickerColor,
} from '../lib/colors'
import {
  CENTER_INDEX,
  countColors,
  createEmptyDraft,
  faceOffset,
  getFace,
  setSticker,
  validateDraft,
  type DraftStickers,
} from '../lib/cubeState'
import type { CubeIssue } from '../lib/cubeValidation'

interface ColorEditorProps {
  draft: DraftStickers
  onChange: (next: DraftStickers) => void
  onBack: () => void
  backLabel: string
  onSolve: () => void
  solving: boolean
  errors: string[]
}

type Brush = StickerColor | 'erase'

const NET_AREAS: Record<FaceId, string> = {
  U: 'u',
  L: 'l',
  F: 'f',
  R: 'r',
  B: 'b',
  D: 'd',
}

interface Marks {
  issue: Set<number>
  focused: Set<number>
  suggestions: Map<number, StickerColor>
}

export function ColorEditor({
  draft,
  onChange,
  onBack,
  backLabel,
  onSolve,
  solving,
  errors,
}: ColorEditorProps) {
  const [brush, setBrush] = useState<Brush>('U')
  const [activeFace, setActiveFace] = useState<FaceId>('F')
  const [focusedIssue, setFocusedIssue] = useState<string | null>(null)
  const validation = useMemo(() => validateDraft(draft), [draft])
  const counts = useMemo(() => countColors(draft), [draft])
  const neighbors = FACE_NEIGHBORS[activeFace]

  const marks = useMemo<Marks>(() => {
    const focused = validation.issues.find((i) => i.message === focusedIssue)
    return {
      issue: new Set(validation.issues.flatMap((i) => i.facelets)),
      focused: new Set(focused?.facelets ?? []),
      suggestions: validation.suggestions,
    }
  }, [validation, focusedIssue])

  const paintCell = (face: FaceId, index: number) => {
    setActiveFace(face)
    if (index === CENTER_INDEX) return
    onChange(setSticker(draft, face, index, brush === 'erase' ? null : brush))
  }

  const applySuggestions = () => {
    let next = draft
    let suggestions = validation.suggestions
    while (suggestions.size > 0) {
      next = next.slice()
      for (const [idx, color] of suggestions) next[idx] = color
      suggestions = validateDraft(next).suggestions
    }
    onChange(next)
  }

  const focusIssue = (issue: CubeIssue) => {
    setFocusedIssue(issue.message)
    if (issue.facelets.length > 0) setActiveFace(FACE_ORDER[Math.floor(issue.facelets[0] / 9)])
  }

  const hasErrors = validation.issues.length > 0 || errors.length > 0

  return (
    <section className="panel editor">
      <header className="panel-head">
        <h2>展開図で色を入力</h2>
        <p>
          パレットで色を選び、ステッカーをタップして塗ります。中心の色は固定です。
        </p>
      </header>

      <div className="hold-guide">
        <div className="hold-guide-cube" aria-hidden>
          <span className="hold-top" style={{ background: COLOR_HEX.U }}>白</span>
          <span className="hold-front" style={{ background: COLOR_HEX.F }}>緑</span>
        </div>
        <div>
          <p className="hold-guide-title">
            持ち方：<strong>白を上</strong>、<strong>緑を手前</strong>
          </p>
          <p className="hold-guide-face">
            <strong>{FACE_LABELS[activeFace]}</strong>：{FACE_VIEW_HINT[activeFace]}
          </p>
          <p className="hold-guide-edges">
            このとき上辺は{FACE_SHORT[neighbors.top]}面、右辺は{FACE_SHORT[neighbors.right]}
            面、下辺は{FACE_SHORT[neighbors.bottom]}面、左辺は{FACE_SHORT[neighbors.left]}
            面に接しています。
          </p>
        </div>
      </div>

      <div className="palette editor-palette">
        {FACE_ORDER.map((c) => (
          <button
            key={c}
            type="button"
            className={`palette-swatch large ${brush === c ? 'selected' : ''} ${counts[c] > 9 ? 'over' : ''}`}
            style={{ background: COLOR_HEX[c] }}
            onClick={() => setBrush(c)}
            aria-label={`${COLOR_NAMES[c]}（${counts[c]} / 9 枚）`}
          >
            <span>{COLOR_NAMES[c]}</span>
            <small>
              {counts[c]}/9
            </small>
          </button>
        ))}
        <button
          type="button"
          className={`palette-swatch large eraser ${brush === 'erase' ? 'selected' : ''}`}
          onClick={() => setBrush('erase')}
        >
          <span>消す</span>
        </button>
      </div>

      <div className="editor-body">
        <div className="net">
          {FACE_ORDER.map((face) => (
            <FacePad
              key={face}
              face={face}
              colors={getFace(draft, face)}
              marks={marks}
              active={activeFace === face}
              onSelect={() => setActiveFace(face)}
              onPaint={paintCell}
            />
          ))}
        </div>
        <div className="zoom-pad">
          <p className="zoom-label">選択中の面（大きく表示）</p>
          <FacePad
            face={activeFace}
            colors={getFace(draft, activeFace)}
            marks={marks}
            active
            zoom
            onSelect={() => {}}
            onPaint={paintCell}
          />
        </div>
      </div>

      {validation.suggestions.size > 0 && (
        <div className="suggest-bar">
          <p>
            塗った色から、残り <strong>{validation.suggestions.size}</strong>{' '}
            枚の色が決まります（展開図の点線のマス）。
          </p>
          <button type="button" className="chip active" onClick={applySuggestions}>
            推測した色を入力
          </button>
        </div>
      )}

      {(validation.missing > 0 || hasErrors) && (
        <ul className={hasErrors ? 'error-list' : 'status-list'}>
          {validation.missing > 0 && (
            <li className="status">未入力のステッカーが {validation.missing} 枚あります。</li>
          )}
          {validation.issues.map((issue) => (
            <li
              key={issue.message}
              className={`${issue.facelets.length ? 'locatable' : ''} ${focusedIssue === issue.message ? 'focused' : ''}`}
              onClick={() => focusIssue(issue)}
            >
              {issue.message}
              {issue.facelets.length > 0 && <span className="issue-locate">（赤枠のマス）</span>}
              {issue.fix && (
                <button
                  type="button"
                  className="chip active issue-fix"
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange(issue.fix!.stickers)
                  }}
                >
                  {issue.fix.label}
                </button>
              )}
            </li>
          ))}
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <footer className="panel-foot">
        <div className="foot-left">
          <button type="button" className="ghost" onClick={onBack}>
            {backLabel}
          </button>
          <button type="button" className="ghost" onClick={() => onChange(createEmptyDraft())}>
            すべて消す
          </button>
        </div>
        <button
          type="button"
          className="primary"
          disabled={!validation.ok || solving}
          onClick={onSolve}
        >
          {solving ? '解法を計算中…' : '解法を表示'}
        </button>
      </footer>
    </section>
  )
}

function FacePad({
  face,
  colors,
  marks,
  active,
  zoom = false,
  onSelect,
  onPaint,
}: {
  face: FaceId
  colors: (StickerColor | null)[]
  marks: Marks
  active: boolean
  zoom?: boolean
  onSelect: () => void
  onPaint: (face: FaceId, index: number) => void
}) {
  const n = FACE_NEIGHBORS[face]
  const offset = faceOffset(face)
  return (
    <div
      className={`face-pad ${active ? 'active' : ''} ${zoom ? 'zoom' : ''}`}
      style={zoom ? undefined : { gridArea: NET_AREAS[face] }}
      onClick={onSelect}
    >
      <span className="face-pad-label">{FACE_LABELS[face]}</span>
      <div className="face-frame">
        <EdgeTag face={n.top} side="top" />
        <EdgeTag face={n.left} side="left" />
        <div className={`sticker-grid ${zoom ? '' : 'compact'}`}>
          {colors.map((c, i) => {
            const idx = offset + i
            const suggested = c ? undefined : marks.suggestions.get(idx)
            const classes = [
              'sticker',
              i === CENTER_INDEX ? 'center' : '',
              c ? '' : 'empty',
              suggested ? 'suggested' : '',
              marks.issue.has(idx) ? 'issue' : '',
              marks.focused.has(idx) ? 'focused' : '',
            ]
            return (
              <button
                key={i}
                type="button"
                className={classes.filter(Boolean).join(' ')}
                style={
                  c
                    ? { background: COLOR_HEX[c] }
                    : suggested
                      ? ({ '--suggest': COLOR_HEX[suggested] } as CSSProperties)
                      : undefined
                }
                disabled={i === CENTER_INDEX}
                aria-label={`${FACE_LABELS[face]} ${i + 1}番目: ${
                  c ? COLOR_NAMES[c] : suggested ? `未入力（推測: ${COLOR_NAMES[suggested]}）` : '未入力'
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  onPaint(face, i)
                }}
              >
                {i === CENTER_INDEX ? FACE_SHORT[face] : null}
              </button>
            )
          })}
        </div>
        <EdgeTag face={n.right} side="right" />
        <EdgeTag face={n.bottom} side="bottom" />
      </div>
    </div>
  )
}

function EdgeTag({ face, side }: { face: FaceId; side: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <span className={`edge-tag edge-${side}`} title={`${FACE_LABELS[face]}に接する辺`}>
      <i style={{ background: COLOR_HEX[face] }} />
      {FACE_SHORT[face]}
    </span>
  )
}
