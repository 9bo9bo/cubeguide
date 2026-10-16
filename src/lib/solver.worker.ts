import Cube from 'cubejs'

export type SolverRequest = { id: number; type: 'warmup' } | { id: number; type: 'solve'; facelets: string }

export type SolverResponse =
  | { id: number; ok: true; algorithm: string }
  | { id: number; ok: false; error: string }

const scope = self as unknown as Worker
let initialized = false

function reply(res: SolverResponse): void {
  scope.postMessage(res)
}

scope.onmessage = (event: MessageEvent<SolverRequest>) => {
  const req = event.data
  try {
    if (!initialized) {
      Cube.initSolver()
      initialized = true
    }
    if (req.type === 'warmup') {
      reply({ id: req.id, ok: true, algorithm: '' })
      return
    }
    const cube = Cube.fromString(req.facelets)
    const algorithm = cube.isSolved() ? '' : (cube.solve() ?? '')
    reply({ id: req.id, ok: true, algorithm })
  } catch (err) {
    reply({ id: req.id, ok: false, error: String(err) })
  }
}
