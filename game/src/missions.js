// Missions and story: Rosa Delgado's chain of jobs for Dario, the golden
// objective marker, repeatable delivery errands once the story is told, and
// the cash / ammo / health pickups scattered over Palmshade.

import * as THREE from 'three';
import { LOCATIONS } from './city.js';
import { mulberry32, range, pick } from './random.js';

export const CHAIN = [
  {
    id: 'meet-rosa', title: 'Meet Rosa', pay: 0,
    brief: 'Rosa Delgado is waiting at the Coral Spoon diner. Go introduce yourself.',
    target: () => LOCATIONS.diner, needCar: false,
    done: 'Rosa: "Dario Marek, as I live and breathe. You drive, I pay, nobody asks questions. Deal?"',
  },
  {
    id: 'first-wheels', title: 'First Wheels', pay: 250, timed: 150,
    brief: 'Take the crate in any car and deliver it to the Marina Hotel, fast and un-dented.',
    target: () => LOCATIONS.hotel, needCar: true,
    done: 'Rosa: "Clean run. The hotel pays on time, and so do I. Keep the car."',
  },
  {
    id: 'harbor-run', title: 'Harbor Run', pay: 600, timed: 260, heatOnPickup: 2,
    brief: 'Collect a package at the Port Corvina docks, then lose it at Manny\'s Chop Shop.',
    target: () => LOCATIONS.docks, thenTarget: () => LOCATIONS.chopShop, needCar: false, thenNeedCar: true,
    done: 'Manny: "Whatever that was, it never existed. Rosa says you are family now."',
  },
  {
    id: 'borrowed-shine', title: 'Borrowed Shine', pay: 1200,
    brief: 'A gold Solstice GT is parked at the marina lot. Borrow it. Manny is expecting it.',
    target: () => LOCATIONS.marinaLot, thenTarget: () => LOCATIONS.chopShop, needCar: false, thenNeedCar: 'story',
    done: 'Manny: "Gold, unscratched, and the PD none the wiser. Beautiful work, Dario."',
  },
  {
    id: 'long-goodbye', title: 'The Long Goodbye', pay: 2500, heatOnPickup: 4,
    brief: 'Pick Rosa up at the diner and get her to the Old Ferry Pier. The whole PD will object.',
    target: () => LOCATIONS.diner, thenTarget: () => LOCATIONS.ferryPier, needCar: true, thenNeedCar: true,
    done: 'Rosa: "Palmshade is yours again, Dario. Do not waste it." — STORY COMPLETE',
  },
];

