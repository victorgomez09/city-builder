import {
  RoadDef,
  PathDef,
  ZoneDef,
  ServiceDef,
  RailDef,
  TransitVehicleConfig,
  Milestone,
  QualityPreset,
  MapDef,
  RoadLayout,
} from '../types';

export const C = {
  TILE: 10,          // metres per tile
  W: 208,            // world tiles per side (incl. scenic border)
  PAD: 32,           // scenic border (not buildable)
  N: 144,            // playable tiles per side
  WATER: 0,
  HOUR_SEC: 120,     // real seconds per clock hour at 1x (day/night, commute schedule)
  SIM_SEC: 10,       // real seconds per simulation tick-hour at 1x (growth, construction, budget)
  CHUNK: 16,
  VEH_SPEED: 1.8,    // visual speed multiplier for agents
  START_MONEY: 70000,
  WALK_R: 16,        // tiles people will walk to a stop
  SAVE_KEY: 'viracity.save.v2',
  SET_KEY: 'viracity.settings.v1',
  LEGACY_SAVE_KEY: 'openskylines.save.v2',
  LEGACY_SET_KEY: 'openskylines.settings.v1',

  P0: 32,
  P1: 32 + 144,
  TRIP_K: 120 / 10,
  DX: [0, 1, 0, -1],
  DY: [-1, 0, 1, 0],
  WORLD: 208 * 10,
  FW: 208 * 2,

  ROAD_BASIC: 1,
  GRP_RANK: { legacy: 0, path: 0, small: 1, medium: 2, large: 3, highway: 4 } as Record<string, number>,

  ROADS: [] as (RoadDef | null)[],
  ROAD_GROUPS: [
    ['small', 'Small'],
    ['medium', 'Medium'],
    ['large', 'Large'],
    ['highway', 'Highways'],
    ['path', 'Paths'],
  ] as [string, string][],

  PATHS: [] as (PathDef | null)[],
  START_HW: 0,

  ZONES: [] as (ZoneDef | null)[],
  LV_REQ: [0, 18, 32, 46, 60],

  SERVICES: {} as Record<string, ServiceDef>,
  PARK_TABS: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']] as [string, string][],
  SVC_TABS: [
    ['garbage', 'Garbage'],
    ['health', 'Healthcare'],
    ['police', 'Police'],
    ['fire', 'Fire'],
    ['edu', 'Education'],
  ] as [string, string][],

  TRANSIT: {} as Record<string, TransitVehicleConfig>,
  RAIL: [] as (RailDef | null)[],
  MILESTONES: [] as Milestone[],
  QUALITY: {} as Record<string, QualityPreset>,
  MAPS: [] as MapDef[],

  RES_NONE: 0,
  RES_FERTILE: 1,
  RES_FOREST: 2,
  RES_ORE: 3,
  RES_OIL: 4,
  RESOURCE_NAMES: ['None', 'Fertile Land', 'Forestry', 'Ore', 'Oil'] as string[],
  RESOURCE_COLORS: ['transparent', '#eab308', '#16a34a', '#64748b', '#1e1b4b'] as string[],

  layout: null as unknown as (R: RoadDef) => RoadLayout,
  bikeScore: null as unknown as (R: RoadDef) => number,
};

const MED_W: Record<string, number> = { none: 0, paint: 0.3, curb: 0.9, grass: 1.8, trees: 2.2, barrier: 0.8 };

