/**
 * BlitzTiles PartyKit server.
 *
 * Each party room is a game between two players. The server owns all game
 * state, validates moves via the shared game engine, and broadcasts filtered
 * state to each player (hiding the opponent's hand).
 */

import type * as Party from 'partykit/server';
import type {
  ClientMessage,
  ClientGameState,
  GameState,
  ServerMessage,
  PlacedTile,
  GameConfig,
} from '@blitztiles/shared';
import {
  createGame,
  submitMove,
  passTurn,
  exchangePlayerTiles,
  resignGame,
  handleTimerExpiry,
  updatePlayerTime,
  Trie,
} from '@blitztiles/shared';

// ---------------------------------------------------------------------------
// Player tracking
// ---------------------------------------------------------------------------

interface PlayerConnection {
  playerId: string;
  playerIndex: number;
  connectionId: string;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export default class BlitzTilesServer implements Party.Server {
  private gameState: GameState | null = null;
  private dictionary: Trie;
  private players: PlayerConnection[] = [];
  private config: GameConfig = {
    timerMode: 'untimed',
    timerDurationMs: 15 * 60 * 1000,
    overtimePenaltyPerMinute: 10,
  };

  constructor(readonly room: Party.Room) {
    // Initialize with a minimal dictionary
    // In production, this would load the ENABLE word list
    this.dictionary = new Trie();
  }

  async onStart() {
    // Load dictionary from storage or initialize
    const stored = await this.room.storage.get<string>('dictionary-loaded');
    if (!stored) {
      // The dictionary would normally be loaded from a KV store or fetched
      // For now, we initialize an empty trie that accepts all words
      // This will be replaced with the real dictionary
      await this.room.storage.put('dictionary-loaded', 'minimal');
    }
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    const playerId = url.searchParams.get('playerId') || conn.id;
    const playerName = url.searchParams.get('name') || `Player ${this.players.length + 1}`;

    // Check if this player is reconnecting
    const existing = this.players.find((p) => p.playerId === playerId);
    if (existing) {
      existing.connectionId = conn.id;
      // Update connected status in game state
      if (this.gameState) {
        this.gameState = {
          ...this.gameState,
          players: this.gameState.players.map((p, i) =>
            i === existing.playerIndex ? { ...p, connected: true } : p,
          ) as [typeof this.gameState.players[0], typeof this.gameState.players[1]],
        };
        this.broadcastState();
      }
      return;
    }

    // New player
    if (this.players.length >= 2) {
      // Room is full - spectator mode could be added later
      const msg: ServerMessage = { type: 'ERROR', message: 'Room is full' };
      conn.send(JSON.stringify(msg));
      return;
    }

    const playerIndex = this.players.length;
    this.players.push({
      playerId,
      playerIndex,
      connectionId: conn.id,
    });

    if (this.players.length === 1) {
      // First player - wait for opponent
      const msg: ServerMessage = {
        type: 'WAITING',
        roomId: this.room.id,
        playerIndex: 0,
      };
      conn.send(JSON.stringify(msg));
    } else if (this.players.length === 2) {
      // Second player joined - start the game
      this.gameState = createGame(
        this.room.id,
        this.players[0].playerId,
        this.players[1].playerId,
        this.config,
      );

      // Set player names
      this.gameState.players[0].name = playerName === 'Player 2' ? 'Player 1' : playerName;
      this.gameState.players[1].name = playerName;

      this.broadcastState();

      // Schedule timer if timed mode
      if (this.config.timerMode !== 'untimed') {
        this.scheduleTimerAlarm();
      }
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(message);
    } catch {
      const msg: ServerMessage = { type: 'ERROR', message: 'Invalid message format' };
      sender.send(JSON.stringify(msg));
      return;
    }

    const player = this.players.find((p) => p.connectionId === sender.id);
    if (!player) {
      const msg: ServerMessage = { type: 'ERROR', message: 'Unknown player' };
      sender.send(JSON.stringify(msg));
      return;
    }

    switch (parsed.type) {
      case 'SUBMIT_MOVE':
        this.handleSubmitMove(player, parsed.tiles, sender);
        break;
      case 'PASS':
        this.handlePass(player);
        break;
      case 'EXCHANGE':
        this.handleExchange(player, parsed.tileIds, sender);
        break;
      case 'RESIGN':
        this.handleResign(player);
        break;
      case 'SET_NAME':
        this.handleSetName(player, parsed.name);
        break;
      case 'REMATCH':
        this.handleRematch();
        break;
    }
  }

  onClose(conn: Party.Connection) {
    const player = this.players.find((p) => p.connectionId === conn.id);
    if (player && this.gameState) {
      // Mark as disconnected but don't remove - they can reconnect
      this.gameState = {
        ...this.gameState,
        players: this.gameState.players.map((p, i) =>
          i === player.playerIndex ? { ...p, connected: false } : p,
        ) as [typeof this.gameState.players[0], typeof this.gameState.players[1]],
      };
      this.broadcastState();
    }
  }

  async onAlarm() {
    if (!this.gameState || this.gameState.phase !== 'playing') return;

    // Check if current player's time has expired
    const currentPlayer = this.gameState.currentPlayerIndex;
    const elapsed = Date.now() - new Date(this.gameState.turnStartTimestamp).getTime();
    this.gameState = updatePlayerTime(this.gameState, currentPlayer, elapsed);

    if (this.gameState.players[currentPlayer].timeRemainingMs <= 0) {
      this.gameState = handleTimerExpiry(this.gameState, currentPlayer);
      this.broadcastState();
    } else {
      // Reschedule
      this.scheduleTimerAlarm();
      // Send timer sync
      this.broadcastTimerSync();
    }
  }

  // ---------------------------------------------------------------------------
  // Message handlers
  // ---------------------------------------------------------------------------

  private handleSubmitMove(player: PlayerConnection, tiles: PlacedTile[], conn: Party.Connection) {
    if (!this.gameState) return;

    // Deduct elapsed time for this turn
    if (this.config.timerMode !== 'untimed') {
      const elapsed = Date.now() - new Date(this.gameState.turnStartTimestamp).getTime();
      this.gameState = updatePlayerTime(this.gameState, player.playerIndex, elapsed);
    }

    const result = submitMove(this.gameState, player.playerIndex, tiles, this.dictionary);

    if (!result.success) {
      const msg: ServerMessage = { type: 'MOVE_REJECTED', reason: result.reason };
      conn.send(JSON.stringify(msg));
      return;
    }

    this.gameState = result.state;
    this.broadcastState();

    if (this.gameState.phase === 'playing' && this.config.timerMode !== 'untimed') {
      this.scheduleTimerAlarm();
    }
  }

  private handlePass(player: PlayerConnection) {
    if (!this.gameState) return;

    if (this.config.timerMode !== 'untimed') {
      const elapsed = Date.now() - new Date(this.gameState.turnStartTimestamp).getTime();
      this.gameState = updatePlayerTime(this.gameState, player.playerIndex, elapsed);
    }

    const result = passTurn(this.gameState, player.playerIndex);
    this.gameState = result.state;
    this.broadcastState();

    if (this.gameState.phase === 'playing' && this.config.timerMode !== 'untimed') {
      this.scheduleTimerAlarm();
    }
  }

  private handleExchange(player: PlayerConnection, tileIds: string[], conn: Party.Connection) {
    if (!this.gameState) return;

    if (this.config.timerMode !== 'untimed') {
      const elapsed = Date.now() - new Date(this.gameState.turnStartTimestamp).getTime();
      this.gameState = updatePlayerTime(this.gameState, player.playerIndex, elapsed);
    }

    const result = exchangePlayerTiles(this.gameState, player.playerIndex, tileIds);

    if (!result.success) {
      const msg: ServerMessage = { type: 'MOVE_REJECTED', reason: result.reason };
      conn.send(JSON.stringify(msg));
      return;
    }

    this.gameState = result.state;
    this.broadcastState();

    if (this.gameState.phase === 'playing' && this.config.timerMode !== 'untimed') {
      this.scheduleTimerAlarm();
    }
  }

  private handleResign(player: PlayerConnection) {
    if (!this.gameState) return;

    this.gameState = resignGame(this.gameState, player.playerIndex);
    this.broadcastState();
  }

  private handleSetName(player: PlayerConnection, name: string) {
    if (!this.gameState) return;

    const sanitized = name.trim().slice(0, 20) || `Player ${player.playerIndex + 1}`;
    this.gameState = {
      ...this.gameState,
      players: this.gameState.players.map((p, i) =>
        i === player.playerIndex ? { ...p, name: sanitized } : p,
      ) as [typeof this.gameState.players[0], typeof this.gameState.players[1]],
    };
    this.broadcastState();
  }

  private handleRematch() {
    if (!this.gameState || this.gameState.phase !== 'finished') return;
    if (this.players.length < 2) return;

    // Start a new game, swap who goes first
    this.gameState = createGame(
      this.room.id,
      this.players[0].playerId,
      this.players[1].playerId,
      this.config,
    );

    // Preserve names
    const p0Name = this.gameState.players[0].name;
    const p1Name = this.gameState.players[1].name;
    this.gameState.players[0].name = p0Name;
    this.gameState.players[1].name = p1Name;

    this.broadcastState();
  }

  // ---------------------------------------------------------------------------
  // Broadcasting
  // ---------------------------------------------------------------------------

  private broadcastState() {
    if (!this.gameState) return;

    for (const player of this.players) {
      const conn = this.room.getConnection(player.connectionId);
      if (!conn) continue;

      const clientState = this.filterStateForPlayer(this.gameState, player.playerIndex);
      const msg: ServerMessage = { type: 'GAME_STATE', state: clientState };
      conn.send(JSON.stringify(msg));
    }
  }

  private broadcastTimerSync() {
    if (!this.gameState) return;

    for (const player of this.players) {
      const conn = this.room.getConnection(player.connectionId);
      if (!conn) continue;

      const opponentIndex = player.playerIndex === 0 ? 1 : 0;
      const msg: ServerMessage = {
        type: 'TIMER_SYNC',
        yourTimeMs: this.gameState.players[player.playerIndex].timeRemainingMs,
        opponentTimeMs: this.gameState.players[opponentIndex].timeRemainingMs,
        turnStartTimestamp: this.gameState.turnStartTimestamp,
      };
      conn.send(JSON.stringify(msg));
    }
  }

  private filterStateForPlayer(state: GameState, playerIndex: number): ClientGameState {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const you = state.players[playerIndex];
    const opponent = state.players[opponentIndex];

    return {
      roomId: state.roomId,
      phase: state.phase,
      config: state.config,
      board: state.board,
      you,
      opponent: {
        name: opponent.name,
        score: opponent.score,
        timeRemainingMs: opponent.timeRemainingMs,
        handSize: opponent.hand.length,
        connected: opponent.connected,
      },
      currentPlayerIndex: state.currentPlayerIndex,
      yourPlayerIndex: playerIndex,
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
  // Timer management
  // ---------------------------------------------------------------------------

  private scheduleTimerAlarm() {
    if (!this.gameState || this.config.timerMode === 'untimed') return;

    const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
    const timeLeft = currentPlayer.timeRemainingMs;

    if (timeLeft <= 0) {
      // Already expired
      this.onAlarm();
      return;
    }

    // Schedule alarm for when time runs out, plus a small buffer
    // Also schedule periodic sync every 5 seconds
    const nextSync = Math.min(timeLeft, 5000);
    this.room.storage.setAlarm(Date.now() + nextSync);
  }
}

// PartyKit requires a default export
BlitzTilesServer satisfies Party.Worker;
