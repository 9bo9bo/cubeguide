import { useMemo, useState } from 'react'
import {
  COLOR_HEX,
  COLOR_NAMES,
  FACE_LABELS,
  FACE_ORDER,
  type FaceId,
  type StickerColor,
} from '../lib/colors'
import { getFace, setSticker, validateStickers, type CubeStickers } from '../lib/cubeState'

interface ColorEditorProps {
  stickers: CubeStickers
  onChange: (next: CubeStickers) => void
  onBack: () => void
  onSolve: () => void
  solving: boolean
  errors: string[]
}

export function ColorEditor({
  stickers,
  onChange,
  onBack,
  onSolve,
  solving,
  errors,
}: ColorEditorProps) {
  const [paint, setPaint] = useState<StickerColor>('U')
  const [activeFace, setActiveFace] = useState<FaceId>('F')
  const validation = useMemo(() => validateStickers(stickers), [stickers])

  const paintCell = (face: FaceId, index: number) => {
    if (index === 4) return // keep center fixed for orientation clarity — allow override with confirm
    onChange(setSticker(stickers, face, index, paint))
  }

  const paintCenter = (face: FaceId) => {
    onChange(setSticker(stickers, face, 4, paint))
  }

  return (
    <section className="panel editor">
      <header className="panel-head">
        <h2>色を修正</h2>
        <p>間違っているステッカーを選び、下のパレット色で塗り直してください。</p>
      </header>

      <div className="palette editor-palette">
        {FACE_ORDER.map((c) => (
          <button
            key={c}
            type="button"
            className={`palette-swatch large ${paint === c ? 'selected' : ''}`}
            style={{ background: COLOR_HEX[c] }}
            onClick={() => setPaint(c)}
            aria-label={COLOR_NAMES[c]}
          >
            <span>{COLOR_NAMES[c]}</span>
          </button>
        ))}
      </div>

      <div className="net">
        <div className="net-u">
          <FacePad
            face="U"
            colors={getFace(stickers, 'U')}
            active={activeFace === 'U'}
            onSelect={() => setActiveFace('U')}
            onPaint={paintCell}
            onPaintCenter={paintCenter}
          />
        </div>
        <div className="net-mid">
          {(['L', 'F', 'R', 'B'] as FaceId[]).map((f) => (
            <FacePad
              key={f}
              face={f}
              colors={getFace(stickers, f)}
              active={activeFace === f}
              onSelect={() => setActiveFace(f)}
              onPaint={paintCell}
              onPaintCenter={paintCenter}
            />
          ))}
        </div>
        <div className="net-d">
          <FacePad
            face="D"
            colors={getFace(stickers, 'D')}
            active={activeFace === 'D'}
            onSelect={() => setActiveFace('D')}
            onPaint={paintCell}
            onPaintCenter={paintCenter}
          />
        </div>
      </div>

      {(!validation.ok || errors.length > 0) && (
        <ul className="error-list">
          {validation.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <footer className="panel-foot">
        <button type="button" className="ghost" onClick={onBack}>
          入力に戻る
        </button>
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
  active,
  onSelect,
  onPaint,
  onPaintCenter,
}: {
  face: FaceId
  colors: StickerColor[]
  active: boolean
  onSelect: () => void
  onPaint: (face: FaceId, index: number) => void
  onPaintCenter: (face: FaceId) => void
}) {
  return (
    <div className={`face-pad ${active ? 'active' : ''}`} onClick={onSelect}>
      <span className="face-pad-label">{FACE_LABELS[face]}</span>
      <div className="sticker-grid compact">
        {colors.map((c, i) => (
          <button
            key={i}
            type="button"
            className={`sticker ${i === 4 ? 'center' : ''}`}
            style={{ background: COLOR_HEX[c] }}
            onClick={(e) => {
              e.stopPropagation()
              if (i === 4) onPaintCenter(face)
              else onPaint(face, i)
            }}
          />
        ))}
      </div>
    </div>
  )
}
