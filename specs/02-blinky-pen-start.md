# SPEC 02 — Blinky starts inside the ghost pen

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-09-23
> **Objective:** Move Blinky's start from outside the pen to inside it at (14,14), so all four ghosts begin staged in the pen and Blinky still exits first through the door.

## Why this spec exists

SPEC 01 deliberately placed Blinky outside the pen (`{ x: 13, y: 11 }`, `exitDelay: 0`) to mirror the arcade. The user wants the four ghosts to start together inside the pen, so this spec reverses that single decision. It amends SPEC 01's behavior (specifically its criterion "Blinky outside the pen above the door"); everything else from SPEC 01 stays.

## Scope

**In:**

- The `blinky` entry in `GHOST_STARTS` (`src/js/maze.js`) moves from `(13, 11)` — outside, above the door — to `(14, 14)` — inside the pen, right of Pinky.
- The `inPen` initialization in `createGame` and `resetPositions` (`src/js/game.js`) becomes unconditionally `true`, since no ghost starts outside anymore. Spanish comments updated.
- Blinky keeps `exitDelay: 0` in `GHOST_DEFS`: he runs the scripted exit (`moveGhostExit`) from the first frame and is still the first ghost out (~0.7 s to clear the door).
- After every death reset, Blinky re-stages inside the pen and exits first again (already implied by `resetPositions`).

**Out of scope (for future specs):**

- Frightened mode, power pellets, eyes-return-to-pen (still deferred from SPEC 01).
- Any change to Pinky, Inky or Clyde: start cells, exit delays (120/240/360), scatter corners.
- Any change to the scatter/chase schedule, speeds, colors or the no-re-entry door rule.
- Idle bobbing or animations for ghosts waiting in the pen.

## Data model

No new data structures. Two existing ones change:

```js
// src/js/maze.js — GHOST_STARTS (solo cambia la entrada de blinky)
const GHOST_STARTS = [
  { x: 14, y: 14, kind: 'blinky' }, // dentro de la pen, a la derecha de pinky
  { x: 13, y: 14, kind: 'pinky'  },
  { x: 11, y: 14, kind: 'inky'   },
  { x: 16, y: 14, kind: 'clyde'  },
];
```

```js
// src/js/game.js — createGame y resetPositions
// Los cuatro arrancan dentro de la pen; blinky (exitDelay 0) sale enseguida.
inPen: true,
exitTimer: GHOST_DEFS[ g.kind ].exitDelay,
```

`GHOST_DEFS` in `src/js/ghosts.js` is untouched (`blinky.exitDelay` stays `0`).

## Implementation plan

1. `src/js/game.js`: in `createGame` and `resetPositions`, replace `inPen: GHOST_DEFS[ g.kind ].exitDelay > 0` with `inPen: true` and update the surrounding comments. Manual test: the game behaves exactly as today — Blinky still starts outside and is active from frame 1, the other three stage normally.
2. `src/js/maze.js`: change the `blinky` entry in `GHOST_STARTS` to `{ x: 14, y: 14, kind: 'blinky' }` with an updated comment. Manual test: refresh — all four ghosts appear inside the pen (Blinky right of Pinky); Blinky immediately walks left to the door column and up through it; Pinky/Inky/Clyde follow at ~2 s/4 s/6 s; no console errors; lose a life and confirm Blinky re-stages inside and exits first again.

## Acceptance criteria

- [ ] `src/index.html` loads with no console errors.
- [ ] At game start the four ghosts are inside the pen: Inky (11,14), Pinky (13,14), Blinky (14,14), Clyde (16,14); none outside.
- [ ] Blinky leaves the pen through the door within the first second, before Pinky (~2 s), Inky (~4 s) and Clyde (~6 s).
- [ ] Once outside, Blinky behaves as in SPEC 01: scatter corner (26,1) first, then chase targeting Pac-Man's tile.
- [ ] After losing a life, positions reset with Blinky inside the pen and he exits first again.
- [ ] No ghost re-enters the pen, and Pac-Man still cannot enter it.
- [ ] Losing all lives still shows "PERDISTE"; eating all dots still shows "GANASTE".

## Decisions

- **Yes:** Blinky at `(14,14)` (user-confirmed). Mirror of Pinky under the door's right column; keeps the pen symmetric about the maze's center axis (Inky 11 ↔ Clyde 16, Pinky 13 ↔ Blinky 14).
- **Yes:** keep `exitDelay: 0` (user-confirmed). Blinky walks out from frame 1, preserving SPEC 01's "first ghost out" intent; only his starting cell changes.
- **Yes:** `inPen` initialized to `true` unconditionally. With all four starting inside, deriving it from `exitDelay > 0` would leave Blinky inside with `inPen: false`, and the door rule would trap him in the pen.
- **Yes:** a new SPEC 02 instead of editing SPEC 01. SPEC 01 is Approved and already implemented/merged; the amendment gets its own traceable change and branch.
- **No:** moving Pinky or any other ghost — scope confirmed as Blinky-only (user-confirmed).
- **Yes:** spec written in English, matching SPEC 01; code comments stay in Spanish per `AGENTS.md`.

## Risks

| Risk | Mitigation |
| --- | --- |
| Someone later "simplifies" `inPen` back to `exitDelay > 0` | The comment next to the initialization states why it must stay `true`: every ghost now starts inside the pen. |

## What is **not** in this spec

- Frightened mode, power pellets, eyes-return-to-pen.
- Changes to Pinky, Inky or Clyde (starts, delays, corners).
- Schedule, speeds, colors or door-rule changes.

Each one of those, if it lands, goes in its own spec.
