# SPEC 01 — Ghost AI: four distinct personalities

> **Status:** Implemented
> **Depends on:** none
> **Date:** 2026-09-23
> **Objective:** Replace the two-ghost placeholder AI with four ghosts using their classic arcade personalities — aggressive Blinky, ambushing Pinky, flanking Inky, shy Clyde — with scatter/chase phase alternation and staged pen exits.

## Why this spec exists

The MVP shipped with two placeholder ghosts (`hunter` + `random`) as stand-ins. This spec replaces them with the real arcade ghost layer and introduces `src/js/ghosts.js`, the future home of frightened/eaten behavior. It is the first spec in this repo.

## Scope

**In:**

- Four ghosts with kinds `blinky`, `pinky`, `inky`, `clyde` (replacing `hunter`/`random`) in `GHOST_STARTS` (`src/js/maze.js`).
- Per-kind chase targeting in a new `src/js/ghosts.js`:
  - `blinky`: Pac-Man's tile (direct pursuit — the aggressive one).
  - `pinky`: the tile 4 cells ahead of Pac-Man in his facing direction.
  - `inky`: the tile mirrored from Blinky through the point 2 cells ahead of Pac-Man (`target = 2 * ( pac + 2 * dir ) - blinky`).
  - `clyde`: Pac-Man's tile when more than 8 tiles away (Manhattan); his own scatter corner otherwise.
- A global scatter/chase phase timer in `game.ghostPhase` following the classic level-1 schedule: 420, 1200, 420, 1200, 300, 1200, 300 frames (even index = scatter, odd = chase), then permanent chase.
- Forced 180° reversal of every active ghost on each phase switch.
- One scatter corner per ghost (see `GHOST_DEFS`).
- Staged pen exits on per-ghost frame timers (`exitDelay`): Blinky starts outside; Pinky, Inky and Clyde leave at roughly 2 s, 4 s and 6 s. Re-staged after every death reset.
- The pen door counts as a wall for ghosts already outside (no re-entry); the scripted exit bypasses that rule.
- Ghost colors per kind in `src/js/render.js` (red, pink, cyan, orange).
- `<script src="js/ghosts.js">` in `src/index.html`, between `maze.js` and `game.js`.

**Out of scope (for future specs):**

