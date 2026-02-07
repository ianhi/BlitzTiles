/**
 * Zustand store for BlitzTiles game state.
 *
 * Supports three modes:
 * - Local hot-seat: Two players on the same device, using the shared game engine directly.
 * - Host: Runs the game engine locally, sends filtered state to guest via WebRTC.
 * - Guest: Sends intents to host, receives filtered state updates.
 */

import { create } from 'zustand';
import type {
  Board,
  GamePhase,
  PlacedTile,
  Tile,
  MoveRecord,
  GameConfig,
  GameState,
  ClientGameState,
} from '@blitztiles/shared';
import {
  createGame,
  submitMove,
  passTurn,
  exchangePlayerTiles,
  resignGame,
  Trie,
  loadDictionary,
} from '@blitztiles/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GameMode = 'local' | 'host' | 'guest';

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
  dictionaryLoaded: boolean;

  // Network state
  mode: GameMode;
  playerIndex: number;

  // Internal (not exposed to components directly)
  _gameState: GameState | null;
  _dictionary: Trie | null;
  _sendFn: ((msg: unknown) => void) | null;

  // Actions
  initLocalGame: (config?: GameConfig) => Promise<void>;
  initHostGame: (config?: GameConfig) => Promise<void>;
  initGuestGame: () => Promise<void>;
  setConnection: (send: (msg: unknown) => void) => void;
  handleNetworkMessage: (msg: unknown) => void;
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
}

// ---------------------------------------------------------------------------
// Dictionary loading
// ---------------------------------------------------------------------------

let dictionaryPromise: Promise<Trie> | null = null;

/** Accept-all dictionary — every word is valid. */
class AcceptAllTrie extends Trie {
  has(word: string): boolean {
    return word.length > 0;
  }
  get size(): number {
    return Infinity;
  }
}

async function getDictionary(): Promise<Trie> {
  // For now, accept all words — no dictionary validation
  if (!dictionaryPromise) {
    dictionaryPromise = Promise.resolve(new AcceptAllTrie());
  }
  return dictionaryPromise;
}

function generateMinimalDictionary(): Trie {
  const trie = new Trie();
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
// Helpers: sync store from game state
// ---------------------------------------------------------------------------

/** Sync store from full GameState (local + host modes). */
function syncFromGameState(state: GameState, viewAsPlayer: number): Partial<GameStore> {
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
    currentHand: state.players[viewAsPlayer].hand,
    tileBagCount: state.tileBag.length,
    consecutivePasses: state.consecutivePasses,
    winnerIndex: state.winnerIndex,
    endReason: state.endReason,
    moveHistory: state.moveHistory,
    _gameState: state,
  };
}

/** Sync store from filtered ClientGameState (guest mode). */
function syncFromClientGameState(clientState: ClientGameState): Partial<GameStore> {
  const myIndex = clientState.yourPlayerIndex;
  const opIndex = myIndex === 0 ? 1 : 0;

  const players: GameStore['players'] = [];
  players[myIndex] = {
    name: clientState.you.name,
    score: clientState.you.score,
    handSize: clientState.you.hand.length,
    timeRemainingMs: clientState.you.timeRemainingMs,
  };
  players[opIndex] = {
    name: clientState.opponent.name,
    score: clientState.opponent.score,
    handSize: clientState.opponent.handSize,
    timeRemainingMs: clientState.opponent.timeRemainingMs,
  };

  return {
    phase: clientState.phase,
    board: clientState.board,
    currentPlayerIndex: clientState.currentPlayerIndex,
    players,
    currentHand: clientState.you.hand,
    tileBagCount: clientState.tileBagCount,
    consecutivePasses: clientState.consecutivePasses,
    winnerIndex: clientState.winnerIndex,
    endReason: clientState.endReason,
    moveHistory: clientState.moveHistory,
    playerIndex: myIndex,
  };
}

