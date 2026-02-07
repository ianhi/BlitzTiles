import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { PlayerTile } from '@blitztiles/shared';
import { useGameStore } from '../../hooks/useGameStore';
import './TileRack.css';

function RackTile({ tile }: { tile: PlayerTile }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tile.id,
    data: { tile },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const placedTiles = useGameStore((s) => s.placedTiles);
  const isPlaced = placedTiles.some((t) => t.id === tile.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rack-tile ${isDragging ? 'dragging' : ''} ${isPlaced ? 'placed' : ''}`}
    >
      <span className="rack-tile-letter">{tile.isBlank ? '' : tile.letter}</span>
      {tile.value > 0 && <span className="rack-tile-value">{tile.value}</span>}
    </div>
  );
}

export function TileRack() {
  const currentHand = useGameStore((s) => s.currentHand);
  const phase = useGameStore((s) => s.phase);

  if (phase !== 'playing') {
    return (
      <div className="tile-rack-container">
        <div className="tile-rack" />
      </div>
    );
  }

  return (
    <div className="tile-rack-container">
      <div className="tile-rack">
        {currentHand.map((tile) => (
          <RackTile key={tile.id} tile={tile} />
        ))}
      </div>
    </div>
  );
}
