// Vehicles: the car factory, one arcade Car class used by traffic, police and the
// player alike, and the traffic system that keeps Palmshade's roads alive.

import * as THREE from 'three';
import { CAR_MODELS, CITY, CITY_W, CITY_D } from './config.js';
import { pick, range, turnToward, angleDelta, clamp } from './random.js';
import { BLOCKS, collideBuildings, collideCircles } from './city.js';

const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xd23b2e });

// Build one low-poly car facing +z. Police cruisers get a light bar that flashes.
export function makeCarMesh(modelKey, colorHex, isPolice = false) {
  const spec = CAR_MODELS[modelKey];
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: colorHex });
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.width, spec.height * 0.62, spec.length), paint);
  body.position.y = 0.34 + spec.height * 0.31; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.84, spec.height * 0.52, spec.length * 0.44), glassMat);
  cabin.position.set(0, 0.34 + spec.height * 0.85, -spec.length * 0.04); cabin.castShadow = true; g.add(cabin);
  if (modelKey === 'hauler') { // open bed behind the cab
    const bed = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.92, spec.height * 0.3, spec.length * 0.3), paint);
    bed.position.set(0, 0.34 + spec.height * 0.45, spec.length * 0.3); g.add(bed);
  }
  if (modelKey === 'solstice') { // rear wing
    const wing = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.9, 0.08, 0.4), tyreMat);
    wing.position.set(0, 0.34 + spec.height + 0.18, -spec.length * 0.46); g.add(wing);
  }
  if (isPolice) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(spec.width + 0.04, spec.height * 0.3, spec.length * 0.5),
      new THREE.MeshLambertMaterial({ color: 0x1d3a5f }));
    stripe.position.set(0, 0.34 + spec.height * 0.3, 0); g.add(stripe);
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    red.position.set(-0.3, 0, 0); bar.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0x2a5aff }));
    blue.position.set(0.3, 0, 0); bar.add(blue);
    bar.position.set(0, 0.34 + spec.height * 1.2, -spec.length * 0.04); g.add(bar);
    g.userData.lightBar = { red, blue };
  }
  const hl = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.7, 0.14, 0.06), lightMat);
  hl.position.set(0, 0.52, spec.length / 2 + 0.02); g.add(hl);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.7, 0.12, 0.06), tailMat);
  tl.position.set(0, 0.56, -spec.length / 2 - 0.02); g.add(tl);
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.26, 10); wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [], frontWheels = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Mesh(wheelGeo, tyreMat);
    w.position.set(sx * (spec.width / 2 - 0.02), 0.35, sz * spec.length * 0.32);
    g.add(w); wheels.push(w); if (sz > 0) frontWheels.push(w);
  }
  g.userData.wheels = wheels; g.userData.frontWheels = frontWheels;
  return g;
}

