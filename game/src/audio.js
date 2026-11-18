// Sound, all synthesized with WebAudio: engine hum, two-tone sirens, gunshots,
// punches, crashes, cash and mission stingers over a warm ambient pad. No files.

export class SoundEngine {
  constructor() {
    this.ctx = null; this.muted = false; this.started = false;
  }
  start() { // called from the first user gesture
    if (this.started) return;
    this.started = true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = this.ctx = new Ctx();
    this.master = ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(ctx.destination);
    // Ambient pad: two slow detuned triangles through a lowpass — dusk air.
    this.padGain = ctx.createGain(); this.padGain.gain.value = 0.035;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    this.padGain.connect(lp); lp.connect(this.master);
    for (const [f, det] of [[110, 0], [164.8, 4], [220, -3]]) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
      o.connect(this.padGain); o.start();
    }
    // Engine: saw + sub sine, pitch follows speed; gain set while driving.
    this.engineGain = ctx.createGain(); this.engineGain.gain.value = 0;
    const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 500;
    this.engineOsc = ctx.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55;
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 28;
    this.engineOsc.connect(ef); sub.connect(ef); ef.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start(); sub.start(); this.engineSub = sub;
    // Siren: one square voice whose pitch the police update steers by distance.
    this.sirenGain = ctx.createGain(); this.sirenGain.gain.value = 0;
    this.sirenOsc = ctx.createOscillator(); this.sirenOsc.type = 'square'; this.sirenOsc.frequency.value = 700;
    const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 900; sf.Q.value = 2;
    this.sirenOsc.connect(sf); sf.connect(this.sirenGain); this.sirenGain.connect(this.master);
    this.sirenOsc.start(); this.sirenT = 0;
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.5; }
  tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol, freq = 1200) {
    if (!this.ctx) return;
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
  }
  shot() { this.noise(0.14, 0.5, 2600); this.tone(150, 0.1, 'square', 0.18, 0, 60); }
  punch() { this.noise(0.08, 0.3, 500); this.tone(90, 0.09, 'sine', 0.25, 0, 45); }
  crash(big) { this.noise(big ? 0.4 : 0.2, big ? 0.55 : 0.3, 700); this.tone(70, 0.25, 'sine', 0.3, 0, 40); }
  door() { this.tone(220, 0.07, 'square', 0.12); this.tone(140, 0.09, 'square', 0.12, 0.09); }
  cash() { this.tone(880, 0.09, 'sine', 0.2); this.tone(1320, 0.14, 'sine', 0.2, 0.08); }
  pickup() { this.tone(660, 0.08, 'sine', 0.16); this.tone(990, 0.1, 'sine', 0.16, 0.06); }
  missionStart() { this.tone(392, 0.12, 'triangle', 0.22); this.tone(523, 0.12, 'triangle', 0.22, 0.1); this.tone(659, 0.2, 'triangle', 0.22, 0.2); }
  missionDone() { for (const [i, f] of [523, 659, 784, 1046].entries()) this.tone(f, 0.16, 'triangle', 0.24, i * 0.09); }
  busted() { this.tone(392, 0.2, 'sawtooth', 0.15); this.tone(311, 0.2, 'sawtooth', 0.15, 0.18); this.tone(233, 0.4, 'sawtooth', 0.15, 0.36); }
  wasted() { this.tone(330, 0.3, 'triangle', 0.2, 0, 110); this.tone(196, 0.6, 'triangle', 0.2, 0.25, 65); }
  update(dt, driving, speedRatio, nearestCopDist) {
    if (!this.ctx) return;
    const eg = driving ? 0.05 + Math.abs(speedRatio) * 0.1 : 0;
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : eg, this.ctx.currentTime, 0.08);
    if (driving) {
      const f = 55 + Math.abs(speedRatio) * 130;
      this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
      this.engineSub.frequency.setTargetAtTime(f / 2, this.ctx.currentTime, 0.05);
    }
    this.sirenT += dt;
    const sg = nearestCopDist < 70 ? (1 - nearestCopDist / 70) * 0.055 : 0;
    this.sirenGain.gain.setTargetAtTime(this.muted ? 0 : sg, this.ctx.currentTime, 0.1);
    if (sg > 0) this.sirenOsc.frequency.setTargetAtTime((this.sirenT % 0.9) < 0.45 ? 660 : 950, this.ctx.currentTime, 0.02);
  }
}
