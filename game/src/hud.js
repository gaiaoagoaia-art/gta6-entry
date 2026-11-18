// The HUD: cash, health, wanted stars, ammo and speed over the 3D view, the
// mission objective card, toasts, and the circular radar minimap that draws
// Palmshade's streets, the police and the golden objective.

import { ROAD_XS, ROAD_ZS, BLOCKS } from './city.js';
import { CITY_W, CITY_D, CITY } from './config.js';

export class Hud {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.cashEl = this.el('cash'); this.starsEl = this.el('stars');
    this.healthFill = this.el('healthfill'); this.ammoEl = this.el('ammo');
    this.speedEl = this.el('speed'); this.speedVal = this.el('speedval');
    this.objTitle = this.el('obj-title');
    this.objDetail = this.el('obj-detail'); this.objDist = this.el('obj-dist');
    this.timerEl = this.el('obj-timer'); this.toastEl = this.el('toast');
    this.toastTitle = this.el('toast-title'); this.toastBody = this.el('toast-body');
    this.hintEl = this.el('hint'); this.bustedWrap = this.el('busted');
    this.bustedFill = this.el('bustedfill'); this.carNameEl = this.el('carname');
    this.map = this.el('minimap').getContext('2d');
    this.toastUntil = 0; this.hintUntil = 0;
    this.lastCash = -1; this.lastStars = -1;
  }
  setCash(v) {
    if (v === this.lastCash) return;
    this.lastCash = v;
    this.cashEl.textContent = '$' + v.toLocaleString('en-US');
  }
  setStars(n) {
    if (n === this.lastStars) return;
    this.lastStars = n;
    this.starsEl.textContent = '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
    this.starsEl.classList.toggle('hot', n > 0);
  }
  setHealth(v) { this.healthFill.style.width = Math.max(0, Math.min(100, v)) + '%'; }
  setAmmo(n) { this.ammoEl.textContent = 'PISTOL · ' + n; }
  setSpeed(kmh, carName) {
    if (carName) { this.speedEl.style.display = 'block'; this.speedVal.textContent = Math.round(kmh) + ' km/h'; this.carNameEl.textContent = carName; }
    else this.speedEl.style.display = 'none';
  }
  setObjective(obj, timer) {
    if (!obj) { this.objTitle.textContent = 'Free roam'; this.objDetail.textContent = 'Palmshade is yours. Find work, or make some.'; this.objDist.textContent = ''; }
    else {
      this.objTitle.textContent = obj.title;
      this.objDetail.textContent = obj.detail;
      this.objDist.textContent = obj.targetName + ' · ' + obj.distance + ' m';
    }
    this.timerEl.textContent = timer > 0 ? Math.ceil(timer) + 's' : '';
    this.timerEl.classList.toggle('urgent', timer > 0 && timer < 20);
  }
  toast(title, body, ms = 5200) {
    this.toastTitle.textContent = title; this.toastBody.textContent = body;
    this.toastEl.classList.add('show');
    this.toastUntil = performance.now() + ms;
  }
  hint(text, ms = 2600) {
    this.hintEl.textContent = text;
    this.hintEl.classList.add('show');
    this.hintUntil = performance.now() + ms;
  }
  setBusted(ratio) {
    if (ratio === null) { this.bustedWrap.style.display = 'none'; return; }
    this.bustedWrap.style.display = 'block';
    this.bustedFill.style.width = Math.round(ratio * 100) + '%';
  }
  update() {
    const now = performance.now();
    if (this.toastUntil && now > this.toastUntil) { this.toastEl.classList.remove('show'); this.toastUntil = 0; }
    if (this.hintUntil && now > this.hintUntil) { this.hintEl.classList.remove('show'); this.hintUntil = 0; }
  }
  drawMinimap(px, pz, heading, cops, target, t) {
    const g = this.map, S = 176, C = S / 2, R = 120; // 120 m radar range
    const scale = C / R;
    const wx = (x) => C + (x - px) * scale, wz = (z) => C + (z - pz) * scale;
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath(); g.arc(C, C, C - 1, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#14424e'; g.fillRect(0, 0, S, S); // the bay
    g.fillStyle = '#3d4148';
    g.fillRect(wx(-CITY_W / 2 - 20), wz(-CITY_D / 2 - 20), (CITY_W + 40 + CITY.beach) * scale, (CITY_D + 40) * scale);
    g.fillStyle = '#e8cf9f';
    g.fillRect(wx(CITY_W / 2 - 4), wz(-CITY_D / 2 - 20), (CITY.beach + 34) * scale, (CITY_D + 40) * scale);
    g.fillStyle = '#565b52';
    for (const b of BLOCKS) g.fillRect(wx(b.x0), wz(b.z0), (b.x1 - b.x0) * scale, (b.z1 - b.z0) * scale);
    g.strokeStyle = '#22252a'; g.lineWidth = CITY.road * scale;
    g.beginPath();
    for (const rx of ROAD_XS) { g.moveTo(wx(rx), wz(-CITY_D / 2 - 20)); g.lineTo(wx(rx), wz(CITY_D / 2 + 20)); }
    for (const rz of ROAD_ZS) { g.moveTo(wx(-CITY_W / 2 - 20), wz(rz)); g.lineTo(wx(CITY_W / 2 + CITY.beach), wz(rz)); }
    g.stroke();
    // Police blips flash red and blue, like their light bars.
    for (const c of cops) {
      const x = wx(c.x), y = wz(c.z);
      if (x < -6 || x > S + 6 || y < -6 || y > S + 6) continue;
      g.fillStyle = (t * 2.4) % 2 < 1 ? '#ff4040' : '#4a7dff';
      g.beginPath(); g.arc(x, y, 3.4, 0, Math.PI * 2); g.fill();
    }
    // The golden objective, clamped to the rim when it is off-radar.
    if (target) {
      let x = wx(target.x), y = wz(target.z);
      const dx = x - C, dy = y - C, d = Math.hypot(dx, dy);
      if (d > C - 10) { x = C + (dx / d) * (C - 10); y = C + (dy / d) * (C - 10); }
      g.fillStyle = '#ffc93c';
      g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-4, -4, 8, 8); g.restore();
    }
    // Dario, a white arrow pointing where he faces. The radar is north-up
    // (world -z is up), so the up-drawn arrow rotates by pi - heading.
    g.save(); g.translate(C, C); g.rotate(Math.PI - heading);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -6.5); g.lineTo(4.4, 5); g.lineTo(0, 2.4); g.lineTo(-4.4, 5); g.closePath(); g.fill();
    g.restore();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
    g.beginPath(); g.arc(C, C, C - 1.5, 0, Math.PI * 2); g.stroke();
  }
}
