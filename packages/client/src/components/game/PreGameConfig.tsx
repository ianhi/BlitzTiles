import { useState } from 'react';
import type { GameConfig, TimerPreset } from '@blitztiles/shared';
import { TIMER_PRESETS, DEFAULT_GAME_CONFIG } from '@blitztiles/shared';
import './PreGameConfig.css';

interface PreGameConfigProps {
  onStart: (config: GameConfig) => void;
  onBack: () => void;
  showPlayerNames?: boolean;
}

export function PreGameConfig({ onStart, onBack, showPlayerNames = true }: PreGameConfigProps) {
  const [selectedPreset, setSelectedPreset] = useState<TimerPreset>(TIMER_PRESETS[2]); // 60s default
  const [player1Name, setPlayer1Name] = useState('');
  const [player2Name, setPlayer2Name] = useState('');

  const handleStart = () => {
    const name1 = player1Name.trim() || 'Player 1';
    const name2 = player2Name.trim() || 'Player 2';

    const config: GameConfig = {
      timerMode: selectedPreset.timerMode,
      timerDurationMs: selectedPreset.durationMs,
      overtimePenaltyPerMinute: DEFAULT_GAME_CONFIG.overtimePenaltyPerMinute,
      playerNames: [name1, name2],
    };
    onStart(config);
  };

  return (
    <div className="pregame-config">
      <h2 className="pregame-title">Game Settings</h2>

      <div className="config-section">
        <label className="config-label">Timer</label>
        <div className="timer-presets">
          {TIMER_PRESETS.map((preset) => (
            <button
              key={preset.label}
              className={`timer-preset-btn ${selectedPreset.label === preset.label ? 'active' : ''}`}
              onClick={() => setSelectedPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {showPlayerNames && (
        <div className="config-section">
          <label className="config-label">Player Names</label>
          <div className="name-inputs">
            <input
              className="name-input"
              type="text"
              placeholder="Player 1"
              value={player1Name}
              onChange={(e) => setPlayer1Name(e.target.value)}
              maxLength={20}
            />
            <input
              className="name-input"
              type="text"
              placeholder="Player 2"
              value={player2Name}
              onChange={(e) => setPlayer2Name(e.target.value)}
              maxLength={20}
            />
          </div>
        </div>
      )}

      <div className="pregame-actions">
        <button className="btn-secondary" onClick={onBack}>
          Back
        </button>
        <button className="btn-primary" onClick={handleStart}>
          Start Game
        </button>
      </div>
    </div>
  );
}
