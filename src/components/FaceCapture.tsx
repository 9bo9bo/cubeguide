import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CAPTURE_ORDER,
  COLOR_HEX,
  FACE_LABELS,
  FACE_NEIGHBORS,
  FACE_SHORT,
  FACE_VIEW_HINT,
  sampleFaceRgb,
  type FaceId,
  type Rgb,
  type StickerColor,
} from '../lib/colors'
import type { CaptureProgress } from '../lib/cubeState'

interface FaceCaptureProps {
  progress: CaptureProgress
  /** Stores the raw cells of a face and returns its calibrated classification. */
  onSample: (face: FaceId, cells: Rgb[]) => StickerColor[]
  onCapture: (face: FaceId, colors: StickerColor[]) => void
  onDone: () => void
  onBack: () => void
}

type Mode = 'camera' | 'photo'

export function FaceCapture({ progress, onSample, onCapture, onDone, onBack }: FaceCaptureProps) {
  const [faceIndex, setFaceIndex] = useState(0)
  const [mode, setMode] = useState<Mode>('photo')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [preview, setPreview] = useState<StickerColor[] | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [paintColor, setPaintColor] = useState<StickerColor>('U')
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

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
        setCameraError('カメラを使えませんでした。写真アップロードまたは展開図での入力をご利用ください。')
        setMode('photo')
      }
    })()
    return () => {
      cancelled = true
      stopCamera()
    }
  }, [mode, stopCamera])

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl)
    }
  }, [photoUrl])

  const selectFace = (index: number) => {
    setFaceIndex(index)
    setPreview(progress[CAPTURE_ORDER[index]] ?? null)
    setPhotoUrl(null)
  }

  const confirmPreview = () => {
    if (!preview) return
    onCapture(face, preview)
    if (faceIndex < CAPTURE_ORDER.length - 1) selectFace(faceIndex + 1)
    else {
      setPreview(null)
      setPhotoUrl(null)
    }
  }

  const captureFromVideo = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    setPreview(onSample(face, sampleFaceRgb(video, video.videoWidth, video.videoHeight)))
  }

  const onFile = (file: File | undefined) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setPreview(onSample(face, sampleFaceRgb(img, img.naturalWidth, img.naturalHeight)))
      setPhotoUrl(url)
    }
    img.src = url
  }

  const fixSticker = (index: number, color: StickerColor) => {
    const base = preview ?? progress[face]
    if (!base || index === 4) return
    const next = base.slice()
    next[index] = color
    setPreview(next)
  }

  return (
    <section className="panel capture">
      <header className="panel-head">
        <h2>写真・カメラで入力</h2>
        <p>
          {FACE_LABELS[face]}（{faceIndex + 1} / {CAPTURE_ORDER.length}）— {FACE_VIEW_HINT[face]}
        </p>
        <p className="hint">
          枠の上辺が{FACE_SHORT[FACE_NEIGHBORS[face].top]}面に接する向きで撮影してください。中心の色を基準に、照明に合わせて色を補正します。
        </p>
      </header>

      <div className="face-tabs">
        {CAPTURE_ORDER.map((f, i) => (
          <button
            key={f}
            type="button"
            className={`face-tab ${f === face ? 'active' : ''} ${progress[f] ? 'done' : ''}`}
            style={{ borderBottomColor: COLOR_HEX[f] }}
            onClick={() => selectFace(i)}
          >
            {FACE_SHORT[f]}
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
      </div>

      {cameraError && <p className="error-text">{cameraError}</p>}

      <div className="capture-stage">
        {mode === 'camera' && (
          <div className="viewport square">
            <video ref={videoRef} playsInline muted className="media" />
            <div className="grid-overlay" aria-hidden />
            <button type="button" className="primary" onClick={captureFromVideo}>
              この面を撮影
            </button>
          </div>
        )}

        {mode === 'photo' && (
          <div className={`viewport square ${photoUrl ? '' : 'photo-drop'}`}>
            {photoUrl ? (
              <img src={photoUrl} alt="" className="media" />
            ) : (
              <p>キューブの1面が枠に収まる写真を選んでください（中央を正方形に切り取って読み取ります）</p>
            )}
            <div className="grid-overlay static" aria-hidden />
            <button type="button" className="primary" onClick={() => fileRef.current?.click()}>
              {photoUrl ? '別の写真を選択' : '写真を選択'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                onFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>
        )}

        {(preview ?? progress[face]) && (
          <div className="preview-block">
            <p className="preview-label">
              認識結果（タップで色修正）— 上辺: {FACE_SHORT[FACE_NEIGHBORS[face].top]}面側
            </p>
            <div className="sticker-grid">
              {(preview ?? progress[face] ?? []).map((c, i) => (
                <button
                  key={i}
                  type="button"
                  className={`sticker ${i === 4 ? 'center' : ''}`}
                  style={{ background: COLOR_HEX[c] }}
                  disabled={i === 4}
                  onClick={() => fixSticker(i, paintColor)}
                  aria-label={`ステッカー ${i + 1}`}
                >
                  {i === 4 ? FACE_SHORT[face] : null}
                </button>
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
            <p className="hint">パレットで色を選び、ステッカーをタップして塗ります（中心は固定）</p>
            {preview && (
              <button type="button" className="primary" onClick={confirmPreview}>
                この面を確定
              </button>
            )}
          </div>
        )}
      </div>

      <footer className="panel-foot">
        <div className="foot-left">
          <button type="button" className="ghost" onClick={onBack}>
            戻る
          </button>
          <span>
            入力済み {capturedCount} / {CAPTURE_ORDER.length} 面
          </span>
        </div>
        <button type="button" className="primary" onClick={onDone}>
          {capturedCount < CAPTURE_ORDER.length ? '残りを展開図で入力' : '展開図で最終確認'}
        </button>
      </footer>
    </section>
  )
}
