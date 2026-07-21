import * as THREE from 'three';
import { GUEST_CAP, QUEUE_CAP, SOUVENIR_CHANCE } from './config.js';
import { SHOP_STOP } from './shop.js';

const GATE = new THREE.Vector3(-30, 0, 12);
const CORNER = new THREE.Vector3(3, 0, 12);
const QUEUE_BASE = new THREE.Vector3(3, 0, 2.7);
const BOARD_POINT = new THREE.Vector3(3, 0, 1.7);
const EXIT_POINT = new THREE.Vector3(3, 0, -1.7);

export const queueSlot = i => new THREE.Vector3(QUEUE_BASE.x, 0, QUEUE_BASE.z + 0.95 * i);

const SKIN_TONES = [0xf2c79b, 0xe8b88a, 0xd9a066, 0xb07845, 0x8d5524];
const HAIR_COLORS = [0x2c222b, 0x4a3221, 0x7a5230, 0xb55239, 0xd8d8d8, 0xe6c477];
const HAT_COLORS = [0xd84545, 0x3f7fd9, 0x2ecc71, 0xf1c40f, 0xe67e22];

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function makeGuestMesh() {
  const g = new THREE.Group();
  const skin = new THREE.Color(pick(SKIN_TONES));
  const shirt = new THREE.Color().setHSL(Math.random(), 0.7, 0.55);
  const pants = new THREE.Color().setHSL(Math.random(), 0.4, 0.3);
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });

  // Legs (pivot at hip for swing)
  const legGeo = new THREE.BoxGeometry(0.13, 0.34, 0.13);
  legGeo.translate(0, -0.17, 0);
  const legMat = new THREE.MeshLambertMaterial({ color: pants });
  const legs = [];
  for (const lx of [-0.09, 0.09]) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, 0.36, 0);
    leg.castShadow = true;
    g.add(leg);
    legs.push(leg);
  }

  // Torso
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.28, 0.62, 8),
    new THREE.MeshLambertMaterial({ color: shirt })
  );
  body.position.y = 0.67;
  body.castShadow = true;
  g.add(body);

  // Arms (pivot at shoulder for swing)
  const armGeo = new THREE.CylinderGeometry(0.055, 0.05, 0.42, 6);
  armGeo.translate(0, -0.21, 0);
  const arms = [];
  for (const ax of [-0.3, 0.3]) {
    const arm = new THREE.Mesh(armGeo, new THREE.MeshLambertMaterial({ color: shirt }));
    arm.position.set(ax, 0.94, 0);
    arm.castShadow = true;
    g.add(arm);
    arms.push(arm);
  }

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), skinMat);
  head.position.y = 1.17;
  head.castShadow = true;
  g.add(head);

  // Hair or hat (some bald)
  const roll = Math.random();
  if (roll < 0.22) {
    const hatMat = new THREE.MeshLambertMaterial({ color: pick(HAT_COLORS) });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.04, 10), hatMat);
    brim.position.y = 1.32;
    g.add(brim);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), hatMat);
    cap.position.y = 1.32;
    g.add(cap);
  } else if (roll < 0.85) {
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.215, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2.2),
      new THREE.MeshLambertMaterial({ color: pick(HAIR_COLORS) })
    );
    hair.position.y = 1.2;
    g.add(hair);
  }

  return { group: g, arms, legs };
}

class Guest {
  constructor(scene, pos, state) {
    const parts = makeGuestMesh();
    this.mesh = parts.group;
    this.arms = parts.arms;
    this.legs = parts.legs;
    this.mesh.position.copy(pos);
    this.state = state; // entering | deciding | toQueue | queuing | boarding | exiting | toShop | shopping | leaving
    this.speed = 2.2 + Math.random() * 0.9;
    this.budget = 3 + Math.floor(Math.random() * 13); // $3..$15
    this.bob = Math.random() * 10;
    this.target = null;
    this.queueIndex = -1;
    this.dwell = 0;
    scene.add(this.mesh);
  }

  arrive() {
    if (!this.target) return true;
    const p = this.mesh.position;
    const dx = this.target.x - p.x, dz = this.target.z - p.z;
    return dx * dx + dz * dz < 0.04;
  }

