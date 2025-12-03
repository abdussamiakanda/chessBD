// Stockfish 17 engine wrapper
import { UciEngine } from "./uciEngine"
import { isMultiThreadSupported, isWasmSupported } from "./shared"

export class Stockfish17 {
  static async create() {
    if (!Stockfish17.isSupported()) {
      throw new Error("Stockfish 17 is not supported")
    }

    const multiThreadIsSupported = isMultiThreadSupported()

    // Use static path from public directory (like chessBD)
    // This avoids path resolution issues with import.meta.url in production
    const enginePath = `/engines/stockfish-17/stockfish-17${
      multiThreadIsSupported ? "" : "-single"
    }.js`

    const engineName = "stockfish_17"

    return UciEngine.create(engineName, enginePath)
  }

  static isSupported() {
    return isWasmSupported()
  }
}

