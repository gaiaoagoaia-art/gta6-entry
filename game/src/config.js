// Palmshade Heat — shared configuration: city dimensions, palette, vehicle models, names.
// Everything in this game is original: the city of Palmshade, its people and its cars.

export const CITY = {
  cols: 6, // building blocks across (west-east)
  rows: 5, // building blocks down (north-south)
  block: 44, // block footprint, metres
  road: 16, // road width between blocks, metres
  beach: 70, // sand strip east of the last road
  water: 400, // sea beyond the beach
};

// Derived layout: road centre lines and block rectangles are computed in city.js.
export const PITCH = CITY.block + CITY.road; // 60 m between neighbouring road centres
export const CITY_W = CITY.cols * CITY.block + (CITY.cols + 1) * CITY.road; // 376
export const CITY_D = CITY.rows * CITY.block + (CITY.rows + 1) * CITY.road; // 316

export const COLORS = {
  sky: 0x2e4a6b,
  fog: 0xe8a56b,
  sun: 0xffb36b,
  road: 0x33373d,
  roadLine: 0xf5d76e,
  sidewalk: 0x9aa0a3,
  sand: 0xe8cf9f,
  water: 0x1d6f77,
  grass: 0x5d8a4a,
};

// Sun-soaked pastel facades for the instanced buildings.
export const FACADE_COLORS = [
  0xf2e3c9, 0xeec9a3, 0xe8b4a0, 0xdfe8d5, 0xbfe0d8, 0xf5d7e0,
  0xd8e2ee, 0xf7ead1, 0xe6c8b0, 0xcfe3c0, 0xf0d9b5, 0xdcc7e8,
];

// Original vehicle models of Palmshade: name, size, pace and price feel.
export const CAR_MODELS = {
  vireo:   { name: 'Vireo Sedan',    length: 4.5, width: 1.9, height: 1.05, topSpeed: 29, accel: 13, colors: [0xc0c4cc, 0x707880, 0x30455e, 0x7a2e2e, 0x2e5e4e, 0xd8d3c3] },
  kestrel: { name: 'Kestrel Hatch',  length: 3.9, width: 1.8, height: 1.15, topSpeed: 26, accel: 12, colors: [0xe0a030, 0x3f7fbf, 0xb8bcc0, 0x5e8c3f, 0x8c3f6e] },
  bronto:  { name: 'Bronto SUV',     length: 4.9, width: 2.0, height: 1.45, topSpeed: 27, accel: 11, colors: [0x2b2f36, 0x6e3b2a, 0x445566, 0xd8d8d8, 0x374f35] },
  hauler:  { name: 'Hauler Pickup',  length: 5.1, width: 2.0, height: 1.30, topSpeed: 25, accel: 11, colors: [0x9c4a2f, 0x51606e, 0xcac2ae, 0x3d5a80] },
  solstice:{ name: 'Solstice GT',    length: 4.4, width: 1.95, height: 0.82, topSpeed: 38, accel: 19, colors: [0xd8a018, 0xc22e2e, 0x22242a, 0xe8e8ec] },
  cruiser: { name: 'PPD Interceptor', length: 4.7, width: 1.95, height: 1.10, topSpeed: 34, accel: 16, colors: [0xf2f2f2] },
};
export const TRAFFIC_MODELS = ['vireo', 'kestrel', 'bronto', 'hauler', 'vireo', 'kestrel'];

export const STORY = {
  title: 'PALMSHADE HEAT',
  subtitle: 'An original open-world crime story in the city of Palmshade',
  intro:
    'Palmshade, a sun-burnt port city of pastel towers, marina money and dockside secrets. ' +
    'Dario Marek has come home after six years away, with empty pockets and one name in his phone: ' +
    'Rosa Delgado of the Coral Spoon diner, who always needs a driver who asks no questions. ' +
    'Run her errands, keep the Palmshade PD off your tail, and earn your way back into the city.',
  hero: 'Dario Marek',
  fixer: 'Rosa Delgado',
};

export const CONTROLS_TEXT = [
  'W A S D — move / drive',
  'Mouse — look (click the game to capture it)',
  'Shift — sprint / boost',
  'E — enter or leave a car, talk, pick up',
  'Left mouse — fire pistol',
  'Q — punch',
  'Space — handbrake',
  'M — toggle sound · P or Esc — pause',
];

export const SAVE_KEY = 'palmshade-heat-save-v1';
