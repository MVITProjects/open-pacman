# SPEC 03 — Power pellets and frightened mode

> **Status:** Implemented
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-09-24
> **Objective:** Add the four arcade power pellets so eating one sends the ghosts into frightened mode — blue, slow, random and edible — with the 200→1600 scoring chain and eaten ghosts returning to the pen as eyes before re-exiting.

## Why this spec exists

SPEC 01 built the four ghost personalities but explicitly deferred frightened mode ("don't add any power, this is another spec"). This is that spec: it completes the classic loop where a pellet turns the hunters into prey.

## Scope

**In:**

- A new tile value `4` (char `o`) in `src/js/maze.js`, with the four power pellets at the classic cells (1,3), (26,3), (1,23), (26,23) replacing existing dots.
- Pellets count in `dotsRemaining` and are worth 50 points — the level cannot be won while any pellet remains.
- Eating a pellet: starts `game.frightTimer` at 360 frames, resets the score chain, and force-reverses every active ghost (reusing the phase-switch `forcedReverse` mechanic).
- Frightened behavior while `game.frightTimer > 0`: ghosts outside the pen move at `GHOST_SPEED / 2` (0.05) and pick a random valid turn at each intersection.
- Ghosts still in the pen come out frightened if the timer is still running when they exit.
- The scatter/chase countdown pauses during fright and resumes the same phase afterwards.
- Pac-Man eats a frightened ghost on collision: 200 → 400 → 800 → 1600 within one fright period; eating a new pellet resets the chain and restarts the timer.
- Eaten ghosts become eyes: fast, immune to collisions, they target the pen door (13,11), re-enter the pen, regenerate and immediately re-exit (a regenerated ghost exits normal, or frightened if the timer is still running).
- Rendering in `src/js/render.js`: pellets bigger than dots and blinking; frightened ghosts dark blue flashing white in the last ~2 s; eaten ghosts drawn as eyes only.
- `resetPositions` clears all fright state on death.

**Out of scope (for future specs):**

- Sound effects — the repo has no audio layer.
- Score popups and the brief freeze frame when a ghost is eaten (arcade shows "200" over the action).
- Per-level fright decay — needs a level system; the 360-frame duration applies to every level, consistent with SPEC 01's "level-1 schedule everywhere" decision.
- Cruise Elroy, tunnel slowdown, per-ghost normal speeds (still deferred from SPEC 01).
- Ghost-ghost collision (still pass-through).
- Pac-Man's eating pause frames (never modeled in this codebase).

## Data model

New tile and chars in `src/js/maze.js`:

```js
// '#' pared(1) · '.' dot(2) · ' ' vacio(0) · '-' puerta(3) · 'o' power pellet(4)
function parseTile( ch ) {
  if ( ch === '#' ) return 1;
  if ( ch === '.' ) return 2;
  if ( ch === '-' ) return 3;
  if ( ch === 'o' ) return 4;
  return 0;
}
```

Rows 3 and 23 change their corner dots to pellets:

```js
'#o####.#####.##.#####.####o#', // 3   pellets en (1,3) y (26,3)
'#o..##................##..o#', // 23  pellets en (1,23) y (26,23)
```

New constants in `src/js/ghosts.js`:

```js
// Fright: duracion, velocidad asustado y velocidad de los ojos.
const FRIGHT_FRAMES = 360; // 6 s a ~60fps; parpadeo blanco en los ultimos 120
const FRIGHT_SPEED = 0.05; // mitad de GHOST_SPEED
const EYES_SPEED = 0.2;    // 2x GHOST_SPEED, vuelve rapido a la pen
```

Global and per-ghost state in `src/js/game.js`:

```js
// createGame / resetPositions
game.frightTimer = 0; // frames restantes de modo asustado
game.frightChain = 0; // fantasmas comidos en este periodo de fright

// por fantasma
{
  x, y, dir, speed, kind, inPen, exitTimer, forcedReverse, // sin cambios
  eaten: false, // true mientras es "ojos" volviendo a la pen
}
```

Conventions unchanged: coordinates in cells, origin top-left; timers in frames at ~60fps. Ghost effective speed is derived each frame from state — normal `GHOST_SPEED`, frightened `FRIGHT_SPEED`, eyes `EYES_SPEED` — instead of mutating `g.speed` on transitions.

## Implementation plan

