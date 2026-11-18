// Palmshade Heat — the game itself. This module builds the world, wires every
// system together (city, traffic, people, police, missions, combat, sound,
// HUD), runs the loop, and owns the top-level state: menu, play, pause,
// busted, wasted, and the save.

import * as THREE from 'three';
import { STORY } from './config.js';
import { buildCity, LOCATIONS } from './city.js';
import { mulberry32, clamp } from './random.js';
import { Car, TrafficSystem } from './vehicles.js';
import { PedestrianSystem } from './pedestrians.js';
import { Player, ChaseCamera } from './player.js';
import { Input } from './input.js';
import { WantedSystem, PoliceSystem } from './police.js';
import { Combat } from './combat.js';
import { MissionSystem, Pickups } from './missions.js';
import { Hud } from './hud.js';
import { SoundEngine } from './audio.js';
import { Effects } from './effects.js';
import { loadSave, storeSave, clearSave } from './save.js';
import { applyShotScene } from './shots.js';

const params = new URLSearchParams(location.search);
const shotScene = params.get('shot');
const rng = mulberry32(2026);

// --- renderer, scene, dusk sky ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe9a266, 130, 640);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 1600);

const sky = new THREE.Mesh(new THREE.SphereGeometry(780, 20, 12), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x33608f) }, mid: { value: new THREE.Color(0xe98d54) }, bot: { value: new THREE.Color(0x59452f) } },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP;' +
    'void main(){ float h = normalize(vP).y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h)) : mix(bot, mid, smoothstep(-0.08, 0.12, h));' +
    ' gl_FragColor = vec4(c, 1.0); }',
}));
scene.add(sky);

const hemi = new THREE.HemisphereLight(0xbdd3e8, 0x8a6a4a, 0.95); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffb36b, 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -100; sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100; sun.shadow.camera.bottom = -100;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 320; sun.shadow.bias = -0.0006;
scene.add(sun); scene.add(sun.target);

// --- world and systems ---
const city = buildCity(scene);
const world = {
  colliders: city.colliders, circles: city.circles,
  onCrash: null, // wired below, once the player exists
};
const fx = new Effects(scene);
const sound = new SoundEngine();
const traffic = new TrafficSystem(scene, rng, world);
const peds = new PedestrianSystem(scene);
const player = new Player(scene);
const chaseCam = new ChaseCamera(camera);
const input = new Input(renderer.domElement);
const wanted = new WantedSystem();
const hud = new Hud();
const combat = new Combat(scene, fx, sound);

let cash = 40;
let mode = 'menu'; // menu | playing | paused | busted | wasted
let playerCar = null, ownedCar = null;
let bustedMeter = 0, punchCooldown = 0, punchT = 0, hintCooldown = 0;
let time = 0, saveTimer = 0, lastHurtAt = -99, fleeAlertTimer = 0, lastMissionIndex = 0;
let everLocked = false;

const police = new PoliceSystem(scene, world, {
  onRam: () => { fx.addShake(0.12); sound.crash(false); },
  onDisabled: (cop) => { fx.burst(cop.x, 1, cop.z, 0xffa040, 30, 8, 0.8, 4); hud.toast('Cruiser disabled', 'One less Palmshade PD cruiser. They will send more.'); },
});
const missions = new MissionSystem(scene, {
  pay: (amount) => { cash += amount; },
  toast: (t, b) => hud.toast(t, b),
  hint: (text) => { if (hintCooldown <= 0) { hud.hint(text); hintCooldown = 2.5; } },
  forceWanted: (n) => wanted.forceStars(n),
  sound: (name) => {
    if (name === 'done') sound.missionDone();
    else if (name === 'pickup') sound.pickup();
    else if (name === 'fail') sound.tone(170, 0.3, 'sawtooth', 0.14, 0, 90);
  },
  storyComplete: () => { document.getElementById('storyend').classList.add('show'); },
  rng: () => rng,
});
const pickups = new Pickups(scene);
const storyCar = traffic.parked.find((c) => c.isStoryCar) || null;

