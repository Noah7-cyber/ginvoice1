import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

const MAX_DRIFT_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = 'ginvoice_last_known_time';

export const useTimeDrift = () => {
  const [isTimeBlocked, setIsTimeBlocked] = useState(false);
  // Baseline references for monotonic check
  const bootTimeRef = useRef(Date.now());
  const perfBootRef = useRef(performance.now());

  useEffect(() => {
    const checkTime = async () => {
      // 1. Offline "Rewind" Check
      try {
        const lastKnownStr = localStorage.getItem(STORAGE_KEY);
        if (lastKnownStr) {
          const lastKnown = parseInt(lastKnownStr, 10);
          if (!isNaN(lastKnown) && Date.now() < lastKnown - MAX_DRIFT_MS) {
            console.warn('[Time Security] Clock rewind detected on boot');
            setIsTimeBlocked(true);
            return;
          }
        }
      } catch (e) {
        console.error('Time check error', e);
      }

      // 2. Online "Server" Check
      if (navigator.onLine) {
        try {
          const res = await api.get('/sync/time');
          const serverTime = res.time; // Expecting { time: number }
          const localTime = Date.now();
          const drift = Math.abs(localTime - serverTime);

          if (drift > MAX_DRIFT_MS) {
            console.warn(`[Time Security] Server drift detected: ${drift}ms`);
            setIsTimeBlocked(true);
          } else {
            // Clock is good. Update baseline if needed or just mark as valid.
            setIsTimeBlocked(false);
            // Save valid time to prevent future rewind
            localStorage.setItem(STORAGE_KEY, serverTime.toString());
          }
        } catch (err) {
          console.error('Failed to fetch server time', err);
        }
      }
    };

    checkTime();

    window.addEventListener('online', checkTime);

    // 3. Runtime "Jump" Check (Monotonic)
    const interval = setInterval(() => {
      const elapsed = performance.now() - perfBootRef.current;
      const expectedNow = bootTimeRef.current + elapsed;
      const actualNow = Date.now();

      const runtimeDrift = Math.abs(actualNow - expectedNow);

      if (runtimeDrift > MAX_DRIFT_MS) {
        console.warn(`[Time Security] Runtime clock jump detected: ${runtimeDrift}ms`);
        setIsTimeBlocked(true);
      } else {
         // Periodically save 'now' as safe-point (monotonic verified)
         // Only if we haven't detected a block yet.
         // And check against rewind?
         localStorage.setItem(STORAGE_KEY, actualNow.toString());
      }
    }, 10000); // Check every 10s

    return () => {
        clearInterval(interval);
        window.removeEventListener('online', checkTime);
    };
  }, []);

  return isTimeBlocked;
};
