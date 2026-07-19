# Coaster Tycoon 3D

A browser-based 3D roller-coaster tycoon game. Build your own coaster track piece by piece, open the ride, and earn ticket money from guests.

## Quick Start

```bash
npm install
npm start
```

Then open `http://localhost:3000` in your browser.

## How to Play

1. **Build** — Select a track piece from the toolbar and click on the grid to place it. Pieces must connect back to the station to form a complete circuit.
2. **Open** — Once the circuit is complete, the ride opens automatically.
3. **Set Price** — Adjust the ticket price. Higher excitement = more guests, but price too high and they'll refuse.
4. **Earn** — Guests queue, board, and pay. Use earnings to expand your coaster.

### Controls

| Action | Input |
|--------|-------|
| Place track | Left click |
| Rotate camera | Right-click drag |
| Pan camera | Middle-click drag |
| Zoom | Scroll wheel |
| Undo last piece | Right click on piece / U key |
| Save | V key |
| Load | L key |

### Track Pieces

| Piece | Cost | Description |
|-------|------|-------------|
| Straight | $40 | Flat track segment |
| Left Turn | $50 | Curves left |
| Right Turn | $50 | Curves right |
| Up (Chain) | $70 | Climbs uphill with chain lift |
| Down | $40 | Drops downhill (gravity-powered) |

## Tech Stack

- **Three.js** — 3D rendering
- **Vanilla JavaScript (ES modules)** — No framework, no bundler
- **Node.js** — Minimal static file server
- **Web Audio API** — Procedural sound effects
- **localStorage** — Save/load game state

## Project Structure

```
├── index.html          # Entry point, HUD, import map
├── server.js           # Static file server
├── style.css           # HUD and toolbar styling
├── js/
│   ├── main.js         # Game orchestrator
│   ├── config.js       # All tunable constants
│   ├── track.js        # Track model and placement rules
│   ├── trackmesh.js    # 3D mesh generation
│   ├── train.js        # Train physics
│   ├── guests.js       # Guest AI
│   ├── scenery.js      # Environment rendering
│   ├── ui.js           # HUD and toolbar
│   └── audio.js        # Sound effects
└── test/
    └── track.test.mjs  # Headless logic tests
```

## Development

Run headless tests:

```bash
node test/track.test.mjs
```

## License

ISC
