import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CAPTURE_ORDER,
  COLOR_HEX,
  FACE_LABELS,
  sampleFaceColors,
  type FaceId,
  type StickerColor,
} from '../lib/colors'
import type { CaptureProgress } from '../lib/cubeState'

interface FaceCaptureProps {
  progress: CaptureProgress
  onCapture: (face: FaceId, colors: StickerColor[]) => void
  onDone: () => void
}

type Mode = 'camera' | 'photo' | 'manual'

export function FaceCapture({ progress, onCapture, onDone }: FaceCaptureProps) {
  const [faceIndex, setFaceIndex] = useState(0)
  const [mode, setMode] = useState<Mode>('photo')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [preview, setPreview] = useState<StickerColor[] | null>(null)
  const [paintColor, setPaintColor] = useState<StickerColor>('U')
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const face = CAPTURE_ORDER[faceIndex]
  const capturedCount = CAPTURE_ORDER.filter((f) => progress[f]).length

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (mode !== 'camera') {
      stopCamera()
      return
    }
    let cancelled = false
    setCameraError(null)
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch {
        setCameraError(
          'カメラを使えませんでした。写真アップロードまたは手動入力をご利用ください。',
        )
        setMode('photo')
      }
    })()
    return () => {
      cancelled = true
      stopCamera()
    }
  }, [mode, stopCamera])

  const applyColors = (colors: StickerColor[]) => {
    setPreview(colors)
  }

  const confirmPreview = () => {
    if (!preview) return
    onCapture(face, preview)
    setPreview(null)
    if (faceIndex < CAPTURE_ORDER.length - 1) {
      setFaceIndex((i) => i + 1)
    }
  }

  const captureFromVideo = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    applyColors(sampleFaceColors(canvas, canvas.width, canvas.height))
  }

  const onFile = (file: File | undefined) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      applyColors(sampleFaceColors(img, img.naturalWidth, img.naturalHeight))
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  const manualPaint = (index: number, color: StickerColor) => {
    const base =
      preview ??
      progress[face] ??
      (Array(9).fill(face) as StickerColor[])
    const next = base.slice()
    next[index] = color
    // keep center as face's nominal color suggestion unless user paints it
    setPreview(next)
  }

  return (
    <section className="panel capture">
      <header className="panel-head">
        <h2>面を入力</h2>
        <p>
          {FACE_LABELS[face]}（{faceIndex + 1} / {CAPTURE_ORDER.length}）—
          中心が{FACE_LABELS[face].match(/（(.+)）/)?.[1] ?? face}になる向きで撮影してください
        </p>
      </header>

      <div className="face-tabs">
        {CAPTURE_ORDER.map((f, i) => (
          <button
            key={f}
            type="button"
            className={`face-tab ${f === face ? 'active' : ''} ${progress[f] ? 'done' : ''}`}
            onClick={() => {
              setFaceIndex(i)
              setPreview(progress[f] ?? null)
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mode-row">
        <button
          type="button"
          className={mode === 'camera' ? 'chip active' : 'chip'}
          onClick={() => setMode('camera')}
        >
          Webカメラ
        </button>
        <button
          type="button"
          className={mode === 'photo' ? 'chip active' : 'chip'}
          onClick={() => setMode('photo')}
        >
          写真
        </button>
        <button
          type="button"
          className={mode === 'manual' ? 'chip active' : 'chip'}
          onClick={() => {
            setMode('manual')
            setPreview(progress[face] ?? (Array(9).fill(face) as StickerColor[]))
          }}
        >
          手動
        </button>
      </div>

      {cameraError && <p className="error-text">{cameraError}</p>}

      <div className="capture-stage">
        {mode === 'camera' && (
          <div className="viewport">
            <video ref={videoRef} playsInline muted className="media" />
            <div className="grid-overlay" aria-hidden />
            <button type="button" className="primary" onClick={captureFromVideo}>
              この面を撮影
            </button>
          </div>
        )}

        {mode === 'photo' && (
          <div className="viewport photo-drop">
            <div className="grid-overlay static" aria-hidden />
            <p>キューブの1面が枠に収まる写真を選んでください</p>
            <button type="button" className="primary" onClick={() => fileRef.current?.click()}>
              写真を選択
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </div>
        )}

        {(mode === 'manual' || preview) && (
          <div className="preview-block">
            <p className="preview-label">認識結果（タップで色修正）</p>
            <div className="sticker-grid">
              {(preview ?? progress[face] ?? Array(9).fill('U')).map((c, i) => (
                <button
                  key={i}
                  type="button"
                  className="sticker"
                  style={{ background: COLOR_HEX[c as StickerColor] }}
                  onClick={() => manualPaint(i, paintColor)}
                  aria-label={`ステッカー ${i + 1}`}
                />
              ))}
            </div>
            <div className="palette">
              {(['U', 'R', 'F', 'D', 'L', 'B'] as StickerColor[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`palette-swatch ${paintColor === c ? 'selected' : ''}`}
                  style={{ background: COLOR_HEX[c] }}
                  title={c}
                  onClick={() => setPaintColor(c)}
                />
              ))}
            </div>
            <p className="hint">パレットで色を選び、ステッカーをタップして塗ります</p>
            {preview && (
              <button type="button" className="primary" onClick={confirmPreview}>
                この面を確定
              </button>
            )}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} hidden />

      <footer className="panel-foot">
        <span>
          入力済み {capturedCount} / {CAPTURE_ORDER.length} 面
        </span>
        <button
          type="button"
          className="primary"
          disabled={capturedCount < 6}
          onClick={onDone}
        >
          色の最終確認へ
        </button>
      </footer>
    </section>
  )
}
