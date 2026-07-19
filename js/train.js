import * as THREE from 'three';
import {
  CELL, CAR_COUNT, CAR_SPACING, SEATS_PER_CAR,
  GRAVITY, FRICTION, CHAIN_SPEED, LAUNCH_SPEED, MAX_SPEED,
  COASTER_MODELS, DEFAULT_MODEL,
} from './config.js';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _t1 = new THREE.Vector3();
const _t2 = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _side = new THREE.Vector3();
const _upv = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m4 = new THREE.Matrix4();
const _ro = { value: 0 };

function disposeGroup(g) {
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
}

export class Train {
  constructor(scene, model = COASTER_MODELS[DEFAULT_MODEL]) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.model = model;
    this.cars = [];
    this.seatHeads = [];
    this._buildCars();
    scene.add(this.group);
    this.track = null;
    this.onArrive = null;
    this.onDepart = null;
    this.onScream = null;
    this.reset(null);
  }

  _buildCars() {
    for (const car of this.cars) { this.group.remove(car); disposeGroup(car); }
    this.cars = [];
    this.seatHeads = [];
    const m = this.model;
    const trimMat = new THREE.MeshStandardMaterial({ color: m.trimColor, roughness: 0.5 });
    const barMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.5 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfe3ff, roughness: 0.1, metalness: 0.4 });
    for (let i = 0; i < CAR_COUNT; i++) {
      const car = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 0.55, 2.1),
        new THREE.MeshStandardMaterial({ color: m.carColors[i % m.carColors.length], roughness: 0.35, metalness: 0.2 })
      );
      body.position.y = 0.62;
      body.castShadow = true;
      car.add(body);
      // Chassis skirt
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.22, 1.9), trimMat);
      chassis.position.y = 0.32;
      car.add(chassis);
      // Nose cone
      const nose = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 0.5), trimMat);
      nose.position.set(0, 0.42, 1.15);
      car.add(nose);
      // Seat backs
      const seatBack = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.4, 0.12), trimMat);
      seatBack.position.set(0, 1.0, -0.62);
      car.add(seatBack);
      // Lap bar across the seats
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.05, 8), barMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 1.02, 0.18);
      car.add(bar);
      // Lead car: windshield + headlights
      if (i === 0) {
        const shield = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.34, 0.06), glassMat);
        shield.position.set(0, 1.05, 0.95);
        shield.rotation.x = -0.25;
        car.add(shield);
        for (const hx of [-0.4, 0.4]) {
          const lamp = new THREE.Mesh(
            new THREE.SphereGeometry(0.07, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xfff6c9, emissive: 0xffee99, emissiveIntensity: 0.9 })
          );
          lamp.position.set(hx, 0.55, 1.42);
          car.add(lamp);
        }
      }
      // Hyper: rear spoiler on the last car
      if (m.spoiler && i === CAR_COUNT - 1) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.35), trimMat);
        wing.position.set(0, 1.25, -1.0);
        car.add(wing);
        for (const sx of [-0.45, 0.45]) {
          const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), trimMat);
          strut.position.set(sx, 1.1, -1.0);
          car.add(strut);
        }
      }
      // Wheels
      const wg = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 10);
      const wm = new THREE.MeshStandardMaterial({ color: 0x1b1b1b });
      for (const wx of [-0.62, 0.62]) {
        for (const wz of [-0.7, 0.7]) {
          const w = new THREE.Mesh(wg, wm);
          w.rotation.z = Math.PI / 2;
          w.position.set(wx, 0.28, wz);
          car.add(w);
        }
      }
      // Rider heads
      for (let s = 0; s < SEATS_PER_CAR; s++) {
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0xf2c79b })
        );
        head.position.set(s === 0 ? -0.32 : 0.32, 1.14, -0.1);
        head.visible = false;
        car.add(head);
        this.seatHeads.push(head);
      }
      this.group.add(car);
      this.cars.push(car);
    }
  }

  rebuild(model) {
    this.model = model;
    this._buildCars();
    this.update(0);
  }

  reset(track) {
    this.track = track;
    this.dist = CELL / 2;
    this.speed = 0;
    this.state = 'parked'; // parked | boarding | running
    this.riders = 0;
    this.boardWait = 0;
    this.maxSpeed = 0;
    this._lapDone = false;
    this._roll = 0;
    this._prevSlope = 0;
    this._screamCooldown = 0;
    this.update(0);
  }

  get capacity() { return CAR_COUNT * SEATS_PER_CAR; }

  startBoarding() {
    if (this.track && this.track.complete) {
      this.state = 'boarding';
      this.boardWait = 0;
      this.dist = CELL / 2;
      this.speed = 0;
    }
  }

  depart() {
    if (this.state !== 'boarding' || !this.track.complete) return;
    this.state = 'running';
    this.speed = LAUNCH_SPEED;
    this._lapDone = false;
    if (this.onDepart) this.onDepart();
  }

  update(dt) {
    const track = this.track;
    if (!track || !track.path || track.path.pts.length < 2) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    if (this.state === 'running' && track.complete) {
      const slope = track.slopeAt(this.dist);
      const maxSpeed = this.model.maxSpeed || MAX_SPEED;
      this.speed += (-GRAVITY * slope - FRICTION * (this.model.frictionMul || 1) * this.speed) * dt;
      if (track.isOnChain(this.dist) && this.speed < CHAIN_SPEED) this.speed = CHAIN_SPEED;
      if (this.speed < 0.5) this.speed = 0.5;
      if (this.speed > maxSpeed) this.speed = maxSpeed;
      this.dist += this.speed * dt;
      const total = track.path.total;
      if (this.dist >= total) this.dist -= total;
      if (this.dist > CELL + 2) this._lapDone = true;
      if (this.speed > this.maxSpeed) this.maxSpeed = this.speed;

      // Scream when cresting a hill, plunging, or spinning through a roll
      this._screamCooldown -= dt;
      const cresting = this._prevSlope > 0.12 && slope < -0.05;
      const plunging = slope < -0.45 && this.speed > CHAIN_SPEED + 2;
      const spinning = Math.abs(track.rollAt(this.dist + 0.6) - track.rollAt(this.dist - 0.6)) > 1.2
        && this.speed > CHAIN_SPEED;
      if (this.riders > 0 && this._screamCooldown <= 0 && (cresting || plunging || spinning)) {
        this._screamCooldown = 1.8;
        if (this.onScream) this.onScream();
      }
      this._prevSlope = slope;

      // Brake into the station each lap
      if (this._lapDone && this.dist >= 0 && this.dist < CELL) {
        const mid = CELL / 2;
        const remain = mid - this.dist;
        if (remain <= 0.12) {
          this.dist = mid;
          this.speed = 0;
          this.state = 'boarding';
          this.boardWait = 0;
          if (this.onArrive) this.onArrive();
        } else {
          const target = Math.max(0.7, remain * 1.4);
          if (this.speed > target) this.speed = target;
        }
      }
    } else if (this.state === 'boarding') {
      this.boardWait += dt;
    }

    // Place cars along the path
    if (track.complete) {
      for (let i = 0; i < this.cars.length; i++) {
        this._placeCar(this.cars[i], this.dist - i * CAR_SPACING, dt);
      }
    } else {
      for (let i = 0; i < this.cars.length; i++) {
        this._placeCar(this.cars[i], Math.max(0.02, CELL / 2 - i * CAR_SPACING), dt, true);
      }
    }
    for (let s = 0; s < this.seatHeads.length; s++) {
      this.seatHeads[s].visible = s < this.riders;
    }
  }

  _placeCar(car, d, dt, clamped = false) {
    const track = this.track;
    const total = track.path.total;
    const dd = clamped || !track.complete
      ? Math.max(0.02, Math.min(total - 0.02, d))
      : ((d % total) + total) % total;
    const pos = track.posAt(dd, _v1, _t1, _ro);
    // Rolled frame: rotate side/up around the tangent by the track roll
    _side.crossVectors(_up, _t1).normalize();
    _upv.crossVectors(_t1, _side).normalize();
    if (_ro.value) {
      _q.setFromAxisAngle(_t1, _ro.value);
      _side.applyQuaternion(_q);
      _upv.applyQuaternion(_q);
    }
    pos.addScaledVector(_upv, 0.42);
    car.position.copy(pos);
    _m4.makeBasis(_side, _upv, _t1);
    car.quaternion.setFromRotationMatrix(_m4);

    // Banking: lean into curves proportional to v^2 * curvature
    if (dt > 0 && track.complete) {
      track.posAt(dd - 0.7, _v2, _t1);
      track.posAt(dd + 0.7, _v2, _t2);
      _axis.crossVectors(_t1, _t2);
      const curve = THREE.MathUtils.clamp(_axis.y, -0.5, 0.5);
      const target = THREE.MathUtils.clamp(-curve * this.speed * this.speed * 0.01, -0.5, 0.5);
      this._roll += (target - this._roll) * Math.min(1, dt * 6);
      car.rotateZ(this._roll);
    }
  }
}