C.layout = function (R: RoadDef): RoadLayout {
  const Tl = C.TILE;
  const sw = R.side;
  const bw = R.bike === 2 ? 1.7 : R.bike === 1 ? 1.4 : 0;
  const L: RoadLayout = { sw, bw, fwd: [], back: [], med: 0, pair: R.w === 2, lw: 3 };
  if (!R.car) {
    L.path = true;
    return L;
  }
  let lw: number;
  if (R.w === 2) {
    L.med = MED_W[R.med] / 2;
    lw = (Tl - L.med - bw - sw) / R.fwd;
    for (let j = 0; j < R.fwd; j++) L.fwd.push(Tl - sw - bw - (j + 0.5) * lw - Tl / 2);
    L.left = L.med;
  } else if (R.oneway) {
    lw = (Tl - 2 * sw - 2 * bw) / R.fwd;
    for (let j = 0; j < R.fwd; j++) L.fwd.push(Tl - sw - bw - (j + 0.5) * lw - Tl / 2);
  } else {
    L.med = MED_W[R.med];
    lw = (Tl - 2 * sw - 2 * bw - L.med) / (R.fwd + R.back);
    for (let j = 0; j < R.fwd; j++) L.fwd.push(Tl - sw - bw - (j + 0.5) * lw - Tl / 2);
    for (let j = 0; j < R.back; j++) L.back.push(Tl / 2 - (sw + bw + (j + 0.5) * lw));
    L.medX = sw + bw + R.back * lw + L.med / 2;
  }
  L.lw = lw;
  L.bikeOff = Tl / 2 - sw - bw / 2;
  L.walkOff = Tl / 2 - Math.max(0.8, sw) / 2;
  return L;
};

C.bikeScore = function (R: RoadDef): number {
  if (!R.car) return 1;
  if (R.grp === 'highway') return 0;
  if (R.bike === 2) return 0.95;
  if (R.bike === 1) return R.grp === 'large' ? 0.6 : 0.75;
  if (R.grp === 'small') return R.surf === 'dirt' ? 0.6 : 0.5;
  return R.grp === 'medium' ? 0.2 : 0.06;
};

const R = (key: string, name: string, grp: RoadDef['grp'], o: Partial<RoadDef>): RoadDef =>
  Object.assign(
    {
      key,
      name,
      grp,
      w: 1,
      fwd: 1,
      back: 1,
      oneway: false,
      speed: 12,
      cap: 4,
      cost: 25,
      upkeep: 0.5,
      zonable: true,
      side: 2,
      bike: 0,
      med: 'paint',
      surf: 'asph',
      tram: false,
      car: true,
      unlock: 0,
      desc: '',
    },
    o
  ) as RoadDef;

