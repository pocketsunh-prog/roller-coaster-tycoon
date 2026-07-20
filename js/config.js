// Game constants
export const CELL = 6;          // grid cell size (world units)
export const STEP = 3;          // height change per slope piece
export const GRID_RADIUS = 18;  // buildable cells: -18..18
export const MAX_LEVEL = 30;

export const COSTS = { straight: 40, left: 60, right: 60, up: 70, down: 70, roll: 120 };
export const START_CASH = 500000;

// Train physics
export const GRAVITY = 22;
export const FRICTION = 0.015;
export const CHAIN_SPEED = 6;    // chain lift pull speed on 'up' pieces
export const LAUNCH_SPEED = 9;   // station launch speed
export const MAX_SPEED = 100;
export const CAR_COUNT = 12;
export const CAR_SPACING = 2.4;
export const SEATS_PER_CAR = 4;

// Guests
export const GUEST_CAP = 560;
export const QUEUE_CAP = 100;

// Coaster models: visuals + physics tweaks
export const COASTER_MODELS = {
  steel: {
    name: 'Steel', swatch: '#d84545',
    railColor: 0xd84545, tieColor: 0x8a8f98, supportColor: 0x6b7280,
    supportShape: 'cylinder', tieScale: [1, 1, 1],
    carColors: [0xe74c3c, 0xf1c40f, 0x3498db, 0x9b59b6, 0x2ecc71],
    trimColor: 0x222831, spoiler: false,
    frictionMul: 1, maxSpeed: MAX_SPEED,
  },
  wooden: {
    name: 'Wooden', swatch: '#8b5e34',
    railColor: 0x9aa3ad, tieColor: 0x7a5230, supportColor: 0x8b5e34,
    supportShape: 'box', tieScale: [1.25, 1.7, 1.35],
    carColors: [0x8b5e34, 0x9c6b3d, 0x7a5230, 0xa9713f, 0x8b5e34],
    trimColor: 0x5a3a1e, spoiler: false,
    frictionMul: 1.35, maxSpeed: MAX_SPEED - 6,
  },
  hyper: {
    name: 'Hyper', swatch: '#3f7fd9',
    railColor: 0x3f7fd9, tieColor: 0xd9e2ec, supportColor: 0xe8eef7,
    supportShape: 'cylinder', tieScale: [0.9, 0.8, 0.9],
    carColors: [0x2f6fd0, 0x3f7fd9, 0x2f6fd0, 0x3f7fd9, 0x2f6fd0],
    trimColor: 0x10141c, spoiler: true,
    frictionMul: 0.8, maxSpeed: MAX_SPEED + 8,
  },
};
export const DEFAULT_MODEL = 'steel';

// Cells reserved for the entrance path / queue (cannot build on)
export const LOCKED_CELLS = (() => {
  const cells = [];
  for (let x = -5; x <= 0; x++) cells.push([x, 2]); // path row
  cells.push([0, 1]);                                // queue column
  return cells;
})();
