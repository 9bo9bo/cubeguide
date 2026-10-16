import { useCallback, useEffect, useRef, useState } from 'react'
import { ColorEditor } from './components/ColorEditor'
import { FaceCapture } from './components/FaceCapture'
import { LearnPage } from './components/LearnPage'
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

const BACK_LABELS: Record<Phase, string> = {
  intro: 'トップに戻る',
  capture: '撮影に戻る',
  edit: '色の入力に戻る',
  play: '解法ステップに戻る',
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('intro')
  /** 学習ページは他の画面の上に重ねて開き、閉じると元の画面にそのまま戻る。 */
  const [learning, setLearning] = useState(false)
  const openLearn = () => {
    setLearning(true)
    window.scrollTo(0, 0)
  }
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
  /** 面ごとの直近の自動判定結果。手で直した面と未修正の面を見分けるために使う。 */
  const autoColors = useRef<CaptureProgress>({})

  const onCapture = useCallback((face: FaceId, colors: StickerColor[]) => {
    setProgress((p) => ({ ...p, [face]: colors }))
  }, [])

  const onSample = (face: FaceId, cells: Rgb[]): StickerColor[] => {
    const nextSamples = { ...samples, [face]: cells }
    setSamples(nextSamples)
    const calibration = calibrationFromSamples(nextSamples)

    // 新しい中央色でキャリブレーションが精度を増すので、未修正の面を判定し直す。
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
          <span className={!learning && (phase === 'intro' || phase === 'capture') ? 'on' : ''}>
            入力
          </span>
          <span className={!learning && phase === 'edit' ? 'on' : ''}>修正</span>
          <span className={!learning && phase === 'play' ? 'on' : ''}>解法</span>
          <button
            type="button"
            className={learning ? 'learn-link on' : 'learn-link'}
            aria-pressed={learning}
            onClick={() => (learning ? setLearning(false) : openLearn())}
          >
            学ぶ
          </button>
        </nav>
      </header>

      <main>
        {learning && <LearnPage onBack={() => setLearning(false)} backLabel={BACK_LABELS[phase]} />}

        <div hidden={learning}>
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
                <button type="button" className="link hero-learn" onClick={openLearn}>
                  はじめての方へ: ルービックキューブの解き方を学ぶ →
                </button>
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

          {phase === 'capture' && !learning && (
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
              onLearn={openLearn}
            />
          )}
        </div>
      </main>

      <footer className="site-foot">
        <p>標準配色: 上=白 / 下=黄 / 前=緑 / 後=青 / 右=赤 / 左=橙</p>
      </footer>
    </div>
  )
}
