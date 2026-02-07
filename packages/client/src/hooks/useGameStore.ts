/**
 * Zustand store for BlitzTiles game state.
 *
 * Supports two modes:
 * - Local hot-seat: Two players on the same device, using the shared game engine directly.
 * - Networked: State comes from the server via WebSocket (future).
 */

import { create } from 'zustand';
import type { Board, GamePhase, PlacedTile, Tile, MoveRecord, GameConfig } from '@blitztiles/shared';
import {
  createGame,
  submitMove,
  passTurn,
  exchangePlayerTiles,
  resignGame,
  Trie,
  loadDictionary,
  HAND_SIZE,
} from '@blitztiles/shared';
import type { GameState } from '@blitztiles/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GameStore {
  // Game state
  phase: GamePhase;
  board: Board;
  currentPlayerIndex: number;
  players: {
    name: string;
    score: number;
    handSize: number;
    timeRemainingMs: number;
  }[];
  currentHand: Tile[];
  tileBagCount: number;
  consecutivePasses: number;
  winnerIndex: number | null;
  endReason: string | null;
  moveHistory: MoveRecord[];

  // UI state
  placedTiles: PlacedTile[];
  selectedTileId: string | null;
  lastMoveError: string | null;
  mode: 'local' | 'network';
  dictionaryLoaded: boolean;
  pendingBlankTileId: string | null;
  pendingBlankPosition: { row: number; col: number } | null;

  // Internal (not exposed to components directly)
  _gameState: GameState | null;
  _dictionary: Trie | null;

  // Actions
  initLocalGame: (config?: GameConfig) => Promise<void>;
  placeTile: (tileId: string, row: number, col: number, designatedLetter?: string) => void;
  removePlacedTile: (tileId: string) => void;
  selectTile: (tileId: string | null) => void;
  submitMove: () => void;
  passTurn: () => void;
  exchangeTiles: (tileIds: string[]) => void;
  resign: () => void;
  recallTiles: () => void;
  shuffleHand: () => void;
  clearError: () => void;
  confirmBlankLetter: (letter: string) => void;
  cancelBlankPlacement: () => void;
}

// ---------------------------------------------------------------------------
// Dictionary loading
// ---------------------------------------------------------------------------

let dictionaryPromise: Promise<Trie> | null = null;

async function getDictionary(): Promise<Trie> {
  if (!dictionaryPromise) {
    dictionaryPromise = fetch('/enable.txt')
      .then((res) => {
        if (!res.ok) {
          // Fall back to a minimal dictionary for testing
          console.warn('Dictionary not found, using minimal word list');
          return generateMinimalDictionary();
        }
        return res.text().then((text) => loadDictionary(text));
      })
      .catch(() => {
        console.warn('Dictionary fetch failed, using minimal word list');
        return generateMinimalDictionary();
      });
  }
  return dictionaryPromise;
}