  update(dt) {
    if (this.dwell > 0) { this.dwell -= dt; return; }
    if (!this.target) return;
    const p = this.mesh.position;
    const dx = this.target.x - p.x, dz = this.target.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-4) {
      const step = Math.min(d, this.speed * dt);
      p.x += (dx / d) * step;
      p.z += (dz / d) * step;
      this.mesh.rotation.y = Math.atan2(dx, dz);
    }
    this.bob += dt * 10;
    const swing = Math.sin(this.bob);
    p.y = Math.abs(swing) * 0.06;
    this.arms[0].rotation.x = swing * 0.7;
    this.arms[1].rotation.x = -swing * 0.7;
    this.legs[0].rotation.x = -swing * 0.8;
    this.legs[1].rotation.x = swing * 0.8;
  }
}

export class GuestSystem {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.guests = [];
    this.queue = [];
    this.spawnTimer = 1.5;
    this.turnedAway = 0;
    this.served = 0;
  }

  update(dt) {
    const g = this.game;
    // Spawning
    if (g.rideOpen && this.guests.length < GUEST_CAP) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const ex = g.track.stats.excitement;
        this.spawnTimer = Math.max(1.0, 3.5 - ex * 0.025);
        const guest = new Guest(this.scene, GATE, 'entering');
        guest.target = CORNER.clone();
        this.guests.push(guest);
      }
    }
    // Update + state transitions
    for (let i = this.guests.length - 1; i >= 0; i--) {
      const guest = this.guests[i];
      guest.update(dt);
      if (!guest.arrive()) continue;
      switch (guest.state) {
        case 'entering':
          if (guest.mesh.position.distanceTo(CORNER) < 0.5) {
            guest.state = 'deciding';
            guest.target = new THREE.Vector3(3, 0, 6); // stroll toward queue area
          } else {
            guest.target = CORNER.clone();
          }
          break;
        case 'deciding':
          if (!this.game.rideOpen || this.game.price > guest.budget || this.queue.length >= QUEUE_CAP) {
            if (this.game.rideOpen && this.game.price > guest.budget) this.turnedAway++;
            guest.state = 'leaving';
            guest.target = GATE.clone();
          } else {
            guest.queueIndex = this.queue.length;
            this.queue.push(guest);
            guest.state = 'toQueue';
            guest.target = queueSlot(guest.queueIndex);
          }
          break;
        case 'toQueue':
          guest.state = 'queuing';
          guest.target = null;
          break;
        case 'boarding':
          // Reached the train: hide and pay
          guest.mesh.visible = false;
          this._remove(guest, i);
          this.game.onGuestBoarded();
          break;
        case 'exiting':
          if (this.game.hasShop && Math.random() < SOUVENIR_CHANCE) {
            guest.state = 'toShop';
            guest.target = SHOP_STOP.clone();
          } else {
            guest.state = 'leaving';
            guest.target = GATE.clone();
          }
          break;
        case 'toShop':
          guest.state = 'shopping';
          guest.target = null;
          guest.dwell = 0.8;
          this.game.onSouvenirSale();
          break;
        case 'shopping':
          guest.state = 'leaving';
          guest.target = GATE.clone();
          break;
        case 'leaving':
          if (guest.mesh.position.distanceTo(GATE) < 0.5) this._remove(guest, i);
          else guest.target = GATE.clone();
          break;
      }
    }
  }

  // Called periodically while the train is boarding
  boardOne() {
    if (!this.queue.length) return false;
    const guest = this.queue.shift();
    guest.state = 'boarding';
    guest.target = BOARD_POINT.clone();
    this._compactQueue();
    return true;
  }

  alight(n) {
    for (let k = 0; k < n; k++) {
      const guest = new Guest(this.scene, EXIT_POINT, 'exiting');
      guest.target = new THREE.Vector3(CORNER.x, 0, CORNER.z);
      this.guests.push(guest);
      this.served++;
    }
  }

  clearQueue() {
    for (const guest of this.queue) {
      guest.state = 'leaving';
      guest.target = new THREE.Vector3(CORNER.x, 0, CORNER.z);
    }
    this.queue.length = 0;
  }

  _compactQueue() {
    this.queue.forEach((guest, i) => {
      guest.queueIndex = i;
      guest.state = 'toQueue';
      guest.target = queueSlot(i);
    });
  }

  _remove(guest, index) {
    this.scene.remove(guest.mesh);
    this.guests.splice(index !== undefined ? index : this.guests.indexOf(guest), 1);
  }
}
