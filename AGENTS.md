# AGENTS.md

## Project Overview

Coaster Tycoon 3D is a browser-based 3D roller-coaster tycoon game built with Three.js and vanilla JavaScript (ES modules). No build step, no framework — pure static files served by a minimal Node.js server.

## Commands

- `npm start` — Start the static file server (default port from `server.js`)
- `npm test` — Currently not configured; headless logic tests live in `test/track.test.mjs` and can be run with `node test/track.test.mjs`

## Architecture

### Entry Point
- `index.html` — DOM structure, HUD, toolbar, import map for `three`
- `js/main.js` — `Game` class orchestrates everything: renderer, input, game loop, save/load

### Core Systems (all receive a reference to `Game`)
| File | Responsibility |
|------|---------------|
| `js/config.js` | All tunable constants — physics, costs, grid limits, capacities |
| `js/track.js` | Track model: piece types, placement rules, path geometry |
| `js/trackmesh.js` | Instanced rail/tie/support meshes + ghost preview rendering |
| `js/train.js` | Train physics: gravity, friction, chain lift, banking, braking |
| `js/guests.js` | Guest AI: spawning, queueing, boarding, budget decisions |
| `js/scenery.js` | Ground, grid, lights, sky, trees, clouds, entrance path |
| `js/ui.js` | HUD updates, toast notifications, toolbar event wiring |
| `js/audio.js` | Procedural WebAudio SFX (no audio assets) |

### Key Design Patterns
- **Single `Game` class** owns all state; systems are composed and receive a reference to it
- **Instanced meshes** for rails, ties, supports, trees — efficient rendering of repeated geometry
- **Config-driven** — all constants centralized in `config.js`
- **Import maps** resolve `three` from `node_modules` at runtime (no bundler)
- **localStorage** for save/load persistence

## Code Style
- Vanilla JS ES modules, no framework
- No comments unless absolutely necessary for clarity
- Follow existing patterns: camelCase for functions/variables, PascalCase for classes
- Keep systems decoupled — each module exports a class or functions, receives `game` reference

## Testing
- Headless logic tests in `test/track.test.mjs` validate circuit completion, train lap physics, and save/load round-trip
- Run with `node test/track.test.mjs`

## Gameplay Summary
- Build track pieces (straight, left, right, up/chain, down) on a grid
- Complete a circuit back to the station to open the ride
- Train runs with gravity-driven physics; chain lifts pull uphill
- Guests spawn based on excitement rating, queue, board, pay tickets
- Economy: start with $5,000, pieces cost $40–$70, undo gives full refund
