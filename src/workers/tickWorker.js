// Simple background tick generator to avoid hidden-tab timer throttling.
// Posts the current timestamp roughly every second.

const TICK_INTERVAL = 1000;
let intervalId = null;

const start = () => {
  if (intervalId) return;
  intervalId = setInterval(() => {
    postMessage(Date.now());
  }, TICK_INTERVAL);
};

const stop = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

self.onmessage = (e) => {
  if (e.data === 'start') start();
  if (e.data === 'stop') stop();
};

// Auto-start on load
start();
