import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Track, PIECES } from './track.js';
import { buildTrackGroup, buildStationMesh, buildGhostMesh, buildSelectionMesh } from './trackmesh.js';
import { Train } from './train.js';
import { GuestSystem } from './guests.js';
import { buildScenery } from './scenery.js';
import { UI } from './ui.js';
import { sfx } from './audio.js';
import { START_CASH, COASTER_MODELS, DEFAULT_MODEL } from './config.js';

const PIECE_ORDER = ['straight', 'left', 'right', 'up', 'down', 'roll'];
const SAVE_KEY = 'coasterTycoonSave';

class Game {
  constructor() {
    // Renderer / scene / camera
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 600);
    this.camera.position.set(28, 22, 34);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(3, 2, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 140;
    this.controls.maxPolarAngle = 1.45;

    // Game state
    this.cash = START_CASH;
    this.price = 5;
    this.rideOpen = false;
    this.selected = 'straight';
    this.model = DEFAULT_MODEL;
    this.rides = 0;
    this.selectedPiece = -1;     // index of the piece being edited (-1 = none)
    this.selectionMesh = null;
    this._boardTimer = 0;
    this._departTimer = 0;

    // World
    this.track = new Track();
    this.scenery = buildScenery(this.scene);
    this.station = null;
    this.rebuildStation();

    this.trackGroup = null;
    this.ghost = null;
    this.rebuildTrackMesh();
    this.updateSelectionMesh();

    this.train = new Train(this.scene, COASTER_MODELS[this.model]);
    this.train.reset(this.track);
    this.train.onArrive = () => this.onTrainArrive();
    this.train.onDepart = () => { sfx.depart(); this.rides++; };
    this.train.onScream = () => sfx.scream(this.train.riders);

    this.guests = new GuestSystem(this.scene, this);
    this.ui = new UI(this);

    // Input
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('keydown', e => this.onKey(e));
    this._raycaster = new THREE.Raycaster();
    this._pointerDown = null;
    this.renderer.domElement.addEventListener('pointerdown', e => { this._pointerDown = [e.clientX, e.clientY]; });
    this.renderer.domElement.addEventListener('pointerup', e => this.onPointerUp(e));

    // Restore previous session if present
    if (this.hasSave()) this.load();

    this.clock = new THREE.Clock();
    this.updateGhost();
    this.loop();
  }

  // --- Building -----------------------------------------------------------

  tryPlace(type) {
    const chk = this.track.canPlace(type);
    if (!chk.ok) { this.ui.toast('Cannot build here: ' + chk.reason); sfx.error(); return; }
    const cost = PIECES[type].cost;
    if (this.cash < cost) { this.ui.toast('Not enough cash!'); sfx.error(); return; }
    this.selected = type;
    const res = this.track.place(type);
    this.cash -= cost;
    sfx.place();
    this.onTrackEdited();
    if (res.complete) {
      this.ui.toast('Circuit complete! Press "Open Ride" to start earning!');
      sfx.open();
    }
  }

  undo() {
    const p = this.track.undo();
    if (!p) { this.ui.toast('Nothing to undo'); return; }
    this.cash += PIECES[p.type].cost;
    sfx.undo();
    this.onTrackEdited();
  }

  clearAll() {
    if (this.track.pieces.length <= 1) return;
    this.cash += this.track.clear();
    sfx.undo();
    this.onTrackEdited();
    this.ui.toast('Track cleared (full refund)');
  }

  newGame() {
    if (this.rideOpen) this.closeRide();
    this.track.reset();
    this.cash = START_CASH;
    this.price = 5;
    this.rideOpen = false;
    this.model = DEFAULT_MODEL;
    this.rides = 0;
    this.selectedPiece = -1;
    this.guests.clearQueue();
    this.guests.guests.forEach(g => this.scene.remove(g.mesh));
    this.guests.guests.length = 0;
    this.guests.turnedAway = 0;
    this.guests.served = 0;
    this.train.rebuild(COASTER_MODELS[this.model]);
    this.train.reset(this.track);
    this.rebuildTrackMesh();
    this.rebuildStation();
    this.updateGhost();
    this.updateSelectionMesh();
    this.save(true);
    this.ui.toast('New game started!');
  }

  // Any structural change: close the ride, unload riders, reset the train
  onTrackEdited() {
    if (this.rideOpen) this.closeRide();
    if (this.train.riders > 0) this.guests.alight(this.train.riders);
    this.train.reset(this.track);
    this.selectedPiece = -1;
    this.rebuildTrackMesh();
    this.updateGhost();
    this.updateSelectionMesh();
    this.save(true); // autosave
  }

