// Headless logic test: circuit completion + train lap simulation.
// Run: node test/track.test.mjs
import * as THREE from 'three';
import { Track } from '../js/track.js';
import { Train } from '../js/train.js';
import { CELL } from '../js/config.js';

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

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
