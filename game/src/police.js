// The Palmshade PD: a wanted level that rises with witnessed crime and fades
// when Dario breaks line of sight, and the cruisers that answer it.

import { Car } from './vehicles.js';
import { randomRoadPoint } from './city.js';
import { mulberry32, clamp, angleDelta } from './random.js';

// Crime weights, in stars. Each kind has its own short cooldown so one long
// crash cannot max the meter in a single frame.
const CRIMES = {
  theft: { stars: 1.0, cooldown: 1.5 },
  pedHit: { stars: 1.6, cooldown: 1.0 },
  pedDown: { stars: 2.0, cooldown: 1.0 },
  gunfire: { stars: 0.7, cooldown: 2.5 },
  copHit: { stars: 1.2, cooldown: 1.2 },
  property: { stars: 0.35, cooldown: 0.8 },
};

export class WantedSystem {
  constructor() {
    this.heat = 0; // float stars
    this.cooldowns = {};
    this.unseenTime = 0;
    this.seen = false;
  }
  get stars() { return Math.floor(this.heat + 0.0001); }
  report(kind) {
    const c = CRIMES[kind]; if (!c) return false;
    const now = performance.now() / 1000;
    if (this.cooldowns[kind] && now - this.cooldowns[kind] < c.cooldown) return false;
    this.cooldowns[kind] = now;
    this.heat = Math.min(5.6, this.heat + c.stars);
    return true;
  }
  forceStars(n) { this.heat = Math.max(this.heat, n); }
  clear() { this.heat = 0; this.unseenTime = 0; }
  update(dt, seenByPolice) {
    this.seen = seenByPolice;
    if (seenByPolice) this.unseenTime = 0;
    else {
      this.unseenTime += dt;
      if (this.unseenTime > 5 && this.heat > 0) this.heat = Math.max(0, this.heat - dt / 5.5);
    }
  }
}

export class PoliceSystem {
  constructor(scene, world, hooks) {
    this.scene = scene; this.world = world; this.hooks = hooks;
    this.rng = mulberry32(31337);
    this.cops = [];
    this.spawnTimer = 0;
  }
  desiredCount(stars) { return stars <= 0 ? 0 : Math.min(1 + stars, 6); }
  nearestDist(x, z) {
    let d = Infinity;
    for (const c of this.cops) d = Math.min(d, Math.hypot(c.x - x, c.z - z));
    return d;
  }
  anySees(x, z) {
    for (const c of this.cops) if (Math.hypot(c.x - x, c.z - z) < 55) return true;
    return false;
  }
  spawnCop(px, pz) {
    for (let tries = 0; tries < 8; tries++) {
      const p = randomRoadPoint(this.rng);
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d > 60 && d < 95) {
        const cop = new Car(this.scene, 'cruiser', 0xf2f2f2, { police: true, x: p.x, z: p.z, heading: this.rng() * 6.28 });
        cop.driver = 'police';
        this.cops.push(cop);
        return;
      }
    }
  }
  spawnCopAt(x, z, heading) {
    const cop = new Car(this.scene, 'cruiser', 0xf2f2f2, { police: true, x, z, heading });
    cop.driver = 'police';
    this.cops.push(cop);
    return cop;
  }
  clearAll() { for (const c of this.cops) c.remove(this.scene); this.cops = []; }
  // hooks: { onRam(intensity) } — police shove the player's car and take damage too.
  update(dt, wanted, target) {
    const want = this.desiredCount(wanted.stars);
    this.spawnTimer -= dt;
    if (this.cops.length < want && this.spawnTimer <= 0) { this.spawnCop(target.x, target.z); this.spawnTimer = 1.6; }
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const cop = this.cops[i];
      const d = Math.hypot(target.x - cop.x, target.z - cop.z);
      if ((wanted.stars === 0 && d > 90) || d > 170 || cop.health <= 0) {
        if (cop.health <= 0) this.hooks.onDisabled(cop);
        cop.remove(this.scene); this.cops.splice(i, 1); continue;
      }
      const targetAngle = Math.atan2(target.x - cop.x, target.z - cop.z);
      const steer = clamp(angleDelta(cop.heading, targetAngle) * 1.7, -1, 1);
      const speedCap = 0.8 + wanted.stars * 0.05;
      let throttle = 1;
      if (d < 7 && target.mode === 'foot') throttle = 0.15; // roll up on a fleeing suspect
      if (d < 3.2) throttle = -0.4;
      const res = cop.drive({ throttle, steer, handbrake: false, boost: false }, dt, this.world);
      // Ramming the player's car hurts both and shakes the chase.
      if (target.car && res.crashed) { /* building crash, handled by drive */ }
      if (target.car) {
        const cd = Math.hypot(target.car.x - cop.x, target.car.z - cop.z);
        if (cd < 3.4 && Math.abs(cop.forwardSpeed) > 4) {
          target.car.health -= 6 * dt * 4;
          cop.health -= 3 * dt * 4;
          this.hooks.onRam(cop);
        }
      }
    }
  }
}