  rebuildTrackMesh() {
    if (this.trackGroup) {
      this.scene.remove(this.trackGroup);
      this.trackGroup.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    this.trackGroup = buildTrackGroup(this.track, COASTER_MODELS[this.model]);
    this._railsMesh = this.trackGroup.children.find(o => o.userData.isRails) || null;
    this.scene.add(this.trackGroup);
  }

  rebuildStation() {
    if (this.station) {
      this.scene.remove(this.station);
      this.station.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    this.station = buildStationMesh(COASTER_MODELS[this.model]);
    this.scene.add(this.station);
  }

  setModel(id) {
    if (!COASTER_MODELS[id] || id === this.model) return;
    this.model = id;
    this.train.rebuild(COASTER_MODELS[id]);
    this.rebuildTrackMesh();
    this.rebuildStation();
    this.ui.toast(COASTER_MODELS[id].name + ' coaster selected');
    sfx.place();
    this.save(true); // autosave
  }

  updateGhost() {
    if (this.ghost) {
      this.scene.remove(this.ghost);
      this.ghost.geometry.dispose();
      this.ghost.material.dispose();
      this.ghost = null;
    }
    if (this.track.complete) return;
    const valid = this.track.canPlace(this.selected).ok;
    this.ghost = buildGhostMesh(this.track.ghostPoints(this.selected), valid);
    this.scene.add(this.ghost);
  }

  // --- Piece selection / editing -----------------------------------------

  selectPiece(index) {
    if (index < 0 || index >= this.track.pieces.length) { this.clearSelection(); return; }
    this.selectedPiece = index;
    this.updateSelectionMesh();
    const p = this.track.pieces[index];
    this.ui.toast('Selected ' + p.type + ' (#' + index + ') — press 1-6 to change, Del to remove');
  }

  clearSelection() {
    this.selectedPiece = -1;
    this.updateSelectionMesh();
  }

  updateSelectionMesh() {
    if (this.selectionMesh) {
      this.scene.remove(this.selectionMesh);
      this.selectionMesh.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      this.selectionMesh = null;
    }
    if (this.selectedPiece >= 0 && this.track.pieces.length > 1) {
      this.selectionMesh = buildSelectionMesh(this.track, this.selectedPiece);
      this.scene.add(this.selectionMesh);
    }
  }

  replaceSelectedPiece(type) {
    if (this.selectedPiece < 0) { this.ui.toast('Click a piece to select it first'); sfx.error(); return; }
    const target = this.track.pieces[this.selectedPiece];
    if (target.type === type) return;
    const newDef = PIECES[type];
    const oldDef = PIECES[target.type];
    // Must keep the same exit signature or the rest of the track disconnects
    if (
      newDef.exitOffset[0] !== oldDef.exitOffset[0] ||
      newDef.exitOffset[1] !== oldDef.exitOffset[1] ||
      newDef.exitDirDelta !== oldDef.exitDirDelta ||
      newDef.exitLevelDelta !== oldDef.exitLevelDelta
    ) {
      this.ui.toast('That shape would disconnect the track'); sfx.error();
      return;
    }
    const costDiff = newDef.cost - oldDef.cost;
    if (costDiff > 0 && this.cash < costDiff) { this.ui.toast('Not enough cash!'); sfx.error(); return; }
    this.track.replacePiece(this.selectedPiece, type);
    this.cash -= costDiff;
    if (costDiff !== 0) sfx.cash();
    this.onTrackEdited();
    this.selectPiece(this.selectedPiece);
    this.ui.toast('Changed to ' + type);
  }

  deleteSelectedPiece() {
    if (this.selectedPiece < 0) { this.ui.toast('Click a piece to select it first'); sfx.error(); return; }
    const refund = this.track.deletePiece(this.selectedPiece);
    this.cash += refund;
    sfx.undo();
    this.onTrackEdited();
    this.ui.toast('Removed — $' + refund + ' refunded');
    this.clearSelection();
  }

  // --- Ride operation -----------------------------------------------------

  toggleOpen() {
    if (this.rideOpen) this.closeRide();
    else this.openRide();
    this.save(true); // autosave
  }

  openRide() {
    if (!this.track.complete) { this.ui.toast('Complete the circuit back to the station first!'); sfx.error(); return; }
    this.rideOpen = true;
    this.train.startBoarding();
    sfx.open();
    this.ui.toast('Ride is OPEN! Guests are coming!');
  }

  closeRide() {
    this.rideOpen = false;
    this.guests.clearQueue();
    this.ui.toast('Ride closed');
  }

  onTrainArrive() {
    this.guests.alight(this.train.riders);
    this.train.riders = 0;
    this.train.maxSpeed = 0;
  }

  onGuestBoarded() {
    this.train.riders++;
    this.cash += this.price;
    sfx.cash();
    this.train.boardWait = 0;
  }

  setPrice(delta) {
    this.price = Math.max(1, Math.min(20, this.price + delta));
  }

  // factor < 1 zooms in, > 1 zooms out
  zoom(factor) {
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    const len = THREE.MathUtils.clamp(
      dir.length() * factor,
      this.controls.minDistance,
      this.controls.maxDistance
    );
    dir.setLength(len);
    this.camera.position.copy(this.controls.target).add(dir);
  }

  zoomIn() { this.zoom(0.8); }
  zoomOut() { this.zoom(1.25); }

  // --- Save / Load --------------------------------------------------------

  save(silent = false) {
    const data = {
      version: 1,
      pieces: this.track.serialize(),
      cash: this.cash,
      price: this.price,
      rides: this.rides,
      rideOpen: this.rideOpen,
      model: this.model,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      if (!silent) { this.ui.toast('Game saved!'); sfx.cash(); }
    } catch {
      if (!silent) { this.ui.toast('Save failed'); sfx.error(); }
    }
  }

  load() {
    let data;
    try {
      data = JSON.parse(localStorage.getItem(SAVE_KEY));
    } catch {
      data = null;
    }
    if (!data || !data.pieces) { this.ui.toast('No save found'); sfx.error(); return false; }
    if (this.rideOpen) this.closeRide();
    if (!this.track.restore(data.pieces)) {
      this.track.reset();
      this.ui.toast('Save file corrupted'); sfx.error();
      return false;
    }
    this.cash = typeof data.cash === 'number' ? data.cash : START_CASH;
    this.price = Math.max(1, Math.min(20, data.price || 5));
    this.rides = data.rides || 0;
    this.model = COASTER_MODELS[data.model] ? data.model : DEFAULT_MODEL;
    this.train.rebuild(COASTER_MODELS[this.model]);
    this.train.reset(this.track);
    this.rebuildTrackMesh();
    this.rebuildStation();
    this.updateGhost();
    if (data.rideOpen && this.track.complete) this.openRide();
    this.ui.toast('Game loaded!');
    return true;
  }

  hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  }

  // --- Input ----------------------------------------------------------------

  onKey(e) {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') { this.clearSelection(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedPiece >= 0) {
      e.preventDefault();
      this.deleteSelectedPiece();
      return;
    }
    const i = ['1', '2', '3', '4', '5', '6'].indexOf(e.key);
    if (i >= 0) {
      if (this.selectedPiece >= 0) this.replaceSelectedPiece(PIECE_ORDER[i]);
      else this.tryPlace(PIECE_ORDER[i]);
      return;
    }
    switch (e.key.toLowerCase()) {
      case 'q': this.cycleSelection(-1); break;
      case 'e': this.cycleSelection(1); break;
      case 'enter': case 'b': this.tryPlace(this.selected); break;
      case 'u': this.undo(); break;
      case 'c': this.clearAll(); break;
      case 'o': this.toggleOpen(); break;
      case 'z': this.zoomIn(); break;
      case 'x': this.zoomOut(); break;
      case 'v': this.save(); break;
      case 'l': this.load(); break;
      case '-': this.setPrice(-1); break;
      case '=': case '+': this.setPrice(1); break;
    }
  }

