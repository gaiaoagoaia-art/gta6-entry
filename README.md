[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/gaiaoagoaia-art/gta6-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/gaiaoagoaia-art/gta6-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Palmshade Heat

An original open-world crime game in the browser. Palmshade is a sun-baked
coastal city of pastel towers, palm trees and one long sunset — and Dario
Marek just got off the ferry with forty dollars, a borrowed pistol and a
note: *Rosa Delgado. Coral Spoon diner. Don't be late.*

Everything here is original: the city, the people, the cars, the names and
the story were made for this game. No third-party assets; the only vendored
library is three.js (MIT).

## The game

- **A city on foot and by car** — a 6×5 block grid of pastel towers with lit
  windows, canvas-signed landmarks (the Coral Spoon diner, Palmshade PD,
  Manny's Chop Shop, the Marina Hotel), a beach, a pier and the sea.
- **Traffic and pedestrians** — sixteen cars loop the avenues on their own,
  dozens more are parked, and 46 pedestrians stroll the sidewalks, panic and
  flee from gunfire, crashes and speeding cars.
- **Steal anything with wheels** — walk up to any car and press F. Drivers
  bail out. If someone sees you do it, the stars start climbing.
- **Wanted system** — 0–5 stars for theft, hit-and-runs, property damage and
  gunfire. Palmshade PD cruisers hunt you down, ram you, and box you in;
  break line of sight and stay hidden to cool off. Get surrounded at a crawl
  and you are **BUSTED** — it costs a cut of your cash.
- **Combat** — fists (left click near someone) and a pistol (pointer-lock
  aim, tracers, recoil), with health, damage and dropped cash.
- **A five-mission story** — Rosa's chain: *Meet Rosa → First Wheels →
  Harbor Run → Borrowed Shine → The Long Goodbye*, with gold marker beams,
  timers, condition bonuses (deliver the Solstice GT un-dented) and payouts
  from $250 to $2,500. After the finale, Rosa keeps texting repeatable
  errands. Cash, ammo and medkit pickups are scattered around the city.
- **HUD** — a circular radar minimap (streets, your arrow, police blips, the
  mission diamond), wanted stars, cash, health, ammo, speedometer and a
  mission card with live distance and countdown.
- **Sound, all synthesized** — WebAudio engine hum that follows your speed,
  police sirens, gunshots, pickup blips, mission stingers and a warm ambient
  pad. No audio files.
- **Feel** — smooth chase camera on foot and in car, collision sparks, dust,
  muzzle flashes, screen shake, day settling into a dusk gradient sky.
- **Save** — progress (cash, story position, car, position) persists in
  `localStorage`; Continue from the title screen.

## Controls

| Input | Action |
| --- | --- |
| W A S D / arrows | Move / drive |
| Shift | Sprint (on foot) |
| Mouse | Orbit camera · pointer-lock aim on foot |
| F / Enter | Enter or exit the nearest car |
| Left click | Punch / fire the pistol |
| R | Reload |
| Esc / P | Pause |

## Run it

The game is static files — no build step, no network needed:

```sh
node serve.ts            # serves game/ on http://localhost:8901
```

then open <http://localhost:8901>. Any static file server pointed at
`game/` works too.

The entry program (what make.fun runs) is `main.ts`: it copies `game/` and
`screenshots/` to the output directory and writes `dossier.json`.

## Layout

- `game/index.html`, `game/style.css` — page shell and HUD styling
- `game/src/` — one module per job: `city.js` (the world), `vehicles.js`
  (cars + traffic), `pedestrians.js`, `player.js` (Dario + chase camera),
  `police.js` (wanted + pursuit), `combat.js`, `missions.js` (story +
  pickups), `hud.js` (HUD + radar), `audio.js` (synthesized sound),
  `effects.js`, `input.js`, `save.js`, `shots.js` (screenshot scenes),
  `main.js` (wires it all together)
- `game/vendor/three.module.min.js` — three.js r160, vendored
- `screenshots/` — four real gameplay captures; `shots.json` lists the
  `?shot=` scenes that stage them
- `vendor/makefun-game.ts` — the kit's dossier library, byte-identical