function generateMinimalDictionary(): Trie {
  const trie = new Trie();
  // Common 2-3 letter words for testing
  const words = [
    'AA', 'AB', 'AD', 'AE', 'AG', 'AH', 'AI', 'AL', 'AM', 'AN', 'AR', 'AS', 'AT', 'AW', 'AX', 'AY',
    'BA', 'BE', 'BI', 'BO', 'BY',
    'DA', 'DE', 'DO',
    'ED', 'EF', 'EH', 'EL', 'EM', 'EN', 'ER', 'ES', 'ET', 'EX',
    'FA', 'FE',
    'GO',
    'HA', 'HE', 'HI', 'HM', 'HO',
    'ID', 'IF', 'IN', 'IS', 'IT',
    'JO',
    'KA', 'KI',
    'LA', 'LI', 'LO',
    'MA', 'ME', 'MI', 'MM', 'MO', 'MU', 'MY',
    'NA', 'NE', 'NO', 'NU',
    'OD', 'OE', 'OF', 'OH', 'OI', 'OK', 'OM', 'ON', 'OP', 'OR', 'OS', 'OU', 'OW', 'OX', 'OY',
    'PA', 'PE', 'PI', 'PO',
    'QI',
    'RE',
    'SH', 'SI', 'SO',
    'TA', 'TI', 'TO',
    'UH', 'UM', 'UN', 'UP', 'US', 'UT',
    'WE', 'WO',
    'XI', 'XU',
    'YA', 'YE',
    'ZA',
    'CAT', 'CAR', 'CARD', 'CARE', 'CART', 'DOG', 'DON', 'DONE',
    'THE', 'HER', 'HERE', 'AND', 'HAND', 'BAND', 'LAND', 'SAND',
    'ONE', 'TONE', 'BONE', 'WORD', 'WORDS', 'STAR', 'RATS', 'ARTS',
    'HIT', 'SIT', 'BIT', 'FIT', 'KIT', 'LIT', 'PIT', 'WIT',
    'HAT', 'BAT', 'FAT', 'MAT', 'PAT', 'RAT', 'SAT', 'VAT',
    'HOT', 'NOT', 'GOT', 'LOT', 'POT', 'ROT', 'DOT', 'COT',
    'RUN', 'FUN', 'GUN', 'NUN', 'BUN', 'SUN', 'PUN',
    'BIG', 'DIG', 'FIG', 'GIG', 'JIG', 'PIG', 'RIG', 'WIG',
    'BET', 'GET', 'JET', 'LET', 'MET', 'NET', 'PET', 'SET', 'VET', 'WET',
    'AGE', 'ACE', 'APE', 'ARE', 'ATE', 'AWE', 'AXE', 'AYE',
  ];
  for (const w of words) trie.insert(w);
  return trie;
}

// ---------------------------------------------------------------------------
// Helper: sync store from internal game state
// ---------------------------------------------------------------------------

