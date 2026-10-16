import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyMove, applyMoves } from '../lib/cubeLogic'
import type { CubeStickers } from '../lib/cubeState'
import { describeMove, invertMoves, parseAlgorithm, type Move } from '../lib/moves'
import { Cube3D } from './Cube3D'

const TURN_MS = 650
const PAUSE_MS = 450

interface AlgDemoProps {
  /** 手順を回し終えたときの状態。開始状態はここから手順を逆にたどって作る。 */
  goal: CubeStickers
  algorithm: string
}

/** 手順を 1 手ずつ回して、どの形がどう揃うかを見せる。手順を変えるときは key で作り直す。 */
export function AlgDemo({ goal, algorithm }: AlgDemoProps) {
  const moves = useMemo(() => parseAlgorithm(algorithm), [algorithm])
  const start = useMemo(() => applyMoves(goal, invertMoves(moves)), [goal, moves])
  const [step, setStep] = useState(0)
  const [stickers, setStickers] = useState(start)
  const [animating, setAnimating] = useState<Move | null>(null)
  const [playing, setPlaying] = useState(false)
  const done = step >= moves.length

  const reset = useCallback(() => {
    setPlaying(false)
    setAnimating(null)
    setStep(0)
    setStickers(start)
  }, [start])

  const next = useCallback(() => {
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
    if (!playing || animating) return
    if (done) {
      setPlaying(false)
      return
    }
    const t = window.setTimeout(next, PAUSE_MS)
    return () => clearTimeout(t)
  }, [playing, animating, done, next])

  const listRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const list = listRef.current
    const item = list?.children[Math.min(step, moves.length - 1)] as HTMLElement | undefined
    if (!list || !item) return
    list.scrollTo({
      left: item.offsetLeft - list.clientWidth / 2 + item.offsetWidth / 2,
      behavior: 'smooth',
    })
  }, [step, moves.length])

  const play = () => {
    if (done) {
      reset()
      setPlaying(true)
    } else {
      setPlaying((v) => !v)
    }
  }

  return (
    <div className="alg-demo">
      <Cube3D
        stickers={stickers}
        animatingMove={animating}
        animationMs={TURN_MS}
        onMoveComplete={onMoveComplete}
      />
      <ol className="alg-moves" aria-label="手順" ref={listRef}>
        {moves.map((m, i) => (
          <li key={i} className={i === step ? 'current' : i < step ? 'done' : ''}>
            <strong>{m}</strong>
            <span>{describeMove(m).labelJa}</span>
          </li>
        ))}
      </ol>
      <div className="controls">
        <button type="button" className="primary" onClick={play}>
          {playing ? '一時停止' : done ? 'もう一度' : '再生'}
        </button>
        <button
          type="button"
          className="ghost"
          disabled={done || !!animating || playing}
          onClick={next}
        >
          1 手進む
        </button>
        <button
          type="button"
          className="ghost"
          disabled={step === 0 || !!animating}
          onClick={reset}
        >
          最初に戻す
        </button>
      </div>
    </div>
  )
}
