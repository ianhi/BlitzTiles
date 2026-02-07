/**
 * Game session recovery utilities.
 *
 * Provides localStorage-based persistence so clients can reconnect to
 * in-progress games after page refreshes, tab closes, or crashes.
 *
 * These are pure functions operating on SessionRecoveryData — the actual
 * localStorage calls are left to the caller (client) so this module stays
 * side-effect-free and testable.
 */

import type { ClientGameState, SessionRecoveryData } from './types.js';

/** localStorage key prefix for session data. */
export const SESSION_STORAGE_KEY = 'blitztiles:session';

/** Sessions older than this are considered expired and should be discarded. */
export const SESSION_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

// ---------------------------------------------------------------------------
// Create / update session data
// ---------------------------------------------------------------------------

/**
 * Creates a fresh SessionRecoveryData when a player joins a game.
 */
export function createSessionData(
  roomId: string,
  playerId: string,
  playerIndex: number,
): SessionRecoveryData {
  return {
    roomId,
    playerId,
    playerIndex,
    lastStateVersion: 0,
    savedAt: new Date().toISOString(),
    lastGameState: null,
  };
}

/**
 * Returns updated session data with the latest game state snapshot.
 * Call this every time the client receives a GAME_STATE message from
 * the server.
 */
export function updateSessionState(
  session: SessionRecoveryData,
  gameState: ClientGameState,
): SessionRecoveryData {
  return {
    ...session,
    lastStateVersion: gameState.stateVersion,
    savedAt: new Date().toISOString(),
    lastGameState: gameState,
  };
}

// ---------------------------------------------------------------------------
// Serialization (for localStorage)
// ---------------------------------------------------------------------------

/**
 * Serializes session recovery data to a JSON string for localStorage.
 */
export function serializeSession(session: SessionRecoveryData): string {
  return JSON.stringify(session);
}

/**
 * Deserializes a JSON string from localStorage into SessionRecoveryData.
 * Returns `null` if the string is invalid or the data is malformed.
 */
export function deserializeSession(json: string): SessionRecoveryData | null {
  try {
    const data = JSON.parse(json) as Record<string, unknown>;

    // Validate required fields exist and have the right types
    if (
      typeof data.roomId !== 'string' ||
      typeof data.playerId !== 'string' ||
      typeof data.playerIndex !== 'number' ||
      typeof data.lastStateVersion !== 'number' ||
      typeof data.savedAt !== 'string'
    ) {
      return null;
    }

    return data as unknown as SessionRecoveryData;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

/**
 * Checks whether session data has expired (too old to be useful for recovery).
 *
 * @param session - The session data to check.
 * @param now     - Current time in ms since epoch. Defaults to Date.now().
 * @param maxAge  - Maximum age in ms. Defaults to SESSION_MAX_AGE_MS.
 */
export function isSessionExpired(
  session: SessionRecoveryData,
  now?: number,
  maxAge?: number,
): boolean {
  const currentTime = now ?? Date.now();
  const age = maxAge ?? SESSION_MAX_AGE_MS;
  const savedTime = new Date(session.savedAt).getTime();

  if (isNaN(savedTime)) return true;

  return currentTime - savedTime >= age;
}

/**
 * Checks whether a session represents a finished game (no point recovering).
 */
export function isSessionGameOver(session: SessionRecoveryData): boolean {
  return session.lastGameState?.phase === 'finished';
}

// ---------------------------------------------------------------------------
// Recovery check
// ---------------------------------------------------------------------------

/**
 * Determines whether a stored session is valid for recovery.
 * Returns the session data if it can be recovered, or `null` if not.
 *
 * A session is recoverable if:
 * - It deserializes correctly
 * - It has not expired
 * - The game is not already finished
 */
export function getRecoverableSession(
  json: string | null,
  now?: number,
): SessionRecoveryData | null {
  if (json === null) return null;

  const session = deserializeSession(json);
  if (session === null) return null;

  if (isSessionExpired(session, now)) return null;
  if (isSessionGameOver(session)) return null;

  return session;
}

// ---------------------------------------------------------------------------
// Storage key helpers
// ---------------------------------------------------------------------------

/**
 * Returns the localStorage key for a specific room's session data.
 * This allows multiple game sessions to coexist (though typically a
 * player is only in one game at a time).
 */
export function getSessionKey(roomId: string): string {
  return `${SESSION_STORAGE_KEY}:${roomId}`;
}

/**
 * Returns the localStorage key for the "last active" session pointer.
 * This is a convenience for quickly finding the most recent game.
 */
export const ACTIVE_SESSION_KEY = `${SESSION_STORAGE_KEY}:active`;