// --- save / restore ---
const saveData = shotScene ? null : loadSave();
if (saveData) {
  cash = saveData.cash ?? 40;
  player.ammo = saveData.ammo ?? 30;
  missions.restore(saveData.mission || { index: 0 });
  player.place(saveData.x ?? LOCATIONS.start.x, saveData.z ?? LOCATIONS.start.z, Math.PI / 2);
} else {
  player.place(LOCATIONS.start.x, LOCATIONS.start.z, Math.PI / 2);
}
chaseCam.pos.set(player.x - 8, 4, player.z);
chaseCam.yaw = Math.PI / 2;

// --- cars: getting in, getting out, and what it costs ---
function allCars() {
  const list = [...traffic.cars.map((t) => t.car), ...traffic.parked, ...police.cops];
  return playerCar ? list.filter((c) => c !== playerCar) : list;
}
function enterCar(car) {
  const wasDriver = car.driver;
  traffic.takeCar(car);
  const pi = police.cops.indexOf(car);
  if (pi >= 0) police.cops.splice(pi, 1);
  if (wasDriver === 'traffic') peds.ejectDriver(car.x, car.z);
  if (car !== ownedCar) {
    // A theft only heats up if somebody sees it: the driver, a cruiser, or a
    // pedestrian close enough to call it in.
    const witnessed = wasDriver === 'traffic' || car.isPolice ||
      police.anySees(car.x, car.z) || !!peds.nearest(car.x, car.z, 14);
    if (witnessed && wanted.report('theft')) hud.hint('You took the ' + car.spec.name + '. The PD notices things like that.');
  }
  car.driver = 'player';
  playerCar = car; player.mode = 'car'; player.car = car;
  player.setVisible(false);
  sound.door();
}
function exitCar() {
  if (!playerCar) return;
  const car = playerCar;
  const sx = Math.cos(car.heading), sz = -Math.sin(car.heading);
  player.place(car.x + sx * 1.8, car.z + sz * 1.8, car.heading);
  car.driver = null;
  traffic.releaseCar(car, rng);
  ownedCar = car;
  playerCar = null; player.mode = 'foot'; player.car = null;
  player.setVisible(true);
  sound.door();
}
function tryEnterNearestCar() {
  let best = null, bd = 3.4;
  for (const car of allCars()) {
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bd) { bd = d; best = car; }
  }
  if (best) enterCar(best);
  else hud.hint('No car in reach. Stand beside one and press E.');
}
function givePlayerCar(model, color, x, z, heading) {
  const car = new Car(scene, model, color, { x, z, heading });
  car.driver = 'player';
  playerCar = car; player.mode = 'car'; player.car = car;
  player.setVisible(false);
  player.place(x, z, heading);
  return car;
}

// --- harm, arrest and their paperwork ---
function damagePlayer(amount) {
  if (mode !== 'playing') return;
  player.hurt(amount);
  lastHurtAt = time;
  const el = document.getElementById('damageflash');
  el.style.opacity = '0.55'; setTimeout(() => { el.style.opacity = '0'; }, 90);
  if (player.health <= 0) wasted();
}
function wasted() {
  mode = 'wasted'; sound.wasted();
  wanted.clear(); police.clearAll(); hud.setBusted(null);
  document.getElementById('wasted-screen').classList.add('show');
  document.exitPointerLock();
}
function busted() {
  mode = 'busted'; sound.busted();
  wanted.clear(); police.clearAll(); hud.setBusted(null);
  document.getElementById('busted-screen').classList.add('show');
  document.exitPointerLock();
}
function respawn(fine) {
  cash = Math.max(0, cash - fine);
  if (playerCar) { const c = playerCar; playerCar = null; player.mode = 'foot'; player.car = null; c.driver = null; traffic.releaseCar(c, rng); }
  player.health = 100; bustedMeter = 0;
  player.setVisible(true);
  player.place(LOCATIONS.police.x, LOCATIONS.police.z + 6, Math.PI);
  document.getElementById('wasted-screen').classList.remove('show');
  document.getElementById('busted-screen').classList.remove('show');
  mode = 'playing';
}

