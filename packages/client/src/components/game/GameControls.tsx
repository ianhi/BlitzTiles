import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../hooks/useGameStore';
import { usePreferences } from '../../hooks/usePreferences';
import './GameControls.css';

export function GameControls() {
  const placedTiles = useGameStore((s) => s.placedTiles);
  const submitMoveAction = useGameStore((s) => s.submitMove);
  const passTurnAction = useGameStore((s) => s.passTurn);
  const recallTiles = useGameStore((s) => s.recallTiles);
  const shuffleHand = useGameStore((s) => s.shuffleHand);
  const lastMoveError = useGameStore((s) => s.lastMoveError);
  const clearError = useGameStore((s) => s.clearError);
  const phase = useGameStore((s) => s.phase);
  const currentHand = useGameStore((s) => s.currentHand);
  const exchangeTilesAction = useGameStore((s) => s.exchangeTiles);
  const tileBagCount = useGameStore((s) => s.tileBagCount);

  const sound = usePreferences((s) => s.sound);
  const haptic = usePreferences((s) => s.haptic);

  const [exchangeMode, setExchangeMode] = useState(false);
  const [exchangeSelection, setExchangeSelection] = useState<Set<string>>(new Set());

  // Play error sound when an error appears
  const prevError = useRef(lastMoveError);
  useEffect(() => {
    if (lastMoveError && lastMoveError !== prevError.current) {
      sound('moveRejected');
      haptic('error');
    }
    prevError.current = lastMoveError;
  }, [lastMoveError, sound, haptic]);

  if (phase !== 'playing') return null;

  const hasPlacedTiles = placedTiles.length > 0;

  const handleSubmit = () => {
    const hadError = !!lastMoveError;
    submitMoveAction();
    // Sound is played after action — if no new error, it was successful
    // We check in next tick since store updates synchronously
    setTimeout(() => {
      const currentError = useGameStore.getState().lastMoveError;
      if (!currentError) {
        sound('moveSubmitted');
        haptic('medium');
      }
    }, 0);
  };

  const handlePass = () => {
    passTurnAction();
    sound('pass');
    haptic('light');
  };

  const handleExchangeToggle = () => {
    if (exchangeMode) {
      setExchangeMode(false);
      setExchangeSelection(new Set());
    } else {
      recallTiles();
      setExchangeMode(true);
      setExchangeSelection(new Set());
    }
  };

  const handleExchangeConfirm = () => {
    if (exchangeSelection.size > 0) {
      exchangeTilesAction(Array.from(exchangeSelection));
      sound('exchange');
      haptic('medium');
      setExchangeMode(false);
      setExchangeSelection(new Set());
    }
  };

  const toggleExchangeTile = (tileId: string) => {
    const newSet = new Set(exchangeSelection);
    if (newSet.has(tileId)) {
      newSet.delete(tileId);
    } else {
      newSet.add(tileId);
    }
    setExchangeSelection(newSet);
    haptic('light');
  };

  return (
    <div className="game-controls">
      {lastMoveError && (
        <div className="move-error" onClick={clearError}>
          {lastMoveError}
        </div>
      )}

      {exchangeMode ? (
        <div className="exchange-mode">
          <div className="exchange-prompt">Tap tiles to exchange:</div>
          <div className="exchange-tiles">
            {currentHand.map((tile) => (
              <div
                key={tile.id}
                className={`exchange-tile ${exchangeSelection.has(tile.id) ? 'selected' : ''}`}
                onClick={() => toggleExchangeTile(tile.id)}
              >
                <span>{tile.isBlank ? '?' : tile.letter}</span>
                {tile.value > 0 && <span className="ex-tile-val">{tile.value}</span>}
              </div>
            ))}
          </div>
          <div className="exchange-actions">
            <button className="btn-secondary" onClick={handleExchangeToggle}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleExchangeConfirm}
              disabled={exchangeSelection.size === 0}
            >
              Exchange {exchangeSelection.size} tile{exchangeSelection.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      ) : (
        <div className="control-buttons">
          <button className="btn-secondary" onClick={shuffleHand}>
            Shuffle
          </button>
          {hasPlacedTiles && (
            <button className="btn-secondary" onClick={recallTiles}>
              Recall
            </button>
          )}
          <button
            className="btn-secondary"
            onClick={handleExchangeToggle}
            disabled={tileBagCount < 1}
          >
            Exchange
          </button>
          <button className="btn-secondary" onClick={handlePass}>
            Pass
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!hasPlacedTiles}
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}
