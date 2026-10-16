import { useCallback, useState, type ReactNode } from 'react'
import { applyMove } from '../lib/cubeLogic'
import { createSolvedStickers, type CubeStickers } from '../lib/cubeState'
import type { FaceId } from '../lib/colors'
import type { Move } from '../lib/moves'
import { describeMove } from '../lib/moves'
import { AlgDemo } from './AlgDemo'
import { Cube3D } from './Cube3D'

/** 白を下・黄を上・緑を手前に持ったときの完成状態（標準の持ち方を前後軸で 180° 回したもの）。 */
const YELLOW_UP: CubeStickers = (() => {
  const swap: Record<FaceId, FaceId> = {
    U: 'D',
    D: 'U',
    R: 'L',
    L: 'R',
    F: 'F',
    B: 'B',
  }
  return createSolvedStickers().map((c) => swap[c])
})()

interface DemoCase {
  label: string
  algorithm: string
}

interface Lesson {
  id: string
  title: string
  summary: string
  body: ReactNode
  cases?: DemoCase[]
}

const LESSONS: Lesson[] = [
  {
    id: 'basics',
    title: 'キューブのしくみ',
    summary: 'センター・エッジ・コーナーの 3 種類のパーツ',
    body: (
      <>
        <p>
          キューブは 3 種類のパーツでできています。各面の真ん中の
          <strong>センター</strong>
          は回しても位置が変わらず、その面の色を決める基準になります。
        </p>
        <ul>
          <li>
            <strong>エッジ</strong>（12 個）: 2 色のパーツ。辺の真ん中にあります。
          </li>
          <li>
            <strong>コーナー</strong>（8 個）: 3 色のパーツ。角にあります。
          </li>
        </ul>
        <p>
          向かい合う色は決まっていて、<strong>白と黄</strong>・<strong>緑と青</strong>・
          <strong>赤と橙</strong>
          が反対側です。「白緑のエッジ」は必ず白センターと緑センターの間に入ります。
        </p>
        <p>
          ここで紹介する<strong>層ごとに揃える方法（LBL 法）</strong>では、
          白を下・黄を上に持って、下の段から順に 7 ステップで揃えます。
        </p>
      </>
    ),
  },
  {
    id: 'notation',
    title: '回転記号の読み方',
    summary: "R・U・F' などの記号と回す向き",
    body: (
      <>
        <p>
          記号は回す面を表します。<strong>U</strong>=上、<strong>D</strong>=下、
          <strong>R</strong>=右、
          <strong>L</strong>=左、<strong>F</strong>=前、<strong>B</strong>
          =後ろ。
        </p>
        <ul>
          <li>
            記号だけ（例: R）: その面を<strong>正面から見て時計回り</strong>に 90°
          </li>
          <li>' 付き（例: R'）: 反時計回りに 90°</li>
          <li>2 付き（例: R2）: 180°（どちら向きでも同じ）</li>
        </ul>
        <p>下のボタンで実際に回して、向きを確かめてみましょう。</p>
      </>
    ),
  },
  {
    id: 'cross',
    title: 'ステップ 1: 白い十字',
    summary: '下の面に白い十字をつくる',
    body: (
      <>
        <p>
          まず黄色を上にして、黄センターのまわりに白いエッジを 4
          つ集めます（花のような形なので「デイジー」と呼びます）。
        </p>
        <p>
          次に上段を回して、白エッジのもう 1 色を側面のセンターの色に合わせ、その面を 180°
          回して下へ落とします。 4 つ繰り返すと、下に白い十字ができ、側面の色もセンターと揃います。
        </p>
        <p className="learn-why">
          なぜ？
          センターは動かないので、先に側面の色を合わせてから落とせば、エッジは必ず正しい場所に入ります。
        </p>
      </>
    ),
    cases: [{ label: '色を合わせて落とす', algorithm: 'U F2' }],
  },
  {
    id: 'corners',
    title: 'ステップ 2: 白いコーナー（1 段目）',
    summary: "R U R' U' を繰り返して角を入れる",
    body: (
      <>
        <p>
          白を含むコーナーを、入れたい場所の真上（右手前の上段）に運びます。 そこで{' '}
          <code>R U R' U'</code> を、角が正しく入るまで（最大 5 回）繰り返します。
        </p>
        <p className="learn-why">
          なぜ？ この 4 手は右手前の 2 つの角を入れ替えながら少しずつねじります。 6
          回で元に戻る性質があるので、繰り返せば必ず白が下を向いた状態になります。
        </p>
      </>
    ),
    cases: [
      {
        label: '3 回繰り返して入る例',
        algorithm: "R U R' U' R U R' U' R U R' U'",
      },
    ],
  },
  {
    id: 'middle',
    title: 'ステップ 3: 2 段目のエッジ',
    summary: '黄を含まないエッジを中段へ入れる',
    body: (
      <>
        <p>
          上段にある黄色を含まないエッジを探し、前面の色をセンターに合わせて縦の線をつくります。
          エッジの上の色が右のセンターなら「右に入れる」、左のセンターなら「左に入れる」手順を使います。
        </p>
        <p className="learn-why">
          なぜ？ いったん 1 段目の角を持ち上げてエッジと組にし、まとめて戻すことで、揃えた 1
          段目を崩さずに中段へ入れられます。
        </p>
      </>
    ),
    cases: [
      { label: '右に入れる', algorithm: "U R U' R' U' F' U F" },
      { label: '左に入れる', algorithm: "U' L' U L U F U' F'" },
    ],
  },
  {
    id: 'yellow-cross',
    title: 'ステップ 4: 黄色い十字',
    summary: "F R U R' U' F' で上面に十字をつくる",
    body: (
      <>
        <p>
          上面の黄色エッジの形を見ます。「点」「L 字」「横一本の棒」のどれかです。 L
          字は左奥に、棒は横向きになるように持って <code>F R U R' U' F'</code> を回します。 点 → L
          字 → 棒 → 十字の順に進みます。
        </p>
        <p className="learn-why">
          なぜ？ 前面を回して上段のエッジを一時的に側面へ逃がし、R U R' U'
          で向きを変えてから戻すので、下の 2 段は元どおりのまま上面のエッジだけが裏返ります。
        </p>
      </>
    ),
    cases: [{ label: '棒から十字へ', algorithm: "F R U R' U' F'" }],
  },
  {
    id: 'yellow-edges',
    title: 'ステップ 5: 黄色いエッジの位置',
    summary: '側面の色をセンターに合わせる',
    body: (
      <>
        <p>
          上段を回して、側面の色がセンターと合うエッジを 2 つ以上つくります。 合っている 2
          つが隣り合うなら、それを後ろと右に置いて <code>R U R' U R U2 R' U</code> を回します。
          向かい合うなら一度回してから、隣り合う形にして同じ手順を使います。
        </p>
        <p className="learn-why">
          なぜ？ この手順は上段のエッジの位置を入れ替える働きを持ち、下の 2 段は最後に元へ戻ります。
        </p>
      </>
    ),
    cases: [{ label: 'エッジを入れ替える', algorithm: "R U R' U R U2 R' U" }],
  },
  {
    id: 'yellow-corners',
    title: 'ステップ 6: 黄色いコーナーの位置',
    summary: '向きは気にせず角を正しい場所へ',
    body: (
      <>
        <p>
          3 色が周りのセンターと同じ組み合わせになっている角（向きは問わない）を探し、右手前に置いて
          <code>U R U' L' U R' U' L</code> を回します。右手前以外の 3 つの角が順番に入れ替わります。
          正しい角が 1 つもなければ、どこからでも 1 回回すと見つかります。
        </p>
        <p className="learn-why">
          なぜ？ 右手を使う手と左手を使う手が互いに打ち消し合い、上段の角 3
          つの位置だけが回るように組まれています。
        </p>
      </>
    ),
    cases: [{ label: '3 つの角を回す', algorithm: "U R U' L' U R' U' L" }],
  },
  {
    id: 'yellow-twist',
    title: 'ステップ 7: 黄色いコーナーの向き',
    summary: "R' D' R D で角をひねって完成",
    body: (
      <>
        <p>
          黄色が上を向いていない角を右手前に置き、黄色が上を向くまで <code>R' D' R D</code>{' '}
          を繰り返します（2 回か 4 回）。 途中で下の段が崩れますが気にしません。次の角は
          <strong>上段（U）だけ</strong>
          を回して右手前に運び、同じことを繰り返します。
        </p>
        <p className="learn-why">
          なぜ？ R' D' R D は 6 回で元に戻ります。すべての角を揃え終わった時点で合計回数が 6
          の倍数になるので、崩れていた下の段も自然に元どおりになります。
        </p>
      </>
    ),
    cases: [
      {
        label: '2 つの角をひねる',
        algorithm: "R' D' R D R' D' R D U R' D' R D R' D' R D R' D' R D R' D' R D U'",
      },
    ],
  },
  {
    id: 'two-phase',
    title: 'このアプリの解法（2 フェーズ法）',
    summary: '解法ステップの「下準備」「仕上げ」とは',
    body: (
      <>
        <p>
          解法ステップは、コンピューター向けの
          <strong>2 フェーズ法（コシエンバ法）</strong>で、20 手前後の短い手順を計算しています。
          人が覚える LBL 法とは違い、途中で面が揃っていくようには見えません。
        </p>
        <ul>
          <li>
            <strong>下準備（フェーズ 1）</strong>: エッジ 12 個とコーナー 8
            個の「向き」を揃え、中段のエッジ 4 個を中段に集めます。
            向きが揃うとは、白か黄の面が上下面を向いている状態です（白・黄を持たない中段エッジは、緑か青が前後面を向いている状態）。
          </li>
          <li>
            <strong>仕上げ（フェーズ 2）</strong>: 上下面は自由に、ほかの面は 180°
            だけ回します。この回し方では揃えた向きが崩れないので、ピースの位置だけを入れ替えて完成させます。
          </li>
        </ul>
        <p>
          解法ステップの「なぜこの手？」では、その手で向きや位置がいくつ揃うかを表示しています。
          数が減る手は、あとでまとめて揃えるための回り道です。
        </p>
      </>
    ),
  },
]