function syncFromGameState(state: GameState, playerIndex: number): Partial<GameStore> {
  return {
    phase: state.phase,
    board: state.board,
    currentPlayerIndex: state.currentPlayerIndex,
    players: state.players.map((p) => ({
      name: p.name,
      score: p.score,
      handSize: p.hand.length,
      timeRemainingMs: p.timeRemainingMs,
    })),
    currentHand: state.players[playerIndex].hand,
    tileBagCount: state.tileBag.length,
    consecutivePasses: state.consecutivePasses,
    winnerIndex: state.winnerIndex,
    endReason: state.endReason,
    moveHistory: state.moveHistory,
    _gameState: state,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  phase: 'waiting',
  board: [],
  currentPlayerIndex: 0,
  players: [],
  currentHand: [],
  tileBagCount: 0,
  consecutivePasses: 0,
  winnerIndex: null,
  endReason: null,
  moveHistory: [],

  placedTiles: [],
  selectedTileId: null,
  lastMoveError: null,
  mode: 'local',
  dictionaryLoaded: false,
  pendingBlankTileId: null,
  pendingBlankPosition: null,

  _gameState: null,
  _dictionary: null,

  // Actions
  initLocalGame: async (config) => {
    const dictionary = await getDictionary();
    const gameState = createGame('local', 'player-0', 'player-1', config);

    set({
      ...syncFromGameState(gameState, 0),
      mode: 'local',
      dictionaryLoaded: true,
      placedTiles: [],
      selectedTileId: null,
      lastMoveError: null,
      _dictionary: dictionary,
    });
  },

  placeTile: (tileId, row, col, designatedLetter) => {
    const { currentHand, placedTiles, _gameState } = get();
    if (!_gameState) return;

    // Find tile in hand
    const tile = currentHand.find((t) => t.id === tileId);
    if (!tile) return;

    // Don't place on already-occupied cell (by board tile or another placed tile)
    if (_gameState.board[row]?.[col]?.tile) return;
    if (placedTiles.some((t) => t.row === row && t.col === col)) return;

    // If this is a blank tile and no designated letter was provided, open the modal
    if (tile.isBlank && !designatedLetter) {
      set({
        pendingBlankTileId: tileId,
        pendingBlankPosition: { row, col },
        selectedTileId: null,
      });
      return;
    }

    // Remove from previous placement if any
    const filtered = placedTiles.filter((t) => t.id !== tileId);

    const placed: PlacedTile = {
      ...tile,
      row,
      col,
      designatedLetter: designatedLetter || tile.letter || 'A',
    };

    set({
      placedTiles: [...filtered, placed],
      selectedTileId: null,
    });
  },

  removePlacedTile: (tileId) => {
    set((s) => ({
      placedTiles: s.placedTiles.filter((t) => t.id !== tileId),
    }));
  },

  selectTile: (tileId) => {
    set({ selectedTileId: tileId });
  },

  submitMove: () => {
    const { _gameState, _dictionary, placedTiles, mode } = get();
    if (!_gameState || !_dictionary || placedTiles.length === 0) return;

    const playerIndex = _gameState.currentPlayerIndex;
    const result = submitMove(_gameState, playerIndex, placedTiles, _dictionary);

    if (!result.success) {
      set({ lastMoveError: result.reason });
      return;
    }

    // In local mode, show the next player's hand
    const nextPlayerIndex = result.state.currentPlayerIndex;
    set({
      ...syncFromGameState(result.state, mode === 'local' ? nextPlayerIndex : playerIndex),
      placedTiles: [],
      selectedTileId: null,
      lastMoveError: null,
    });
  },

  passTurn: () => {
    const { _gameState, mode } = get();
    if (!_gameState) return;

    const playerIndex = _gameState.currentPlayerIndex;
    const result = passTurn(_gameState, playerIndex);

    const nextPlayerIndex = result.state.currentPlayerIndex;
    set({
      ...syncFromGameState(result.state, mode === 'local' ? nextPlayerIndex : playerIndex),
      placedTiles: [],
      selectedTileId: null,
      lastMoveError: null,
    });
  },

  exchangeTiles: (tileIds) => {
    const { _gameState, mode } = get();
    if (!_gameState) return;

    const playerIndex = _gameState.currentPlayerIndex;
    const result = exchangePlayerTiles(_gameState, playerIndex, tileIds);

    if (!result.success) {
      set({ lastMoveError: result.reason });
      return;
    }

    const nextPlayerIndex = result.state.currentPlayerIndex;
    set({
      ...syncFromGameState(result.state, mode === 'local' ? nextPlayerIndex : playerIndex),
      placedTiles: [],
      selectedTileId: null,
      lastMoveError: null,
    });
  },

  resign: () => {
    const { _gameState } = get();
    if (!_gameState) return;

    const result = resignGame(_gameState, _gameState.currentPlayerIndex);
    set({
      ...syncFromGameState(result, _gameState.currentPlayerIndex),
      placedTiles: [],
      selectedTileId: null,
    });
  },

  recallTiles: () => {
    set({ placedTiles: [], selectedTileId: null });
  },

  shuffleHand: () => {
    const { currentHand, placedTiles } = get();
    // Only shuffle tiles that are still in hand (not placed)
    const placedIds = new Set(placedTiles.map((t) => t.id));
    const inHand = currentHand.filter((t) => !placedIds.has(t.id));
    const onBoard = currentHand.filter((t) => placedIds.has(t.id));

    // Fisher-Yates shuffle
    const shuffled = [...inHand];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    set({ currentHand: [...shuffled, ...onBoard] });
  },

  clearError: () => {
    set({ lastMoveError: null });
  },

  confirmBlankLetter: (letter) => {
    const { pendingBlankTileId, pendingBlankPosition, currentHand, placedTiles, _gameState } = get();
    if (!pendingBlankTileId || !pendingBlankPosition || !_gameState) return;

    const tile = currentHand.find((t) => t.id === pendingBlankTileId);
    if (!tile) {
      set({ pendingBlankTileId: null, pendingBlankPosition: null });
      return;
    }

    // Remove from previous placement if any
    const filtered = placedTiles.filter((t) => t.id !== pendingBlankTileId);

    const placed: PlacedTile = {
      ...tile,
      row: pendingBlankPosition.row,
      col: pendingBlankPosition.col,
      designatedLetter: letter,
    };

    set({
      placedTiles: [...filtered, placed],
      pendingBlankTileId: null,
      pendingBlankPosition: null,
    });
  },

  cancelBlankPlacement: () => {
    set({
      pendingBlankTileId: null,
      pendingBlankPosition: null,
    });
  },
}));
