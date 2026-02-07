import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { GameBoard } from '../components/board/GameBoard';
import { TileRack } from '../components/tiles/TileRack';
import { GameHeader } from '../components/game/GameHeader';
import { GameControls } from '../components/game/GameControls';
import { GameOverModal } from '../components/game/GameOverModal';
import { useGameStore } from '../hooks/useGameStore';
import { useGameConnection } from '../hooks/useGameConnection';
import './GamePage.css';

export function GamePage() {
  const [searchParams] = useSearchParams();
  const gameMode = searchParams.get('mode') as 'host' | 'guest' | null;
  const joinCode = searchParams.get('code') || '';

  if (gameMode === 'host' || gameMode === 'guest') {
    return <OnlineGame role={gameMode} joinCode={joinCode} />;
  }

  return <LocalGame />;
}

// ---------------------------------------------------------------------------
// Local hot-seat game (existing behavior)
// ---------------------------------------------------------------------------

function LocalGame() {
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

// ---------------------------------------------------------------------------
// Online game (host or guest via WebRTC)
// ---------------------------------------------------------------------------

function OnlineGame({ role, joinCode }: { role: 'host' | 'guest'; joinCode: string }) {
  const navigate = useNavigate();
  const connection = useGameConnection(
    role,
    role === 'guest' ? joinCode : undefined,
  );

  const phase = useGameStore((s) => s.phase);
  const dictionaryLoaded = useGameStore((s) => s.dictionaryLoaded);
  const mode = useGameStore((s) => s.mode);
  const initHostGame = useGameStore((s) => s.initHostGame);
  const initGuestGame = useGameStore((s) => s.initGuestGame);
  const setConnection = useGameStore((s) => s.setConnection);
  const handleNetworkMessage = useGameStore((s) => s.handleNetworkMessage);

  const [initialized, setInitialized] = useState(false);

  // Wire incoming messages to store
  useEffect(() => {
    connection.setOnMessage((msg: unknown) => {
      handleNetworkMessage(msg);
    });
  }, [connection.setOnMessage, handleNetworkMessage]);

  // When connected: set send function and init game
  useEffect(() => {
    if (connection.status === 'connected' && !initialized) {
      setConnection(connection.send);

      if (role === 'host') {
        initHostGame().then(() => setInitialized(true));
      } else {
        initGuestGame().then(() => setInitialized(true));
      }
    }
  }, [connection.status, initialized]);

  // Show lobby/waiting screen until game is ready
  const gameReady =
    connection.status === 'connected' &&
    initialized &&
    dictionaryLoaded &&
    phase === 'playing';

  if (!gameReady) {
    return (
      <div className="game-loading">
        <div className="online-lobby">
          {connection.status === 'connecting' && (
            <div className="loading-text">Connecting...</div>
          )}

          {connection.status === 'waiting' && (
            <>
              <div className="lobby-label">Room Code</div>
              <div className="room-code">{connection.roomCode}</div>
              <div className="lobby-hint">Share this code with your opponent</div>
              <div className="loading-text">Waiting for opponent...</div>
            </>
          )}

          {connection.status === 'connected' && !gameReady && (
            <div className="loading-text">Starting game...</div>
          )}

          {connection.status === 'error' && (
            <div className="error-box">
              <div>Connection failed</div>
              <div className="error-detail">{connection.error}</div>
              <button className="btn-primary" onClick={() => navigate('/')}>
                Back
              </button>
            </div>
          )}

          {connection.status === 'disconnected' && (
            <div className="error-box">
              <div>Opponent disconnected</div>
              <button className="btn-primary" onClick={() => navigate('/')}>
                Back
              </button>
            </div>
          )}
        </div>
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
