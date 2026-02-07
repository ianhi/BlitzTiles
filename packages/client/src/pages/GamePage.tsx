import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { GameConfig } from '@blitztiles/shared';
import { GameBoard } from '../components/board/GameBoard';
import { TileRack } from '../components/tiles/TileRack';
import { GameHeader } from '../components/game/GameHeader';
import { GameControls } from '../components/game/GameControls';
import { GameOverModal } from '../components/game/GameOverModal';
import { BlankTileModal } from '../components/game/BlankTileModal';
import { TimerSoundEffect } from '../components/game/TimerSoundEffect';
import { useGameStore } from '../hooks/useGameStore';
import './GamePage.css';

export function GamePage() {
  const phase = useGameStore((s) => s.phase);
  const initLocalGame = useGameStore((s) => s.initLocalGame);
  const dictionaryLoaded = useGameStore((s) => s.dictionaryLoaded);
  const pendingBlankTileId = useGameStore((s) => s.pendingBlankTileId);
  const confirmBlankLetter = useGameStore((s) => s.confirmBlankLetter);
  const cancelBlankPlacement = useGameStore((s) => s.cancelBlankPlacement);
  const location = useLocation();

  useEffect(() => {
    if (phase === 'waiting') {
      const navConfig = (location.state as { config?: GameConfig } | null)?.config;
      initLocalGame(navConfig);
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
      <BlankTileModal
        isOpen={pendingBlankTileId !== null}
        onSelect={confirmBlankLetter}
        onCancel={cancelBlankPlacement}
      />
      <TimerSoundEffect />
    </div>
  );
}