C.ROADS = [
  null,
  R('basic', 'Two-Lane Road', 'small', { desc: 'The everyday street. One lane each way.' }),
  R('gravel', 'Gravel Road', 'small', { surf: 'dirt', side: 0, speed: 8, cap: 3, cost: 10, upkeep: 0.2, med: 'none', desc: 'Cheap and slow. No sidewalks.' }),
  R('oneway2', 'One-Way, 2 Lanes', 'small', { oneway: true, fwd: 2, back: 0, cap: 5, cost: 30, desc: 'Drag in the direction traffic should flow.' }),
  R('bike2', 'Two-Lane + Bike Lanes', 'small', { bike: 1, side: 1.6, cost: 35, unlock: 1, desc: 'Painted bike lanes on both sides.' }),
  R('median2', 'Two-Lane + Median', 'small', { med: 'curb', side: 1.7, cost: 35, unlock: 2, desc: 'A raised curb splits the two directions.' }),
  R('trees2', 'Two-Lane + Trees', 'small', { side: 2.4, cost: 40, unlock: 2, trees: true, desc: 'Street trees. Raises land value.' }),
  R('asym12', 'Three-Lane, 1 + 2', 'small', { fwd: 2, back: 1, cap: 5, cost: 40, side: 1.5, unlock: 2, desc: 'Two lanes in the drag direction, one back.' }),
  R('oneway3', 'One-Way, 3 Lanes', 'small', { oneway: true, fwd: 3, back: 0, cap: 7, side: 1.5, cost: 45, unlock: 2, desc: 'Drag in the direction traffic should flow.' }),
  R('prot2', 'Two-Lane + Protected Bikes', 'small', { bike: 2, side: 1.4, cost: 45, unlock: 3, desc: 'Curb-separated bike tracks. Cyclists love it.' }),
  R('tram2', 'Two-Lane + Tram', 'small', { tram: true, cost: 60, unlock: 4, upkeep: 0.8, desc: 'Streetcar tracks in both lanes.' }),
  R('ave4', 'Four-Lane Avenue', 'medium', { w: 2, fwd: 2, back: 0, speed: 15, cap: 7, cost: 70, upkeep: 1.2, med: 'paint', side: 2.2, unlock: 2, desc: 'Two tiles wide. Two lanes each way.' }),
  R('ave4bike', 'Avenue + Bike Lanes', 'medium', { w: 2, fwd: 2, back: 0, speed: 15, cap: 7, cost: 80, upkeep: 1.3, bike: 1, side: 1.8, unlock: 3 }),
  R('ave4grass', 'Avenue + Grass Median', 'medium', { w: 2, fwd: 2, back: 0, speed: 15, cap: 7, cost: 80, upkeep: 1.3, med: 'grass', side: 2, unlock: 3 }),
  R('ave4trees', 'Avenue + Tree Median', 'medium', { w: 2, fwd: 2, back: 0, speed: 15, cap: 7, cost: 90, upkeep: 1.4, med: 'trees', side: 2, unlock: 3, trees: true }),
  R('ave4prot', 'Avenue + Protected Bikes', 'medium', { w: 2, fwd: 2, back: 0, speed: 15, cap: 7, cost: 95, upkeep: 1.4, bike: 2, med: 'curb', side: 1.6, unlock: 3 }),
  R('ave4tram', 'Avenue + Tram', 'medium', { w: 2, fwd: 2, back: 0, speed: 15, cap: 7, cost: 120, upkeep: 1.6, tram: true, med: 'curb', side: 2, unlock: 4 }),
  R('blvd6', 'Six-Lane Boulevard', 'large', { w: 2, fwd: 3, back: 0, speed: 17, cap: 10, cost: 130, upkeep: 2, med: 'curb', side: 1.6, unlock: 5, desc: 'Three lanes each way. Gets traffic lights.' }),
  R('blvd6trees', 'Boulevard + Trees', 'large', { w: 2, fwd: 3, back: 0, speed: 17, cap: 10, cost: 145, upkeep: 2.2, med: 'trees', side: 1.4, unlock: 5, trees: true }),
  R('blvd6bike', 'Boulevard + Bike Lanes', 'large', { w: 2, fwd: 3, back: 0, speed: 17, cap: 10, cost: 145, upkeep: 2.2, med: 'curb', bike: 1, side: 1.2, unlock: 5 }),
  R('blvd6prot', 'Boulevard + Protected Bikes', 'large', { w: 2, fwd: 3, back: 0, speed: 17, cap: 10, cost: 160, upkeep: 2.3, med: 'paint', bike: 2, side: 1.1, unlock: 5 }),
  R('blvd8', 'Eight-Lane Road', 'large', { w: 2, fwd: 4, back: 0, speed: 18, cap: 13, cost: 180, upkeep: 2.6, med: 'curb', side: 0.8, unlock: 6 }),
  R('hw2', 'Two-Lane Highway', 'highway', { w: 2, fwd: 2, back: 0, speed: 26, cap: 9, cost: 140, upkeep: 2.4, zonable: false, side: 0.9, med: 'barrier', unlock: 4, desc: 'Fast. Nothing can be built along it.' }),
  R('hw3', 'Three-Lane Highway', 'highway', { w: 2, fwd: 3, back: 0, speed: 28, cap: 13, cost: 190, upkeep: 3, zonable: false, side: 0.7, med: 'barrier', unlock: 5 }),
  R('hw4', 'Four-Lane Highway', 'highway', { w: 2, fwd: 4, back: 0, speed: 30, cap: 17, cost: 250, upkeep: 3.8, zonable: false, side: 0.5, med: 'barrier', unlock: 6 }),
  R('ramp1', 'One-Lane Ramp', 'highway', { oneway: true, fwd: 1, back: 0, speed: 20, cap: 5, cost: 70, upkeep: 1.2, zonable: false, side: 1.2, med: 'none', unlock: 4, desc: 'One-way. Use it for on and off ramps.' }),
  R('ramp2', 'Two-Lane Ramp', 'highway', { oneway: true, fwd: 2, back: 0, speed: 22, cap: 8, cost: 100, upkeep: 1.6, zonable: false, side: 0.9, med: 'none', unlock: 4 }),
  R('rural', 'Rural Highway', 'highway', { speed: 20, cap: 5, cost: 60, upkeep: 0.8, zonable: false, side: 1.0, med: 'paint', unlock: 4, desc: 'Fast two-lane road. No buildings.' }),
  // legacy full-tile paths (converted to half-tile paths when an old save loads)
  R('bikepath', 'Bike Path', 'legacy', { car: false, zonable: false, cost: 12, upkeep: 0.2, side: 0, med: 'none', unlock: 1 }),
  R('footpath', 'Pedestrian Path', 'legacy', { car: false, zonable: false, cost: 8, upkeep: 0.1, side: 0, med: 'none', unlock: 0 }),
];

