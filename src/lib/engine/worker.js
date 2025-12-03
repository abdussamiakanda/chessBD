// Worker system for chess engine

export const getEngineWorker = (enginePath) => {
  // Use static path from public directory (like chessBD)
  // No need for type: 'module' when using static paths
  const worker = new Worker(enginePath)

  const engineWorker = {
    isReady: false,
    uci: (command) => worker.postMessage(command),
    listen: () => null,
    terminate: () => worker.terminate(),
  }

  worker.onmessage = (event) => {
    engineWorker.listen(event.data)
  }

  return engineWorker
}

export const sendCommandsToWorker = (
  worker,
  commands,
  finalMessage,
  onNewMessage
) => {
  return new Promise((resolve) => {
    const messages = []

    worker.listen = (data) => {
      messages.push(data)
      onNewMessage?.(messages)

      if (data.startsWith(finalMessage)) {
        resolve(messages)
      }
    }

    for (const command of commands) {
      worker.uci(command)
    }
  })
}

