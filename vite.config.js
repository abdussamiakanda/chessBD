import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Configure worker options
  worker: {
    format: 'es',
  },
  // Ensure WASM files are handled correctly
  assetsInclude: ['**/*.wasm'],
  build: {
    rollupOptions: {
      output: {
        // Preserve WASM file names to help with path resolution
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.wasm')) {
            // Keep WASM files with their original names in assets
            return 'assets/[name][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
})