  cycleSelection(dir) {
    const i = PIECE_ORDER.indexOf(this.selected);
    this.selected = PIECE_ORDER[(i + dir + PIECE_ORDER.length) % PIECE_ORDER.length];
    this.updateGhost();
  }

  onPointerUp(e) {
    if (!this._pointerDown) return;
    const moved = Math.hypot(e.clientX - this._pointerDown[0], e.clientY - this._pointerDown[1]);
    this._pointerDown = null;
    if (moved > 5) return; // it was a camera drag
    const ndc = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    this._raycaster.setFromCamera(ndc, this.camera);
    // 1) ghost placement
    if (this.ghost && this._raycaster.intersectObject(this.ghost).length > 0) {
      this.tryPlace(this.selected);
      return;
    }
    // 2) click a track piece to select it (only the rails carry segment ids)
    if (this._railsMesh) {
      const hits = this._raycaster.intersectObject(this._railsMesh);
      if (hits.length > 0) {
        const seg = Math.floor(hits[0].instanceId / 2);
        const pp = this.track.path.pointPiece;
        if (pp && seg >= 0 && seg < pp.length) { this.selectPiece(pp[seg]); return; }
      }
    }
    // 3) clicked empty space — deselect
    this.clearSelection();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // --- Main loop -------------------------------------------------------------

  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);

    // Boarding logic
    if (this.train.state === 'boarding' && this.rideOpen) {
      this._boardTimer -= dt;
      if (this.train.riders < this.train.capacity && this.guests.queue.length > 0) {
        if (this._boardTimer <= 0) {
          this.guests.boardOne();
          this._boardTimer = 0.45;
        }
      } else if (this.train.riders > 0 && this.train.boardWait > 3) {
        this.train.depart();
      }
    }

    this.train.update(dt);
    this.guests.update(dt);
    this.scenery.update(dt);

    // Ghost pulse
    if (this.ghost) {
      this.ghost.material.opacity = 0.35 + 0.15 * Math.sin(performance.now() * 0.005);
    }

    this.controls.update();
    this.ui.update();
    this.renderer.render(this.scene, this.camera);
  }
}

new Game();
