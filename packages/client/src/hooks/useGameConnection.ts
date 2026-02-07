/**
 * WebSocket connection hook for networked multiplayer.
 *
 * Connects to the PartyKit server, translates server messages into
 * Zustand store updates, and provides methods to send client messages.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { ClientMessage, ServerMessage, ClientGameState } from '@blitztiles/shared';

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999';

interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'waiting' | 'error';
  roomId: string | null;
  playerIndex: number | null;
  error: string | null;
}

interface UseGameConnectionOptions {
  roomId: string;
  playerId: string;
  playerName: string;
  onGameState: (state: ClientGameState) => void;
  onMoveRejected: (reason: string) => void;
  onTimerSync: (yourTimeMs: number, opponentTimeMs: number, turnStartTimestamp: string) => void;
  onError: (message: string) => void;
}

export function useGameConnection(options: UseGameConnectionOptions | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
    roomId: null,
    playerIndex: null,
    error: null,
  });

  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    if (!options) return;

    const { roomId, playerId, playerName, onGameState, onMoveRejected, onTimerSync, onError } = options;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${PARTYKIT_HOST}/party/${roomId}?playerId=${encodeURIComponent(playerId)}&name=${encodeURIComponent(playerName)}`;

    setConnectionState({
      status: 'connecting',
      roomId,
      playerIndex: null,
      error: null,
    });

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionState((prev) => ({ ...prev, status: 'connected' }));
    };

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'GAME_STATE':
            onGameState(message.state);
            break;
          case 'WAITING':
            setConnectionState((prev) => ({
              ...prev,
              status: 'waiting',
              roomId: message.roomId,
              playerIndex: message.playerIndex,
            }));
            break;
          case 'MOVE_REJECTED':
            onMoveRejected(message.reason);
            break;
          case 'TIMER_SYNC':
            onTimerSync(message.yourTimeMs, message.opponentTimeMs, message.turnStartTimestamp);
            break;
          case 'ERROR':
            onError(message.message);
            break;
        }
      } catch {
        console.error('Failed to parse server message');
      }
    };

    ws.onclose = () => {
      setConnectionState((prev) => ({ ...prev, status: 'disconnected' }));
    };

    ws.onerror = () => {
      setConnectionState((prev) => ({
        ...prev,
        status: 'error',
        error: 'Connection failed',
      }));
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [options?.roomId, options?.playerId]);

  return {
    connectionState,
    send,
  };
}