// Crash reporting from the drive physics.
world.onCrash = (intensity, x, z) => {
  fx.sparks(x, 0.7, z, intensity > 9);
  sound.crash(intensity > 9);
  fx.addShake(Math.min(0.4, intensity * 0.022));
  if (playerCar && intensity > 7) {
    wanted.report('property');
    damagePlayer((intensity - 7) * 0.7);
  }
};

// --- menu wiring ---
const $ = (id) => document.getElementById(id);
$('story-text').textContent = STORY.intro;
if (saveData && (missions.index > 0 || cash > 40)) $('btn-continue').style.display = 'block';
function startGame() {
  sound.start();
  mode = 'playing';
  document.body.classList.add('playing');
  $('menu').classList.remove('show');
  $('hud').classList.add('show');
}
$('btn-new').addEventListener('click', () => {
  if (saveData) { clearSave(); location.reload(); return; }
  startGame();
  hud.toast('Welcome to Palmshade', 'Rosa is waiting at the Coral Spoon. Follow the gold marker.');
});
$('btn-continue').addEventListener('click', () => { startGame(); hud.toast('Welcome back', 'Your Palmshade is where you left it.'); });
$('btn-resume').addEventListener('click', () => { mode = 'playing'; $('pause').classList.remove('show'); });
$('btn-respawn-b').addEventListener('click', () => respawn(Math.min(150, cash)));
$('btn-respawn-w').addEventListener('click', () => respawn(Math.ceil(cash * 0.1)));
$('btn-roam').addEventListener('click', () => $('storyend').classList.remove('show'));
document.addEventListener('pointerlockchange', () => {
  if (input.locked) everLocked = true;
  else if (everLocked && mode === 'playing' && !shotScene) pauseGame();
});
function pauseGame() { if (mode !== 'playing') return; mode = 'paused'; $('pause').classList.add('show'); }

