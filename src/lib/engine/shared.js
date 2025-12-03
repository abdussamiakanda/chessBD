// Shared utilities for chess engine

export const isWasmSupported = () =>
  typeof WebAssembly === "object" &&
  WebAssembly.validate(
    Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
  )

export const isMultiThreadSupported = () => {
  try {
    return typeof SharedArrayBuffer !== "undefined" && !isIosDevice()
  } catch {
    return false
  }
}

export const isIosDevice = () =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent)

export const isMobileDevice = () =>
  isIosDevice() || /Android|Opera Mini/i.test(navigator.userAgent)

