// Headless logic test: circuit completion + train lap simulation.
// Run: node test/track.test.mjs
import * as THREE from 'three';
import { Track } from '../js/track.js';
import { Train } from '../js/train.js';
import { CELL, COASTER_MODELS, CAR_COUNT, COSTS } from '../js/config.js';

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log('  ok  -', msg);
  else { failures++; console.error('  FAIL -', msg); }
}

// Flat loop traced by hand: E along z=0, S column x=5, W row z=4,
// N column x=-7, then E along z=0 back into the station.
const FLAT_LOOP = [
  'straight', 'straight', 'straight', 'right',
  'straight', 'straight', 'right',
  'straight', 'straight', 'straight', 'straight', 'straight',
  'straight', 'straight', 'straight', 'straight', 'straight',
  'right',
  'straight', 'straight', 'right',
  'straight', 'straight', 'straight', 'straight', 'straight', 'straight',
];

// Same loop but with 2 chain-lift ups at the start and 2 downs at the end.
const HILL_LOOP = [
  'up', 'up', 'straight', 'right',
  'straight', 'straight', 'right',
  'straight', 'straight', 'straight', 'straight', 'straight',
  'straight', 'straight', 'straight', 'straight', 'straight',
  'right',
  'straight', 'straight', 'right',
  'down', 'down', 'straight', 'straight', 'straight', 'straight',
];

function buildLoop(seq, label) {
  const track = new Track();
  let last;
  for (const t of seq) {
    last = track.place(t);
    if (!last.ok) { failures++; console.error(`  FAIL - ${label}: rejected`, t, last.reason); return null; }
  }
  return track;
}

// --- 1. Circuit completion -------------------------------------------------
console.log('Circuit building:');
const track = buildLoop(FLAT_LOOP, 'flat');
assert(track && track.complete === true, 'flat circuit is complete (returned to station)');
assert(track && track.path.closed === true, 'path marked closed');

const pts = track.path.pts;
const start = pts[0];
assert(Math.abs(start.x) < 1e-6 && Math.abs(start.z) < 1e-6, 'path starts at station entry');
const lastPt = pts[pts.length - 1];
assert(lastPt.distanceTo(start) < CELL, 'last segment connects back toward start');
assert(track.path.total > 120, `path length sane (${track.path.total.toFixed(1)} units)`);

// --- 2. Rejections -----------------------------------------------------------
console.log('Placement validation:');
const t3 = new Track();
assert(t3.place('down').ok === false, 'cannot go down at level 0');
const t5 = new Track();
assert(t5.occupied.has('-3,2'), 'path cell (-3,2) is locked');
assert(t5.occupied.has('0,1'), 'queue cell (0,1) is locked');
// Building onto an occupied cell: after a full loop the end is the station cell.
const r = track.place('straight');
assert(r.ok === false, 'cannot extend a completed circuit onto the station');
// Undo refund flow
const t6 = new Track();
t6.place('straight');
const removed = t6.undo();
assert(removed && removed.type === 'straight' && t6.pieces.length === 1, 'undo removes last piece');

// --- 3. Train lap simulation ---------------------------------------------------
console.log('Train physics (flat lap):');
const scene = new THREE.Scene();
const train = new Train(scene);
train.reset(track);
train.startBoarding();
train.riders = 4;
train.depart();
assert(train.state === 'running', 'train departed');

let arrived = false;
train.onArrive = () => { arrived = true; };
let simTime = 0;
const dt = 1 / 60;
let nanGuard = false;
while (simTime < 240 && !arrived) {
  train.update(dt);
  simTime += dt;
  if (Number.isNaN(train.dist) || Number.isNaN(train.speed)) { nanGuard = true; break; }
}
assert(!nanGuard, 'no NaN in physics');
assert(arrived, `train completed lap and returned to station (${simTime.toFixed(1)}s simulated)`);
assert(train.state === 'boarding', 'train is boarding again after lap');
assert(train.maxSpeed > 5, `train reached decent speed (${train.maxSpeed.toFixed(1)})`);

// --- 4. Hilly circuit with chain lift -------------------------------------------
console.log('Hilly circuit:');
const hill = buildLoop(HILL_LOOP, 'hill');
assert(hill && hill.complete, 'hilly circuit completes at level 0');
const hillTrain = new Train(new THREE.Scene());
hillTrain.reset(hill);
hillTrain.startBoarding();
hillTrain.riders = 2;
hillTrain.depart();
let hArrived = false;
hillTrain.onArrive = () => { hArrived = true; };
simTime = 0;
while (simTime < 300 && !hArrived) { hillTrain.update(dt); simTime += dt; }
assert(hArrived, `hilly lap completed (${simTime.toFixed(1)}s)`);
assert(hillTrain.maxSpeed > 10, `hill train hit good speed (${hillTrain.maxSpeed.toFixed(1)})`);