for (let r = 1; r < C.ROADS.length; r++) {
  const road = C.ROADS[r];
  if (road) road.L = C.layout(road);
}

C.PATHS = [
  null,
  { key: 'foot', name: 'Pedestrian Path', cost: 4, upkeep: 0.05, unlock: 0, col: '#cfc6b0', bike: 0.85, desc: 'Half a tile wide. Joins any sidewalk it touches.' },
  { key: 'bike', name: 'Bike Path', cost: 6, upkeep: 0.08, unlock: 1, col: '#8a4a3c', bike: 1, desc: 'Half a tile wide. Bikes and pedestrians. Joins any sidewalk it touches.' },
  { key: 'shared', name: 'Shared Walk & Bike Path', cost: 8, upkeep: 0.1, unlock: 1, col: '#8f8a80', bike: 1, desc: 'One wide path for walkers and cyclists, with a centre line. Use it instead of laying a pedestrian and a bike path side by side.' },
];

C.START_HW = C.ROADS.findIndex(r => r && r.key === 'hw2');

C.ZONES = [
  null,
  { key: 'rlow', name: 'Low Density Residential', short: 'Res · Low', cat: 'res', color: '#5fcf5a', unlock: 0, lots: [[1, 1, 15], [1, 2, 34], [1, 3, 14], [2, 2, 25], [2, 3, 12]], cap: [3, 4, 4, 5, 6], perBuilding: true },
  { key: 'rmed', name: 'Row Houses', short: 'Res · Row houses', cat: 'res', color: '#2f9e48', unlock: 3, lots: [[1, 2, 30], [2, 2, 45], [2, 3, 25]], cap: [2.2, 2.4, 2.7, 3.0, 3.3], rows: true },
  { key: 'rhigh', name: 'High Density Residential', short: 'Res · High', cat: 'res', color: '#167a3a', unlock: 6, lots: [[2, 2, 50], [2, 3, 50]], cap: [18, 23, 28, 34, 40] },
  { key: 'clow', name: 'Low Density Commercial', short: 'Com · Low', cat: 'com', color: '#59a6f5', unlock: 0, lots: [[1, 1, 30], [1, 2, 60], [2, 2, 40]], cap: [2, 3, 3, 4, 5] },
  { key: 'chigh', name: 'High Density Commercial', short: 'Com · High', cat: 'com', color: '#2b62d9', unlock: 4, lots: [[2, 2, 50], [2, 3, 50]], cap: [5, 6, 8, 9, 11] },
  { key: 'ind', name: 'Industrial', short: 'Industry', cat: 'ind', color: '#f0c43a', unlock: 0, lots: [[1, 1, 25], [1, 2, 25], [2, 1, 15], [2, 2, 40], [2, 3, 35], [3, 3, 25]], cap: [3, 3, 4, 4, 5] },
  { key: 'office', name: 'High Density Office', short: 'Office · High', cat: 'off', color: '#b276f2', unlock: 5, lots: [[2, 2, 50], [2, 3, 50]], cap: [8, 10, 12, 14, 17] },
  { key: 'rapt', name: 'Medium Density Apartments', short: 'Res · Apartments', cat: 'res', color: '#3fb59a', unlock: 3, lots: [[1, 2, 25], [2, 2, 45], [2, 3, 30]], cap: [6, 7, 8, 9, 10] },
  { key: 'olow', name: 'Low Density Office', short: 'Office · Low', cat: 'off', color: '#c9a2f5', unlock: 3, lots: [[1, 1, 25], [1, 2, 45], [2, 2, 30]], cap: [3, 4, 5, 6, 7] },
];

