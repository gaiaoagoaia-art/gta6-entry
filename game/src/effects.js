// Effects: one pooled particle system (sparks, smoke, pickups, muzzle smoke),
// screen shake and hit flashes. No textures, no files: points and additive sprites.

import * as THREE from 'three';

const MAX = 900;

export class Effects {
  constructor(scene) {
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX); // seconds remaining
    this.span = new Float32Array(MAX);
    this.head = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.55, vertexColors: true, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -50;
    this.shake = 0;
  }
  burst(x, y, z, hex, count, speed = 6, span = 0.6, up = 3) {
    const c = new THREE.Color(hex);
    for (let n = 0; n < count; n++) {
      const i = this.head; this.head = (this.head + 1) % MAX;
      const a = Math.random() * Math.PI * 2, r = Math.random() * speed;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = Math.cos(a) * r; this.vel[i * 3 + 1] = Math.random() * up; this.vel[i * 3 + 2] = Math.sin(a) * r;
      this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
      this.life[i] = this.span[i] = span * (0.5 + Math.random() * 0.7);
    }
  }
  sparks(x, y, z, big = false) { this.burst(x, y, z, 0xffc46b, big ? 26 : 12, big ? 9 : 6, 0.45, 2.5); }
  smoke(x, y, z) { this.burst(x, y, z, 0x555c63, 3, 1.2, 1.4, 2.2); }
  pickup(x, y, z) { this.burst(x, y, z, 0x7dff9a, 16, 3.5, 0.7, 4.5); }
  bloodlessPuff(x, y, z) { this.burst(x, y, z, 0xd8d3c3, 10, 3, 0.4, 2); } // dust, not gore
  addShake(amount) { this.shake = Math.min(0.6, this.shake + amount); }
  update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -50; continue; }
      this.vel[i * 3 + 1] -= 5.5 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.05) { this.pos[i * 3 + 1] = 0.05; this.vel[i * 3 + 1] = 0; }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    this.shake = Math.max(0, this.shake - dt * 1.6);
  }
  shakeOffset() {
    if (this.shake <= 0) return { x: 0, y: 0 };
    const s = this.shake;
    return { x: (Math.random() - 0.5) * s * 0.5, y: (Math.random() - 0.5) * s * 0.5 };
  }
}
