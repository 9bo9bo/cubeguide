import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { COLOR_HEX, type StickerColor } from '../lib/colors'
import type { CubeStickers } from '../lib/cubeState'
import { describeMove, moveAxis, type Move } from '../lib/moves'

interface Cube3DProps {
  stickers: CubeStickers
  animatingMove: Move | null
  animationMs?: number
  onMoveComplete?: () => void
}

interface Cubie {
  mesh: THREE.Mesh
  x: number
  y: number
  z: number
}

function stickerIndexForCubieFace(
  x: number,
  y: number,
  z: number,
  face: 'U' | 'R' | 'F' | 'D' | 'L' | 'B',
): number | null {
  const faceBase = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 }
  const base = faceBase[face]
  const toCell = (v: number) => v + 1
  switch (face) {
    case 'U':
      if (y !== 1) return null
      return base + (2 - toCell(z)) * 3 + toCell(x)
    case 'D':
      if (y !== -1) return null
      return base + toCell(z) * 3 + toCell(x)
    case 'F':
      if (z !== 1) return null
      return base + (2 - toCell(y)) * 3 + toCell(x)
    case 'B':
      if (z !== -1) return null
      return base + (2 - toCell(y)) * 3 + (2 - toCell(x))
    case 'R':
      if (x !== 1) return null
      return base + (2 - toCell(y)) * 3 + (2 - toCell(z))
    case 'L':
      if (x !== -1) return null
      return base + (2 - toCell(y)) * 3 + toCell(z)
  }
}

function colorMaterials(stickers: CubeStickers, x: number, y: number, z: number): THREE.Material[] {
  const faces: (('U' | 'R' | 'F' | 'D' | 'L' | 'B') | null)[] = [
    x === 1 ? 'R' : null,
    x === -1 ? 'L' : null,
    y === 1 ? 'U' : null,
    y === -1 ? 'D' : null,
    z === 1 ? 'F' : null,
    z === -1 ? 'B' : null,
  ]
  return faces.map((face) => {
    if (!face) return new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
    const idx = stickerIndexForCubieFace(x, y, z, face)
    const c = (idx != null ? stickers[idx] : 'U') as StickerColor
    return new THREE.MeshBasicMaterial({ color: COLOR_HEX[c] })
  })
}

function disposeCubies(cubeRoot: THREE.Group) {
  while (cubeRoot.children.length) {
    const child = cubeRoot.children[0]
    cubeRoot.remove(child)
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      const mats = child.material
      if (Array.isArray(mats)) mats.forEach((m) => m.dispose())
      else mats.dispose()
    }
  }
}

function buildCubies(cubeRoot: THREE.Group, colors: CubeStickers): Cubie[] {
  disposeCubies(cubeRoot)
  const cubies: Cubie[] = []
  const size = 0.92
  const gap = 1.05
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(size, size, size),
          colorMaterials(colors, x, y, z),
        )
        mesh.position.set(x * gap, y * gap, z * gap)
        cubeRoot.add(mesh)
        cubies.push({ mesh, x, y, z })
      }
    }
  }
  return cubies
}