const PAD_MOVES: Move[] = ['U', "U'", 'D', "D'", 'R', "R'", 'L', "L'", 'F', "F'", 'B', "B'"]

function MovePad() {
  const [stickers, setStickers] = useState(createSolvedStickers)
  const [animating, setAnimating] = useState<Move | null>(null)
  const [last, setLast] = useState<Move | null>(null)

  const onMoveComplete = useCallback(() => {
    if (!animating) return
    const move = animating
    setStickers((s) => applyMove(s, move))
    setAnimating(null)
  }, [animating])

  return (
    <div className="alg-demo">
      <Cube3D
        stickers={stickers}
        animatingMove={animating}
        animationMs={450}
        onMoveComplete={onMoveComplete}
      />
      <p className="move-hint">
        {last ? `${last}: ${describeMove(last).labelJa}` : 'ボタンを押すと、その面が回ります。'}
      </p>
      <div className="move-pad">
        {PAD_MOVES.map((m) => (
          <button
            key={m}
            type="button"
            className="chip"
            disabled={!!animating}
            onClick={() => {
              setLast(m)
              setAnimating(m)
            }}
          >
            {m}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="ghost"
        disabled={!!animating}
        onClick={() => {
          setStickers(createSolvedStickers())
          setLast(null)
        }}
      >
        完成状態に戻す
      </button>
    </div>
  )
}

function LessonDemo({ cases }: { cases: DemoCase[] }) {
  const [index, setIndex] = useState(0)
  const current = cases[index]
  return (
    <>
      {cases.length > 1 && (
        <div className="case-tabs" role="tablist">
          {cases.map((c, i) => (
            <button
              key={c.label}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={i === index ? 'chip active' : 'chip'}
              onClick={() => setIndex(i)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      <p className="alg-line">
        <span>{current.label}</span>
        <code>{current.algorithm}</code>
      </p>
      <AlgDemo key={current.algorithm} goal={YELLOW_UP} algorithm={current.algorithm} />
    </>
  )
}

interface LearnPageProps {
  onBack: () => void
  backLabel: string
}

export function LearnPage({ onBack, backLabel }: LearnPageProps) {
  const [openId, setOpenId] = useState<string | null>('basics')

  return (
    <section className="panel learn">
      <header className="panel-head">
        <h2>解き方を学ぶ</h2>
        <p>
          初心者向けの「層ごとに揃える方法」を 7 ステップで紹介します。各ステップの 3D
          デモは、ドラッグで向きを変えながら再生できます。
        </p>
      </header>

      <div className="lessons">
        {LESSONS.map((lesson) => {
          const open = openId === lesson.id
          return (
            <article key={lesson.id} className={`lesson${open ? ' open' : ''}`}>
              <button
                type="button"
                className="lesson-head"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : lesson.id)}
              >
                <span className="lesson-title">{lesson.title}</span>
                <span className="lesson-summary">{lesson.summary}</span>
              </button>
              {open && (
                <div className="lesson-body">
                  <div className="lesson-text">{lesson.body}</div>
                  {lesson.id === 'notation' && <MovePad />}
                  {lesson.cases && <LessonDemo cases={lesson.cases} />}
                </div>
              )}
            </article>
          )
        })}
      </div>

      <footer className="panel-foot">
        <button type="button" className="ghost" onClick={onBack}>
          {backLabel}
        </button>
      </footer>
    </section>
  )
}
