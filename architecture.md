# BlitzTiles Architecture

## System Overview

```
 ┌─────────────────────────────────────────────────────────────────┐
 │                        PLAYERS (Browser)                        │
 │                                                                 │
 │  ┌──────────────────────┐       ┌──────────────────────┐       │
 │  │    Player A (tab)    │       │    Player B (tab)    │       │
 │  │                      │       │                      │       │
 │  │  React + Vite SPA    │       │  React + Vite SPA    │       │
 │  └──────────┬───────────┘       └──────────┬───────────┘       │
 └─────────────┼──────────────────────────────┼───────────────────┘
               │ WebSocket (partysocket)      │ WebSocket
               │ auto-reconnect              │ auto-reconnect
               │                              │
 ┌─────────────┼──────────────────────────────┼───────────────────┐
 │             ▼          PartyKit            ▼                   │
 │  ┌─────────────────────────────────────────────────────┐       │
 │  │              Durable Object (Game Room)              │       │
 │  │                                                      │       │
 │  │  ┌─────────────┐  ┌──────────┐  ┌───────────────┐  │       │
 │  │  │ Game State  │  │  Timer   │  │  Dictionary   │  │       │
 │  │  │ (authorit.) │  │ Manager  │  │  (Trie cache) │  │       │
 │  │  └──────┬──────┘  └────┬─────┘  └───────────────┘  │       │
 │  │         │              │                             │       │
 │  │         ▼              ▼                             │       │
 │  │  ┌──────────────────────────┐                       │       │
 │  │  │  @blitztiles/shared      │                       │       │
 │  │  │  (game engine)           │                       │       │
 │  │  └──────────────────────────┘                       │       │
 │  └─────────────────────────────────────────────────────┘       │
 │                 Cloudflare Durable Objects                      │
 └────────────────────────────────────────────────────────────────┘
```

## Monorepo Package Structure

```
blitztiles/
├── packages/
│   ├── shared/          ◄── Pure game logic, zero deps
│   ├── client/          ◄── React SPA (imports shared)
│   └── server/          ◄── PartyKit DO (imports shared)
│
│   shared ◄──────── client
│     ▲
│     └──────────── server
```

## Package Detail: @blitztiles/shared

```
shared/src/
│
├── types.ts          Tile, Board, GameState, Messages (discriminated unions)
│
├── constants.ts      TILE_DISTRIBUTION, BONUS_MAP, HAND_SIZE, BOARD_SIZE
│       │
│       ▼
├── tileBag.ts        createTileBag(seed) → drawTiles() → exchangeTiles()
│                     Uses seeded PRNG (mulberry32) for determinism
│
├── words.ts          Trie class + loadDictionary(text)
│                     O(k) lookup for ~172K ENABLE words
│
├── board.ts          isValidPlacement(board, tiles) → {valid, reason}
│                     getFormedWords(board, tiles) → [{word, cells}]
│
├── scoring.ts        scoreTurn(board, placed, words) → number
│                     getEndGameBonus(handValues) → number
│
└── gameEngine.ts     ◄── NOT YET IMPLEMENTED
                      createGame() → submitMove() → passTurn()
                      exchangeTiles() → checkEndConditions()
                      Pure state machine: (State, Action) → State
```

## Data Flow: Networked Game

```
  Player A (Client)              Server (Durable Object)           Player B (Client)
  ─────────────────              ───────────────────────           ─────────────────
        │                                │                                │
        │  1. SUBMIT_MOVE {tiles}        │                                │
        ├───────────────────────────────►│                                │
        │                                │  2. Validate via               │
        │                                │     shared/gameEngine          │
        │                                │     + shared/words (Trie)      │
        │                                │                                │
        │                                │  3. If valid: update state,    │
        │                                │     schedule timer alarm       │
        │                                │                                │
        │  4. GAME_STATE (filtered)      │  4. GAME_STATE (filtered)     │
        │◄───────────────────────────────┤───────────────────────────────►│
        │  (sees own hand)               │  (sees own hand)              │
        │  (opponent = handSize only)    │  (opponent = handSize only)   │
        │                                │                                │
        │                                │  ── every 5s ──               │
        │  TIMER_SYNC                    │  TIMER_SYNC                   │
        │◄───────────────────────────────┤───────────────────────────────►│
        │                                │                                │
        │                                │  ── alarm() fires ──          │
        │                                │  Time expired → game over     │
```

## Data Flow: Local Hot-Seat Mode

