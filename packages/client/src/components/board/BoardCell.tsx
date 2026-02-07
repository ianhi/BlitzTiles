import type { BoardCell as BoardCellType, BonusType, PlacedTile } from '@blitztiles/shared';
import { useDroppable } from '@dnd-kit/core';
import './BoardCell.css';

interface BoardCellProps {
  cell: BoardCellType;
  pendingTile?: PlacedTile;
  isSelected: boolean;
  onClick: () => void;
}

const BONUS_LABELS: Record<NonNullable<BonusType>, string> = {
  DL: 'DL',
  TL: 'TL',
  DW: 'DW',
  TW: 'TW',
};

export function BoardCell({ cell, pendingTile, isSelected, onClick }: BoardCellProps) {
  const tile = pendingTile || cell.tile;
  const isCenter = cell.row === 7 && cell.col === 7;
  const isPending = !!pendingTile;

  const droppableId = `cell-${cell.row}-${cell.col}`;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { row: cell.row, col: cell.col },
  });

  const classNames = [
    'board-cell',
    cell.bonus && !tile ? `bonus-${cell.bonus.toLowerCase()}` : '',
    isCenter && !tile ? 'center' : '',
    isSelected ? 'selected' : '',
    tile ? 'has-tile' : '',
    isPending ? 'pending' : '',
    isOver ? 'drag-over' : '', // Add drag-over class
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={setNodeRef} className={classNames} onClick={onClick}>
      {tile ? (
        <div className={`cell-tile ${isPending ? 'pending-tile' : 'placed-tile'}`}>
          <span className="tile-letter">{tile.designatedLetter || tile.letter}</span>
          {tile.value > 0 && <span className="tile-value">{tile.value}</span>}
        </div>
      ) : (
        <>
          {cell.bonus && <span className="bonus-label">{BONUS_LABELS[cell.bonus]}</span>}
          {isCenter && !cell.bonus && <span className="center-star">★</span>}
        </>
      )}
    </div>
  );
}
