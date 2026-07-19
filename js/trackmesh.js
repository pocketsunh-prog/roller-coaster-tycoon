import * as THREE from 'three';
import { CELL, COASTER_MODELS, DEFAULT_MODEL } from './config.js';

export const GAUGE = 1.3;

const _dummy = new THREE.Object3D();
const _up = new THREE.Vector3(0, 1, 0);
const _tan = new THREE.Vector3();
const _side = new THREE.Vector3();
const _tmp = new THREE.Vector3();

// Build rails + ties + supports as instanced meshes from the track path.
export function buildTrackGroup(track, model = COASTER_MODELS[DEFAULT_MODEL]) {
  const group = new THREE.Group();
  const P = track.path, pts = P.pts, N = pts.length;
  if (N < 2) return group;
  const segCount = P.closed ? N : N - 1;

  // Collect tie placements (evenly spaced along the path)
  const tiePos = [];
  let acc = 0, nextTie = 0;
  for (let i = 0; i < segCount; i++) {
    const a = pts[i], b = pts[(i + 1) % N];
    const l = P.segLen[i];
    acc += l;
    while (acc >= nextTie) {
      const t = 1 - (acc - nextTie) / l;
      tiePos.push([a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, i]);
      nextTie += 0.9;
    }
  }
  // Supports
  const supportPos = [];
  for (let i = 4; i < N; i += 9) {
    if (pts[i].y > 0.9) supportPos.push(pts[i]);
  }

  // Rails (two per segment)
  const railGeo = new THREE.BoxGeometry(0.13, 0.16, 1);
  const railMat = new THREE.MeshStandardMaterial({ color: model.railColor, roughness: 0.4, metalness: 0.6 });
  const rails = new THREE.InstancedMesh(railGeo, railMat, segCount * 2);
  let idx = 0;
  for (let i = 0; i < segCount; i++) {
    const a = pts[i], b = pts[(i + 1) % N];
    _tan.subVectors(b, a);
    const l = _tan.length();
    _tan.normalize();
    _side.crossVectors(_up, _tan).normalize();
    for (const s of [-1, 1]) {
      _dummy.position.lerpVectors(a, b, 0.5).addScaledVector(_side, s * GAUGE / 2);
      _dummy.position.y += 0.14;
      _dummy.scale.set(1, 1, Math.max(0.01, l + 0.03));
      _dummy.lookAt(_tmp.copy(_dummy.position).add(_tan));
      _dummy.updateMatrix();
      rails.setMatrixAt(idx++, _dummy.matrix);
    }
  }
  rails.castShadow = true;
  group.add(rails);

  // Ties
  const [tw, th, td] = model.tieScale;
  const tieGeo = new THREE.BoxGeometry((GAUGE + 0.7) * tw, 0.09 * th, 0.42 * td);
  const tieMat = new THREE.MeshStandardMaterial({ color: model.tieColor, roughness: 0.8 });
  const ties = new THREE.InstancedMesh(tieGeo, tieMat, Math.max(1, tiePos.length));
  for (let k = 0; k < tiePos.length; k++) {
    const [x, y, z, si] = tiePos[k];
    const a = pts[si], b = pts[(si + 1) % N];
    _tan.subVectors(b, a).normalize();
    _dummy.position.set(x, y + 0.02, z);
    _dummy.scale.set(1, 1, 1);
    _dummy.lookAt(_tmp.set(x + _tan.x, y + _tan.y, z + _tan.z));
    _dummy.updateMatrix();
    ties.setMatrixAt(k, _dummy.matrix);
  }
  ties.count = tiePos.length;
  ties.castShadow = true;
  group.add(ties);

  // Supports
  if (supportPos.length) {
    const supGeo = model.supportShape === 'box'
      ? new THREE.BoxGeometry(0.34, 1, 0.34)
      : new THREE.CylinderGeometry(0.16, 0.2, 1, 8);
    const supMat = new THREE.MeshStandardMaterial({ color: model.supportColor, roughness: 0.7, metalness: 0.3 });
    const sups = new THREE.InstancedMesh(supGeo, supMat, supportPos.length);
    for (let k = 0; k < supportPos.length; k++) {
      const p = supportPos[k];
      _dummy.position.set(p.x, p.y / 2 - 0.05, p.z);
      _dummy.scale.set(1, p.y + 0.1, 1);
      _dummy.rotation.set(0, 0, 0);
      _dummy.updateMatrix();
      sups.setMatrixAt(k, _dummy.matrix);
    }
    sups.castShadow = true;
    group.add(sups);
  }
  return group;
}

// Station platform, posts and roof (static, at cell 0,0 facing +X)
export function buildStationMesh(model = COASTER_MODELS[DEFAULT_MODEL]) {
  const g = new THREE.Group();
  const platMat = new THREE.MeshStandardMaterial({ color: 0xc9a26b, roughness: 0.9 });
  for (const s of [-1, 1]) {
    const plat = new THREE.Mesh(new THREE.BoxGeometry(CELL, 0.5, 1.8), platMat);
    plat.position.set(CELL / 2, 0.25, s * (GAUGE / 2 + 1.05));
    plat.castShadow = plat.receiveShadow = true;
    g.add(plat);
  }
  const postMat = new THREE.MeshStandardMaterial({ color: model.supportColor, roughness: 0.6 });
  for (const px of [0.6, CELL - 0.6]) {
    for (const pz of [-2.3, 2.3]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.2, 8), postMat);
      post.position.set(px, 2.1, pz);
      post.castShadow = true;
      g.add(post);
    }
  }
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(CELL + 1.8, 0.25, 5.8),
    new THREE.MeshStandardMaterial({ color: model.railColor, roughness: 0.6 })
  );
  roof.position.set(CELL / 2, 4.35, 0);
  roof.castShadow = true;
  g.add(roof);
  return g;
}

// Semi-transparent preview ribbon for the piece about to be placed
export function buildGhostMesh(points, valid) {
  const w = GAUGE / 2 + 0.4;
  const verts = [], idxs = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const p2 = points[Math.min(i + 1, points.length - 1)];
    const p0 = points[Math.max(i - 1, 0)];
    const tan = new THREE.Vector3().subVectors(p2, p0).normalize();
    const side = new THREE.Vector3().crossVectors(up, tan).normalize();
    verts.push(
      p.x + side.x * w, p.y + 0.08, p.z + side.z * w,
      p.x - side.x * w, p.y + 0.08, p.z - side.z * w
    );
    if (i > 0) {
      const b = i * 2;
      idxs.push(b - 2, b - 1, b, b - 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idxs);
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({
    color: valid ? 0x35e08c : 0xe03535,
    transparent: true, opacity: 0.45,
    side: THREE.DoubleSide, depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}