const SV = (o: Partial<ServiceDef>): ServiceDef => Object.assign({ upkeep: 0, radius: 8 }, o) as ServiceDef;

C.SERVICES = {
  // services
  garbage: SV({ name: 'Waste Transfer Station', cat: 'services', tab: 'garbage', size: [3, 2], cost: 6000, upkeep: 380, radius: 30, cov: 'garbage', unlock: 1, veh: 'garbage', vehCount: 6, pollute: 0.5, desc: 'Garbage trucks collect from buildings in range.' }),
  recycle: SV({ name: 'Recycling Center', cat: 'services', tab: 'garbage', size: [3, 3], cost: 14000, upkeep: 650, radius: 40, cov: 'garbage', unlock: 4, veh: 'garbage', vehCount: 9, pollute: 0.15, desc: 'Bigger range, much less pollution.' }),
  clinic: SV({ name: 'Medical Clinic', cat: 'services', tab: 'health', size: [2, 2], cost: 5000, upkeep: 300, radius: 13, cov: 'health', unlock: 1, veh: 'ambulance', vehCount: 1, desc: 'Keeps residents healthy and happy.' }),
  hospital: SV({ name: 'Hospital', cat: 'services', tab: 'health', size: [3, 3], cost: 20000, upkeep: 1100, radius: 28, cov: 'health', unlock: 5, veh: 'ambulance', vehCount: 4, desc: 'Large health coverage.' }),
  police: SV({ name: 'Police Station', cat: 'services', tab: 'police', size: [2, 2], cost: 6000, upkeep: 350, radius: 14, cov: 'police', unlock: 2, veh: 'police', vehCount: 2, desc: 'Patrols reduce crime nearby.' }),
  policehq: SV({ name: 'Police Headquarters', cat: 'services', tab: 'police', size: [3, 3], cost: 18000, upkeep: 900, radius: 26, cov: 'police', unlock: 5, veh: 'police', vehCount: 5, desc: 'Large police coverage.' }),
  fire: SV({ name: 'Fire Station', cat: 'services', tab: 'fire', size: [2, 2], cost: 6000, upkeep: 350, radius: 15, cov: 'fire', unlock: 2, veh: 'fire', vehCount: 2, desc: 'Fire trucks put out fires before buildings burn down.' }),
  firehq: SV({ name: 'Fire Headquarters', cat: 'services', tab: 'fire', size: [3, 3], cost: 17000, upkeep: 850, radius: 28, cov: 'fire', unlock: 5, veh: 'fire', vehCount: 5, desc: 'Large fire coverage.' }),
  elem: SV({ name: 'Elementary School', cat: 'services', tab: 'edu', size: [2, 2], cost: 7000, upkeep: 380, radius: 13, cov: 'edu', unlock: 2, desc: 'Education raises land value and enables offices.' }),
  high: SV({ name: 'High School', cat: 'services', tab: 'edu', size: [3, 3], cost: 14000, upkeep: 700, radius: 20, cov: 'edu', unlock: 4, desc: 'Wider education coverage.' }),
  univ: SV({ name: 'University', cat: 'services', tab: 'edu', size: [4, 4], cost: 35000, upkeep: 1600, radius: 34, cov: 'edu', unlock: 6, desc: 'Big boost to education and office demand.' }),
};

