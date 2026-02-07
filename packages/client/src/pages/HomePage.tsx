import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function HomePage() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');

  const handleCreateOnline = () => {
    const roomId = generateRoomCode();
    navigate(`/game/${roomId}`);
  };

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length >= 3) {
      navigate(`/game/${code}`);
    }
  };

  return (
    <div className="home-page">
      <div className="home-content">
        <h1 className="home-title">BlitzTiles</h1>
        <p className="home-subtitle">Word game with a clock</p>

        <div className="home-actions">
          <button
            className="btn-primary home-btn"
            onClick={() => navigate('/game')}
          >
            Play Local (Hot Seat)
          </button>

          <div className="divider">
            <span>or play online</span>
          </div>

          <button
            className="btn-secondary home-btn"
            onClick={handleCreateOnline}
          >
            Create Online Game
          </button>

          <div className="join-section">
            <input
              className="join-input"
              type="text"
              placeholder="Enter room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <button
              className="btn-secondary"
              onClick={handleJoin}
              disabled={joinCode.trim().length < 3}
            >
              Join
            </button>
          </div>
        </div>

        <div className="home-rules">
          <h3>How to play</h3>
          <ul>
            <li>Tap a tile in your rack, then tap a cell on the board to place it</li>
            <li>Form words reading left-to-right or top-to-bottom</li>
            <li>First word must cover the center star</li>
            <li>All subsequent words must connect to existing tiles</li>
            <li>Hit Submit when you're happy with your word</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
