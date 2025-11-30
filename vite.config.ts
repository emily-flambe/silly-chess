import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  root: 'src/frontend',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/frontend/index.html'),
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          // Copy ffish WASM file (path relative to project root, not vite root)
          src: '../../node_modules/ffish/ffish.wasm',
          dest: 'wasm'
        },
        {
          // Copy Fairy-Stockfish WASM file
          src: '../../node_modules/fairy-stockfish-nnue.wasm/stockfish.wasm',
          dest: 'wasm'
        }
      ]
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
  },
  // Configure asset handling for WASM
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['ffish', 'fairy-stockfish-nnue.wasm']
  }
});
