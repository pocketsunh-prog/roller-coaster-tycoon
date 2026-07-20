import * as THREE from 'three';
import { CELL, STEP, GRID_RADIUS, MAX_LEVEL, COSTS, LOCKED_CELLS } from './config.js';

// Directions: 0=+X(E) 1=+Z(S) 2=-X(W) 3=-Z(N). Y is up.
export const DIRV = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const mod4 = d => ((d % 4) + 4) % 4;

// Rotate a local (x,z) offset by dir steps (each step maps +X toward +Z).
export function rot(dx, dz, dir) {
  let x = dx, z = dz;
  for (let i = 0; i < dir; i++) { const nx = -z, nz = x; x = nx; z = nz; }
  return [x, z];
}

const HALF_PI = Math.PI / 2;

// Piece definitions in local space: entry at origin, facing +X.
// point(t) -> [x, y, z], t in [0,1]
export const PIECES = {
  station: {
    cost: 0, chain: false, station: true,
    point: t => [CELL * t, 0, 0],
    exitOffset: [1, 0], exitDirDelta: 0, exitLevelDelta: 0,
  },
  straight: {
    cost: COSTS.straight, chain: false,
    point: t => [CELL * t, 0, 0],
    exitOffset: [1, 0], exitDirDelta: 0, exitLevelDelta: 0,
  },
  up: { // chain lift hill
    cost: COSTS.up, chain: true,
    point: t => [CELL * t, STEP * (1 - Math.cos(Math.PI * t)) / 2, 0],
    exitOffset: [1, 0], exitDirDelta: 0, exitLevelDelta: 1,
  },
  down: {
    cost: COSTS.down, chain: false,
    point: t => [CELL * t, -STEP * (1 - Math.cos(Math.PI * t)) / 2, 0],
    exitOffset: [1, 0], exitDirDelta: 0, exitLevelDelta: -1,
  },
  left: { // curves toward -Z
    cost: COSTS.left, chain: false,
    point: t => { const a = HALF_PI * t; return [CELL * Math.sin(a), 0, -(CELL - CELL * Math.cos(a))]; },
    exitOffset: [1, -1], exitDirDelta: 3, exitLevelDelta: 0,
  },
  right: { // curves toward +Z
    cost: COSTS.right, chain: false,
    point: t => { const a = HALF_PI * t; return [CELL * Math.sin(a), 0, CELL - CELL * Math.cos(a)]; },
    exitOffset: [1, 1], exitDirDelta: 1, exitLevelDelta: 0,
  },
  roll: { // barrel roll: flat, twists 360 degrees
    cost: COSTS.roll, chain: false,
    point: t => [CELL * t, 0, 0],
    roll: t => Math.PI * 2 * t,
    exitOffset: [1, 0], exitDirDelta: 0, exitLevelDelta: 0,
  },
};

const SAMPLES = { station: 6, straight: 6, up: 12, down: 12, left: 16, right: 16, roll: 24 };
const TWO_PI = Math.PI * 2;
const wrapAngle = a => a - Math.round(a / TWO_PI) * TWO_PI;

const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();
const _ro = { value: 0 };

export class Track {
  constructor() { this.reset(); }

  reset() {
    this.pieces = [{ type: 'station', gx: 0, gz: 0, dir: 0, level: 0 }];
    this.occupied = new Set(['0,0']);
    for (const c of LOCKED_CELLS) this.occupied.add(c[0] + ',' + c[1]);
    this.end = { gx: 1, gz: 0, dir: 0, level: 0 };
    this.complete = false;
    this.rebuildPath();
  }

  pieceExit(p) {
    const def = PIECES[p.type];
    const [ox, oz] = rot(def.exitOffset[0], def.exitOffset[1], p.dir);
    return {
      gx: p.gx + ox, gz: p.gz + oz,
      dir: mod4(p.dir + def.exitDirDelta),
      level: p.level + def.exitLevelDelta,
    };
  }

  canPlace(type) {
    const def = PIECES[type];
    if (!def || def.station) return { ok: false, reason: 'Unknown piece' };
    const e = this.end;
    if (Math.abs(e.gx) > GRID_RADIUS || Math.abs(e.gz) > GRID_RADIUS) return { ok: false, reason: 'Out of bounds' };
    if (e.level + def.exitLevelDelta < 0) return { ok: false, reason: 'Too low' };
    if (e.level + def.exitLevelDelta > MAX_LEVEL) return { ok: false, reason: 'Too high' };
    if (this.occupied.has(e.gx + ',' + e.gz)) return { ok: false, reason: 'Blocked' };
    return { ok: true };
  }

