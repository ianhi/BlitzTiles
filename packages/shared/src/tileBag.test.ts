import { describe, it, expect } from 'vitest';
import { createTileBag, drawTiles, exchangeTiles } from './tileBag.js';
import { TILE_DISTRIBUTION, TOTAL_TILE_COUNT } from './constants.js';

// ---------------------------------------------------------------------------
// createTileBag
// ---------------------------------------------------------------------------

describe('createTileBag', () => {
  it('produces exactly 100 tiles', () => {
    const { tiles } = createTileBag(42);
    expect(tiles).toHaveLength(TOTAL_TILE_COUNT);
  });

  it('all expected letter counts match TILE_DISTRIBUTION', () => {
    const { tiles } = createTileBag(42);

    // Build expected counts from TILE_DISTRIBUTION
    const expected = new Map<string, number>();
    for (const [letter, count] of TILE_DISTRIBUTION) {
      expected.set(letter, count);
    }

    // Build actual counts from the bag
    const actual = new Map<string, number>();
    for (const tile of tiles) {
      actual.set(tile.letter, (actual.get(tile.letter) ?? 0) + 1);
    }

    for (const [letter, count] of expected) {
      expect(actual.get(letter), `count for "${letter}"`).toBe(count);
    }

    // No extra letters should be present
    expect(actual.size).toBe(expected.size);
  });

  it('same seed produces same tile order', () => {
    const a = createTileBag(12345);
    const b = createTileBag(12345);

    expect(a.tiles.map((t) => t.id)).toEqual(b.tiles.map((t) => t.id));
    expect(a.seed).toBe(b.seed);
  });

  it('different seeds produce different orders', () => {
    const a = createTileBag(111);
    const b = createTileBag(999);

    // The ids will be the same set, but the order should differ.
    // It's theoretically possible for two seeds to produce the same
    // permutation, but astronomically unlikely for 100 elements.
    const aIds = a.tiles.map((t) => t.id);
    const bIds = b.tiles.map((t) => t.id);
    expect(aIds).not.toEqual(bIds);
  });

  it('blank tiles have correct properties', () => {
    const { tiles } = createTileBag(42);
    const blanks = tiles.filter((t) => t.isBlank);

    expect(blanks).toHaveLength(2);
    for (const blank of blanks) {
      expect(blank.letter).toBe('');
      expect(blank.value).toBe(0);
      expect(blank.isBlank).toBe(true);
    }
  });

  it('each tile has a unique id', () => {
    const { tiles } = createTileBag(42);
    const ids = new Set(tiles.map((t) => t.id));
    expect(ids.size).toBe(tiles.length);
  });
});

// ---------------------------------------------------------------------------
// drawTiles
// ---------------------------------------------------------------------------

describe('drawTiles', () => {
  it('draws the correct number of tiles', () => {
    const { tiles } = createTileBag(42);
    const { drawn, remaining } = drawTiles(tiles, 7);

    expect(drawn).toHaveLength(7);
    expect(remaining).toHaveLength(93);
  });

  it('draws all remaining when count exceeds bag size', () => {
    const smallBag = createTileBag(42).tiles.slice(0, 3);
    const { drawn, remaining } = drawTiles(smallBag, 7);

    expect(drawn).toHaveLength(3);
    expect(remaining).toHaveLength(0);
  });

  it('does not mutate the original array', () => {
    const { tiles } = createTileBag(42);
    const original = [...tiles];

    drawTiles(tiles, 7);

    expect(tiles).toEqual(original);
    expect(tiles).toHaveLength(100);
  });

  it('draws tiles from the front of the bag', () => {
    const { tiles } = createTileBag(42);
    const { drawn } = drawTiles(tiles, 3);

    expect(drawn[0]).toEqual(tiles[0]);
    expect(drawn[1]).toEqual(tiles[1]);
    expect(drawn[2]).toEqual(tiles[2]);
  });

  it('drawing 0 tiles returns empty drawn and full remaining', () => {
    const { tiles } = createTileBag(42);
    const { drawn, remaining } = drawTiles(tiles, 0);

    expect(drawn).toHaveLength(0);
    expect(remaining).toHaveLength(100);
  });
});

// ---------------------------------------------------------------------------
// exchangeTiles
// ---------------------------------------------------------------------------

describe('exchangeTiles', () => {
  it('returns null when bag has fewer tiles than requested', () => {
    const smallBag = createTileBag(42).tiles.slice(0, 3);
    const tilesToReturn = createTileBag(99).tiles.slice(0, 2);

    const result = exchangeTiles(smallBag, tilesToReturn, 5);
    expect(result).toBeNull();
  });

  it('draws new tiles and appends returned tiles to end of bag', () => {
    const { tiles } = createTileBag(42);
    const bag = tiles.slice(0, 20);
    const tilesToReturn = tiles.slice(90, 93); // 3 tiles to return

    const result = exchangeTiles(bag, tilesToReturn, 5);
    expect(result).not.toBeNull();

    const { drawn, newBag } = result!;

    // Should draw 5 tiles from the front
    expect(drawn).toHaveLength(5);
    expect(drawn).toEqual(bag.slice(0, 5));

    // Remaining bag = original[5..20] + returned tiles
    expect(newBag).toHaveLength(15 + 3); // 15 remaining + 3 returned
    expect(newBag.slice(-3)).toEqual(tilesToReturn); // returned tiles at end
  });

  it('preserves total tile count (drawn + newBag = original + returned)', () => {
    const { tiles } = createTileBag(42);
    const bag = tiles.slice(0, 50);
    const tilesToReturn = tiles.slice(50, 57); // 7 tiles

    const result = exchangeTiles(bag, tilesToReturn, 7);
    expect(result).not.toBeNull();

    const { drawn, newBag } = result!;

    // drawn + newBag should equal bag.length + tilesToReturn.length
    expect(drawn.length + newBag.length).toBe(bag.length + tilesToReturn.length);
  });

  it('does not mutate input arrays', () => {
    const { tiles } = createTileBag(42);
    const bag = tiles.slice(0, 20);
    const tilesToReturn = tiles.slice(80, 85);

    const bagCopy = [...bag];
    const returnCopy = [...tilesToReturn];

    exchangeTiles(bag, tilesToReturn, 5);

    expect(bag).toEqual(bagCopy);
    expect(tilesToReturn).toEqual(returnCopy);
  });

  it('returns null when bag is empty', () => {
    const result = exchangeTiles([], [createTileBag(1).tiles[0]], 1);
    expect(result).toBeNull();
  });

  it('succeeds when bag has exactly count tiles', () => {
    const bag = createTileBag(42).tiles.slice(0, 7);
    const tilesToReturn = createTileBag(99).tiles.slice(0, 3);

    const result = exchangeTiles(bag, tilesToReturn, 7);
    expect(result).not.toBeNull();

    const { drawn, newBag } = result!;
    expect(drawn).toHaveLength(7);
    expect(newBag).toEqual(tilesToReturn); // only returned tiles remain
  });
});