// --- 4b. Model physics: hyper faster than wooden on the same hill ----------------
console.log('Coaster models:');
function lapMaxSpeed(modelId) {
  const t = new Train(new THREE.Scene(), COASTER_MODELS[modelId]);
  t.reset(hill);
  t.startBoarding();
  t.riders = 2;
  t.depart();
  let done = false;
  t.onArrive = () => { done = true; };
  let s = 0;
  while (s < 300 && !done) { t.update(dt); s += dt; }
  return { done, max: t.maxSpeed };
}
// --- 4c. Piece editing (select / replace / delete) ------------------------
console.log('Piece editing:');
const editTrack = buildLoop(FLAT_LOOP, 'edit');
// Straight and roll share the same exit signature -> can swap in place
const straightIdx = editTrack.pieces.findIndex(p => p.type === 'straight' && editTrack.pieces.indexOf(p) > 0);
assert(straightIdx > 0, 'found a straight piece to edit');
const repl = editTrack.replacePiece(straightIdx, 'roll');
assert(repl.ok === true && repl.costDiff === COSTS.roll - COSTS.straight, 'replace straight with roll (same exit shape)');
assert(editTrack.replacePiece(straightIdx, 'left').ok === false, 'cannot replace with a shape that disconnects the track');
// Invalid: changing station (index 0) is rejected
assert(editTrack.replacePiece(0, 'straight').ok === false, 'cannot edit the station piece');
// pointPiece maps segments back to pieces
assert(editTrack.path.pointPiece[editTrack.path.pieceStart[straightIdx]] === straightIdx, 'pointPiece maps sample to its piece');
// Delete a piece and everything after it
const before = editTrack.pieces.length;
const delIdx = Math.max(1, before - 3);
const refund = editTrack.deletePiece(delIdx);
assert(refund > 0, 'deleting pieces grants a refund');
assert(editTrack.pieces.length === delIdx, 'piece count truncated to delete index');
assert(editTrack.complete === false, 'truncated track is no longer complete');
// Cannot delete the station
assert(editTrack.deletePiece(0) === 0, 'cannot delete the station piece');

const hyper = lapMaxSpeed('hyper');
const wooden = lapMaxSpeed('wooden');
assert(hyper.done, 'hyper completed hilly lap');
assert(wooden.done, 'wooden completed hilly lap');
assert(hyper.max > wooden.max, `hyper (${hyper.max.toFixed(1)}) faster than wooden (${wooden.max.toFixed(1)})`);
const swapped = new Train(new THREE.Scene());
swapped.reset(hill);
swapped.rebuild(COASTER_MODELS.wooden);
assert(swapped.model === COASTER_MODELS.wooden && swapped.cars.length === CAR_COUNT, 'rebuild swaps model and keeps cars');

// --- 4c. Barrel roll piece -------------------------------------------------------
console.log('Barrel roll:');
const ROLL_LOOP = FLAT_LOOP.map(t => t === 'straight' ? t : t);
ROLL_LOOP[1] = 'roll'; // swap one flat straight for a roll
const rollTrack = buildLoop(ROLL_LOOP, 'roll');
assert(rollTrack && rollTrack.complete, 'circuit with roll piece completes');
// rollAt should sweep 0 -> 2pi across the roll piece, upside-down at the middle
const rollPiece = rollTrack.pieces[2]; // station, straight, then roll
assert(rollPiece.type === 'roll', 'third piece is the roll');
// Find path distance at the middle of the roll piece via its sample index
const rollMidDist = rollTrack.path.cum[12 + 12]; // station 6 + straight 6 + half of 24 roll samples
const midRoll = rollTrack.rollAt(rollMidDist);
assert(Math.abs(Math.abs(midRoll) - Math.PI) < 0.4, `upside-down mid-roll (roll=${midRoll.toFixed(2)})`);
assert(Math.abs(rollTrack.rollAt(rollTrack.path.cum[12])) < 0.01, 'upright at roll entry');
const rollTrain = new Train(new THREE.Scene());
rollTrain.reset(rollTrack);
rollTrain.startBoarding();
rollTrain.riders = 4;
rollTrain.depart();
let rArrived = false;
rollTrain.onArrive = () => { rArrived = true; };
simTime = 0;
while (simTime < 300 && !rArrived) { rollTrain.update(dt); simTime += dt; }
assert(rArrived, `train completed lap with roll (${simTime.toFixed(1)}s)`);

// --- 5. Save / load round trip ------------------------------------------------
console.log('Save / load:');
const saved = track.serialize();
const restored = new Track();
assert(restored.restore(saved) === true, 'restore accepts saved pieces');
assert(restored.complete === true, 'restored track still complete');
assert(Math.abs(restored.path.total - track.path.total) < 1e-6, 'restored path length matches');
assert(JSON.stringify(restored.serialize()) === JSON.stringify(saved), 'serialize -> restore -> serialize is stable');
assert(restored.restore('garbage') === false, 'restore rejects non-array');
assert(restored.restore([{ type: 'straight', gx: 0, gz: 0, dir: 0, level: 0 }]) === false, 'restore rejects missing station');

// --- 6. Open ride state machine ----------------------------------------------
console.log('Open ride:');
const openTrack = buildLoop(FLAT_LOOP, 'open');
// Simulate the Game.openRide() preconditions + state the UI status check relies on
assert(openTrack.complete === true, 'track complete so ride can open');
// rideOpen flag + train boarding state mirror Game.openRide / loop boarding logic
let rideOpen = false;
function openRide() {
  if (!openTrack.complete) return false;
  rideOpen = true;
  openTrain.startBoarding();
  return true;
}
const openTrain = new Train(new THREE.Scene());
openTrain.reset(openTrack);
assert(openRide() === true, 'openRide succeeds on complete track');
assert(rideOpen === true, 'rideOpen flag set after opening');
assert(openTrain.state === 'boarding', 'train is boarding after opening');
// UI status rule: complete && rideOpen => OPEN (not CLOSED)
const status = !openTrack.complete ? 'BUILDING' : rideOpen ? 'OPEN' : 'CLOSED';
assert(status === 'OPEN', 'status shows OPEN when ride is open');
// After a lap the train returns to boarding but ride stays open
openTrain.riders = 4;
openTrain.depart();
let oArrived = false;
openTrain.onArrive = () => { oArrived = true; };
simTime = 0;
while (simTime < 300 && !oArrived) { openTrain.update(1 / 60); simTime += 1 / 60; }
assert(oArrived, 'train completed lap while ride open');
assert(rideOpen === true, 'rideOpen still true after lap (ride stays open)');
assert(openTrain.state === 'boarding', 'train back to boarding for next load');

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