// --- per-frame updates ---
function updatePlaying(dt) {
  const mouse = input.consumeMouse();
  chaseCam.applyMouse(mouse.x, mouse.y, player.mode === 'car');
  if (input.justPressed('KeyM')) sound.setMuted(!sound.muted);
  if (input.justPressed('KeyP')) { pauseGame(); return; }
  hintCooldown = Math.max(0, hintCooldown - dt);
  punchCooldown = Math.max(0, punchCooldown - dt);

  const focus = playerCar ? { x: playerCar.x, z: playerCar.z } : { x: player.x, z: player.z };

  if (player.mode === 'foot') {
    const mx = input.axis('KeyA', 'KeyD'), mz = input.axis('KeyS', 'KeyW');
    player.updateFoot(dt, mx, mz, chaseCam.yaw, input.down('ShiftLeft') || input.down('ShiftRight'), world);
    if (input.justPressed('KeyE')) tryEnterNearestCar();
    if (input.clicked && punchCooldown <= 0) {
      punchCooldown = 0.38;
      if (player.ammo > 0) {
        player.ammo--;
        const hit = combat.shoot(player, chaseCam.yaw, chaseCam.pitch, peds, [...allCars(), ...(playerCar ? [playerCar] : [])]);
        wanted.report('gunfire');
        peds.alertNearby(player.x, player.z, 17);
        if (hit.kind === 'ped' && hit.killed) wanted.report('pedDown');
        if (hit.kind === 'car' && hit.car.isPolice) wanted.report('copHit');
        fx.addShake(0.05);
      } else sound.tone(1300, 0.05, 'square', 0.07);
    }
    if (input.justPressed('KeyQ') && punchCooldown <= 0) {
      punchCooldown = 0.42; punchT = 0.25;
      const res = combat.punch(player, peds);
      if (res) wanted.report(res.killed ? 'pedDown' : 'pedHit');
    }
  } else if (playerCar) {
    const driveInput = {
      throttle: input.axis('KeyS', 'KeyW'),
      steer: input.axis('KeyD', 'KeyA'),
      handbrake: input.down('Space'),
      boost: input.down('ShiftLeft') || input.down('ShiftRight'),
    };
    playerCar.drive(driveInput, dt, world);
    player.place(playerCar.x, playerCar.z, playerCar.heading);
    if (playerCar.health < 35 && Math.random() < dt * 6) fx.smoke(playerCar.x, 1.1, playerCar.z);
    if (input.justPressed('KeyE') && Math.abs(playerCar.forwardSpeed) < 3) exitCar();
    // Running people down is the city's gravest crime.
    if (playerCar.speed > 2.5) {
      for (const ped of peds.peds) {
        if (ped.state === 'down') continue;
        const d = Math.hypot(ped.mesh.position.x - playerCar.x, ped.mesh.position.z - playerCar.z);
        if (d < 1.8) {
          const died = peds.damage(ped, playerCar.speed > 7 ? 100 : 45);
          wanted.report(died ? 'pedDown' : 'pedHit');
          fx.bloodlessPuff(ped.mesh.position.x, 0.8, ped.mesh.position.z);
          sound.crash(false); fx.addShake(0.15);
          playerCar.velX *= 0.82; playerCar.velZ *= 0.82;
        }
      }
      fleeAlertTimer -= dt;
      if (playerCar.speed > 11 && fleeAlertTimer <= 0) { peds.alertNearby(playerCar.x, playerCar.z, 11); fleeAlertTimer = 0.5; }
    }
    // Car-to-car contact: shoves, sparks and blame.
    for (const other of allCars()) {
      const d = Math.hypot(other.x - playerCar.x, other.z - playerCar.z);
      if (d < 3.5 && d > 0.01) {
        const push = (3.5 - d) / 2, ux = (other.x - playerCar.x) / d, uz = (other.z - playerCar.z) / d;
        other.mesh.position.x += ux * push; other.mesh.position.z += uz * push;
        playerCar.mesh.position.x -= ux * push; playerCar.mesh.position.z -= uz * push;
        const rel = Math.abs(playerCar.forwardSpeed - other.forwardSpeed);
        if (rel > 3) {
          fx.sparks(playerCar.x + ux * 2, 0.7, playerCar.z + uz * 2);
          sound.crash(rel > 8); fx.addShake(0.1);
          other.health -= rel * 1.4; playerCar.health -= rel * 0.9;
          if (other.isPolice) wanted.report('copHit');
        }
        other.velX += ux * 2; other.velZ += uz * 2;
      }
    }
  }
  if (punchT > 0) {
    punchT -= dt;
    player.mesh.userData.parts.armR.rotation.x = -1.7 * Math.max(0, punchT / 0.25);
  }

  traffic.update(dt, focus);
  peds.update(dt, world.colliders);
  police.update(dt, wanted, { x: focus.x, z: focus.z, mode: player.mode, car: playerCar });
  wanted.update(dt, police.anySees(focus.x, focus.z));
  missions.update(dt, {
    x: focus.x, z: focus.z,
    inCar: player.mode === 'car',
    inStoryCar: !!(playerCar && playerCar.isStoryCar),
  }, time);
  if (missions.index !== lastMissionIndex) {
    lastMissionIndex = missions.index;
    if (mode === 'playing' && !missions.storyDone) sound.missionStart();
  }
  pickups.update(dt, time, focus.x, focus.z, (kind, x, z) => {
    fx.pickup(x, 1.2, z);
    if (kind === 'cash') { const amt = 25 + Math.floor(rng() * 50); cash += amt; sound.cash(); hud.hint('Found $' + amt + ' in a dropped briefcase.'); }
    if (kind === 'ammo') { player.ammo += 12; sound.pickup(); hud.hint('Pistol ammo +12.'); }
    if (kind === 'health') { player.heal(35); sound.pickup(); hud.hint('Patched up. +35 health.'); }
  });
  combat.update(dt);

  // Being run down by the law (or by traffic) hurts.
  if (player.mode === 'foot') {
    for (const car of [...police.cops, ...traffic.cars.map((t) => t.car)]) {
      if (car.speed > 5 && Math.hypot(car.x - player.x, car.z - player.z) < 2.3 && time - lastHurtAt > 0.7) {
        damagePlayer(car.isPolice ? 16 : 10);
        fx.addShake(0.25);
      }
    }
  }
  // Slow recovery once the shooting stops.
  if (time - lastHurtAt > 6 && player.health > 0) player.heal(1.3 * dt);

  // Busted: a cruiser holding position over a slow or foot-bound Dario.
  const nd = police.nearestDist(focus.x, focus.z);
  const cornered = wanted.stars > 0 && ((player.mode === 'foot' && nd < 8) || (player.mode === 'car' && nd < 9.5 && Math.abs(playerCar.forwardSpeed) < 2.5));
  if (cornered) bustedMeter = Math.min(1, bustedMeter + dt / 2.4);
  else bustedMeter = Math.max(0, bustedMeter - dt * 0.7);
  hud.setBusted(bustedMeter > 0.04 ? bustedMeter : null);
  if (bustedMeter >= 1) { busted(); return; }

  sound.update(dt, player.mode === 'car', playerCar ? playerCar.forwardSpeed / playerCar.spec.topSpeed : 0, nd);

  saveTimer += dt;
  if (saveTimer > 8) {
    saveTimer = 0;
    storeSave({ cash, ammo: player.ammo, mission: missions.serialize(), x: focus.x, z: focus.z });
  }
}

