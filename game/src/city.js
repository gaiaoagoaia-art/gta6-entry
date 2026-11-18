// Palmshade itself: the block grid, roads, pastel towers, palms, streetlights,
// the beach and the bay, plus the named places the story uses.

import * as THREE from 'three';
import { CITY, PITCH, CITY_W, CITY_D, FACADE_COLORS } from './config.js';
import { mulberry32, range, pick } from './random.js';

// Road centre lines: vertical roads run north-south at these x positions.
export const ROAD_XS = [];
for (let i = 0; i <= CITY.cols; i++) ROAD_XS.push(-CITY_W / 2 + CITY.road / 2 + i * PITCH);
export const ROAD_ZS = [];
for (let i = 0; i <= CITY.rows; i++) ROAD_ZS.push(-CITY_D / 2 + CITY.road / 2 + i * PITCH);

// Building blocks between the roads: { cx, cz, x0, x1, z0, z1, col, row }.
export const BLOCKS = [];
for (let r = 0; r < CITY.rows; r++) {
  for (let c = 0; c < CITY.cols; c++) {
    const x0 = ROAD_XS[c] + CITY.road / 2, z0 = ROAD_ZS[r] + CITY.road / 2;
    BLOCKS.push({ col: c, row: r, x0, z0, x1: x0 + CITY.block, z1: z0 + CITY.block, cx: x0 + CITY.block / 2, cz: z0 + CITY.block / 2 });
  }
}
export function blockAt(col, row) { return BLOCKS[row * CITY.cols + col]; }

// Named places, each anchored to a block edge so missions can point at them.
const dinerBlock = blockAt(1, 2), docksBlock = blockAt(5, 4), marinaBlock = blockAt(4, 4);
const chopBlock = blockAt(0, 1), policeBlock = blockAt(3, 1), hotelBlock = blockAt(4, 0);
export const LOCATIONS = {
  diner:       { name: 'Coral Spoon Diner', x: dinerBlock.cx, z: dinerBlock.z1 + 5 },
  docks:       { name: 'Port Corvina Docks', x: docksBlock.cx + 10, z: docksBlock.z1 + 6 },
  marinaLot:   { name: 'Marina Hotel Lot', x: marinaBlock.cx, z: marinaBlock.z1 + 5 },
  hotel:       { name: 'Marina Hotel', x: hotelBlock.cx, z: hotelBlock.z0 - 5 },
  chopShop:    { name: "Manny's Chop Shop", x: chopBlock.x0 - 5, z: chopBlock.cz },
  police:      { name: 'Palmshade PD', x: policeBlock.cx, z: policeBlock.z0 - 5 },
  ferryPier:   { name: 'Old Ferry Pier', x: CITY_W / 2 + CITY.beach - 8, z: 20 },
  start:       { name: 'Harborview Corner', x: dinerBlock.cx - 14, z: dinerBlock.z1 + 5 },
};

export function groundYAt(x, z) {
  for (const b of BLOCKS) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return 0.18;
  return 0;
}
export function isOnRoad(x, z) {
  for (const rx of ROAD_XS) if (Math.abs(x - rx) < CITY.road / 2) return true;
  for (const rz of ROAD_ZS) if (Math.abs(z - rz) < CITY.road / 2) return true;
  return false;
}
export function randomRoadPoint(rng) {
  if (rng() < 0.5) return { x: pick(rng, ROAD_XS), z: range(rng, -CITY_D / 2, CITY_D / 2) };
  return { x: range(rng, -CITY_W / 2, CITY_W / 2), z: pick(rng, ROAD_ZS) };
}

// A canvas sign with the place's name, drawn by the game itself.
function makeSignTexture(text, bg, fg) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, 496, 112);
  g.fillStyle = fg; g.font = 'bold 52px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
function makeSign(text, bg, fg, w = 12) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4),
    new THREE.MeshBasicMaterial({ map: makeSignTexture(text, bg, fg), side: THREE.DoubleSide }));
  return m;
}