let nextCarId = 1;
export class Car {
  constructor(scene, modelKey, colorHex, opts = {}) {
    this.id = nextCarId++;
    this.model = modelKey;
    this.spec = CAR_MODELS[modelKey];
    this.isPolice = !!opts.police;
    this.mesh = makeCarMesh(modelKey, colorHex, this.isPolice);
    this.heading = opts.heading || 0;
    this.velX = 0; this.velZ = 0;
    this.health = 100;
    this.driver = null; // 'traffic' | 'police' | 'player' | null (parked)
    this.steerVisual = 0;
    this.mesh.position.set(opts.x || 0, 0, opts.z || 0);
    scene.add(this.mesh);
    this.syncMesh(0);
  }
  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }
  get speed() { return Math.hypot(this.velX, this.velZ); }
  get forwardSpeed() { return this.velX * Math.sin(this.heading) + this.velZ * Math.cos(this.heading); }
  place(x, z, heading) { this.mesh.position.set(x, 0, z); this.heading = heading; this.velX = this.velZ = 0; this.syncMesh(0); }
  remove(scene) { scene.remove(this.mesh); }
  syncMesh(dt) {
    this.mesh.position.y = 0;
    this.mesh.rotation.y = this.heading;
    const spin = this.forwardSpeed * dt / 0.35;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
    for (const w of this.mesh.userData.frontWheels) w.rotation.y = this.steerVisual * 0.45;
    if (this.isPolice && this.mesh.userData.lightBar) {
      const phase = (performance.now() / 280) % 2 < 1;
      this.mesh.userData.lightBar.red.visible = phase;
      this.mesh.userData.lightBar.blue.visible = !phase;
    }
  }
  // Arcade drive step. input: { throttle -1..1, steer -1..1, handbrake bool }.
  // world: { colliders, circles, onCrash(intensity, x, z) }.
  drive(input, dt, world) {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const fSpeed = this.velX * fx + this.velZ * fz;
    const accel = input.throttle * this.spec.accel * (input.boost ? 1.35 : 1);
    this.velX += fx * accel * dt; this.velZ += fz * accel * dt;
    if (input.throttle < 0 && fSpeed > 1) { this.velX -= fx * 22 * dt; this.velZ -= fz * 22 * dt; } // braking
    const drag = input.handbrake ? 1.6 : 0.55;
    this.velX -= this.velX * drag * dt; this.velZ -= this.velZ * drag * dt;
    const top = this.spec.topSpeed * (input.boost ? 1.18 : 1);
    const sp = this.speed;
    if (sp > top) { const s = top / sp; this.velX *= s; this.velZ *= s; }
    if (Math.abs(fSpeed) > 0.4) {
      const dir = fSpeed >= 0 ? 1 : -1;
      this.heading += input.steer * 1.75 * clamp(Math.abs(fSpeed) / 7, 0, 1) * dir * dt;
      this.steerVisual += (input.steer - this.steerVisual) * Math.min(1, dt * 8);
    }
    // Grip: bleed off lateral velocity (less of it while handbraking = sliding).
    const nfx = Math.sin(this.heading), nfz = Math.cos(this.heading);
    const latX = this.velX - (this.velX * nfx + this.velZ * nfz) * nfx;
    const latZ = this.velZ - (this.velX * nfx + this.velZ * nfz) * nfz;
    const grip = input.handbrake ? 2.0 : 9.0;
    this.velX -= latX * Math.min(1, grip * dt); this.velZ -= latZ * Math.min(1, grip * dt);
    let nx = this.x + this.velX * dt, nz = this.z + this.velZ * dt;
    const before = this.speed;
    let [cx, cz, hitB] = collideBuildings(world.colliders, nx, nz, 1.7);
    let [px, pz, hitC] = collideCircles(world.circles, cx, cz, 1.2);
    nx = px; nz = pz;
    if (hitB || hitC) {
      const impact = before * (hitB ? 0.75 : 0.5);
      this.velX *= 0.25; this.velZ *= 0.25;
      if (impact > 3 && world.onCrash) world.onCrash(impact, nx, nz);
      this.health -= impact * 0.8;
    }
    // Keep cars on the island: the sea is a wall.
    nx = clamp(nx, -CITY_W / 2 - 14, CITY_W / 2 + CITY.beach + 26);
    nz = clamp(nz, -CITY_D / 2 - 14, CITY_D / 2 + 14);
    this.mesh.position.x = nx; this.mesh.position.z = nz;
    this.syncMesh(dt);
    return { crashed: hitB || hitC, speedBefore: before };
  }
}

// The rectangular lane loop around one block (right-hand traffic).
export function blockLoopWaypoints(block) {
  const o = CITY.road / 2 - 3.2;
  const x0 = block.x0 - o, x1 = block.x1 + o, z0 = block.z0 - o, z1 = block.z1 + o;
  return [[x0, z1], [x1, z1], [x1, z0], [x0, z0]];
}