const PARKS: [string, string, string, number, number, number, number, number, number][] = [
  ['park', 'Pocket Park', 'small', 1, 1, 600, 20, 6, 1],
  ['playground', 'Playground', 'small', 1, 1, 900, 25, 6, 1],
  ['grove', 'Tree Grove', 'small', 1, 1, 500, 15, 5, 1],
  ['miniplaza', 'Statue Square', 'small', 1, 1, 1100, 30, 6, 2],
  ['garden', 'Community Garden', 'small', 1, 2, 1200, 30, 7, 2],
  ['court', 'Basketball Court', 'small', 1, 2, 1400, 35, 7, 2],
  ['dogpark', 'Dog Park', 'small', 2, 1, 1300, 30, 7, 3],
  ['benches', 'Shady Benches', 'small', 2, 1, 900, 20, 6, 2],
  ['plaza', 'Town Plaza', 'medium', 2, 2, 2500, 70, 9, 3],
  ['trail', 'Forest Trail', 'medium', 2, 2, 1800, 40, 9, 3],
  ['bigplay', 'Adventure Playground', 'medium', 2, 2, 3000, 80, 9, 3],
  ['skate', 'Skate Park', 'medium', 2, 2, 2800, 70, 9, 4],
  ['meadow', 'Picnic Meadow', 'medium', 2, 3, 2400, 55, 10, 4],
  ['soccer', 'Soccer Field', 'medium', 2, 3, 3600, 90, 10, 4],
  ['flowers', 'Flower Garden', 'medium', 2, 2, 3200, 80, 9, 5],
  ['bigpark', 'Central Park', 'large', 4, 4, 9000, 220, 15, 6],
  ['woods', 'Woodland Reserve', 'large', 4, 4, 6000, 120, 15, 6],
  ['grandplaza', 'Grand Plaza', 'large', 3, 3, 8500, 200, 13, 6],
  ['lakepark', 'Lake Park', 'large', 4, 3, 9500, 220, 14, 7],
  ['zen', 'Zen Garden', 'large', 3, 3, 7800, 180, 13, 7],
  ['sports', 'Sports Complex', 'large', 4, 4, 14000, 320, 16, 7],
  ['amphi', 'Amphitheater Park', 'large', 3, 4, 11000, 260, 15, 8],
];

for (const p of PARKS) {
  C.SERVICES[p[0]] = SV({ name: p[1], cat: 'parks', tab: p[2], size: [p[3], p[4]], cost: p[5], upkeep: p[6], radius: p[7], cov: 'park', unlock: p[8] });
}

const LMK: [string, string, number, number, number, number, number, number, string][] = [
  ['claude', 'Claude Arch', 3, 3, 60000, 900, 32, 7, 'A warm arch crowned with a spark. Thinks about your city.'],
  ['vscode', 'VS Code Tower', 3, 3, 70000, 1000, 32, 7, 'An office tower in the shape of the editor’s logo.'],
  ['octocat', 'Octocat Statue', 2, 2, 45000, 700, 28, 7, 'A giant cat with tentacles. Forks welcome.'],
  ['duck', 'Rubber Duck Monument', 3, 3, 50000, 700, 30, 7, 'Explain your bugs to it. It listens.'],
  ['terminal', 'Terminal Monolith', 2, 2, 55000, 800, 28, 8, 'A black slab with a blinking prompt.'],
  ['stack', 'Stack Tower', 2, 2, 80000, 1100, 34, 8, 'Stacked slabs that never quite line up.'],
  ['neural', 'Neural Net Sphere', 3, 3, 90000, 1200, 36, 8, 'Nodes and weights lit up at night.'],
  ['python', 'Twin Serpent Towers', 3, 3, 100000, 1300, 36, 9, 'Two coiled towers, blue and yellow.'],
  ['tux', 'Penguin Plaza', 3, 3, 65000, 900, 30, 8, 'A friendly penguin on an open plaza.'],
  ['whale', 'Container Whale', 4, 3, 85000, 1100, 34, 9, 'A whale carrying stacked shipping containers.'],
  ['stadium', 'Hackathon Arena', 4, 4, 120000, 1500, 40, 9, 'Attracts visitors citywide.'],
  ['tower', 'Cloud Spire', 2, 2, 110000, 1200, 38, 9, 'An observation tower above the clouds.'],
];

