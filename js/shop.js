import * as THREE from 'three';

export const SHOP_POS = new THREE.Vector3(-8, 0, 15.4);
export const SHOP_STOP = new THREE.Vector3(-8, 0, 13.5); // where guests pause to buy

export function buildGiftShop() {
  const g = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 2.4, 2.6),
    new THREE.MeshLambertMaterial({ color: 0xf3e2c0 })
  );
  body.position.y = 1.2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(2.9, 1.2, 4),
    new THREE.MeshLambertMaterial({ color: 0xc0392b })
  );
  roof.position.y = 3.0;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);

  // Striped awning over the front (faces the path, -z side)
  const stripeColors = [0xd84545, 0xffffff];
  for (let i = 0; i < 6; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.06, 1.0),
      new THREE.MeshLambertMaterial({ color: stripeColors[i % 2] })
    );
    stripe.position.set(-1.5 + 0.6 * i + 0.3, 2.0, -1.75);
    stripe.rotation.x = 0.35;
    g.add(stripe);
  }

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.4, 0.08),
    new THREE.MeshLambertMaterial({ color: 0x6b4a2f })
  );
  door.position.set(0, 0.7, -1.32);
  g.add(door);

  const winMat = new THREE.MeshLambertMaterial({ color: 0x9fd4ff });
  for (const wx of [-1.1, 1.1]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.08), winMat);
    win.position.set(wx, 1.3, -1.32);
    g.add(win);
  }

  const signPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6),
    new THREE.MeshLambertMaterial({ color: 0x7a5230 })
  );
  signPost.position.set(2.4, 1.3, -1.2);
  g.add(signPost);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.7, 0.1),
    new THREE.MeshLambertMaterial({ color: 0xf1c40f })
  );
  sign.position.set(2.4, 2.4, -1.2);
  sign.castShadow = true;
  g.add(sign);

  g.position.copy(SHOP_POS);
  return g;
}

export function disposeGiftShop(shop) {
  shop.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
}
