import * as THREE from 'three';
import {
  CELL, CAR_COUNT, CAR_SPACING, SEATS_PER_CAR,
  GRAVITY, FRICTION, CHAIN_SPEED, LAUNCH_SPEED, MAX_SPEED,
} from './config.js';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _t1 = new THREE.Vector3();
const _t2 = new THREE.Vector3();
const _axis = new THREE.Vector3();

export class Train {
  constructor(scene) {
    this.group = new THREE.Group();
    this.cars = [];
    this.seatHeads = [];
    const bodyColors = [0xe74c3c, 0xf1c40f, 0x3498db, 0x9b59b6, 0x2ecc71];
    for (let i = 0; i < CAR_COUNT; i++) {
      const car = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 0.55, 2.1),
        new THREE.MeshStandardMaterial({ color: bodyColors[i % bodyColors.length], roughness: 0.35, metalness: 0.2 })
      );
      body.position.y = 0.62;
      body.castShadow = true;
      car.add(body);
      const nose = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.3, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.5 })
      );
      nose.position.set(0, 0.42, 1.15);
      car.add(nose);
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
      for (let s = 0; s < SEATS_PER_CAR; s++) {
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0xf2c79b })
        );
        head.position.set(s === 0 ? -0.32 : 0.32, 1.08, -0.1);
        head.visible = false;
        car.add(head);
        this.seatHeads.push(head);
      }
      this.group.add(car);
      this.cars.push(car);
    }
    scene.add(this.group);
    this.track = null;
    this.onArrive = null;
    this.onDepart = null;
    this.reset(null);
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
      this.speed += (-GRAVITY * slope - FRICTION * this.speed) * dt;
      if (track.isOnChain(this.dist) && this.speed < CHAIN_SPEED) this.speed = CHAIN_SPEED;
      if (this.speed < 0.5) this.speed = 0.5;
      if (this.speed > MAX_SPEED) this.speed = MAX_SPEED;
      this.dist += this.speed * dt;
      const total = track.path.total;
      if (this.dist >= total) this.dist -= total;
      if (this.dist > CELL + 2) this._lapDone = true;
      if (this.speed > this.maxSpeed) this.maxSpeed = this.speed;

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
    const pos = track.posAt(dd, _v1, _t1);
    pos.y += 0.42;
    car.position.copy(pos);
    car.lookAt(_v2.copy(pos).add(_t1));

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