// Window grids: lit windows glow warm against the dusk.
function makeFacadeTextures() {
  const face = document.createElement('canvas'); face.width = 128; face.height = 256;
  const g = face.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 256);
  const glow = document.createElement('canvas'); glow.width = 128; glow.height = 256;
  const e = glow.getContext('2d');
  e.fillStyle = '#000000'; e.fillRect(0, 0, 128, 256);
  const rng = mulberry32(99);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 6; x++) {
    const wx = 8 + x * 20, wy = 8 + y * 15, lit = rng() < 0.55;
    g.fillStyle = lit ? '#8a97a5' : '#5d6a76'; g.fillRect(wx, wy, 12, 9);
    if (lit) { e.fillStyle = rng() < 0.7 ? '#ffca7a' : '#ffe9b0'; e.fillRect(wx, wy, 12, 9); }
  }
  const map = new THREE.CanvasTexture(face);
  const emissiveMap = new THREE.CanvasTexture(glow);
  return { map, emissiveMap };
}

function makeRoadTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#33373d'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 300; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  g.fillStyle = '#f5d76e'; g.fillRect(60, 0, 8, 44); g.fillRect(60, 84, 8, 44); // dashes along y
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function buildCity(scene) {
  const rng = mulberry32(20261117);
  const colliders = []; // building AABBs {x0,x1,z0,z1}
  const circles = [];   // palm / light-post circles {x,z,r}
  const group = new THREE.Group(); scene.add(group);

  // --- ground: land slab, sand rim, sea ---
  const landW = CITY_W + 40, landD = CITY_D + 40;
  const land = new THREE.Mesh(new THREE.BoxGeometry(landW + CITY.beach, 1, landD),
    new THREE.MeshLambertMaterial({ color: 0x8a8f7a }));
  land.position.set(CITY.beach / 2 - 6, -0.51, 0); land.receiveShadow = true; group.add(land);
  const sand = new THREE.Mesh(new THREE.BoxGeometry(CITY.beach + 30, 1.04, landD),
    new THREE.MeshLambertMaterial({ color: 0xe8cf9f }));
  sand.position.set(CITY_W / 2 + CITY.beach / 2 - 4, -0.5, 0); group.add(sand);
  const waterTexC = document.createElement('canvas'); waterTexC.width = waterTexC.height = 128;
  const wg = waterTexC.getContext('2d');
  wg.fillStyle = '#1d6f77'; wg.fillRect(0, 0, 128, 128);
  wg.strokeStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < 22; i++) { wg.beginPath(); const y = Math.random() * 128; wg.moveTo(Math.random() * 60, y); wg.lineTo(40 + Math.random() * 80, y); wg.stroke(); }
  const waterTex = new THREE.CanvasTexture(waterTexC);
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterTex.repeat.set(30, 30);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshLambertMaterial({ map: waterTex, color: 0x9fd8dc, transparent: true, opacity: 0.94 }));
  water.rotation.x = -Math.PI / 2; water.position.y = -0.35; group.add(water);

  // --- roads ---
  const roadTex = makeRoadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  function addRoad(cx, cz, w, d, alongZ) {
    const t = roadTex.clone(); t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, (alongZ ? d : w) / 16);
    if (!alongZ) t.rotation = Math.PI / 2, t.center.set(0.5, 0.5);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: t }));
    m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.02, cz); m.receiveShadow = true; group.add(m);
  }
  for (const rx of ROAD_XS) addRoad(rx, 0, CITY.road, CITY_D + 30, true);
  for (const rz of ROAD_ZS) addRoad(0, rz, CITY_W + 10, CITY.road, false);

  // --- sidewalks and buildings ---
  const slabGeo = new THREE.BoxGeometry(CITY.block + 1.5, 0.18, CITY.block + 1.5);
  const slabMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a3 });
  const slabs = new THREE.InstancedMesh(slabGeo, slabMat, BLOCKS.length);
  const dummy = new THREE.Object3D();
  BLOCKS.forEach((b, i) => {
    dummy.position.set(b.cx, 0.09, b.cz); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.updateMatrix(); slabs.setMatrixAt(i, dummy.matrix);
  });
  slabs.receiveShadow = true; group.add(slabs);

  const { map, emissiveMap } = makeFacadeTextures();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const buildings = []; // {x,z,w,d,h,color}
  for (const b of BLOCKS) {
    const centerBoost = 1 - Math.min(1, Math.hypot(b.cx, b.cz) / 260);
    const pattern = rng();
    const plots = pattern < 0.3 ? [[0, 0, 30, 30]]
      : pattern < 0.65 ? [[-11, 0, 19, 30], [11, 0, 19, 30]]
      : [[-11, -11, 19, 19], [11, -11, 19, 19], [-11, 11, 19, 19], [11, 11, 19, 19]];
    for (const [ox, oz, w, d] of plots) {
      const tall = plots.length === 1;
      const h = tall ? 26 + rng() * 30 * (0.4 + centerBoost) : 8 + rng() * 16 * (0.5 + centerBoost);
      buildings.push({ x: b.cx + ox, z: b.cz + oz, w, d, h, color: pick(rng, FACADE_COLORS) });
      colliders.push({ x0: b.cx + ox - w / 2, x1: b.cx + ox + w / 2, z0: b.cz + oz - d / 2, z1: b.cz + oz + d / 2 });
    }
  }
  const bMat = new THREE.MeshLambertMaterial({ map, emissiveMap, emissive: 0xffc37a, emissiveIntensity: 0.55 });
  const bMesh = new THREE.InstancedMesh(boxGeo, bMat, buildings.length);
  const roofMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.6, 1),
    new THREE.MeshLambertMaterial({ color: 0x4a423c }), buildings.length);
  const col = new THREE.Color();
  buildings.forEach((bd, i) => {
    dummy.position.set(bd.x, 0.18, bd.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(bd.w, bd.h, bd.d);
    dummy.updateMatrix(); bMesh.setMatrixAt(i, dummy.matrix);
    bMesh.setColorAt(i, col.setHex(bd.color));
    dummy.position.set(bd.x, 0.18 + bd.h, bd.z); dummy.scale.set(bd.w + 0.5, 1, bd.d + 0.5);
    dummy.updateMatrix(); roofMesh.setMatrixAt(i, dummy.matrix);
  });
  bMesh.castShadow = true; bMesh.receiveShadow = true; group.add(bMesh, roofMesh);

  // --- palms ---
  const palmSpots = [];
  for (let z = -CITY_D / 2 + 12; z < CITY_D / 2; z += 22) palmSpots.push([CITY_W / 2 + 16 + rng() * 8, z + range(rng, -4, 4)]);
  for (const b of BLOCKS) if (rng() < 0.8) palmSpots.push([b.x0 + 3, b.z0 + 3]), palmSpots.push([b.x1 - 3, b.z1 - 3]);
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 5.4, 5); trunkGeo.translate(0, 2.7, 0);
  const crownGeo = new THREE.ConeGeometry(2.6, 1.6, 7); crownGeo.translate(0, 5.6, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x8a6a4a }), palmSpots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: 0x3f7d3a }), palmSpots.length);
  palmSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 0, z); dummy.rotation.set(range(rng, -0.06, 0.06), rng() * 3, range(rng, -0.06, 0.06));
    const s = range(rng, 0.85, 1.25); dummy.scale.set(s, s, s); dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix); crowns.setMatrixAt(i, dummy.matrix);
    circles.push({ x, z, r: 0.45 });
  });
  trunks.castShadow = true; group.add(trunks, crowns);

  // --- streetlights ---
  const lightSpots = [];
  for (const rx of ROAD_XS) for (let z = -CITY_D / 2 + 18; z < CITY_D / 2; z += 48) lightSpots.push([rx + 7.4, z]);
  for (const rz of ROAD_ZS) for (let x = -CITY_W / 2 + 24; x < CITY_W / 2; x += 48) lightSpots.push([x, rz + 7.4]);
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.11, 6, 5); poleGeo.translate(0, 3, 0);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x3a3f45 }), lightSpots.length);
  const bulbGeo = new THREE.SphereGeometry(0.32, 6, 5); bulbGeo.translate(0, 6.05, 0);
  const bulbs = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), lightSpots.length);
  lightSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 0, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix); bulbs.setMatrixAt(i, dummy.matrix);
    circles.push({ x, z, r: 0.3 });
  });
  group.add(poles, bulbs);

  // --- landmark dressing: diner, police post, chop shop, marina pier + boats ---
  // Each landmark sits fully on its block, its signed face to the street.
  function addLandmark(block, side, w, h, d, color, signText, signBg, signFg) {
    const geo = side === 'west' ? new THREE.BoxGeometry(d, h, w) : new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
    let mx, mz;
    if (side === 'south') { mx = block.cx; mz = block.z1 - d / 2 - 0.6; }
    else if (side === 'north') { mx = block.cx; mz = block.z0 + d / 2 + 0.6; }
    else { mx = block.x0 + d / 2 + 0.6; mz = block.cz; }
    m.position.set(mx, h / 2, mz); m.castShadow = true; group.add(m);
    const bw = side === 'west' ? d : w, bd = side === 'west' ? w : d;
    colliders.push({ x0: mx - bw / 2, x1: mx + bw / 2, z0: mz - bd / 2, z1: mz + bd / 2 });
    const s = makeSign(signText, signBg, signFg, Math.min(w, 15));
    if (side === 'south') s.position.set(mx, h + 1.2, block.z1 + 0.15);
    else if (side === 'north') { s.position.set(mx, h + 1.2, block.z0 - 0.15); s.rotation.y = Math.PI; }
    else { s.position.set(block.x0 - 0.15, h + 1.2, mz); s.rotation.y = -Math.PI / 2; }
    group.add(s);
    return m;
  }
  addLandmark(dinerBlock, 'south', 20, 5, 10, 0xe2725b, 'CORAL SPOON', '#7a2d1d', '#ffd9a0');
  addLandmark(policeBlock, 'north', 22, 9, 12, 0xdfe3e6, 'PALMSHADE PD', '#1d3a5f', '#bcd6f5');
  addLandmark(chopBlock, 'west', 18, 6, 12, 0x707880, "MANNY'S", '#333333', '#ffb36b');
  addLandmark(hotelBlock, 'north', 26, 16, 12, 0xf0d9b5, 'MARINA HOTEL', '#5f431d', '#ffe9b0');
  const pier = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 46), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
  pier.position.set(CITY_W / 2 + CITY.beach + 12, 0.1, 20); group.add(pier);
  for (let i = 0; i < 5; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 8), new THREE.MeshLambertMaterial({ color: pick(rng, [0xe8e8ec, 0x3f7fbf, 0xc22e2e, 0xf0d9b5]) }));
    hull.position.y = 0.4; boat.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 1.1, 3), new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }));
    cab.position.set(0, 1.4, -0.6); boat.add(cab);
    boat.position.set(CITY_W / 2 + CITY.beach + 24 + (i % 2) * 9, 0, -30 + i * 17);
    boat.rotation.y = range(rng, -0.2, 0.2); group.add(boat);
  }

  return {
    colliders, circles,
    update(dt, t) {
      waterTex.offset.x = (t * 0.008) % 1; waterTex.offset.y = Math.sin(t * 0.1) * 0.01;
      water.position.y = -0.35 + Math.sin(t * 0.5) * 0.03;
    },
  };
}

// Resolve a circle (x, z, r) out of every building AABB; returns corrected [x, z] and hit flag.
export function collideBuildings(colliders, x, z, r) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.x0, Math.min(x, c.x1)), nz = Math.max(c.z0, Math.min(z, c.z1));
    const dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 1e-6) { const d = Math.sqrt(d2); x = nx + (dx / d) * r; z = nz + (dz / d) * r; }
      else { // centre inside the box: push out through the nearest face
        const pl = x - c.x0, pr = c.x1 - x, pt = z - c.z0, pb = c.z1 - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.x0 - r; else if (m === pr) x = c.x1 + r;
        else if (m === pt) z = c.z0 - r; else z = c.z1 + r;
      }
    }
  }
  return [x, z, hit];
}
export function collideCircles(circles, x, z, r) {
  let hit = false;
  for (const c of circles) {
    const dx = x - c.x, dz = z - c.z, rr = r + c.r, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); x = c.x + (dx / d) * rr; z = c.z + (dz / d) * rr; hit = true; }
  }
  return [x, z, hit];
}
