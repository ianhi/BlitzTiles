/**
 * Client-side timer hook using requestAnimationFrame.
 *
 * Displays a locally-ticking countdown reconciled from server state.
 */

import { useState, useEffect, useRef } from 'react';

export function useTimer(
  serverTimeMs: number,
  isActive: boolean,
  turnStartTimestamp?: string,
): { displayMs: number; formatted: string } {
  const [displayMs, setDisplayMs] = useState(serverTimeMs);
  const startRef = useRef<number>(0);
  const serverTimeRef = useRef(serverTimeMs);
  const rafRef = useRef<number>(0);

  // Update when server sends new time
  useEffect(() => {
    serverTimeRef.current = serverTimeMs;
    setDisplayMs(serverTimeMs);
    startRef.current = Date.now();
  }, [serverTimeMs, turnStartTimestamp]);

  useEffect(() => {
    if (!isActive || serverTimeMs === Infinity) {
      return;
    }

    startRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, serverTimeRef.current - elapsed);
      setDisplayMs(remaining);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, serverTimeMs]);

  const formatted = formatTime(displayMs);

  return { displayMs, formatted };
}

function formatTime(ms: number): string {
  if (ms === Infinity || ms < 0) return '--:--';

  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (totalSeconds <= 10) {
    // Show tenths under 10 seconds
    const tenths = Math.floor((ms % 1000) / 100);
    return `${seconds}.${tenths}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
