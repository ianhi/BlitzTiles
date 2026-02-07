import { useGameStore } from '../../hooks/useGameStore';
import { usePreferences } from '../../hooks/usePreferences';
import './GameHeader.css';

export function GameHeader() {
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const tileBagCount = useGameStore((s) => s.tileBagCount);
  const phase = useGameStore((s) => s.phase);
  const soundEnabled = usePreferences((s) => s.soundEnabled);
  const toggleSound = usePreferences((s) => s.toggleSound);

  if (players.length < 2) return null;

  return (
    <div className="game-header">
      <div className={`player-info ${currentPlayerIndex === 0 ? 'active' : ''}`}>
        <div className="player-name">{players[0].name}</div>
        <div className="player-score">{players[0].score}</div>
      </div>

      <div className="game-info-center">
        <div className="bag-count">{tileBagCount} tiles left</div>
        {phase === 'playing' && (
          <div className="turn-indicator">
            {players[currentPlayerIndex].name}'s turn
          </div>
        )}
        <button
          className="mute-toggle"
          onClick={toggleSound}
          title={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
          aria-label={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
        >
          {soundEnabled ? '\u{1F50A}' : '\u{1F507}'}
        </button>
      </div>

      <div className={`player-info ${currentPlayerIndex === 1 ? 'active' : ''}`}>
        <div className="player-name">{players[1].name}</div>
        <div className="player-score">{players[1].score}</div>
      </div>
    </div>
  );
}