```
  Single Browser Tab
  ──────────────────
        │
  ┌─────┴──────────────────────────────────────┐
  │  Zustand Store (useGameStore)               │
  │                                             │
  │  action ──► shared/gameEngine ──► newState  │
  │                                             │
  │  No server. No WebSocket.                   │
  │  Hands swap on turn change.                 │
  │  Dictionary loaded client-side.             │
  └─────────────────────────────────────────────┘
```

## Client Architecture

```
  ┌──────────────────────────────────────────────────────────┐
  │  React App (Vite)                                        │
  │                                                          │
  │  Pages                                                   │
  │  ├── HomePage ─── Create game / Join via code            │
  │  └── GamePage ─── Main game view                         │
  │                                                          │
  │  Components                                              │
  │  ├── board/                                              │
  │  │   ├── GameBoard ──── 15x15 CSS Grid + DnD context    │
  │  │   └── BoardCell ──── Droppable cell                   │
  │  ├── tiles/                                              │
  │  │   ├── TileRack ───── 7-tile hand                     │
  │  │   └── DraggableTile ─ Drag source                    │
  │  └── game/                                               │
  │      ├── GameHeader ──── Scores + Timers                 │
  │      ├── TimerDisplay ── MM:SS (SS.T under 10s)          │
  │      ├── GameControls ── Submit / Pass / Exchange        │
  │      ├── GameOverModal ─ Final scores + Rematch          │
  │      └── BlankTileModal ─ Letter picker for blanks       │
  │                                                          │
  │  Hooks                                                   │
  │  ├── useGameStore ────── Zustand (local or networked)   │
  │  ├── useGameConnection ─ PartySocket ↔ store bridge     │
  │  └── useTimer ─────────── rAF countdown, synced         │
  │                                                          │
  │  Input                                                   │
  │  ├── Desktop: @dnd-kit drag-and-drop                    │
  │  └── Mobile:  tap-to-select → tap-to-place              │
  └──────────────────────────────────────────────────────────┘
```

## Server Architecture

```
  ┌──────────────────────────────────────────────────────────┐
  │  PartyKit Server (Durable Object)                        │
  │                                                          │
  │  game.ts ─── Main class                                  │
  │  ├── onConnect(ws) ──── Assign player 0 or 1            │
  │  │                      Start game when 2 connected      │
  │  ├── onMessage(ws, msg)                                  │
  │  │   ├── Parse ClientMessage                             │
  │  │   ├── Validate via shared/gameEngine                  │
  │  │   ├── Validate words via Trie                         │
  │  │   └── Broadcast filtered ServerMessage                │
  │  ├── onClose(ws) ────── Mark disconnected               │
  │  │                      Clock keeps running              │
  │  └── alarm() ────────── Timer expiry handler             │
  │                                                          │
  │  timerManager.ts                                         │
  │  ├── Record turn start timestamps                        │
  │  ├── Compute elapsed time on move                        │
  │  ├── Schedule DO alarms                                  │
  │  └── Send TIMER_SYNC every 5s                            │
  │                                                          │
  │  dictionary.ts                                           │
  │  └── Load ENABLE word list into Trie (cached in memory) │
  │                                                          │
  │  Security                                                │
  │  └── Filter GameState per player before sending          │
  │      (opponent hand → handSize count only)               │
  └──────────────────────────────────────────────────────────┘
```

## Message Protocol

```
  Client → Server (intents)          Server → Client (state)
  ─────────────────────────          ──────────────────────────
  SUBMIT_MOVE { tiles[] }            GAME_STATE { ClientGameState }
  PASS                               WAITING { roomId, playerIndex }
  EXCHANGE { tileIds[] }             MOVE_REJECTED { reason }
  RESIGN                             TIMER_SYNC { yourTimeMs, opponentTimeMs }
  REMATCH                            ERROR { message }
  SET_NAME { name }
```

## Timer Modes

```
  ┌─────────────────┬──────────────────────────────────────────┐
  │ sudden_death    │ Time runs out → immediate loss           │
  ├─────────────────┼──────────────────────────────────────────┤
  │ time_penalty    │ Overtime → point deductions per minute   │
  ├─────────────────┼──────────────────────────────────────────┤
  │ untimed         │ No clock (casual play)                   │
  └─────────────────┴──────────────────────────────────────────┘
```

## Deployment

```
  ┌────────────────────┐     ┌──────────────────────┐
  │  Cloudflare Pages  │     │  PartyKit (CF DOs)   │
  │  (static client)   │────►│  (game rooms)        │
  │                    │ ws  │                      │
  │  React SPA         │     │  Each room = 1 DO    │
  └────────────────────┘     └──────────────────────┘
```
