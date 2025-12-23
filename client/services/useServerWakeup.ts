// A small React hook to ping the backend /health endpoint (with 5s timeout)
// and expose a lightweight wakeup status. Non-blocking, works with offline-first app.
// Does not interfere with service worker behavior.
import { useEffect, useRef, useState } from 'react';

export type WakeStatus = 'idle' | 'waking' | 'ready' | 'failed';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '';

const buildUrl = (path: string) => {
  if (!API_BASE) return path;
  return `${API_BASE.replace(/\/$/, '')}${path}`;
};

export default function useServerWakeup() {
  const [status, setStatus] = useState<WakeStatus>('idle');
  // keep reference to last active controller so we can abort on cleanup
  const controllerRef = useRef<AbortController | null>(null);

  const wake = async () => {
    // If offline, immediately mark ready (we will work locally)
    if (!navigator.onLine) {
      setStatus('ready');
      return;
    }

    // Start waking
    setStatus('waking');

    // Clean up previous controller if any
    if (controllerRef.current) {
      try { controllerRef.current.abort(); } catch {}
      controllerRef.current = null;
    }

    const controller = new AbortController();
    controllerRef.current = controller;

    // Ensure we don't hang: 5-second timeout
    const timeoutId = window.setTimeout(() => {
      try { controller.abort(); } catch {}
    }, 5000);

    try {
      const resp = await fetch(buildUrl('/health'), { signal: controller.signal, method: 'GET' });
      window.clearTimeout(timeoutId);
      if (!resp.ok) {
        setStatus('failed');
      } else {
        setStatus('ready');
      }
    } catch (err) {
      // fetch threw (network error / aborted / timed out)
      setStatus('failed');
    } finally {
      controllerRef.current = null;
    }
  };

  useEffect(() => {
    // Run once on mount
    wake();

    // When connection is restored later, try waking again
    const onOnline = () => {
      wake();
    };
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('online', onOnline);
      if (controllerRef.current) {
        try { controllerRef.current.abort(); } catch {}
        controllerRef.current = null;
      }
    };
    // We intentionally do NOT include `wake` in deps to avoid re-creating effect loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status };
}