import * as THREE from 'three';
import { CELL, GRID_RADIUS } from './config.js';

export function buildScenery(scene) {
  // Ground
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(170, 48),
    new THREE.MeshLambertMaterial({ color: 0x71bd5a })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Build grid
  const size = (GRID_RADIUS * 2 + 1) * CELL;
  const grid = new THREE.GridHelper(size, GRID_RADIUS * 2 + 1, 0x4f9140, 0x5aa345);
  grid.position.y = 0.02;
  grid.material.transparent = true;
  grid.material.opacity = 0.4;
  scene.add(grid);

  // Lights
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6a8f5a, 0.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.4);
  sun.position.set(60, 90, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -75;
  sun.shadow.camera.right = 75;
  sun.shadow.camera.top = 75;
  sun.shadow.camera.bottom = -75;
  sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // Sky + fog
  scene.background = new THREE.Color(0x9fd4ff);
  scene.fog = new THREE.Fog(0x9fd4ff, 130, 340);

  // Entrance path (west gate -> station) + queue pad
  const pathMat = new THREE.MeshLambertMaterial({ color: 0xdfd7c8 });
  const path1 = new THREE.Mesh(new THREE.BoxGeometry(36, 0.06, 2.4), pathMat);
  path1.position.set(-13.5, 0.03, 12);
  path1.receiveShadow = true;
  scene.add(path1);
  const path2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 10), pathMat);
  path2.position.set(3, 0.03, 7.5);
  path2.receiveShadow = true;
  scene.add(path2);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 10.5), pathMat);
  pad.position.set(3, 0.03, 7.4);
  pad.receiveShadow = true;
  scene.add(pad);

  // Gate arch
  const gateMat = new THREE.MeshStandardMaterial({ color: 0xd84545, roughness: 0.5 });
  for (const dz of [-1.6, 1.6]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.4, 0.5), gateMat);
    post.position.set(-30, 2.2, 12 + dz);
    post.castShadow = true;
    scene.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 4.4), new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.5 }));
  beam.position.set(-30, 4.6, 12);
  beam.castShadow = true;
  scene.add(beam);

  // Trees (instanced trunks + foliage)
  const treePositions = [];
  let guard = 0;
  while (treePositions.length < 90 && guard++ < 4000) {
    const a = Math.random() * Math.PI * 2;
    const r = 26 + Math.random() * 120;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z > 8 && z < 16 && x > -34 && x < 8) continue;  // keep path clear
    if (Math.abs(x) < 10 && Math.abs(z) < 10) continue; // keep station clear
    treePositions.push([x, z, 0.8 + Math.random() * 0.7]);
  }
  const dummy = new THREE.Object3D();
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.22, 0.32, 1.6, 6),
    new THREE.MeshLambertMaterial({ color: 0x7a5230 }),
    treePositions.length
  );
  const foliage = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.5, 3.4, 7),
    new THREE.MeshLambertMaterial({ color: 0x2e8b3a }),
    treePositions.length
  );
  treePositions.forEach(([x, z, s], i) => {
    dummy.position.set(x, 0.8 * s, z);
    dummy.scale.set(s, s, s);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, (1.6 + 1.7) * s * 0.9, z);
    dummy.updateMatrix();
    foliage.setMatrixAt(i, dummy.matrix);
  });
  trunks.castShadow = foliage.castShadow = true;
  scene.add(trunks, foliage);

  // Clouds
  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (let c = 0; c < 7; c++) {
    const cloud = new THREE.Group();
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(2.2 + Math.random() * 2, 10, 8), cloudMat);
      s.position.set(i * 2.6 - n, Math.random() * 1.2, Math.random() * 2 - 1);
      s.scale.y = 0.55;
      cloud.add(s);
    }
    cloud.position.set(Math.random() * 260 - 130, 34 + Math.random() * 16, Math.random() * 200 - 100);
    cloud.userData.speed = 0.5 + Math.random() * 0.8;
    scene.add(cloud);
    clouds.push(cloud);
  }
  return {
    clouds,
    update(dt) {
      for (const c of clouds) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 170) c.position.x = -170;
      }
    },
  };
}
