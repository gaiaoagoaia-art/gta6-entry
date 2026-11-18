// Dario Marek, the player: an on-foot body with a walk cycle, health and a
// pistol, plus the third-person chase camera for both feet and wheels.

import * as THREE from 'three';
import { makePersonMesh, animatePerson } from './pedestrians.js';
import { collideBuildings, collideCircles, groundYAt } from './city.js';
import { mulberry32, clamp, lerp, turnToward, angleDelta } from './random.js';

export class Player {
  constructor(scene) {
    const rng = mulberry32(4242);
    this.mesh = makePersonMesh(rng, { shirt: 0x2a9d8f, pants: 0x2e3a4a, skin: 0xc98d5e, cap: 0xc22e2e });
    scene.add(this.mesh);
    this.heading = Math.PI; // facing the street
    this.health = 100;
    this.mode = 'foot'; // or 'car'
    this.car = null;
    this.walkPhase = 0;
    this.speedNow = 0;
    this.ammo = 30;
    this.dead = false;
  }
  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }
  place(x, z, heading = this.heading) {
    this.mesh.position.set(x, groundYAt(x, z), z);
    this.heading = heading; this.mesh.rotation.y = heading;
  }
  setVisible(v) { this.mesh.visible = v; }
  // Move on foot. moveX/moveZ are camera-relative axes in -1..1.
  updateFoot(dt, moveX, moveZ, camYaw, sprint, world) {
    const moving = Math.abs(moveX) > 0.01 || Math.abs(moveZ) > 0.01;
    const speed = sprint ? 8.6 : 5.4;
    if (moving) {
      const len = Math.hypot(moveX, moveZ) || 1;
      const mx = moveX / len, mz = moveZ / len;
      // Camera forward on the ground is (sin yaw, cos yaw); right is (-cos yaw, sin yaw).
      const wx = Math.sin(camYaw) * mz - Math.cos(camYaw) * mx;
      const wz = Math.cos(camYaw) * mz + Math.sin(camYaw) * mx;
      const target = Math.atan2(wx, wz);
      this.heading = turnToward(this.heading, target, 11 * dt);
      let nx = this.x + Math.sin(this.heading) * speed * dt;
      let nz = this.z + Math.cos(this.heading) * speed * dt;
      [nx, nz] = collideBuildings(world.colliders, nx, nz, 0.45);
      [nx, nz] = collideCircles(world.circles, nx, nz, 0.4);
      this.mesh.position.x = nx; this.mesh.position.z = nz;
      this.speedNow = speed;
      this.walkPhase += dt * speed * 2.1;
    } else this.speedNow = 0;
    this.mesh.position.y = groundYAt(this.x, this.z);
    this.mesh.rotation.y = this.heading;
    animatePerson(this.mesh, this.walkPhase, sprint ? 1 : 0);
    if (!moving) { // settle the limbs
      const p = this.mesh.userData.parts;
      for (const k of ['legL', 'legR', 'armL', 'armR']) p[k].rotation.x *= 0.8;
    }
  }
  hurt(amount) { this.health = Math.max(0, this.health - amount); return this.health <= 0; }
  heal(amount) { this.health = Math.min(100, this.health + amount); }
}

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI; this.pitch = 0.34;
    this.pos = new THREE.Vector3(0, 6, -12);
    this.orbitOffset = 0; // mouse-look offset while driving; decays back behind the car
  }
  applyMouse(dx, dy, inCar) {
    if (inCar) {
      this.orbitOffset -= dx * 0.0032;
      this.pitch = clamp(this.pitch + dy * 0.002, 0.08, 0.9);
    } else {
      this.yaw -= dx * 0.0034;
      this.pitch = clamp(this.pitch + dy * 0.0024, 0.02, 1.15);
    }
  }
  update(dt, target, mode, shake) {
    const cam = this.camera;
    let tx, ty, tz, lookX, lookY, lookZ, dist;
    if (mode === 'car') {
      const carHeading = target.heading;
      this.orbitOffset *= Math.pow(0.4, dt); // drift back behind the car
      const desiredYaw = carHeading + this.orbitOffset;
      let d = angleDelta(this.yaw, desiredYaw);
      this.yaw += d * Math.min(1, dt * 4.5);
      dist = 9.5 + Math.abs(target.forwardSpeed) * 0.14;
      tx = target.x; ty = 1.4; tz = target.z;
      lookX = tx + Math.sin(carHeading) * 7; lookZ = tz + Math.cos(carHeading) * 7; lookY = 1.6;
    } else {
      dist = 7.6;
      tx = target.x; ty = 1.7; tz = target.z;
      lookX = tx; lookY = ty; lookZ = tz;
    }
    const cx = tx - Math.sin(this.yaw) * Math.cos(this.pitch) * dist;
    const cz = tz - Math.cos(this.yaw) * Math.cos(this.pitch) * dist;
    const cy = ty + Math.sin(this.pitch) * dist + (mode === 'car' ? 1.1 : 0);
    const k = 1 - Math.exp(-dt * (mode === 'car' ? 7 : 10));
    this.pos.x = lerp(this.pos.x, cx, k);
    this.pos.y = lerp(this.pos.y, Math.max(cy, 0.8), k);
    this.pos.z = lerp(this.pos.z, cz, k);
    cam.position.set(this.pos.x + shake.x, this.pos.y + shake.y, this.pos.z);
    cam.lookAt(lookX, lookY, lookZ);
    const targetFov = mode === 'car' ? 62 + Math.abs(target.forwardSpeed) * 0.35 : 58;
    cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 3);
    cam.updateProjectionMatrix();
  }
}