/** Filter full GameState into a ClientGameState for a specific player. */
function filterStateForPlayer(state: GameState, forPlayer: number): ClientGameState {
  const opponentIndex = forPlayer === 0 ? 1 : 0;
  const opponent = state.players[opponentIndex];

  return {
    roomId: state.roomId,
    phase: state.phase,
    config: state.config,
    board: state.board,
    you: state.players[forPlayer],
    opponent: {
      name: opponent.name,
      score: opponent.score,
      timeRemainingMs: opponent.timeRemainingMs,
      handSize: opponent.hand.length,
      connected: opponent.connected,
    },
    currentPlayerIndex: state.currentPlayerIndex,
    yourPlayerIndex: forPlayer,
    tileBagCount: state.tileBag.length,
    consecutivePasses: state.consecutivePasses,
    turnStartTimestamp: state.turnStartTimestamp,
    winnerIndex: state.winnerIndex,
    endReason: state.endReason,
    moveHistory: state.moveHistory,
    stateVersion: state.stateVersion,
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
  dictionaryLoaded: false,

  mode: 'local',
  playerIndex: 0,

  _gameState: null,
  _dictionary: null,
  _sendFn: null,

  // ─── Init actions ───────────────────────────────────────────────

  initLocalGame: async (config) => {
    const dictionary = await getDictionary();
    const gameState = createGame('local', 'Player 1', 'Player 2', config);

    set({
      ...syncFromGameState(gameState, 0),
      mode: 'local',
      playerIndex: 0,
      dictionaryLoaded: true,
      placedTiles: [],
      selectedTileId: null,
      lastMoveError: null,
      _dictionary: dictionary,
      _sendFn: null,
    });
  },

  initHostGame: async (config) => {
    const dictionary = await getDictionary();
    const gameState = createGame('online', 'You', 'Opponent', config);

    set({
      ...syncFromGameState(gameState, 0),
      mode: 'host',
      playerIndex: 0,
      dictionaryLoaded: true,
      placedTiles: [],
      selectedTileId: null,
      lastMoveError: null,
      _dictionary: dictionary,
    });

    // Send initial state to guest
    const { _sendFn } = get();
    _sendFn?.({ type: 'GAME_STATE', state: filterStateForPlayer(gameState, 1) });
  },

  initGuestGame: async () => {
    // Set mode synchronously so incoming messages are processed immediately
    set({
      mode: 'guest',
      playerIndex: 1,
      placedTiles: [],
      selectedTileId: null,
      lastMoveError: null,
    });
    const dictionary = await getDictionary();
    set({
      dictionaryLoaded: true,
      _dictionary: dictionary,
    });
  },

  setConnection: (send) => {
    set({ _sendFn: send });
  },

  // ─── Network message handler ────────────────────────────────────

  handleNetworkMessage: (raw) => {
    const msg = raw as { type: string; [key: string]: unknown };
    const { _gameState, _dictionary, mode, _sendFn } = get();

    if (mode === 'host') {
      // Host processes guest's intents through the game engine
      if (!_gameState || !_dictionary) return;

      switch (msg.type) {
        case 'SUBMIT_MOVE': {
          const tiles = msg.tiles as PlacedTile[];
          // Only allow if it's guest's turn (player 1)
          if (_gameState.currentPlayerIndex !== 1) {
            _sendFn?.({ type: 'MOVE_REJECTED', reason: 'Not your turn' });
            return;
          }
          const result = submitMove(_gameState, 1, tiles, _dictionary);
          if (result.success) {
            set({
              ...syncFromGameState(result.state, 0),
              placedTiles: [],
              lastMoveError: null,
            });
            _sendFn?.({ type: 'GAME_STATE', state: filterStateForPlayer(result.state, 1) });
          } else {
            _sendFn?.({ type: 'MOVE_REJECTED', reason: result.reason });
          }
          break;
        }
        case 'PASS': {
          if (_gameState.currentPlayerIndex !== 1) {
            _sendFn?.({ type: 'MOVE_REJECTED', reason: 'Not your turn' });
            return;
          }
          const result = passTurn(_gameState, 1);
          set({
            ...syncFromGameState(result.state, 0),
            placedTiles: [],
            lastMoveError: null,
          });
          _sendFn?.({ type: 'GAME_STATE', state: filterStateForPlayer(result.state, 1) });
          break;
        }
        case 'EXCHANGE': {
          if (_gameState.currentPlayerIndex !== 1) {
            _sendFn?.({ type: 'MOVE_REJECTED', reason: 'Not your turn' });
            return;
          }
          const tileIds = msg.tileIds as string[];
          const result = exchangePlayerTiles(_gameState, 1, tileIds);
          if (result.success) {
            set({
              ...syncFromGameState(result.state, 0),
              placedTiles: [],
              lastMoveError: null,
            });
            _sendFn?.({ type: 'GAME_STATE', state: filterStateForPlayer(result.state, 1) });
          } else {
            _sendFn?.({ type: 'MOVE_REJECTED', reason: result.reason });
          }
          break;
        }
        case 'RESIGN': {
          const result = resignGame(_gameState, 1);
          set({
            ...syncFromGameState(result, 0),
            placedTiles: [],
          });
          _sendFn?.({ type: 'GAME_STATE', state: filterStateForPlayer(result, 1) });
          break;
        }
      }
    } else if (mode === 'guest') {
      // Guest receives state updates from host
      switch (msg.type) {
        case 'GAME_STATE': {
          const clientState = (msg as { type: 'GAME_STATE'; state: ClientGameState }).state;
          set({
            ...syncFromClientGameState(clientState),
            placedTiles: [],
            selectedTileId: null,
            lastMoveError: null,
          });
          break;
        }
        case 'MOVE_REJECTED': {
          set({ lastMoveError: (msg as { reason: string }).reason });
          break;
        }
      }
    }
  },

  // ─── Tile placement (works in all modes) ────────────────────────

  placeTile: (tileId, row, col, designatedLetter) => {
    const { currentHand, placedTiles, board } = get();
    if (board.length === 0) return;

    const tile = currentHand.find((t) => t.id === tileId);
    if (!tile) return;

    // Don't place on occupied cell
    if (board[row]?.[col]?.tile) return;
    if (placedTiles.some((t) => t.row === row && t.col === col)) return;

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

  // ─── Game actions (mode-aware) ──────────────────────────────────

  submitMove: () => {
    const { _gameState, _dictionary, placedTiles, mode, playerIndex, _sendFn } = get();

    if (placedTiles.length === 0) return;

    if (mode === 'guest') {
      // Guest sends intent to host
      _sendFn?.({ type: 'SUBMIT_MOVE', tiles: placedTiles });
      // Optimistic clear — host will confirm or reject
      set({ placedTiles: [], selectedTileId: null });
      return;
    }

    // Host or local: run engine locally
    if (!_gameState || !_dictionary) return;

    const currentPlayer = _gameState.currentPlayerIndex;
    const result = submitMove(_gameState, currentPlayer, placedTiles, _dictionary);

    if (!result.success) {
      set({ lastMoveError: result.reason });
      return;
    }

    const viewAs = mode === 'local' ? result.state.currentPlayerIndex : playerIndex;
    set({
      ...syncFromGameState(result.state, viewAs),
      placedTiles: [],
      selectedTileId: null,
      lastMoveError: null,
    });

    // Host: broadcast to guest
    if (mode === 'host' && _sendFn) {
      _sendFn({ type: 'GAME_STATE', state: filterStateForPlayer(result.state, 1) });
    }
  },

  passTurn: () => {
    const { _gameState, mode, playerIndex, _sendFn } = get();

    if (mode === 'guest') {
      _sendFn?.({ type: 'PASS' });
      return;
    }

    if (!_gameState) return;

    const currentPlayer = _gameState.currentPlayerIndex;
    const result = passTurn(_gameState, currentPlayer);

    const viewAs = mode === 'local' ? result.state.currentPlayerIndex : playerIndex;
    set({
      ...syncFromGameState(result.state, viewAs),
      placedTiles: [],
      selectedTileId: null,
      lastMoveError: null,
    });

    if (mode === 'host' && _sendFn) {
      _sendFn({ type: 'GAME_STATE', state: filterStateForPlayer(result.state, 1) });
    }
  },

  exchangeTiles: (tileIds) => {
    const { _gameState, mode, playerIndex, _sendFn } = get();

    if (mode === 'guest') {
      _sendFn?.({ type: 'EXCHANGE', tileIds });
      return;
    }

    if (!_gameState) return;

    const currentPlayer = _gameState.currentPlayerIndex;
    const result = exchangePlayerTiles(_gameState, currentPlayer, tileIds);

    if (!result.success) {
      set({ lastMoveError: result.reason });
      return;
    }

    const viewAs = mode === 'local' ? result.state.currentPlayerIndex : playerIndex;
    set({
      ...syncFromGameState(result.state, viewAs),
      placedTiles: [],
      selectedTileId: null,
      lastMoveError: null,
    });

    if (mode === 'host' && _sendFn) {
      _sendFn({ type: 'GAME_STATE', state: filterStateForPlayer(result.state, 1) });
    }
  },

  resign: () => {
    const { _gameState, mode, playerIndex, _sendFn } = get();

    if (mode === 'guest') {
      _sendFn?.({ type: 'RESIGN' });
      return;
    }

    if (!_gameState) return;

    const result = resignGame(_gameState, _gameState.currentPlayerIndex);
    set({
      ...syncFromGameState(result, playerIndex),
      placedTiles: [],
      selectedTileId: null,
    });

    if (mode === 'host' && _sendFn) {
      _sendFn({ type: 'GAME_STATE', state: filterStateForPlayer(result, 1) });
    }
  },

  recallTiles: () => {
    set({ placedTiles: [], selectedTileId: null });
  },

  shuffleHand: () => {
    const { currentHand, placedTiles } = get();
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
}));