export class TrafficSystem {
  constructor(scene, rng, world) {
    this.scene = scene; this.world = world; this.cars = [];
    const usedBlocks = new Set();
    for (let i = 0; i < 16; i++) {
      const block = pick(rng, BLOCKS);
      const model = pick(rng, ['vireo', 'kestrel', 'bronto', 'hauler', 'vireo', 'kestrel']);
      const car = new Car(scene, model, pick(rng, CAR_MODELS[model].colors), {});
      car.driver = 'traffic';
      const wps = blockLoopWaypoints(block);
      const wp = Math.floor(rng() * 4);
      car.place(wps[wp][0], wps[wp][1], 0);
      this.cars.push({ car, wps, wp: (wp + 1) % 4, cruise: range(rng, 8, 12.5) });
      usedBlocks.add(block.col + ',' + block.row);
    }
    // Parked cars along the curbs and in the marina lot: free for the taking.
    this.parked = [];
    const spots = [];
    for (let i = 0; i < 14; i++) {
      const b = pick(rng, BLOCKS);
      spots.push([b.cx + range(rng, -14, 14), b.z1 + CITY.road / 2 - 2.6, 0]);
      spots.push([b.cx + range(rng, -14, 14), b.z0 - CITY.road / 2 + 2.6, Math.PI]);
    }
    // Marina lot: a row of cars parked along the south curb of the docks road.
    for (let i = 0; i < 4; i++) spots.push([136 + i * 8, 144.6, 0]);
    // The gold Solstice GT the story needs, parked at the marina lot.
    const gt = new Car(scene, 'solstice', 0xd8a018, { x: 170, z: 144.6, heading: Math.PI / 2 });
    gt.driver = null; gt.isStoryCar = true; this.parked.push(gt);
    for (const [x, z, h] of spots) {
      const model = pick(rng, ['vireo', 'kestrel', 'bronto', 'hauler']);
      const c = new Car(scene, model, pick(rng, CAR_MODELS[model].colors), { x, z, heading: h + Math.PI / 2 });
      c.driver = null; this.parked.push(c);
    }
  }
  // Remove a car from traffic because the player just took it; returns the car.
  takeCar(car) {
    const i = this.cars.findIndex((t) => t.car === car);
    if (i >= 0) this.cars.splice(i, 1);
    const j = this.parked.indexOf(car);
    if (j >= 0) this.parked.splice(j, 1);
    return car;
  }
  releaseCar(car, rng) { // a car the player abandoned rejoins the parked pool
    car.driver = null; this.parked.push(car);
  }
  update(dt, focus) {
    for (const t of this.cars) {
      const car = t.car;
      const [tx, tz] = t.wps[t.wp];
      const d = Math.hypot(tx - car.x, tz - car.z);
      if (d < 4.5) { t.wp = (t.wp + 1) % 4; continue; }
      const target = Math.atan2(tx - car.x, tz - car.z);
      car.heading = turnToward(car.heading, target, 1.9 * dt);
      let speed = t.cruise;
      // Slow for the car ahead and for the player standing in the road.
      for (const o of this.cars) {
        if (o === t) continue;
        const ahead = (o.car.x - car.x) * Math.sin(car.heading) + (o.car.z - car.z) * Math.cos(car.heading);
        const side = Math.abs((o.car.x - car.x) * Math.cos(car.heading) - (o.car.z - car.z) * Math.sin(car.heading));
        if (ahead > 0 && ahead < 8 && side < 2.2) speed = Math.min(speed, o.car.forwardSpeed * 0.9);
      }
      if (focus) {
        const ahead = (focus.x - car.x) * Math.sin(car.heading) + (focus.z - car.z) * Math.cos(car.heading);
        const side = Math.abs((focus.x - car.x) * Math.cos(car.heading) - (focus.z - car.z) * Math.sin(car.heading));
        if (ahead > 0 && ahead < 6.5 && side < 2) speed = 0;
      }
      const cur = car.forwardSpeed;
      const accel = speed > cur ? 6 : 18;
      const ns = cur + clamp(speed - cur, -accel * dt, accel * dt);
      car.velX = Math.sin(car.heading) * ns; car.velZ = Math.cos(car.heading) * ns;
      car.mesh.position.x += car.velX * dt; car.mesh.position.z += car.velZ * dt;
      car.steerVisual = clamp(angleDelta(car.heading, target) * 1.4, -1, 1);
      car.syncMesh(dt);
    }
  }
}
