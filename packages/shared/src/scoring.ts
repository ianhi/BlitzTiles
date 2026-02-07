/**
 * Scoring logic for BlitzTiles.
 *
 * Pure functions — no side effects, no mutation.
 */

import type { Board, PlacedTile } from './types.js';
import { BINGO_BONUS, HAND_SIZE } from './constants.js';

// ---------------------------------------------------------------------------
// scoreTurn
// ---------------------------------------------------------------------------

/**
 * Calculate the total score for a turn given the board state, newly placed
 * tiles, and the words that were formed.
 *
 * Scoring rules:
 * 1. For each formed word, compute a base score by summing letter values.
 *    - Letter bonuses (DL/TL) apply only to *newly placed* tiles on those cells.
 *    - Word bonuses (DW/TW) apply when any *newly placed* tile sits on such a cell.
 *      Multiple word bonuses stack multiplicatively.
 * 2. Sum all word scores.
 * 3. Add a bingo bonus (50 pts) if exactly 7 tiles were placed (full hand).
 */
export function scoreTurn(
  board: Board,
  placedTiles: PlacedTile[],
  formedWords: { word: string; cells: { row: number; col: number }[] }[],
): number {
  // Build a quick lookup set of newly-placed positions.
  const placedSet = new Set<string>();
  const placedMap = new Map<string, PlacedTile>();
  for (const tile of placedTiles) {
    const key = `${tile.row},${tile.col}`;
    placedSet.add(key);
    placedMap.set(key, tile);
  }

  let totalScore = 0;

  for (const { cells } of formedWords) {
    let wordScore = 0;
    let wordMultiplier = 1;

    for (const { row, col } of cells) {
      const key = `${row},${col}`;
      const isNewlyPlaced = placedSet.has(key);

      // Determine the tile value at this position.
      let tileValue: number;
      const placed = placedMap.get(key);
      if (placed) {
        tileValue = placed.value;
      } else {
        tileValue = board[row][col].tile?.value ?? 0;
      }

      // Apply letter-level bonuses only for newly placed tiles.
      if (isNewlyPlaced) {
        const bonus = board[row][col].bonus;
        if (bonus === 'DL') {
          tileValue *= 2;
        } else if (bonus === 'TL') {
          tileValue *= 3;
        } else if (bonus === 'DW') {
          wordMultiplier *= 2;
        } else if (bonus === 'TW') {
          wordMultiplier *= 3;
        }
      }

      wordScore += tileValue;
    }

    totalScore += wordScore * wordMultiplier;
  }

  // Bingo bonus: player used all 7 tiles from their hand.
  if (placedTiles.length === HAND_SIZE) {
    totalScore += BINGO_BONUS;
  }

  return totalScore;
}

// ---------------------------------------------------------------------------
// getEndGameBonus
// ---------------------------------------------------------------------------

/**
 * When a player goes out (empties their hand), they receive the sum of all
 * tile values remaining in the opponent's hand.
 */
export function getEndGameBonus(remainingHandValues: number[]): number {
  let sum = 0;
  for (const v of remainingHandValues) {
    sum += v;
  }
  return sum;
}
