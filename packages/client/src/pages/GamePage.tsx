import { useEffect } from 'react';
import { GameBoard } from '../components/board/GameBoard';
import { TileRack } from '../components/tiles/TileRack';
import { GameHeader } from '../components/game/GameHeader';
import { GameControls } from '../components/game/GameControls';
import { GameOverModal } from '../components/game/GameOverModal';
import { useGameStore } from '../hooks/useGameStore';
import './GamePage.css';

export function GamePage() {
  const phase = useGameStore((s) => s.phase);
  const initLocalGame = useGameStore((s) => s.initLocalGame);
  const dictionaryLoaded = useGameStore((s) => s.dictionaryLoaded);

  useEffect(() => {
    if (phase === 'waiting') {
      initLocalGame();
    }
  }, []);

  if (!dictionaryLoaded || phase === 'waiting') {
    return (
      <div className="game-loading">
        <div className="loading-text">Loading game...</div>
      </div>
    );
  }

  return (
    <div className="game-page">
      <GameHeader />
      <GameBoard />
      <div className="game-bottom">
        <TileRack />
        <GameControls />
      </div>
      <GameOverModal />
    </div>
  );
}
