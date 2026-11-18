// The people of Palmshade: a shared low-poly person builder, and the pedestrian
// system — citizens strolling the sidewalks who flee danger and can be hurt.

import * as THREE from 'three';
import { BLOCKS, collideBuildings, groundYAt } from './city.js';
import { mulberry32, range, pick, turnToward, clamp } from './random.js';

const SKIN = [0xf2c79b, 0xc98d5e, 0x8a5a34, 0x6e4226, 0xffdbac];
const SHIRTS = [0xe2725b, 0x3f7fbf, 0xf0d060, 0x7db35e, 0xd86aa8, 0xe8e8ec, 0x5ec8c0, 0xb0503c, 0x7078c8];
const PANTS = [0x2e3a4a, 0x5a4632, 0x3c3c44, 0x746a58, 0x27351f];

// One stylised citizen. Parts are named so the walk cycle can swing them.
export function makePersonMesh(rng, opts = {}) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: opts.shirt ?? pick(rng, SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: opts.pants ?? pick(rng, PANTS) });
  const skin = new THREE.MeshLambertMaterial({ color: opts.skin ?? pick(rng, SKIN) });
  function limb(w, h, d, mat, x, y, z) {
    const geo = new THREE.BoxGeometry(w, h, d); geo.translate(0, -h / 2, 0);
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
  }
  const legL = limb(0.16, 0.52, 0.18, pants, -0.11, 0.54, 0);
  const legR = limb(0.16, 0.52, 0.18, pants, 0.11, 0.54, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.24), shirt);
  torso.position.y = 0.86; torso.castShadow = true; g.add(torso);
  const armL = limb(0.12, 0.5, 0.14, shirt, -0.3, 1.12, 0);
  const armR = limb(0.12, 0.5, 0.14, shirt, 0.3, 1.12, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.29, 0.27), skin);
  head.position.y = 1.32; head.castShadow = true; g.add(head);
  if (opts.cap) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.3), new THREE.MeshLambertMaterial({ color: opts.cap }));
    cap.position.y = 1.5; g.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.2), cap.material);
    brim.position.set(0, 1.47, 0.22); g.add(brim);
  }
  g.scale.setScalar(1.18);
  g.userData.parts = { legL, legR, armL, armR, torso, head };
  return g;
}

export function animatePerson(mesh, phase, runBlend) {
  const p = mesh.userData.parts, s = Math.sin(phase) * (0.45 + runBlend * 0.35);
  p.legL.rotation.x = s; p.legR.rotation.x = -s;
  p.armL.rotation.x = -s * 0.8; p.armR.rotation.x = s * 0.8;
}

function sidewalkLoop(block) {
  const i = 2.4;
  return [[block.x0 + i, block.z1 - i], [block.x1 - i, block.z1 - i], [block.x1 - i, block.z0 + i], [block.x0 + i, block.z0 + i]];
}

export class PedestrianSystem {
  constructor(scene) {
    this.scene = scene;
    this.rng = mulberry32(777);
    this.peds = [];
    for (let i = 0; i < 46; i++) this.spawnPed();
  }
  spawnPed() {
    const rng = this.rng;
    const block = pick(rng, BLOCKS);
    const mesh = makePersonMesh(rng);
    const wps = sidewalkLoop(block);
    const wp = Math.floor(rng() * 4);
    mesh.position.set(wps[wp][0], 0.18, wps[wp][1]);
    this.scene.add(mesh);
    this.peds.push({
      mesh, wps, wp: (wp + 1) % 4, dir: rng() < 0.5 ? 1 : -1,
      speed: range(rng, 1.1, 1.7), phase: rng() * 6, health: 100,
      state: 'walk', fleeX: 0, fleeZ: 0, fleeT: 0, downT: 0, heading: 0,
    });
  }
  // A driver bailing out of a car the player just took: appears at the door
  // and runs for it.
  ejectDriver(x, z) {
    const mesh = makePersonMesh(this.rng);
    mesh.position.set(x + 1.4, 0.18, z);
    this.scene.add(mesh);
    this.peds.push({
      mesh, wps: sidewalkLoop(BLOCKS[0]), wp: 1, dir: 1,
      speed: 1.4, phase: 0, health: 100,
      state: 'flee', fleeX: x, fleeZ: z, fleeT: 3.2, downT: 0, heading: 0,
    });
  }
  alertNearby(x, z, radius, except = null) {
    for (const p of this.peds) {
      if (p === except || p.state === 'down') continue;
      const d = Math.hypot(p.mesh.position.x - x, p.mesh.position.z - z);
      if (d < radius) { p.state = 'flee'; p.fleeX = x; p.fleeZ = z; p.fleeT = range(this.rng, 2.2, 3.6); }
    }
  }
  damage(ped, amount) {
    if (ped.state === 'down') return false;
    ped.health -= amount;
    if (ped.health <= 0) {
      ped.state = 'down'; ped.downT = 0;
      ped.mesh.rotation.x = -Math.PI / 2; ped.mesh.position.y = 0.25;
      return true;
    }
    ped.state = 'flee'; ped.fleeT = 2.5;
    return false;
  }
  nearest(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      const d = Math.hypot(p.mesh.position.x - x, p.mesh.position.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  update(dt, colliders) {
    for (const p of [...this.peds]) {
      const m = p.mesh;
      if (p.state === 'down') {
        p.downT += dt;
        if (p.downT > 6) { // the city quietly clears the pavement; a fresh citizen arrives
          this.scene.remove(m);
          const i = this.peds.indexOf(p); this.peds.splice(i, 1);
          this.spawnPed();
        }
        continue;
      }
      let tx, tz, speed = p.speed;
      if (p.state === 'flee') {
        p.fleeT -= dt;
        if (p.fleeT <= 0) p.state = 'walk';
        const away = Math.atan2(m.position.x - p.fleeX, m.position.z - p.fleeZ);
        tx = m.position.x + Math.sin(away) * 4; tz = m.position.z + Math.cos(away) * 4;
        speed = 3.6;
      } else {
        const w = p.wps[p.wp];
        tx = w[0]; tz = w[1];
        if (Math.hypot(tx - m.position.x, tz - m.position.z) < 0.8) {
          p.wp = (p.wp + p.dir + 4) % 4;
          continue;
        }
      }
      const target = Math.atan2(tx - m.position.x, tz - m.position.z);
      p.heading = turnToward(p.heading || 0, target, 6 * dt);
      let nx = m.position.x + Math.sin(p.heading) * speed * dt;
      let nz = m.position.z + Math.cos(p.heading) * speed * dt;
      [nx, nz] = collideBuildings(colliders, nx, nz, 0.4);
      m.position.x = nx; m.position.z = nz;
      m.position.y = groundYAt(nx, nz);
      m.rotation.y = p.heading;
      p.phase += dt * speed * 3.4;
      animatePerson(m, p.phase, p.state === 'flee' ? 1 : 0);
    }
  }
}
