import { useCallback, useEffect, useRef, useState } from 'react'
import { ColorEditor } from './components/ColorEditor'
import { FaceCapture } from './components/FaceCapture'
import { SolutionPlayer } from './components/SolutionPlayer'
import {
  calibrationFromSamples,
  classifyFace,
  FACE_ORDER,
  type FaceId,
  type FaceSamples,
  type Rgb,
  type StickerColor,
} from './lib/colors'
import { applyMoves } from './lib/cubeLogic'
import {
  createEmptyDraft,
  createSolvedStickers,
  mergeCapture,
  type CaptureProgress,
  type CubeStickers,
  type DraftStickers,
} from './lib/cubeState'
import type { Move } from './lib/moves'
import { scrambleMoves, solveCube, warmupSolver } from './lib/solver'
import './App.css'

type Phase = 'intro' | 'capture' | 'edit' | 'play'

export default function App() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [editFrom, setEditFrom] = useState<'intro' | 'capture'>('intro')
  const [progress, setProgress] = useState<CaptureProgress>({})
  const [draft, setDraft] = useState<DraftStickers>(createEmptyDraft)
  const [stickers, setStickers] = useState<CubeStickers>(createSolvedStickers)
  const [moves, setMoves] = useState<Move[]>([])
  const [solving, setSolving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    warmupSolver()
  }, [])

  const [samples, setSamples] = useState<FaceSamples>({})
  /** Last automatic classification per face, to tell untouched faces from hand-fixed ones. */
  const autoColors = useRef<CaptureProgress>({})

  const onCapture = useCallback((face: FaceId, colors: StickerColor[]) => {
    setProgress((p) => ({ ...p, [face]: colors }))
  }, [])

  const onSample = (face: FaceId, cells: Rgb[]): StickerColor[] => {
    const nextSamples = { ...samples, [face]: cells }
    setSamples(nextSamples)
    const calibration = calibrationFromSamples(nextSamples)

    // A new center refines the calibration, so re-read faces the user hasn't touched.
    const refreshed: CaptureProgress = {}
    for (const f of FACE_ORDER) {
      const s = nextSamples[f]
      const current = progress[f]
      const auto = autoColors.current[f]
      if (f === face || !s || !current || !auto || current.join() !== auto.join()) continue
      refreshed[f] = classifyFace(s, f, calibration)
      autoColors.current[f] = refreshed[f]
    }
    if (Object.keys(refreshed).length > 0) setProgress((p) => ({ ...p, ...refreshed }))

    const colors = classifyFace(cells, face, calibration)
    autoColors.current[face] = colors
    return colors
  }

  const openEditor = (next: DraftStickers, from: 'intro' | 'capture') => {
    setDraft(next)
    setEditFrom(from)
    setErrors([])
    setPhase('edit')
  }

  const startManual = () => openEditor(createEmptyDraft(), 'intro')

  const goEditFromCapture = () => openEditor(mergeCapture(createEmptyDraft(), progress), 'capture')

  const startDemo = () => {
    setProgress({})
    openEditor(applyMoves(createSolvedStickers(), scrambleMoves(20)), 'intro')
  }

  const changeDraft = (next: DraftStickers) => {
    setDraft(next)
    setErrors([])
  }

  const runSolve = async () => {
    if (draft.some((s) => s === null)) return
    const complete = draft as CubeStickers
    setSolving(true)
    setErrors([])
    const result = await solveCube(complete)
    setSolving(false)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setStickers(complete)
    setMoves(result.moves)
    setPhase('play')
  }

  const restart = () => {
    setPhase('intro')
    setProgress({})
    setSamples({})
    autoColors.current = {}
    setDraft(createEmptyDraft())
    setStickers(createSolvedStickers())
    setMoves([])
    setErrors([])
  }

  return (
    <div className="app">
      <div className="bg-glow" aria-hidden />
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <p className="brand-name">CubeGuide</p>
            <p className="brand-tag">ルービックキューブ解法ガイド</p>
          </div>
        </div>
        <nav className="steps" aria-label="進行状況">
          <span className={phase === 'intro' || phase === 'capture' ? 'on' : ''}>入力</span>
          <span className={phase === 'edit' ? 'on' : ''}>修正</span>
          <span className={phase === 'play' ? 'on' : ''}>解法</span>
        </nav>
      </header>

      <main>
        {phase === 'intro' && (
          <section className="hero panel">
            <div className="hero-copy">
              <h1>CubeGuide</h1>
              <p className="lede">
                展開図や写真で今のキューブを入力すると、一手ずつアニメーションで回し方を案内します。
              </p>
              <div className="hero-actions">
                <button type="button" className="primary" onClick={startManual}>
                  展開図で入力する
                </button>
                <button type="button" className="ghost" onClick={() => setPhase('capture')}>
                  写真・カメラで入力
                </button>
                <button type="button" className="ghost" onClick={startDemo}>
                  デモ（ランダムスクランブル）
                </button>
              </div>
            </div>
            <div className="hero-visual" aria-hidden>
              <div className="hero-cube">
                {(['U', 'D', 'F', 'B', 'R', 'L'] as const).map((face) => (
                  <div key={face} className={`hero-face face-${face}`}>
                    {Array.from({ length: 9 }, (_, i) => (
                      <i key={i} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {phase === 'capture' && (
          <FaceCapture
            progress={progress}
            onSample={onSample}
            onCapture={onCapture}
            onDone={goEditFromCapture}
            onBack={() => setPhase('intro')}
          />
        )}

        {phase === 'edit' && (
          <ColorEditor
            draft={draft}
            onChange={changeDraft}
            onBack={() => setPhase(editFrom)}
            backLabel={editFrom === 'capture' ? '撮影に戻る' : 'トップに戻る'}
            onSolve={runSolve}
            solving={solving}
            errors={errors}
          />
        )}

        {phase === 'play' && (
          <SolutionPlayer
            initialStickers={stickers}
            moves={moves}
            onBack={() => setPhase('edit')}
            onRestart={restart}
          />
        )}
      </main>

      <footer className="site-foot">
        <p>標準配色: 上=白 / 下=黄 / 前=緑 / 後=青 / 右=赤 / 左=橙</p>
      </footer>
    </div>
  )
}
