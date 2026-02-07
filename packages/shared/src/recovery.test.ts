import { describe, it, expect } from 'vitest';
import {
  createSessionData,
  updateSessionState,
  serializeSession,
  deserializeSession,
  isSessionExpired,
  isSessionGameOver,
  getRecoverableSession,
  getSessionKey,
  SESSION_STORAGE_KEY,
  SESSION_MAX_AGE_MS,
  ACTIVE_SESSION_KEY,
} from './recovery.js';
import type { ClientGameState, SessionRecoveryData } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClientGameState(overrides?: Partial<ClientGameState>): ClientGameState {
  return {
    roomId: 'room-1',
    phase: 'playing',
    config: {
      timerMode: 'sudden_death',
      timerDurationMs: 900000,
      overtimePenaltyPerMinute: 0,
      turnTimeLimitMs: 0,
    },
    board: [],
    you: {
      id: 'p0',
      name: 'Alice',
      hand: [],
      score: 42,
      timeRemainingMs: 600000,
      connected: true,
    },
    opponent: {
      name: 'Bob',
      score: 30,
      timeRemainingMs: 500000,
      handSize: 5,
      connected: true,
    },
    currentPlayerIndex: 0,
    yourPlayerIndex: 0,
    tileBagCount: 50,
    consecutivePasses: 0,
    turnStartTimestamp: '2025-01-01T00:00:00.000Z',
    winnerIndex: null,
    endReason: null,
    moveHistory: [],
    stateVersion: 5,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createSessionData
// ---------------------------------------------------------------------------

describe('createSessionData', () => {
  it('creates session with correct fields', () => {
    const session = createSessionData('room-1', 'player-abc', 0);

    expect(session.roomId).toBe('room-1');
    expect(session.playerId).toBe('player-abc');
    expect(session.playerIndex).toBe(0);
    expect(session.lastStateVersion).toBe(0);
    expect(session.lastGameState).toBeNull();
    expect(session.savedAt).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// updateSessionState
// ---------------------------------------------------------------------------

describe('updateSessionState', () => {
  it('updates state version and game state snapshot', () => {
    const session = createSessionData('room-1', 'p0', 0);
    const gameState = makeClientGameState({ stateVersion: 10 });

    const updated = updateSessionState(session, gameState);

    expect(updated.lastStateVersion).toBe(10);
    expect(updated.lastGameState).toEqual(gameState);
    expect(updated.roomId).toBe('room-1');
    expect(updated.playerId).toBe('p0');
  });

  it('updates savedAt timestamp', () => {
    const session = createSessionData('room-1', 'p0', 0);
    const oldSavedAt = session.savedAt;

    const gameState = makeClientGameState();
    const updated = updateSessionState(session, gameState);

    expect(updated.savedAt).toBeTruthy();
    expect(new Date(updated.savedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(oldSavedAt).getTime(),
    );
  });
});

// ---------------------------------------------------------------------------
// Serialization round-trip
// ---------------------------------------------------------------------------

describe('serializeSession / deserializeSession', () => {
  it('round-trips correctly', () => {
    const session = createSessionData('room-1', 'p0', 0);
    const gameState = makeClientGameState();
    const updated = updateSessionState(session, gameState);

    const json = serializeSession(updated);
    const restored = deserializeSession(json);

    expect(restored).not.toBeNull();
    expect(restored!.roomId).toBe('room-1');
    expect(restored!.playerId).toBe('p0');
    expect(restored!.playerIndex).toBe(0);
    expect(restored!.lastStateVersion).toBe(gameState.stateVersion);
    expect(restored!.lastGameState).toEqual(gameState);
  });

  it('returns null for invalid JSON', () => {
    expect(deserializeSession('not-json')).toBeNull();
    expect(deserializeSession('')).toBeNull();
    expect(deserializeSession('null')).toBeNull();
  });

  it('returns null for malformed data', () => {
    expect(deserializeSession(JSON.stringify({ roomId: 'r' }))).toBeNull();
    expect(
      deserializeSession(
        JSON.stringify({
          roomId: 123,
          playerId: 'p',
          playerIndex: 0,
          lastStateVersion: 0,
          savedAt: 'x',
        }),
      ),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isSessionExpired
// ---------------------------------------------------------------------------

describe('isSessionExpired', () => {
  it('returns false for a fresh session', () => {
    const session = createSessionData('room-1', 'p0', 0);
    expect(isSessionExpired(session)).toBe(false);
  });

  it('returns true for an old session', () => {
    const session = createSessionData('room-1', 'p0', 0);
    const fiveHoursAgo = Date.now() - 5 * 60 * 60 * 1000;
    const oldSession: SessionRecoveryData = {
      ...session,
      savedAt: new Date(fiveHoursAgo).toISOString(),
    };

    expect(isSessionExpired(oldSession)).toBe(true);
  });

  it('respects custom maxAge', () => {
    const session = createSessionData('room-1', 'p0', 0);
    // With 0ms max age, even a fresh session is expired
    expect(isSessionExpired(session, undefined, 0)).toBe(true);
  });

  it('returns true for invalid savedAt', () => {
    const session = createSessionData('room-1', 'p0', 0);
    const bad: SessionRecoveryData = { ...session, savedAt: 'not-a-date' };
    expect(isSessionExpired(bad)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isSessionGameOver
// ---------------------------------------------------------------------------

describe('isSessionGameOver', () => {
  it('returns false when no game state', () => {
    const session = createSessionData('room-1', 'p0', 0);
    expect(isSessionGameOver(session)).toBe(false);
  });

  it('returns false when game is playing', () => {
    const session = createSessionData('room-1', 'p0', 0);
    const updated = updateSessionState(session, makeClientGameState({ phase: 'playing' }));
    expect(isSessionGameOver(updated)).toBe(false);
  });

  it('returns true when game is finished', () => {
    const session = createSessionData('room-1', 'p0', 0);
    const updated = updateSessionState(
      session,
      makeClientGameState({
        phase: 'finished',
        winnerIndex: 0,
        endReason: 'test',
      }),
    );
    expect(isSessionGameOver(updated)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getRecoverableSession
// ---------------------------------------------------------------------------

describe('getRecoverableSession', () => {
  it('returns session for valid, non-expired, in-progress game', () => {
    const session = createSessionData('room-1', 'p0', 0);
    const updated = updateSessionState(session, makeClientGameState());
    const json = serializeSession(updated);

    const result = getRecoverableSession(json);
    expect(result).not.toBeNull();
    expect(result!.roomId).toBe('room-1');
  });

  it('returns null for null input', () => {
    expect(getRecoverableSession(null)).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(getRecoverableSession('garbage')).toBeNull();
  });

  it('returns null for expired session', () => {
    const session = createSessionData('room-1', 'p0', 0);
    const old: SessionRecoveryData = {
      ...session,
      savedAt: new Date(Date.now() - SESSION_MAX_AGE_MS - 1000).toISOString(),
    };
    const json = serializeSession(old);

    expect(getRecoverableSession(json)).toBeNull();
  });

  it('returns null for finished game', () => {
    const session = createSessionData('room-1', 'p0', 0);
    const updated = updateSessionState(session, makeClientGameState({ phase: 'finished' }));
    const json = serializeSession(updated);

    expect(getRecoverableSession(json)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Storage key helpers
// ---------------------------------------------------------------------------

describe('getSessionKey', () => {
  it('returns namespaced key', () => {
    expect(getSessionKey('room-1')).toBe(`${SESSION_STORAGE_KEY}:room-1`);
  });
});

describe('ACTIVE_SESSION_KEY', () => {
  it('is a string', () => {
    expect(typeof ACTIVE_SESSION_KEY).toBe('string');
    expect(ACTIVE_SESSION_KEY).toContain(SESSION_STORAGE_KEY);
  });
});
