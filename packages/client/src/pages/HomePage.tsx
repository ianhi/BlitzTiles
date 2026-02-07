import { useNavigate } from 'react-router-dom';
import './HomePage.css';

export function HomePage() {
  const navigate = useNavigate();

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