  place(type) {
    const chk = this.canPlace(type);
    if (!chk.ok) return chk;
    const p = { type, gx: this.end.gx, gz: this.end.gz, dir: this.end.dir, level: this.end.level };
    this.pieces.push(p);
    this.occupied.add(p.gx + ',' + p.gz);
    this.end = this.pieceExit(p);
    this.complete =
      this.end.gx === 0 && this.end.gz === 0 && this.end.dir === 0 && this.end.level === 0 &&
      this.pieces.length > 4;
    this.rebuildPath();
    return { ok: true, piece: p, complete: this.complete };
  }

  undo() {
    if (this.pieces.length <= 1) return null;
    const p = this.pieces.pop();
    this.occupied.delete(p.gx + ',' + p.gz);
    this.end = this.pieceExit(this.pieces[this.pieces.length - 1]);
    this.complete = false;
    this.rebuildPath();
    return p;
  }

  // --- Editing ------------------------------------------------------------

  canPlaceAfter(index) {
    if (index < 1 || index >= this.pieces.length) return false;
    if (!this.complete) return index === this.pieces.length - 1;
    return false;
  }

  // Replace a piece's type in place. Only allowed when the new type has the
  // same exit signature (offset + dir + level) so the rest of the track stays
  // connected. Returns { ok, costDiff } or { ok: false, reason }.
  replacePiece(index, type) {
    if (index < 1 || index >= this.pieces.length) return { ok: false, reason: 'Invalid piece' };
    const oldType = this.pieces[index].type;
    if (oldType === type) return { ok: false, reason: 'Same type' };
    const oldDef = PIECES[oldType];
    const newDef = PIECES[type];
    if (!newDef) return { ok: false, reason: 'Unknown piece' };
    if (
      newDef.exitOffset[0] !== oldDef.exitOffset[0] ||
      newDef.exitOffset[1] !== oldDef.exitOffset[1] ||
      newDef.exitDirDelta !== oldDef.exitDirDelta ||
      newDef.exitLevelDelta !== oldDef.exitLevelDelta
    ) {
      return { ok: false, reason: 'Changed shape — disconnects track' };
    }
    this.pieces[index] = { ...this.pieces[index], type };
    this.rebuildPath();
    return { ok: true, costDiff: newDef.cost - oldDef.cost };
  }

  // Delete a piece and everything after it (truncate the track here).
  // Returns the total cost of removed pieces (for a refund).
  deletePiece(index) {
    if (index < 1 || index >= this.pieces.length) return 0;
    const removed = this.pieces.splice(index);
    for (const p of removed) this.occupied.delete(p.gx + ',' + p.gz);
    this.end = this.pieceExit(this.pieces[this.pieces.length - 1]);
    this.complete = false;
    this.rebuildPath();
    return removed.reduce((s, p) => s + PIECES[p.type].cost, 0);
  }

  // Bounds-check a replacement type against level limits (for UI hints).
  pieceLevelBounds(index) {
    const p = this.pieces[index];
    const lvl = p ? p.level : 0;
    const min = -lvl;            // cannot go below 0
    const max = MAX_LEVEL - lvl; // cannot exceed MAX_LEVEL
    return { min, max };
  }

  clear() {
    const refund = this.pieces.slice(1).reduce((s, p) => s + PIECES[p.type].cost, 0);
    this.reset();
    return refund;
  }

  serialize() {
    return this.pieces.map(p => ({ ...p }));
  }

  // Replace the track with saved pieces. Returns true on success.
  restore(pieces) {
    if (!Array.isArray(pieces) || pieces.length === 0 || pieces[0].type !== 'station') return false;
    this.reset();
    this.pieces = [];
    this.occupied.clear();
    for (const c of LOCKED_CELLS) this.occupied.add(c[0] + ',' + c[1]);
    for (const p of pieces) {
      if (!PIECES[p.type]) return false;
      this.pieces.push({ type: p.type, gx: p.gx | 0, gz: p.gz | 0, dir: mod4(p.dir), level: p.level | 0 });
      this.occupied.add((p.gx | 0) + ',' + (p.gz | 0));
    }
    this.end = this.pieceExit(this.pieces[this.pieces.length - 1]);
    this.complete =
      this.end.gx === 0 && this.end.gz === 0 && this.end.dir === 0 && this.end.level === 0 &&
      this.pieces.length > 4;
    this.rebuildPath();
    return true;
  }

