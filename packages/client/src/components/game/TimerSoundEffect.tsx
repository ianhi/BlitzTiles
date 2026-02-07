/**
 * Invisible component that plays audio/haptic feedback
 * for timer warnings and game completion.
 */

import { useEffect, useRef } from 'react';
import { useGameStore } from '../../hooks/useGameStore';
import { usePreferences } from '../../hooks/usePreferences';
import { useTimer } from '../../hooks/useTimer';

export function TimerSoundEffect() {
  const phase = useGameStore((s) => s.phase);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const players = useGameStore((s) => s.players);
  const _gameState = useGameStore((s) => s._gameState);
  const sound = usePreferences((s) => s.sound);
  const haptic = usePreferences((s) => s.haptic);

  const currentPlayer = players[currentPlayerIndex];
  const timerMs = currentPlayer?.timeRemainingMs ?? Infinity;
  const isActive = phase === 'playing';
  const turnTimestamp = _gameState?.turnStartTimestamp;

  const { displayMs } = useTimer(timerMs, isActive, turnTimestamp);

  // Track which warnings have been fired for the current turn
  const warned10 = useRef(false);
  const warned5 = useRef(false);

  // Reset warnings when turn changes
  useEffect(() => {
    warned10.current = false;
    warned5.current = false;
  }, [currentPlayerIndex, turnTimestamp]);

  // Check timer thresholds
  useEffect(() => {
    if (!isActive || displayMs === Infinity || displayMs <= 0) return;

    const seconds = displayMs / 1000;

    if (seconds <= 5 && !warned5.current) {
      warned5.current = true;
      sound('timerUrgent');
      haptic('warning');
    } else if (seconds <= 10 && seconds > 5 && !warned10.current) {
      warned10.current = true;
      sound('timerWarning');
      haptic('warning');
    }
  }, [displayMs, isActive, sound, haptic]);

  // Game over sound
  const prevPhase = useRef(phase);
  useEffect(() => {
    if (prevPhase.current === 'playing' && phase === 'finished') {
      sound('gameOver');
      haptic('strong');
    }
    prevPhase.current = phase;
  }, [phase, sound, haptic]);

  return null;
}
