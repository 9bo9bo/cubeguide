import { useCallback, useEffect, useMemo, useState } from 'react'
import { applyMove, applyMoves } from '../lib/cubeLogic'
import type { CubeStickers } from '../lib/cubeState'
import { describeMove, type Move } from '../lib/moves'
import { Cube3D } from './Cube3D'

/** 速度×1 のときの、1 手の回転アニメーション時間と次の手までの間隔。 */
const BASE_TURN_MS = 1000
const BASE_PAUSE_MS = 900

interface SolutionPlayerProps {
  initialStickers: CubeStickers
  moves: Move[]
  onBack: () => void
  onRestart: () => void
}

export function SolutionPlayer({
  initialStickers,
  moves,
  onBack,
  onRestart,
}: SolutionPlayerProps) {
  const [step, setStep] = useState(0)
  const [stickers, setStickers] = useState(initialStickers)
  const [animating, setAnimating] = useState<Move | null>(null)
  const [autoPlay, setAutoPlay] = useState(false)
  const [speed, setSpeed] = useState(1)

  const currentMove = moves[step] ?? null
  const info = currentMove ? describeMove(currentMove) : null
  const done = step >= moves.length

  const animationMs = useMemo(() => Math.round(BASE_TURN_MS / speed), [speed])

  const resetTo = useCallback(
    (nextStep: number) => {
      setAnimating(null)
      setAutoPlay(false)
      setStep(nextStep)
      setStickers(applyMoves(initialStickers, moves.slice(0, nextStep)))
    },
    [initialStickers, moves],
  )

  const playNext = useCallback(() => {
    if (animating || step >= moves.length) return
    setAnimating(moves[step])
  }, [animating, moves, step])

  const onMoveComplete = useCallback(() => {
    if (!animating) return
    const move = animating
    setStickers((s) => applyMove(s, move))
    setAnimating(null)
    setStep((s) => s + 1)
  }, [animating])

  useEffect(() => {
    if (!autoPlay || animating || done) return
    const t = window.setTimeout(() => playNext(), Math.round(BASE_PAUSE_MS / speed))
    return () => clearTimeout(t)
  }, [autoPlay, animating, done, playNext, speed])

  const confirmRestart = () => {
    if (window.confirm('入力したキューブの色はすべて消えます。最初の画面に戻りますか？')) onRestart()
  }

  useEffect(() => {
    if (done) setAutoPlay(false)
  }, [done])

  return (
    <section className="panel player">
      <header className="panel-head">
        <h2>解法ステップ</h2>
        <p>
          {moves.length === 0
            ? 'すでに揃っています。'
            : done
              ? `完了 — 全 ${moves.length} 手`
              : `${step + 1} / ${moves.length} 手目`}
        </p>
      </header>

      <div className="player-layout">
        <Cube3D
          stickers={stickers}
          animatingMove={animating}
          animationMs={animationMs}
          onMoveComplete={onMoveComplete}
        />

        <div className="player-side">
          <div className="move-card">
            {done ? (
              <>
                <span className="move-notation">✓</span>
                <p className="move-hint">キューブが揃いました</p>
              </>
            ) : (
              <>
                <span className="move-notation">{currentMove}</span>
                <p className="move-label">{info?.labelJa}</p>
                <p className="move-hint">{info?.hintJa}</p>
              </>
            )}
          </div>

          <div className="progress-track" aria-hidden>
            <div
              className="progress-fill"
              style={{ width: `${moves.length ? (step / moves.length) * 100 : 100}%` }}
            />
          </div>

          <div className="controls">
            <button
              type="button"
              className="ghost"
              disabled={step === 0 || !!animating}
              onClick={() => resetTo(Math.max(0, step - 1))}
            >
              戻る
            </button>
            <button
              type="button"
              className="primary"
              disabled={done || !!animating}
              onClick={playNext}
            >
              次の一手
            </button>
            <button
              type="button"
              className={autoPlay ? 'chip active' : 'chip'}
              disabled={done}
              onClick={() => setAutoPlay((v) => !v)}
            >
              {autoPlay ? '自動停止' : '自動再生'}
            </button>
          </div>

          <label className="speed">
            速度
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.25}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            />
            <span>×{speed.toFixed(2)}</span>
          </label>

          <ol className="move-list">
            {moves.map((m, i) => (
              <li key={`${m}-${i}`} className={i === step ? 'current' : i < step ? 'done' : ''}>
                <button type="button" disabled={!!animating} onClick={() => resetTo(i)}>
                  <strong>{m}</strong>
                  <span>{describeMove(m).labelJa}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <footer className="panel-foot">
        <button type="button" className="ghost" onClick={onBack}>
          色修正に戻る
        </button>
        <button type="button" className="ghost" onClick={confirmRestart}>
          最初から
        </button>
      </footer>
    </section>
  )
}