- Frightened mode: power pellets, edible ghosts, eyes-return-to-pen, ghost-eaten scoring. Explicitly deferred by the user ("don't add any power, this is another spec").
- Cruise Elroy (Blinky's end-game speedup) and tunnel slowdown.
- Per-ghost speed differences — all four keep `GHOST_SPEED = 0.1`.
- Level-dependent schedules — the level-1 schedule applies to every level.
- Audio and new animations (ghosts idle in place inside the pen; no bobbing).

## Data model

New static config in `src/js/ghosts.js`:

```js
// Definicion estatica por fantasma: color, esquina de scatter y retardo de salida.
const GHOST_DEFS = {
  blinky: { color: '#ff0000', scatter: { x: 26, y: 1 },  exitDelay: 0 },
  pinky:  { color: '#ffb8ff', scatter: { x: 1,  y: 1 },  exitDelay: 120 },
  inky:   { color: '#00ffff', scatter: { x: 26, y: 29 }, exitDelay: 240 },
  clyde:  { color: '#ffb852', scatter: { x: 1,  y: 29 }, exitDelay: 360 },
};

// Frames a ~60fps. Indice par = scatter, impar = chase; agotado → chase permanente.
const SCATTER_SCHEDULE = [ 420, 1200, 420, 1200, 300, 1200, 300 ];
```

`GHOST_STARTS` in `src/js/maze.js` grows from 2 to 4:

```js
const GHOST_STARTS = [
  { x: 13, y: 11, kind: 'blinky' }, // fuera de la pen, sobre la puerta
  { x: 13, y: 14, kind: 'pinky'  },
  { x: 11, y: 14, kind: 'inky'   },
  { x: 16, y: 14, kind: 'clyde'  },
];
```

Per-ghost state in `game.ghosts[i]` gains two fields, and `game` gains the phase object:

```js
// Estado por fantasma (game.js, createGame / resetPositions).
{
  x, y, dir, speed, kind,   // sin cambios
  inPen: true,              // false al terminar la salida guionizada (blinky arranca false)
  exitTimer: 120,           // frames restantes antes de salir de la pen
}

// Fase global (game.js, createGame / update).
game.ghostPhase = { mode: 'scatter', index: 0, framesLeft: 420 };
```

Conventions: coordinates in cells with origin top-left; speeds in cells/frame; every timer in frames assuming ~60fps from `requestAnimationFrame`.

## Implementation plan

1. `src/js/maze.js`: replace `GHOST_STARTS` with the four entries above. Manual test: open `src/index.html` — four ghosts appear, the unknown kinds fall into the existing random branch, no console errors.
2. Create `src/js/ghosts.js` with `GHOST_DEFS`, `SCATTER_SCHEDULE` and a placeholder `decideGhost( game, g )` that keeps today's random-choice logic; add the script tag to `src/index.html` between `maze.js` and `game.js`; export the API on `window`. Manual test: game runs as before; `window.GHOST_DEFS` is reachable from the console.
3. `src/js/game.js`: delete the old `decideGhost` (the one in `ghosts.js` takes over); in `createGame` and `resetPositions`, initialize `inPen` and `exitTimer` from `GHOST_DEFS` (Blinky: `inPen: false`). Manual test: four random-walking ghosts; win/lose still work.
4. `src/js/ghosts.js`: implement per-kind chase targets in `decideGhost` — compute the kind's target tile, then pick the direction that minimizes Manhattan distance to it (reusing the current option/choice mechanics). Manual test: Blinky beelines onto Pac-Man, Pinky cuts ahead, Inky comes in at angles, Clyde breaks off when close.
5. Scatter/chase phases: create `game.ghostPhase` in `createGame`; tick it in `update`; on countdown end advance `index`, flip `mode` and force-reverse every non-pen ghost; `decideGhost` targets `GHOST_DEFS[ g.kind ].scatter` while `mode === 'scatter'`. Manual test: ghosts head to their corners at start, reverse on each switch, and switch to permanent chase after ~84 s.
6. Staged exit: in `update`, count down `exitTimer` while the ghost idles in place; at 0 the ghost walks inside the pen to the door column (x = 13), then up through the door to row 11, where `inPen` becomes `false`; extend the ghost wall rule so the door blocks ghosts that are outside; `resetPositions` restarts staging and `ghostPhase`. Manual test: Blinky active from frame one; Pinky/Inky/Clyde leave at ~2 s/4 s/6 s; after a death the sequence restarts; no ghost re-enters the pen.
7. `src/js/render.js`: draw each ghost with `GHOST_DEFS[ g.kind ].color` and drop the index-based `GHOST_COLORS`. Manual test: red Blinky, pink Pinky, cyan Inky, orange Clyde.

## Acceptance criteria

- [ ] `src/index.html` loads with no console errors.
- [ ] Four ghosts appear at start: Blinky outside the pen above the door; Pinky, Inky and Clyde inside it.
- [ ] Each ghost renders in its classic color matching its kind (red, pink, cyan, orange).
- [ ] All four ghosts keep the uniform `GHOST_SPEED = 0.1`.
- [ ] In chase, Blinky always picks a turn that minimizes his next-tile Manhattan distance to Pac-Man's tile.
- [ ] In chase, Pinky heads for the tile 4 cells ahead of Pac-Man's facing, even when that misses Pac-Man.
- [ ] In chase, Inky's target changes when Blinky's position changes, with Pac-Man's facing held constant.
- [ ] In chase, Clyde pursues Pac-Man beyond 8 tiles and turns back toward his corner at 8 or fewer.
- [ ] At game start every active ghost heads toward its scatter corner (the first phase is scatter).
- [ ] Ghosts visibly reverse direction on every phase switch.
- [ ] After the schedule is exhausted (~84 s at 60fps), ghosts chase permanently for the rest of the level.
- [ ] Pinky, Inky and Clyde leave the pen at roughly 2 s, 4 s and 6 s; Blinky is outside from the first frame.
- [ ] After losing a life, positions reset, the staged exit restarts, and the phase resets to scatter.
- [ ] No ghost re-enters the pen once outside, and Pac-Man still cannot enter it.
- [ ] Losing all lives still shows "PERDISTE"; eating all dots still shows "GANASTE".

## Decisions

- **Yes:** classic arcade targeting for all four personalities (user-confirmed). It is the behavior players expect and the reference material is abundant.
- **No:** Pinky's original up-direction overflow bug. It is a hardware quirk, not a design; the ambush intent is preserved without it.
- **Yes:** level-1 scatter/chase schedule with forced reversal on switches (user-confirmed). Simple to encode as a frame array and it makes phases observable.
- **Yes:** staged pen exit via per-ghost frame timers (user-confirmed). The arcade's dot-counter release system is overkill for this codebase.
- **Yes:** new `src/js/ghosts.js` between `maze.js` and `game.js` (user-confirmed). Ghost config and AI live in one place; `game.js` keeps state, movement mechanics and collision.
- **Yes:** arcade names as `kind` values (user-confirmed). Instantly recognizable and they map 1:1 to colors.
- **Yes:** uniform `GHOST_SPEED = 0.1` (user-confirmed). Elroy and tunnel slowdown are deferred.
- **No:** frightened mode and power pellets — explicitly deferred by the user to a future spec.
- **No:** idle bobbing for ghosts waiting in the pen. They idle in place; polish can come later.
- **Yes:** ghosts pass through each other, as today. Ghost-ghost collision is not part of the arcade behavior.
- **Yes:** spec written in English (user choice); code comments and user-facing copy stay in Spanish per `AGENTS.md`.

## Risks

| Risk | Mitigation |
| --- | --- |
| Timers are frame-based on `requestAnimationFrame`; on high-refresh displays (120/144 Hz) phases and exits run up to ~2× faster | Accepted for this learning project; converting to delta-time can be its own spec if it bothers in practice. |
| The no-re-entry door rule could block the scripted exit or trap a ghost | The scripted exit bypasses the decision layer; the door rule only applies to `decideGhost` choices of outside ghosts. |

## What is **not** in this spec

- Power pellets, frightened mode, edible ghosts, eyes-return-to-pen.
- Cruise Elroy, tunnel slowdown, per-ghost speeds.
- Level-dependent ghost schedules.
- Ghost-ghost collision.

Each one of those, if it lands, goes in its own spec.
