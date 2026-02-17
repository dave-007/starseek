import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split Three.js into separate chunk for better caching
          three: ['three']
        }
      }
    },
    // Increase chunk size limit to suppress warnings for this project
    chunkSizeWarningLimit: 600,
    // Use esbuild for faster minification (default, but explicit here)
    minify: 'esbuild'
  },
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: ['three']
  }
})
