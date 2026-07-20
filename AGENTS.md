# AGENTS.md

## Project Overview

Coaster Tycoon 3D is a browser-based 3D roller-coaster tycoon game built with Three.js and vanilla JavaScript (ES modules). No build step, no framework — pure static files served by a minimal Node.js server.

## Commands

- `npm start` — Start the Express server (default port 8080)
- `npm test` — Headless logic tests in `test/track.test.mjs`; run with `node test/track.test.mjs`
- `docker compose up -d` — Start MySQL + app containers

## Database (MySQL in Docker)

- `docker compose up -d db` — Start just the MySQL container
- Schema auto-loaded from `db/schema.sql` on first boot
- Tables: `users` (id, username, password_hash), `saves` (id, user_id, save_name, game_data JSON)
- Connection via `server/db.js` pool (env: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)

## Auth

- JWT-based: `server/auth.js` signs/verifies tokens, `authMiddleware` protects routes
- Endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- Save endpoints (auth required): `GET /api/saves`, `GET /api/saves/:name`, `POST /api/saves/:name`, `DELETE /api/saves/:name`
- Frontend: `js/auth.js` (API client + token storage), `js/auth-ui.js` (login/register modal)

## Architecture

### Entry Point
- `index.html` — DOM structure, HUD, toolbar, import map for `three`
- `js/main.js` — `Game` class orchestrates everything: renderer, input, game loop, save/load

### Core Systems (all receive a reference to `Game`)
| File | Responsibility |
|------|---------------|
| `js/config.js` | All tunable constants — physics, costs, grid limits, capacities, `COASTER_MODELS` |
| `js/track.js` | Track model: piece types, placement rules, path geometry |
| `js/trackmesh.js` | Instanced rail/tie/support meshes + ghost preview rendering (model-aware) |
| `js/train.js` | Train physics: gravity, friction, chain lift, banking, braking, scream triggers; model-specific car detail |
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
- Build track pieces (straight, left, right, up/chain, down, roll) on a grid
- Click any piece to select it (highlighted green); press 1-6 to replace its type (only if the exit signature matches), Delete to truncate from there, Esc to deselect
- Roll pieces carry a per-point roll angle in `path.rolls`; meshes and cars use rolled basis frames
- Choose a coaster model (Steel / Wooden / Hyper) — different visuals, friction, and top speed; saved with the game
- Complete a circuit back to the station to open the ride
- Train runs with gravity-driven physics; chain lifts pull uphill; riders scream on hill crests, steep drops, and fast rolls
- Guests spawn based on excitement rating, queue, board, pay tickets
- Economy: start with $5,000, pieces cost $40–$120, undo gives full refund
