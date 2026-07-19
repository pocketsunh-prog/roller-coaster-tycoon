// Game constants
export const CELL = 6;          // grid cell size (world units)
export const STEP = 3;          // height change per slope piece
export const GRID_RADIUS = 18;  // buildable cells: -18..18
export const MAX_LEVEL = 7;

export const COSTS = { straight: 40, left: 60, right: 60, up: 70, down: 70 };
export const START_CASH = 5000;

// Train physics
export const GRAVITY = 22;
export const FRICTION = 0.015;
export const CHAIN_SPEED = 6;    // chain lift pull speed on 'up' pieces
export const LAUNCH_SPEED = 9;   // station launch speed
export const MAX_SPEED = 45;
export const CAR_COUNT = 4;
export const CAR_SPACING = 2.4;
export const SEATS_PER_CAR = 2;

// Guests
export const GUEST_CAP = 26;
export const QUEUE_CAP = 10;

// Cells reserved for the entrance path / queue (cannot build on)
export const LOCKED_CELLS = (() => {
  const cells = [];
  for (let x = -5; x <= 0; x++) cells.push([x, 2]); // path row
  cells.push([0, 1]);                                // queue column
  return cells;
})();