export function Cube3D({
  stickers,
  animatingMove,
  animationMs = 480,
  onMoveComplete,
}: Cube3DProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const stickersRef = useRef(stickers)
  const cubiesRef = useRef<Cubie[]>([])
  const onCompleteRef = useRef(onMoveComplete)
  const animatingRef = useRef(false)

  type SceneState = {
    renderer: THREE.WebGLRenderer
    camera: THREE.PerspectiveCamera
    scene: THREE.Scene
    /** User-controlled view rotation; cube layers turn in its local axes. */
    viewRoot: THREE.Group
    cubeRoot: THREE.Group
    pivot: THREE.Group
    anim: {
      axis: THREE.Vector3
      target: number
      start: number
      duration: number
    } | null
  }

  const sceneRef = useRef<SceneState | null>(null)
  onCompleteRef.current = onMoveComplete
  stickersRef.current = stickers

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    camera.position.set(5.4, 4.4, 6)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 1))

    const viewRoot = new THREE.Group()
    const cubeRoot = new THREE.Group()
    const pivot = new THREE.Group()
    viewRoot.add(cubeRoot)
    viewRoot.add(pivot)
    scene.add(viewRoot)

    cubiesRef.current = buildCubies(cubeRoot, stickersRef.current)
    sceneRef.current = { renderer, camera, scene, viewRoot, cubeRoot, pivot, anim: null }

    const canvas = renderer.domElement
    canvas.style.touchAction = 'none'
    canvas.style.cursor = 'grab'
    let drag: { id: number; x: number; y: number } | null = null
    const worldX = new THREE.Vector3(1, 0, 0)
    const worldY = new THREE.Vector3(0, 1, 0)
    const turn = new THREE.Quaternion()
    const onDown = (e: PointerEvent) => {
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = 'grabbing'
    }
    const onMove = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return
      const dx = e.clientX - drag.x
      const dy = e.clientY - drag.y
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
      const speed = 0.01
      viewRoot.quaternion.premultiply(turn.setFromAxisAngle(worldY, dx * speed))
      viewRoot.quaternion.premultiply(turn.setFromAxisAngle(worldX, dy * speed))
    }
    const onUp = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return
      drag = null
      canvas.style.cursor = 'grab'
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)

    const resize = () => {
      const w = mount.clientWidth
      const h = Math.max(mount.clientHeight, 1)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      // Keep CSS size under stylesheet control so the canvas never widens its container.
      renderer.setSize(w, h, false)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    let frame = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const state = sceneRef.current
      if (!state) return

      if (state.anim) {
        const t = Math.min(1, (now - state.anim.start) / state.anim.duration)
        const eased = 1 - (1 - t) ** 3
        const angle = state.anim.target * eased
        state.pivot.setRotationFromAxisAngle(state.anim.axis, angle)

        if (t >= 1) {
          // Detach and rebuild from stickers (parent updates after callback)
          for (const cubie of cubiesRef.current) {
            if (cubie.mesh.parent === state.pivot) {
              state.pivot.remove(cubie.mesh)
            }
          }
          state.pivot.rotation.set(0, 0, 0)
          state.anim = null
          animatingRef.current = false
          onCompleteRef.current?.()
        }
      }

      renderer.render(scene, camera)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      disposeCubies(cubeRoot)
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement)
      }
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const state = sceneRef.current
    if (!state || animatingRef.current) return
    cubiesRef.current = buildCubies(state.cubeRoot, stickers)
  }, [stickers])

  useEffect(() => {
    const state = sceneRef.current
    if (!state || !animatingMove || animatingRef.current) return

    const info = describeMove(animatingMove)
    const axisInfo = moveAxis(info.face)
    const angle = axisInfo.angleForTurns(info.turns)
    const axis = new THREE.Vector3(
      axisInfo.axis === 'x' ? 1 : 0,
      axisInfo.axis === 'y' ? 1 : 0,
      axisInfo.axis === 'z' ? 1 : 0,
    )

    state.pivot.rotation.set(0, 0, 0)

    for (const cubie of cubiesRef.current) {
      const onLayer =
        (axisInfo.axis === 'x' && cubie.x === axisInfo.layer) ||
        (axisInfo.axis === 'y' && cubie.y === axisInfo.layer) ||
        (axisInfo.axis === 'z' && cubie.z === axisInfo.layer)
      if (onLayer) {
        state.cubeRoot.remove(cubie.mesh)
        state.pivot.add(cubie.mesh)
      }
    }

    animatingRef.current = true
    state.anim = {
      axis,
      target: angle,
      start: performance.now(),
      duration: animationMs,
    }
  }, [animatingMove, animationMs])

  return (
    <div className="cube-stage-wrap">
      <div className="cube-stage" ref={mountRef} />
      <div className="cube-stage-bar">
        <span>ドラッグで回転できます</span>
        <button
          type="button"
          className="chip"
          onClick={() => sceneRef.current?.viewRoot.quaternion.identity()}
        >
          向きを戻す
        </button>
      </div>
    </div>
  )
}
