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
          // Copy ffish WASM file to root (ffish library looks for it relative to script)
          src: '../../node_modules/ffish/ffish.wasm',
          dest: '.'
        },
        {
          // Also copy to wasm folder for consistency
          src: '../../node_modules/ffish/ffish.wasm',
          dest: 'wasm'
        },
        {
          // Copy Stockfish lite single-threaded JS (no SharedArrayBuffer required)
          // Keep original name - the JS file looks for .wasm with matching basename
          src: '../../node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.js',
          dest: 'wasm'
        },
        {
          // Copy Stockfish lite single-threaded WASM (must match JS filename)
          src: '../../node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.wasm',
          dest: 'wasm'
        },
        {
          // Copy Stockfish worker wrapper
          src: '../lib/stockfish/stockfish-worker-wrapper.js',
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
    exclude: ['ffish', 'stockfish']
  }
});
