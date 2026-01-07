// Background tick worker to avoid hidden-tab timer throttling
// Posts the current timestamp every second to keep game state synced

import { TICK_WORKER_INTERVAL_MS } from '../utils/gameConstants';
let intervalId = null;

const start = () => {
  if (intervalId) return;
  intervalId = setInterval(() => {
    postMessage(Date.now());
  }, TICK_WORKER_INTERVAL_MS);
};

const stop = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

self.onmessage = (e) => {
  if (e.data === 'start') {
    start();
  } else if (e.data === 'stop') {
    stop();
  }
};

// Auto-start on load
start();

