import { useCallback, useState } from 'react'
import { ColorEditor } from './components/ColorEditor'
import { FaceCapture } from './components/FaceCapture'
import { SolutionPlayer } from './components/SolutionPlayer'
import type { FaceId, StickerColor } from './lib/colors'
import { applyMoves } from './lib/cubeLogic'
import {
  createSolvedStickers,
  mergeCapture,
  type CaptureProgress,
  type CubeStickers,
} from './lib/cubeState'
import type { Move } from './lib/moves'
import { ensureSolver, scrambleMoves, solveCube } from './lib/solver'
import './App.css'

type Phase = 'intro' | 'capture' | 'edit' | 'play'

export default function App() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [progress, setProgress] = useState<CaptureProgress>({})
  const [stickers, setStickers] = useState<CubeStickers>(createSolvedStickers())
  const [moves, setMoves] = useState<Move[]>([])
  const [solving, setSolving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const onCapture = useCallback((face: FaceId, colors: StickerColor[]) => {
    setProgress((p) => ({ ...p, [face]: colors }))
  }, [])

  const goEditFromCapture = () => {
    setStickers(mergeCapture(createSolvedStickers(), progress))
    setErrors([])
    setPhase('edit')
  }

  const startDemo = async () => {
    await ensureSolver()
    const scramble = scrambleMoves(20)
    const scrambled = applyMoves(createSolvedStickers(), scramble)
    setStickers(scrambled)
    setProgress({})
    setErrors([])
    setPhase('edit')
  }

  const fillManualSolved = () => {
    const solved = createSolvedStickers()
    const p: CaptureProgress = {}
    for (const face of ['U', 'R', 'F', 'D', 'L', 'B'] as FaceId[]) {
      p[face] = solved.slice(
        ['U', 'R', 'F', 'D', 'L', 'B'].indexOf(face) * 9,
        ['U', 'R', 'F', 'D', 'L', 'B'].indexOf(face) * 9 + 9,
      )
    }
    setProgress(p)
    setStickers(solved)
    setPhase('capture')
  }

  const runSolve = async () => {
    setSolving(true)
    setErrors([])
    const result = await solveCube(stickers)
    setSolving(false)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setMoves(result.moves)
    setPhase('play')
  }

  const restart = () => {
    setPhase('intro')
    setProgress({})
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
                写真やカメラで今のキューブを取り込み、一手ずつアニメーションで回し方を案内します。
              </p>
              <div className="hero-actions">
                <button type="button" className="primary" onClick={() => setPhase('capture')}>
                  面を入力する
                </button>
                <button type="button" className="ghost" onClick={startDemo}>
                  デモ（ランダムスクランブル）
                </button>
                <button type="button" className="ghost" onClick={fillManualSolved}>
                  手動で揃った状態から
                </button>
              </div>
            </div>
            <div className="hero-visual" aria-hidden>
              <div className="hero-cube">
                {(['U', 'R', 'F'] as const).map((face) => (
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
            onCapture={onCapture}
            onDone={goEditFromCapture}
          />
        )}

        {phase === 'edit' && (
          <ColorEditor
            stickers={stickers}
            onChange={setStickers}
            onBack={() => setPhase('capture')}
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
