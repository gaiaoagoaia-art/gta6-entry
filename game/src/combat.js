// Combat: a hitscan pistol with tracers and muzzle smoke, and a short-range
// punch. Targets are pedestrians and cars; every act is reported to the caller
// so the wanted system can answer for it.

import * as THREE from 'three';

export class Combat {
  constructor(scene, fx, sound) {
    this.scene = scene; this.fx = fx; this.sound = sound;
    this.tracers = [];
    const geo = new THREE.BoxGeometry(0.05, 0.05, 1);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 }));
      m.visible = false; scene.add(m);
      this.tracers.push({ mesh: m, life: 0 });
    }
    this.tracerIdx = 0;
  }
  drawTracer(from, to) {
    const t = this.tracers[this.tracerIdx]; this.tracerIdx = (this.tracerIdx + 1) % this.tracers.length;
    const len = from.distanceTo(to);
    t.mesh.visible = true; t.life = 0.07;
    t.mesh.position.copy(from).add(to).multiplyScalar(0.5);
    t.mesh.scale.set(1, 1, len);
    t.mesh.lookAt(to);
  }
  // Fire toward the camera aim. Returns { kind: 'ped'|'car'|null, killed, x, z }.
  shoot(player, camYaw, camPitch, peds, cars) {
    // Camera pitch is positive when the camera rides above the target, so the
    // aim direction pitches down by the same angle.
    const dir = new THREE.Vector3(
      Math.sin(camYaw) * Math.cos(camPitch), -Math.sin(camPitch), Math.cos(camYaw) * Math.cos(camPitch));
    const origin = new THREE.Vector3(player.x, 1.45, player.z);
    const gun = origin.clone().add(new THREE.Vector3(Math.sin(player.heading) * 0.4, 0.05, Math.cos(player.heading) * 0.4));
    this.sound.shot();
    this.fx.burst(gun.x, gun.y, gun.z, 0xffd9a0, 5, 2, 0.15, 0.5);
    let bestT = 60, hit = { kind: null, killed: false, x: origin.x + dir.x * 40, z: origin.z + dir.z * 40 };
    let bestPoint = origin.clone().add(dir.clone().multiplyScalar(40));
    for (const ped of peds.peds) {
      if (ped.state === 'down') continue;
      const c = new THREE.Vector3(ped.mesh.position.x, 1.0, ped.mesh.position.z);
      const t = c.clone().sub(origin).dot(dir);
      if (t < 1 || t > bestT) continue;
      const closest = origin.clone().add(dir.clone().multiplyScalar(t));
      if (closest.distanceTo(c) < 0.85) {
        bestT = t; bestPoint = c;
        hit = { kind: 'ped', ped, killed: false, x: c.x, z: c.z };
      }
    }
    for (const car of cars) {
      const c = new THREE.Vector3(car.x, 0.8, car.z);
      const t = c.clone().sub(origin).dot(dir);
      if (t < 2 || t > bestT) continue;
      const closest = origin.clone().add(dir.clone().multiplyScalar(t));
      if (closest.distanceTo(c) < 2.1) {
        bestT = t; bestPoint = closest;
        hit = { kind: 'car', car, killed: false, x: closest.x, z: closest.z };
      }
    }
    this.drawTracer(gun, bestPoint);
    if (hit.kind === 'ped') {
      hit.killed = peds.damage(hit.ped, 60);
      this.fx.bloodlessPuff(hit.x, 1.1, hit.z);
    } else if (hit.kind === 'car') {
      hit.car.health -= 14;
      this.fx.sparks(hit.x, 0.9, hit.z);
    }
    return hit;
  }
  // Swing at whatever stands in front of Dario. Returns the ped hit, or null.
  punch(player, peds) {
    const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
    for (const ped of peds.peds) {
      if (ped.state === 'down') continue;
      const dx = ped.mesh.position.x - player.x, dz = ped.mesh.position.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.9 && (dx * fx + dz * fz) / (d || 1) > 0.4) {
        const killed = peds.damage(ped, 45);
        ped.mesh.position.x += fx * 0.7; ped.mesh.position.z += fz * 0.7;
        this.sound.punch();
        this.fx.bloodlessPuff(ped.mesh.position.x, 1.1, ped.mesh.position.z);
        return { ped, killed };
      }
    }
    this.sound.punch();
    return null;
  }
  update(dt) {
    for (const t of this.tracers) {
      if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.mesh.visible = false; }
    }
  }
}
