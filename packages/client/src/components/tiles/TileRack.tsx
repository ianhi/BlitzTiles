import { useGameStore } from '../../hooks/useGameStore';
import './TileRack.css';

export function TileRack() {
  const currentHand = useGameStore((s) => s.currentHand);
  const placedTiles = useGameStore((s) => s.placedTiles);
  const selectedTileId = useGameStore((s) => s.selectedTileId);
  const selectTile = useGameStore((s) => s.selectTile);
  const removePlacedTile = useGameStore((s) => s.removePlacedTile);
  const phase = useGameStore((s) => s.phase);

  const placedIds = new Set(placedTiles.map((t) => t.id));

  const handleTileClick = (tileId: string) => {
    if (phase !== 'playing') return;

    // If tile is placed on board, recall it
    if (placedIds.has(tileId)) {
      removePlacedTile(tileId);
      return;
    }

    // Toggle selection
    if (selectedTileId === tileId) {
      selectTile(null);
    } else {
      selectTile(tileId);
    }
  };

  return (
    <div className="tile-rack">
      {currentHand.map((tile) => {
        const isPlaced = placedIds.has(tile.id);
        const isSelected = selectedTileId === tile.id;

        return (
          <div
            key={tile.id}
            className={[
              'rack-tile',
              isPlaced ? 'placed' : '',
              isSelected ? 'selected' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleTileClick(tile.id)}
          >
            <span className="rack-tile-letter">
              {tile.isBlank ? '' : tile.letter}
            </span>
            {tile.value > 0 && (
              <span className="rack-tile-value">{tile.value}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
