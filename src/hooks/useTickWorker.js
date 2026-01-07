import { useState, useEffect, useRef } from 'react';

/**
 * Hook to manage the background tick worker
 * Provides a signal that updates even when the tab is hidden
 * @returns {number} Current tick signal (timestamp in milliseconds)
 */
export function use_tick_worker() {
  const [tick_signal, set_tick_signal] = useState(Date.now());
  const worker_ref = useRef(null);

  useEffect(() => {
    // Create worker
    try {
      const worker = new Worker(new URL('../workers/tickWorker.js', import.meta.url), { type: 'module' });
      worker_ref.current = worker;

      // Listen for tick messages
      worker.onmessage = (e) => {
        set_tick_signal(e.data);
      };

      // Start the worker
      worker.postMessage('start');

      // Cleanup
      return () => {
        if (worker_ref.current) {
          worker_ref.current.postMessage('stop');
          worker_ref.current.terminate();
          worker_ref.current = null;
        }
      };
    } catch (error) {
      // Fallback if Web Workers aren't supported or fail
      console.warn('Tick worker failed to initialize, using fallback timer:', error);
      const fallback_interval = setInterval(() => {
        set_tick_signal(Date.now());
      }, 1000);
      return () => clearInterval(fallback_interval);
    }
  }, []);

  return tick_signal;
}