function updateHud() {
  const focus = playerCar ? playerCar : player;
  hud.setCash(cash);
  hud.setStars(wanted.stars);
  hud.setHealth(player.health);
  hud.setAmmo(player.ammo);
  hud.setSpeed(playerCar ? Math.abs(playerCar.forwardSpeed) * 3.6 : 0, playerCar ? playerCar.spec.name : null);
  hud.setObjective(missions.objectiveText(focus.x, focus.z), missions.timer);
  hud.drawMinimap(focus.x, focus.z, playerCar ? playerCar.heading : player.heading,
    police.cops, missions.currentTarget(), time);
  hud.update();
}

// --- shot staging (screenshots) ---
if (shotScene) {
  $('menu').classList.remove('show');
  $('hud').classList.add('show');
  document.body.classList.add('playing');
  mode = 'playing';
  applyShotScene(shotScene, {
    player, camera: chaseCam, wanted, police, missions, traffic,
    givePlayerCar, setCash: (v) => { cash = v; },
  });
} else {
  $('menu').classList.add('show');
}

// Test hooks for the headless drive test.
window.__palmshade = {
  state: () => ({
    mode, cash, stars: wanted.stars, cops: police.cops.length,
    mission: missions.index, stage: missions.stage, playerMode: player.mode,
    health: Math.round(player.health), ammo: player.ammo,
    x: Math.round(player.x), z: Math.round(player.z),
  }),
  enterNearestCar: () => tryEnterNearestCar(),
  exitCar: () => exitCar(),
  reportCrime: (k) => wanted.report(k),
  start: () => startGame(),
  // Playtest helper: stand Dario beside the first traffic car and take it, so
  // the real enterCar path (driver bails, theft reported) can be exercised.
  jackTrafficCar: () => {
    const t = traffic.cars[0];
    if (!t) return false;
    player.place(t.car.x + 1.6, t.car.z, 0);
    tryEnterNearestCar();
    return player.mode === 'car';
  },
};

// --- the loop ---
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;
  if (mode === 'playing') updatePlaying(dt);
  else if (mode === 'menu' && !shotScene) {
    // Slow menu pan over the marina.
    chaseCam.yaw += dt * 0.05;
    traffic.update(dt, null);
    peds.update(dt, world.colliders);
  }
  const focus = playerCar ? playerCar : player;
  chaseCam.update(dt, player.mode === 'car' ? playerCar : player, player.mode, fx.shakeOffset());
  sun.position.set(focus.x - 120, 95, focus.z + 45);
  sun.target.position.set(focus.x, 0, focus.z);
  city.update(dt, time);
  fx.update(dt);
  if (mode === 'playing' || shotScene) updateHud();
  input.endFrame();
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
