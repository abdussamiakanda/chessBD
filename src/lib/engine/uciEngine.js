// UCI Engine class - adapted for chessBD
import { parseEvaluationResults } from "./helpers/parseResults"
import { getIsStalemate, getWhoIsCheckmated } from "./helpers/chessHelpers"
import { getEngineWorker, sendCommandsToWorker } from "./worker"

export class UciEngine {
  constructor(engineName, enginePath, customEngineInit) {
    this.name = engineName
    this.enginePath = enginePath
    this.customEngineInit = customEngineInit
    this.workers = []
    this.workerQueue = []
    this.isReady = false
    this.multiPv = 3
    this.limitStrength = false
    this.elo = null
  }

  static async create(engineName, enginePath, customEngineInit) {
    const engine = new UciEngine(engineName, enginePath, customEngineInit)

    await engine.addNewWorker()
    engine.isReady = true

    return engine
  }

  acquireWorker() {
    for (const worker of this.workers) {
      if (!worker.isReady) continue

      worker.isReady = false
      return worker
    }

    return undefined
  }

  async releaseWorker(worker) {
    const nextJob = this.workerQueue.shift()
    if (!nextJob) {
      worker.isReady = true
      return
    }

    const res = await sendCommandsToWorker(
      worker,
      nextJob.commands,
      nextJob.finalMessage,
      nextJob.onNewMessage
    )

    this.releaseWorker(worker)
    nextJob.resolve(res)
  }

  async setMultiPv(multiPv) {
    if (multiPv === this.multiPv) return

    if (multiPv < 2 || multiPv > 6) {
      throw new Error(`Invalid MultiPV value : ${multiPv}`)
    }

    await this.sendCommandsToEachWorker(
      [`setoption name MultiPV value ${multiPv}`, "isready"],
      "readyok"
    )

    this.multiPv = multiPv
  }

  async setStrength(limitStrength, elo) {
    if (limitStrength === this.limitStrength && elo === this.elo) return

    // Stockfish's UCI_Elo range is 1350-2850
    if (limitStrength && (elo < 1350 || elo > 2850)) {
      throw new Error(`Invalid Elo value: ${elo}. Must be between 1350 and 2850`)
    }

    const commands = []
    if (limitStrength) {
      commands.push(`setoption name UCI_LimitStrength value true`)
      commands.push(`setoption name UCI_Elo value ${elo}`)
    } else {
      commands.push(`setoption name UCI_LimitStrength value false`)
    }
    commands.push("isready")

    await this.sendCommandsToEachWorker(commands, "readyok")

    this.limitStrength = limitStrength
    this.elo = elo
  }

  getIsReady() {
    return this.isReady
  }

  throwErrorIfNotReady() {
    if (!this.isReady) {
      throw new Error(`${this.name} is not ready`)
    }
  }

  shutdown() {
    this.isReady = false
    this.workerQueue = []

    for (const worker of this.workers) {
      this.terminateWorker(worker)
    }
    this.workers = []
  }

  terminateWorker(worker) {
    worker.isReady = false
    worker.uci("quit")
    worker.terminate()
  }

  async stopAllCurrentJobs() {
    this.workerQueue = []
    await this.sendCommandsToEachWorker(["stop", "isready"], "readyok")

    for (const worker of this.workers) {
      this.releaseWorker(worker)
    }
  }

  async sendCommands(commands, finalMessage, onNewMessage) {
    const worker = this.acquireWorker()

    if (!worker) {
      return new Promise((resolve) => {
        this.workerQueue.push({
          commands,
          finalMessage,
          onNewMessage,
          resolve,
        })
      })
    }

    const res = await sendCommandsToWorker(
      worker,
      commands,
      finalMessage,
      onNewMessage
    )

    this.releaseWorker(worker)
    return res
  }

  async sendCommandsToEachWorker(commands, finalMessage, onNewMessage) {
    await Promise.all(
      this.workers.map(async (worker) => {
        await sendCommandsToWorker(
          worker,
          commands,
          finalMessage,
          onNewMessage
        )
        this.releaseWorker(worker)
      })
    )
  }

  async addNewWorker() {
    const worker = getEngineWorker(this.enginePath)

    await sendCommandsToWorker(worker, ["uci"], "uciok")
    
    const initCommands = [`setoption name MultiPV value ${this.multiPv}`]
    
    // Set strength options if configured
    if (this.limitStrength && this.elo !== null) {
      initCommands.push(`setoption name UCI_LimitStrength value true`)
      initCommands.push(`setoption name UCI_Elo value ${this.elo}`)
    } else {
      initCommands.push(`setoption name UCI_LimitStrength value false`)
    }
    
    initCommands.push("isready")
    
    await sendCommandsToWorker(worker, initCommands, "readyok")
    await this.customEngineInit?.(worker)
    await sendCommandsToWorker(worker, ["ucinewgame", "isready"], "readyok")

    this.workers.push(worker)
    this.releaseWorker(worker)
  }

  async setWorkersNb(workersNb) {
    if (workersNb === this.workers.length) return

    if (workersNb < 1) {
      throw new Error(
        `Number of workers must be greater than 0, got ${workersNb} instead`
      )
    }

    if (workersNb < this.workers.length) {
      const workersToRemove = this.workers.slice(workersNb)
      this.workers = this.workers.slice(0, workersNb)

      for (const worker of workersToRemove) {
        this.terminateWorker(worker)
      }
      return
    }

    const workersNbToCreate = workersNb - this.workers.length

    await Promise.all(
      new Array(workersNbToCreate).fill(0).map(() => this.addNewWorker())
    )
  }

  async evaluatePosition(fen, depth = 16) {
    const results = await this.sendCommands(
      [`position fen ${fen}`, `go depth ${depth}`],
      "bestmove"
    )

    return parseEvaluationResults(results, fen)
  }

  async evaluateGame({
    fens,
    uciMoves: _uciMoves,
    depth = 16,
    multiPv = this.multiPv,
    setEvaluationProgress,
    workersNb = 1,
  }) {
    this.throwErrorIfNotReady()
    this.isReady = false
    setEvaluationProgress?.(1)

    await this.setMultiPv(multiPv)
    await this.sendCommandsToEachWorker(["ucinewgame", "isready"], "readyok")
    await this.setWorkersNb(workersNb)

    const positions = new Array(fens.length)
    let completed = 0

    const updateEval = (index, positionEval) => {
      completed++
      positions[index] = positionEval
      const progress = completed / fens.length
      setEvaluationProgress?.(99 - Math.exp(-4 * progress) * 99)
    }

    await Promise.all(
      fens.map(async (fen, i) => {
        const whoIsCheckmated = getWhoIsCheckmated(fen)
        if (whoIsCheckmated) {
          updateEval(i, {
            lines: [
              {
                pv: [],
                depth: 0,
                multiPv: 1,
                mate: whoIsCheckmated === "w" ? -1 : 1,
              },
            ],
          })
          return
        }

        const isStalemate = getIsStalemate(fen)
        if (isStalemate) {
          updateEval(i, {
            lines: [
              {
                pv: [],
                depth: 0,
                multiPv: 1,
                cp: 0,
              },
            ],
          })
          return
        }

        const result = await this.evaluatePosition(fen, depth)
        updateEval(i, result)
      })
    )

    await this.setWorkersNb(1)
    this.isReady = true

    // Simplified - you can add move classification and accuracy calculation later
    return {
      positions,
      accuracy: { white: 0, black: 0 },
      settings: {
        engine: this.name,
        date: new Date().toISOString(),
        depth,
        multiPv,
      },
    }
  }
}