export class MissionSystem {
  constructor(scene, hooks) {
    this.hooks = hooks;
    this.index = 0; this.stage = 0; this.timer = 0; this.active = true;
    this.errand = null;
    // The golden marker: a beam of light, a ground ring and a bobbing chevron.
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 34, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 17; g.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3, 28),
      new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.25; g.add(ring); this.ring = ring;
    const chev = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffc93c }));
    chev.rotation.x = Math.PI; chev.position.y = 4.4; g.add(chev); this.chev = chev;
    scene.add(g); this.marker = g;
    this.refreshTarget();
  }
  get storyDone() { return this.index >= CHAIN.length; }
  currentDef() { return this.errand || CHAIN[this.index]; }
  currentTarget() {
    if (this.errand) return this.errand.stageErrand === 0 ? this.errand.from : this.errand.targetPos;
    const def = CHAIN[this.index]; if (!def) return null;
    return (this.stage === 1 && def.thenTarget) ? def.thenTarget() : def.target();
  }
  needCarNow() {
    if (this.errand) return true;
    const def = CHAIN[this.index]; if (!def) return false;
    return this.stage === 1 && def.thenTarget ? def.thenNeedCar : def.needCar;
  }
  refreshTarget() {
    const t = this.currentTarget();
    if (t) { this.marker.visible = true; this.marker.position.set(t.x, 0, t.z); }
    else this.marker.visible = false;
    const def = this.currentDef();
    this.timer = def && def.timed && !this.errand ? def.timed : (this.errand ? this.errand.timed : 0);
  }
  objectiveText(px, pz) {
    const def = this.currentDef(); if (!def) return null;
    const t = this.currentTarget(); if (!t) return null;
    const d = Math.round(Math.hypot(t.x - px, t.z - pz));
    let detail = def.brief;
    if (this.errand) detail = this.errand.brief;
    else if (this.index === 2 && this.stage === 0) detail = 'Collect the package at the Port Corvina docks.';
    else if (this.index === 2 && this.stage === 1) detail = 'Package aboard. Deliver it to Manny\'s Chop Shop.';
    else if (this.index === 3 && this.stage === 1) detail = 'You have the Solstice. Deliver it to Manny\'s Chop Shop.';
    else if (this.index === 4 && this.stage === 1) detail = 'Rosa is aboard. Reach the Old Ferry Pier — do not stop.';
    return { title: (this.errand ? 'Errand: ' : '') + def.title, detail, distance: d, targetName: t.name };
  }
  startErrand(rng) {
    const places = [LOCATIONS.diner, LOCATIONS.hotel, LOCATIONS.docks, LOCATIONS.chopShop, LOCATIONS.marinaLot, LOCATIONS.police];
    const from = pick(rng, places); let to = pick(rng, places);
    if (to === from) to = LOCATIONS.hotel;
    const dist = Math.hypot(to.x - from.x, to.z - from.z);
    this.errand = {
      title: 'City Errand', from, targetPos: to, pay: Math.round(60 + dist * 0.9),
      timed: Math.round(dist / 9) + 45,
      brief: `Pick up at ${from.name}, deliver to ${to.name}.`,
      stageErrand: 0,
    };
    this.marker.position.set(from.x, 0, from.z); this.marker.visible = true;
    this.timer = 0;
  }
  // ctx: { x, z, inCar, inStoryCar, wanted } — returns nothing; pays via hooks.
  update(dt, ctx, t) {
    this.ring.rotation.z = t * 0.8;
    this.chev.position.y = 4.4 + Math.sin(t * 2.4) * 0.5;
    if (this.errand) return this.updateErrand(dt, ctx);
    const def = CHAIN[this.index];
    if (!def) return;
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) { // out of time: Rosa reschedules, no hard fail state
        this.stage = 0; this.refreshTarget();
        this.hooks.toast('Out of time', 'Rosa reschedules the job. Head back and try again.');
        this.hooks.sound('fail');
        return;
      }
    }
    const target = this.currentTarget();
    const d = Math.hypot(target.x - ctx.x, target.z - ctx.z);
    if (d > 7) return;
    const need = this.needCarNow();
    if (need === true && !ctx.inCar) { this.hooks.hint('You need a car for this. Press E beside any car.'); return; }
    if (need === 'story' && !ctx.inStoryCar) { this.hooks.hint('This job needs the gold Solstice GT itself.'); return; }
    if (def.thenTarget && this.stage === 0) {
      this.stage = 1;
      if (def.heatOnPickup) this.hooks.forceWanted(def.heatOnPickup);
      if (def.timed) this.timer = def.timed;
      this.refreshTarget();
      this.hooks.toast(def.title, this.index === 4 ? 'Rosa is in. The PD is already rolling.' : 'Package collected. Move!');
      this.hooks.sound('pickup');
      return;
    }
    // Mission complete.
    this.hooks.pay(def.pay, def.title);
    this.hooks.toast(def.title + ' — complete', def.done);
    this.hooks.sound('done');
    this.index++; this.stage = 0;
    if (this.storyDone) { this.hooks.storyComplete(); this.startErrand(this.hooks.rng()); }
    else this.refreshTarget();
  }
  updateErrand(dt, ctx) {
    const e = this.errand;
    const target = e.stageErrand === 0 ? e.from : e.targetPos;
    this.marker.position.set(target.x, 0, target.z);
    if (e.stageErrand === 1 && this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) { this.errand = null; this.startErrand(this.hooks.rng()); this.hooks.toast('Errand lost', 'Too slow. A new errand is on the board.'); return; }
    }
    const d = Math.hypot(target.x - ctx.x, target.z - ctx.z);
    if (d > 7) return;
    if (!ctx.inCar) { this.hooks.hint('Errands are driving work. Bring a car.'); return; }
    if (e.stageErrand === 0) {
      e.stageErrand = 1; this.timer = e.timed;
      this.hooks.toast('Errand', 'Package aboard. Deliver it before the clock runs out.');
      this.hooks.sound('pickup');
    } else {
      this.hooks.pay(e.pay, 'City Errand');
      this.hooks.toast('Errand complete', `Paid $${e.pay}. Another fare is waiting.`);
      this.hooks.sound('done');
      this.errand = null; this.startErrand(this.hooks.rng());
    }
  }
  serialize() { return { index: this.index }; }
  restore(data) {
    this.index = Math.min(data.index || 0, CHAIN.length);
    this.stage = 0;
    if (this.storyDone) this.startErrand(this.hooks.rng()); else this.refreshTarget();
  }
}

// Cash briefcases, ammo crates and medkits, bobbing over the pavement.
const PICKUP_SPOTS = [
  ['cash', -152, -60], ['cash', -32, 40], ['cash', 88, -118], ['cash', 152, 60], ['cash', -92, 128],
  ['cash', 28, -142], ['cash', 205, 20], ['cash', -172, -128],
  ['ammo', -62, 96], ['ammo', 118, -28], ['ammo', 178, 148], ['ammo', -122, -8],
  ['health', -2, -62], ['health', 58, 122], ['health', -152, 66],
];
export class Pickups {
  constructor(scene) {
    this.items = [];
    const mats = {
      cash: new THREE.MeshLambertMaterial({ color: 0x2e7d46, emissive: 0x1d5c2e }),
      ammo: new THREE.MeshLambertMaterial({ color: 0xc96a1e, emissive: 0x6e3405 }),
      health: new THREE.MeshLambertMaterial({ color: 0xe8e8ec, emissive: 0x555560 }),
    };
    for (const [kind, x, z] of PICKUP_SPOTS) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.9), mats[kind]);
      m.position.set(x, 1, z); scene.add(m);
      let cross = null;
      if (kind === 'health') {
        cross = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.2), new THREE.MeshBasicMaterial({ color: 0xd23b2e }));
        cross.position.copy(m.position); scene.add(cross);
      }
      this.items.push({ kind, mesh: m, cross, x, z, taken: 0, phase: Math.random() * 6 });
    }
  }
  update(dt, t, px, pz, onTake) {
    for (const it of this.items) {
      if (it.taken > 0) { it.taken -= dt; it.mesh.visible = it.taken <= 0; if (it.cross) it.cross.visible = it.mesh.visible; continue; }
      it.mesh.rotation.y = t * 1.6 + it.phase;
      it.mesh.position.y = 1 + Math.sin(t * 2 + it.phase) * 0.18;
      if (it.cross) { it.cross.position.y = it.mesh.position.y; it.cross.rotation.y = it.mesh.rotation.y; }
      if (Math.hypot(it.x - px, it.z - pz) < 1.8) {
        it.taken = 45; it.mesh.visible = false; if (it.cross) it.cross.visible = false;
        onTake(it.kind, it.x, it.z);
      }
    }
  }
}
