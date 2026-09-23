# AGENTS.md

## Project

Vanilla JS/HTML/CSS PacMan clone (no frameworks, no build step, no package.json, no tests, no lint). The repo's purpose is learning spec-driven development.

## Run

Open `src/index.html` directly in a browser, or serve `src/` statically. There is no dev server and nothing to install.

## Architecture

- Entry point: `src/index.html`. Scripts are classic `<script>` tags loaded in strict dependency order: `maze.js` → `game.js` → `render.js` → `main.js`. There are **no ES modules**; files share state via `window.*` globals (e.g. `window.MAZE`, `window.createGame`). A new JS file must be added to `index.html` in the right order and export its API on `window`.
- `maze.js`: `MAZE_STR` (31 strings × 28 chars) parsed to a numeric 28×31 grid. `MAZE` is pristine and never mutated; `createGame()` copies it into `game.grid`, which is the only grid that gameplay and rendering touch (`render.js` reads `game.grid`, not `MAZE`).
- `game.js`: state and rules (`createGame`, `update`). `main.js`: loop, keyboard, overlay screens. `render.js`: canvas drawing (`draw(ctx, game, frame)`, `TILE = 20`).
- Tile encoding: `0` empty, `1` wall, `2` dot, `3` ghost-pen door. The door blocks Pacman but not ghosts (`isWall` in `game.js`).
- Actor positions are fractional (speed = fraction of a cell per frame); direction changes only apply when aligned to a cell. Tunnel row 14 (`TUNNEL_ROW`) wraps horizontally (`wrapTunnel`).

## Workflow: spec-driven development

- This repo is deliberately used to practice the spec-driven method. New features should start with a spec written to `specs/NN-slug.md` (zero-padded, sequential; the folder starts at `01-`) via the `spec` skill — no code during spec writing.
- Implementation of an approved spec goes through the `spec-impl` skill, which creates a branch per spec (branch auto-creation is controlled by `specs/.spec-config.yml`).
- Both skills are installed locally under `.agents/skills/` and locked in `skills-lock.json`.

## Conventions

- Comments and user-facing copy are in Spanish; identifiers are in English. Keep this split.
- Formatting quirk used consistently across all files: spaces inside parentheses, e.g. `( x )`, `foo( bar, baz )`. Match it when editing existing files.
