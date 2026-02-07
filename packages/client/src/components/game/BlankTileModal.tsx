import './BlankTileModal.css';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface BlankTileModalProps {
  isOpen: boolean;
  onSelect: (letter: string) => void;
  onCancel: () => void;
}

export function BlankTileModal({ isOpen, onSelect, onCancel }: BlankTileModalProps) {
  if (!isOpen) return null;

  return (
    <div className="blank-tile-overlay" onClick={onCancel}>
      <div className="blank-tile-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="blank-tile-title">Choose a Letter</h2>
        <div className="blank-tile-grid">
          {LETTERS.map((letter) => (
            <button
              key={letter}
              className="blank-tile-letter-btn"
              onClick={() => onSelect(letter)}
            >
              {letter}
            </button>
          ))}
        </div>
        <button className="blank-tile-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
