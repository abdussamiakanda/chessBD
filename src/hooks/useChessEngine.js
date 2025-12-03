// Hook to use Chess engine in chessBD - Stockfish 17 only
import { useEffect, useState, useRef } from "react"
import { Stockfish17 } from "../lib/engine/stockfish17"
import { isWasmSupported } from "../lib/engine/shared"

export function useChessEngine() {
  const [engine, setEngine] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const isInitializingRef = useRef(false)
  const engineRef = useRef(null)

  useEffect(() => {
    // Prevent multiple initializations (especially in React Strict Mode)
    if (isInitializingRef.current || engineRef.current) {
      return
    }

    if (!isWasmSupported()) {
      setError(new Error("WebAssembly is not supported in this browser"))
      setIsLoading(false)
      return
    }

    isInitializingRef.current = true
    setIsLoading(true)
    setError(null)

    // Only support Stockfish 17
    Stockfish17.create()
      .then((newEngine) => {
        // Check if component is still mounted and not already initialized
        if (engineRef.current) {
          newEngine.shutdown()
          return
        }
        
        engineRef.current = newEngine
        setEngine(newEngine)
        setIsLoading(false)
        isInitializingRef.current = false
      })
      .catch((err) => {
        setError(err)
        setIsLoading(false)
        isInitializingRef.current = false
      })

    return () => {
      if (engineRef.current) {
        engineRef.current.shutdown()
        engineRef.current = null
        setEngine(null)
      }
      isInitializingRef.current = false
    }
  }, []) // No dependencies - always use Stockfish 17

  return { engine, isLoading, error }
}