for (const p of LMK) {
  C.SERVICES[p[0]] = SV({ name: p[1], cat: 'landmarks', tab: 'landmarks', size: [p[2], p[3]], cost: p[4], upkeep: p[5], radius: p[6], cov: 'landmark', unlock: p[7], desc: p[8] });
}

C.TRANSIT = {
  bus: { name: 'Bus', speed: 10, cap: 30, upkeep: 90, fare: 2, stopCost: 250, unlock: 3, len: 10 },
  tram: { name: 'Streetcar', speed: 12, cap: 70, upkeep: 220, fare: 2, stopCost: 600, unlock: 4, len: 14 },
  rail: { name: 'Train / Metro', speed: 24, cap: 160, upkeep: 600, fare: 3, stopCost: 7000, ugStopCost: 11000, unlock: 6, len: 14 },
};

C.RAIL = [
  null,
  { key: 'elev', name: 'Elevated Track', cost: 160, upkeep: 1.5, desc: 'Track on a viaduct. Can cross roads and water.' },
  { key: 'sub', name: 'Subway Tunnel', cost: 320, upkeep: 2.5, desc: 'Underground track. Nothing on the surface is affected.' },
];

C.MILESTONES = [
  { name: 'Settlement', pop: 0, reward: 0, unlocks: '' },
  { name: 'Hamlet', pop: 50, reward: 8000, unlocks: 'Garbage collection, Medical Clinic, bike lanes, small parks' },
  { name: 'Village', pop: 150, reward: 12000, unlocks: 'Police, fire, schools, avenues, more small roads' },
  { name: 'Small Town', pop: 300, reward: 18000, unlocks: 'Buses, medium density housing, medium parks, protected bike lanes' },
  { name: 'Town', pop: 600, reward: 25000, unlocks: 'Highways, streetcars, high school, recycling, dense commercial' },
  { name: 'Large Town', pop: 1200, reward: 35000, unlocks: 'Boulevards, offices, hospital, police and fire HQ' },
  { name: 'Small City', pop: 2500, reward: 50000, unlocks: 'Trains and metro, university, high density housing, large parks' },
  { name: 'City', pop: 5000, reward: 70000, unlocks: 'First landmarks: Claude Arch, VS Code Tower, Octocat, Rubber Duck' },
  { name: 'Big City', pop: 9000, reward: 100000, unlocks: 'More landmarks: Terminal, Stack Tower, Neural Sphere, Penguin Plaza' },
  { name: 'Metropolis', pop: 15000, reward: 150000, unlocks: 'Twin Serpent Towers, Container Whale, Hackathon Arena, Cloud Spire' },
];

C.QUALITY = {
  low: { res: 0.7, shadows: 0, aa: false, view: 1100, cars: 250, trees: 0.35, lighting: 'simple', water: 'simple', detail: false },
  medium: { res: 1, shadows: 1024, aa: true, view: 1700, cars: 500, trees: 0.7, lighting: 'pbr', water: 'simple', detail: false },
  high: { res: 1.25, shadows: 2048, aa: true, view: 2400, cars: 900, trees: 1, lighting: 'pbr', water: 'waves', detail: true },
  ultra: { res: 2, shadows: 4096, aa: true, view: 3200, cars: 1400, trees: 1.4, lighting: 'pbr', water: 'waves', detail: true },
};

C.MAPS = [
  { key: 'valley', name: 'Alder Valley', desc: 'A river valley under northern mountains, opening onto the sea in the south.' },
  { key: 'coast', name: 'Gull Bay', desc: 'A wide bay with sandy beaches to the east and a rocky headland. Lots of waterfront.' },
  { key: 'lakes', name: 'Pine Lakes', desc: 'Rolling forest dotted with lakes. Build around the shores.' },
  { key: 'highlands', name: 'Granite Highlands', desc: 'Hilly ground cut by a winding river gorge. Plan roads with the slopes.' },
  { key: 'islands', name: 'Twin Isles', desc: 'The mainland and a big island across a strait. You will need bridges.' },
];
