import { useGameStore } from '../../hooks/useGameStore';
import './GameHeader.css';

export function GameHeader() {
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const tileBagCount = useGameStore((s) => s.tileBagCount);
  const phase = useGameStore((s) => s.phase);
  const mode = useGameStore((s) => s.mode);
  const playerIndex = useGameStore((s) => s.playerIndex);

  if (players.length < 2) return null;

  const isOnline = mode === 'host' || mode === 'guest';
  const isMyTurn = isOnline
    ? currentPlayerIndex === playerIndex
    : true; // always "your turn" in local (shared device)

  // In online mode, label as "You" and "Opponent"
  const getLabel = (idx: number) => {
    if (!isOnline) return players[idx].name;
    return idx === playerIndex ? 'You' : 'Opponent';
  };

  return (
    <div className="game-header">
      <div className={`player-info ${currentPlayerIndex === 0 ? 'active' : ''} ${isOnline && playerIndex === 0 ? 'you' : ''}`}>
        <div className="player-name">
          {getLabel(0)}
          {isOnline && playerIndex === 0 && <span className="you-badge">YOU</span>}
        </div>
        <div className="player-score">{players[0].score}</div>
      </div>

      <div className="game-info-center">
        <div className="bag-count">{tileBagCount} tiles left</div>
        {phase === 'playing' && (
          <div className={`turn-indicator ${isMyTurn ? 'your-turn' : ''}`}>
            {isOnline
              ? (isMyTurn ? 'Your turn' : "Opponent's turn")
              : `${players[currentPlayerIndex].name}'s turn`
            }
          </div>
        )}
      </div>

      <div className={`player-info ${currentPlayerIndex === 1 ? 'active' : ''} ${isOnline && playerIndex === 1 ? 'you' : ''}`}>
        <div className="player-name">
          {getLabel(1)}
          {isOnline && playerIndex === 1 && <span className="you-badge">YOU</span>}
        </div>
        <div className="player-score">{players[1].score}</div>
      </div>
    </div>
  );
}