  rebuildPath() {
    const pts = [];
    const rolls = [];
    const chainIdx = [];
    const pieceStart = []; // first sample index for each piece
    for (const p of this.pieces) {
      const def = PIECES[p.type];
      const n = SAMPLES[p.type];
      const rollFn = def.roll || (() => 0);
      const start = pts.length;
      pieceStart.push(start);
      for (let i = 0; i < n; i++) {
        const [lx, ly, lz] = def.point(i / n);
        const [wx, wz] = rot(lx, lz, p.dir);
        pts.push(new THREE.Vector3(p.gx * CELL + wx, p.level * STEP + ly, p.gz * CELL + wz));
        rolls.push(rollFn(i / n));
      }
      if (def.chain) chainIdx.push([start, pts.length - 1]);
    }
    const closed = this.complete;
    const N = pts.length;
    const segCount = closed ? N : Math.max(0, N - 1);
    const cum = new Float64Array(N + 1);
    const segLen = new Float64Array(segCount);
    let L = 0;
    for (let i = 0; i < segCount; i++) {
      const l = pts[i].distanceTo(pts[(i + 1) % N]);
      segLen[i] = l; cum[i] = L; L += l;
    }
    cum[segCount] = L;
    this.chainDist = chainIdx.map(([a, b]) => [cum[a], cum[Math.min(b + 1, segCount)]]);
    // Map each sample point to its piece index (for click selection)
    const pointPiece = new Int32Array(N);
    for (let pi = 0; pi < this.pieces.length; pi++) {
      const end = pi + 1 < pieceStart.length ? pieceStart[pi + 1] : N;
      for (let s = pieceStart[pi]; s < end; s++) pointPiece[s] = pi;
    }
    this.path = { pts, rolls, closed, segLen, cum, total: L, pointPiece, pieceStart };
    this._cursor = 0;
  }

  posAt(d, out = new THREE.Vector3(), tangent = null, rollObj = null) {
    const P = this.path, N = P.pts.length;
    if (N === 0) { out.set(0, 0, 0); if (tangent) tangent.set(1, 0, 0); if (rollObj) rollObj.value = 0; return out; }
    if (N === 1) { out.copy(P.pts[0]); if (tangent) tangent.set(1, 0, 0); if (rollObj) rollObj.value = 0; return out; }
    if (P.closed) d = ((d % P.total) + P.total) % P.total;
    else d = Math.max(0, Math.min(P.total - 1e-4, d));
    let i = this._cursor;
    if (i >= P.segLen.length || d < P.cum[i] || d >= P.cum[i + 1]) {
      i = 0;
      while (i < P.segLen.length - 1 && P.cum[i + 1] <= d) i++;
    }
    this._cursor = i;
    const a = P.pts[i], b = P.pts[(i + 1) % N];
    const l = P.segLen[i] || 1;
    const t = Math.max(0, Math.min(1, (d - P.cum[i]) / l));
    out.lerpVectors(a, b, t);
    if (tangent) tangent.subVectors(b, a).normalize();
    if (rollObj) rollObj.value = P.rolls[i] + wrapAngle(P.rolls[(i + 1) % N] - P.rolls[i]) * t;
    return out;
  }

  rollAt(d) {
    this.posAt(d, _tmpA, null, _ro);
    return _ro.value;
  }

  slopeAt(d) {
    const e = 0.4;
    const y1 = this.posAt(d - e, _tmpA).y;
    const y2 = this.posAt(d + e, _tmpB).y;
    return (y2 - y1) / (2 * e);
  }

  isOnChain(d) {
    const P = this.path;
    if (!P.total) return false;
    d = P.closed ? ((d % P.total) + P.total) % P.total : Math.max(0, Math.min(P.total, d));
    for (const [a, b] of this.chainDist) if (d >= a && d <= b) return true;
    return false;
  }

  // World-space points of a candidate piece at the current track end (for ghost preview)
  ghostPoints(type) {
    const def = PIECES[type];
    const e = this.end, n = SAMPLES[type] || 8;
    const arr = [];
    for (let i = 0; i <= n; i++) {
      const [lx, ly, lz] = def.point(i / n);
      const [wx, wz] = rot(lx, lz, e.dir);
      arr.push(new THREE.Vector3(e.gx * CELL + wx, e.level * STEP + ly, e.gz * CELL + wz));
    }
    return arr;
  }

  get stats() {
    let ups = 0, downs = 0, turns = 0;
    for (const p of this.pieces) {
      if (p.type === 'up') ups++;
      else if (p.type === 'down') downs++;
      else if (p.type === 'left' || p.type === 'right') turns++;
    }
    const n = this.pieces.length - 1;
    const excitement = Math.max(5, Math.min(95, Math.round(18 + n * 1.1 + ups * 2 + downs * 4 + turns * 1.5)));
    return { pieces: n, ups, downs, turns, excitement, length: this.path.total };
  }
}