1. `maze.js`: add `'o' → 4` to `parseTile` (and the header comment) and swap the four corner dots in rows 3 and 23. `game.js`: `dotsRemaining` counts `2` and `4`. `render.js`: draw tile `4` as a ~6px-radius circle in `DOT_COLOR`, visible only every other ~15-frame window (`Math.floor( frame / 15 ) % 2`). Manual test: four big blinking pellets appear in the corners; the game runs as before; no console errors.
2. `game.js`: in `movePacman`, eating a `4` clears it, adds 50, decrements `dotsRemaining`, sets `frightTimer = FRIGHT_FRAMES`, `frightChain = 0` and reverses every active ghost (extract the reversal loop from `tickGhostPhase` into a `reverseGhosts( game )` helper reused by both). In `update`, decrement `frightTimer` and only call `tickGhostPhase` while it is `0`. Manual test: eating a pellet scores 50, all active ghosts visibly turn 180°, the scatter/chase phase freezes for ~6 s and then resumes where it stopped.
3. `ghosts.js`: in `decideGhost`, branch for frightened — random choice among the valid non-reverse options (reverse only if dead end, as today). `game.js` `moveGhost`: use `FRIGHT_SPEED` when `frightTimer > 0` and the ghost is outside and not eaten. `render.js`: frightened ghosts drawn in `FRIGHTENED_COLOR` (`#2121ff`), flashing to white every ~12 frames during the last 120 frames of the timer. Manual test: after a pellet, outside ghosts turn blue and wander at half speed; a ghost released from the pen mid-fright comes out blue; all revert after ~6 s.
4. `game.js`: collision branch in `update` — if `frightTimer > 0` and the ghost is not eaten, Pac-Man eats it: `score += 200 * 2 ** frightChain`, `frightChain++`, `g.eaten = true`; eaten ghosts idle in place this step and are skipped by collisions. `render.js`: draw eaten ghosts as the two eyeballs only (no body). Manual test: touching a blue ghost scores 200 and it becomes a floating pair of eyes; a second/third/fourth in the same fright period scores 400/800/1600.
5. `game.js`/`ghosts.js`: eyes return — while `g.eaten`, `moveGhost` uses `EYES_SPEED` and `decideGhost` targets the door tile `{ x: 13, y: 11 }`; on arrival a scripted re-entry (mirror of `moveGhostExit`) walks the eyes down to (13,14), then sets `eaten = false`, `inPen = true`, `exitTimer = 0` so the existing `moveGhostExit` re-runs immediately. Manual test: the eaten ghost's eyes zip back to the pen, dip in, and the ghost comes right back out — normal, or blue if fright is still active.
6. `game.js` `resetPositions`: reset `frightTimer = 0`, `frightChain = 0`, `g.eaten = false` on every ghost. Manual test: dying during fright leaves no blue ghosts after the reset; "PERDISTE" and "GANASTE" still work.

## Acceptance criteria

- [ ] `src/index.html` loads with no console errors.
- [ ] Four power pellets render at (1,3), (26,3), (1,23), (26,23), visibly bigger than dots and blinking.
- [ ] Eating a pellet adds exactly 50 points.
- [ ] The game cannot reach "GANASTE" while any pellet is uneaten.
- [ ] Every active ghost makes a visible 180° turn the frame a pellet is eaten.
- [ ] Frightened ghosts move at half speed and choose random directions at intersections.
- [ ] Frightened ghosts render dark blue and flash white during the final ~2 seconds.
- [ ] The scatter/chase phase resumes exactly where it paused once fright ends.
- [ ] A ghost inside the pen when the pellet is eaten exits frightened if the timer is still running.
- [ ] Eating the 1st/2nd/3rd/4th frightened ghost in one fright period scores 200/400/800/1600.
- [ ] Eating a new pellet mid-fright restarts the timer and resets the chain to 200.
- [ ] An eaten ghost renders as eyes only, never kills Pac-Man and cannot be re-eaten.
- [ ] Eyes head for the pen door, re-enter the pen, regenerate and exit again immediately.
- [ ] A regenerated ghost exits normal, or frightened if `frightTimer` is still above 0.
- [ ] Dying during fright clears it: after the reset no ghost is blue and the phase restarts at scatter.
- [ ] Losing all lives shows "PERDISTE"; eating every dot and pellet shows "GANASTE".

## Decisions

- **Yes:** tile `4` with char `'o'`. Consistent with the existing 0/1/2/3 encoding and keeps `MAZE_STR` readable.
- **Yes:** pellets count in `dotsRemaining`. Otherwise the win condition could trigger with pellets still on the board; the arcade counts them as dots too.
- **Yes:** 50 points per pellet — arcade value.
- **Yes:** global `game.frightTimer` plus a single per-ghost `eaten` flag. The global timer makes "pen ghosts exit frightened" automatic and keeps the per-ghost diff minimal.
- **Yes:** 360 frames (6 s), same every level (user-confirmed). Matches SPEC 01's stance of applying level-1 timing everywhere; per-level decay waits for a level system.
- **Yes:** random turns + `FRIGHT_SPEED = 0.05` (user-confirmed) — the arcade's confused half-speed wander.
- **Yes:** eyes return to the pen with scripted re-entry and instant re-exit (user-confirmed). Reuses `moveGhostExit`; the arcade regenerates the ghost immediately.
- **Yes:** `EYES_SPEED = 0.2` (2× ghost speed). The return reads as urgent, like the arcade.
- **Yes:** 200→1600 doubling chain, reset on each new pellet (user-confirmed).
- **Yes:** pause the phase countdown during fright (user-confirmed); resuming the same phase avoids silent scatter/chase switches mid-fright.
- **Yes:** forced reversal on pellet eaten, reusing the phase-switch mechanism (user-confirmed).
- **Yes:** derive effective speed from ghost state each frame instead of mutating `g.speed` at transitions — no missed transition can leave a ghost permanently slow or fast.
- **No:** changing `isWall`/door rules. The scripted re-entry bypasses `canMove`, exactly like the scripted exit already does.
- **No:** sound, score popups, freeze frames — no audio layer in the repo; popups are polish.
- **No:** Pac-Man's digestion pause (arcade's 1–3 frame stop while eating) — never modeled here.

## Risks

| Risk | Mitigation |
| --- | --- |
| Fright ends in the same frame Pac-Man touches a ghost — eat or die? | The order inside `update` defines it: `frightTimer` is decremented before the collision check, so a timer at 0 means the collision kills. Documented in a comment in `update`. |
| Random frightened turns can make a ghost pace back and forth in one corridor | Accepted — options exclude the reverse direction unless it is a dead end, same rule as every other mode. |
| Frame-based timers run ~2× faster on 120/144 Hz displays | Inherited from SPEC 01; accepted for this learning project. |

## What is **not** in this spec

- Sound effects.
- Score popups and freeze frames when eating a ghost.
- Per-level fright decay.
- Cruise Elroy, tunnel slowdown, per-ghost normal speeds.
- Ghost-ghost collision.

Each one of those, if it lands, goes in its own spec.
