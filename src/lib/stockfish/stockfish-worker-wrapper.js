/**
 * Stockfish Worker Wrapper
 *
 * This file is loaded as a Web Worker. It initializes the stockfish-lite-single
 * WASM engine which doesn't require SharedArrayBuffer.
 */

const baseUrl = self.location.origin || 'http://localhost:8787';

console.log('[Worker Wrapper] Starting, origin:', baseUrl);

// Import the stockfish-lite-single module
importScripts(baseUrl + '/wasm/stockfish-lite-single.js');

console.log('[Worker Wrapper] stockfish.js loaded, Stockfish type:', typeof Stockfish);

// Configure and initialize Stockfish
const config = {
  locateFile: function(path) {
    console.log('[Stockfish locateFile] requested:', path);
    return baseUrl + '/wasm/' + path;
  },
  listener: function(line) {
    // Forward UCI output to main thread
    postMessage(line);
  }
};

// Initialize Stockfish
Stockfish(config).then(function(sf) {
  console.log('[Worker Wrapper] Stockfish initialized successfully');

  // Store reference for command processing
  self.stockfishEngine = sf;

  // Set up message handler to forward UCI commands to the engine
  self.onmessage = function(e) {
    if (typeof e.data === 'string') {
      // Send UCI command to Stockfish
      sf.processCommand(e.data);
    }
  };

}).catch(function(err) {
  console.error('[Worker Wrapper] Failed to initialize Stockfish:', err);
  postMessage('error: ' + err.message);
});
