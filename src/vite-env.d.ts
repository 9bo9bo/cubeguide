/// <reference types="vite/client" />

declare module 'cubejs' {
  interface CubeJSON {
    center: number[]
    cp: number[]
    co: number[]
    ep: number[]
    eo: number[]
  }

  class Cube {
    constructor(state?: Cube | CubeJSON)
    move(algorithm: string): this
    randomize(): this
    isSolved(): boolean
    solve(maxDepth?: number): string | null
    asString(): string
    toJSON(): CubeJSON
    static initSolver(): void
    static fromString(str: string): Cube
    static random(): Cube
    static inverse(algorithm: string): string
  }

  export default Cube
}
