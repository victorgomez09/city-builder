import * as THREE from 'three';

export type RoadGroup = 'small' | 'medium' | 'large' | 'highway' | 'path' | 'legacy';
export type RoadSurface = 'asph' | 'dirt';
export type MedianType = 'none' | 'paint' | 'curb' | 'grass' | 'trees' | 'barrier';

export interface RoadLayout {
  sw: number;
  bw: number;
  fwd: number[];
  back: number[];
  med: number;
  pair: boolean;
  lw: number;
  left?: number;
  medX?: number;
  bikeOff?: number;
  walkOff?: number;
  path?: boolean;
}

export interface RoadDef {
  key: string;
  name: string;
  grp: RoadGroup;
  w: number;
  fwd: number;
  back: number;
  oneway: boolean;
  speed: number;
  cap: number;
  cost: number;
  upkeep: number;
  zonable: boolean;
  side: number;
  bike: number; // 0 none, 1 painted, 2 protected
  med: MedianType;
  surf: RoadSurface;
  tram: boolean;
  car: boolean;
  unlock: number;
  desc: string;
  trees?: boolean;
  L?: RoadLayout;
}

export interface PathDef {
  key: string;
  name: string;
  cost: number;
  upkeep: number;
  unlock: number;
  col: string;
  bike: number;
  desc: string;
}

export type ZoneCategory = 'res' | 'com' | 'ind' | 'off';

export interface ZoneDef {
  key: string;
  name: string;
  short: string;
  cat: ZoneCategory;
  color: string;
  unlock: number;
  lots: [number, number, number][]; // [width, depth, weight]
  cap: number[];
  perBuilding?: boolean;
  rows?: boolean;
}

export type ServiceCategory = 'services' | 'parks' | 'landmarks';

export interface ServiceDef {
  name: string;
  cat: ServiceCategory;
  tab: string;
  size: [number, number];
  cost: number;
  upkeep: number;
  radius: number;
  cov?: string;
  unlock: number;
  veh?: string;
  vehCount?: number;
  pollute?: number;
  desc?: string;
}

export interface RailDef {
  key: string;
  name: string;
  cost: number;
  upkeep: number;
  desc: string;
}

export interface TransitVehicleConfig {
  name: string;
  speed: number;
  cap: number;
  upkeep: number;
  fare: number;
  stopCost: number;
  ugStopCost?: number;
  unlock: number;
  len: number;
}

export interface Milestone {
  name: string;
  pop: number;
  reward: number;
  unlocks: string;
}

export interface QualityPreset {
  res: number;
  shadows: number;
  aa: boolean;
  view: number;
  cars: number;
  trees: number;
  lighting: 'simple' | 'pbr';
  water: 'simple' | 'waves';
  detail: boolean;
}

export interface MapDef {
  key: string;
  name: string;
  desc: string;
}

export type ResourceType = 0 | 1 | 2 | 3 | 4; // 0: none, 1: fertile, 2: forest, 3: ore, 4: oil

export interface SupplyChainStats {
  rawFood: number;
  rawTimber: number;
  rawOre: number;
  rawOil: number;
  processedGoods: number;
  consumerGoods: number;
  localProduction: number;
  cityDemand: number;
  importedGoods: number;
  exportedGoods: number;
  importCost: number;
  exportRevenue: number;
  stockoutStores: number;
  commercialStockRate: number;
}

export type IntersectionControl = 'auto' | 'none' | 'lights' | 'stop' | 'allstop' | 'round';

export interface JunctionConfig {
  ctrl: IntersectionControl;
  stops: Record<number, boolean>;
  lanes: Record<number, number[]>;
  green?: [number, number];
}

export interface JunctionApproach {
  tile: number;
  into: number;
  d: number;
  key: number;
  lanes: number;
  cl?: number;
}

export interface JunctionExit {
  tile: number;
  from: number;
  d: number;
}

export interface JunctionCluster {
  id: number;
  tiles: number[];
  aps: JunctionApproach[];
  exits: JunctionExit[];
  cx: number;
  cy: number;
  rank: number;
  cars: boolean;
  cfg: JunctionConfig;
  avail: number[];
  mask: number[];
  ctrl: string;
  phase: number;
  pt: number;
  wait?: number[];
}

export interface PickResult {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  i: number;
}

export interface BuildingWorkRecord {
  id: number;
  n: number;
}

export interface Building {
  id: number;
  kind?: 'zone' | 'svc';
  type?: string;
  name?: string;
  x: number;
  y: number;
  fw: number;
  fh: number;
  w?: number;
  d?: number;
  dir: number;
  roadTile?: number;
  road?: number;
  baseY?: number;
  minY?: number;
  lvl?: number;
  level?: number;
  zone?: number;
  svc?: string;
  state?: 'site' | 'live' | 'aband' | 'burn' | 'build' | 'fire';
  abandoned?: boolean;
  occ?: number;
  occMax?: number;
  cap?: number;
  res?: number;
  residents?: number[];
  jobs?: number;
  workers?: BuildingWorkRecord[];
  work?: BuildingWorkRecord[];
  filled?: number;
  inbound?: number;
  employed?: number;
  outTown?: number;
  prob?: string | null;
  prog?: number;
  gTarget?: boolean;
  low?: number;
  pop?: number;
  commute?: number;
  happy?: number;
  garbage?: number;
  transit?: number;
  cust?: number;
  custRatio?: number;
  abandT?: number;
  buildT?: number;
  st?: number;
  seed?: number;
  tint?: number;
  tintCol?: string;
  vehOut?: number;
  outside?: number;
  parkKey?: string;
  svcKey?: string;
  mesh?: THREE.Object3D;
  fireProg?: number;
  fire?: number;
  age?: number;
  waterNear?: boolean;
  waterEdge?: boolean;
  stock?: number;
  stockMax?: number;
  stockoutHours?: number;
  industryType?: 'generic' | 'farming' | 'forestry' | 'mining' | 'oil';
  outputRate?: number;
  rawDemand?: number;
  _door?: {
    road?: number;
    x?: number;
    z?: number;
    door?: [number, number];
    curb?: [number, number];
    ux?: number;
    uz?: number;
    [key: string]: unknown;
  };
  _h?: number;
  ang?: number;
  noLevel?: boolean;
}

export interface SimIcon {
  id?: number;
  type: string;
  x: number;
  y: number;
  z: number;
  tile?: number;
}

export interface SimNotice {
  text: string;
  kind: string;
}

export interface Vehicle {
  id: number;
  kind: string;
  type?: string;
  name?: string;
  path: number[];
  pIdx?: number;
  x: number;
  y?: number;
  z: number;
  heading?: number;
  speed: number;
  vmax?: number;
  len?: number;
  color?: string | number[];
  loop?: boolean;
  src?: number;
  dst?: number;
  stuck?: number;
  service?: string;
  target?: number;
  targetBld?: Building | null;
  wait?: number;
  line?: TransitLine;
  passengers?: number;
  pass?: TransitWaitingPassenger[];
  load?: number;
  dir?: number;
  lane?: number;
  laneIn?: number;
  laneOut?: number;
  from?: number;
  to?: number;
  segT?: number;
  bend?: number[];
  born?: number;
  onSeg?: boolean;
  dwell?: number;
  stopK?: number;
  stopAt?: number;
  waitStop?: number;
  cargo?: string;
  purpose?: string;
  fromBld?: Building | null;
  toBld?: Building | null;
  fromB?: Building | null;
  toB?: Building | null;
  nx?: number;
  cur?: number;
  next?: number;
  prev?: number;
  entryDir?: number;
  pref?: number;
  lw?: number;
  ex?: number;
  ez?: number;
  xx?: number;
  xz?: number;
  cx?: number;
  cz?: number;
  turn?: number;
  drv?: number;
  deg?: number;
  apKey?: number;
  stopDone?: number;
  seg?: number;
  t?: number;
  dout?: number;
  din?: number;
  hx?: number;
  hz?: number;
  jNext?: number;
  nextTurn?: number;
  done?: (() => void) | null;
  onArrive?: ((v: Vehicle, ok: boolean) => void) | null;
  onDwellEnd?: (() => void) | null;
  onStop?: ((v: Vehicle) => void) | null;
  onBroken?: ((v: Vehicle) => void) | null;
  gaveUp?: boolean;
  col?: string | number[] | null;
  data?: unknown;
  L?: number;
  ph?: { c: Bezier2D; t: number; out?: boolean; wander?: boolean; pause?: number } | null;
}

export interface Bezier2D {
  ax: number;
  az: number;
  cx: number;
  cz: number;
  bx: number;
  bz: number;
  len: number;
}

export interface VehicleSpawnRequest {
  from: number;
  to: number;
  fromB?: Building | null;
  toB?: Building | null;
  kind?: string;
  col?: string | number[] | null;
  purpose?: string;
  cargo?: string;
  data?: unknown;
  onArrive?: ((v?: Vehicle, ok?: boolean) => void) | null;
  onFail?: ((reason?: string) => void) | null;
}

export interface ParkSpot {
  a: string;
  x: number;
  z: number;
  y?: number;
  fx?: number;
  fz?: number;
  rx?: number;
  rz?: number;
  ax?: number;
  az?: number;
  cx?: number;
  cz?: number;
  kid?: boolean;
  busy?: SoftAgent | null;
  [key: string]: unknown;
}

export interface ParkData {
  spots: ParkSpot[];
  paths: [number, number][][];
  area: [number, number, number, number] | null;
  play: boolean;
}

export interface SoftDoing {
  until: number;
  action?: string;
  type?: string;
  t0?: number;
  spot?: ParkSpot;
  tx?: number;
  tz?: number;
  pause?: number;
  go?: { c: Bezier2D; t: number; ball?: boolean };
  ball?: boolean;
  ph?: number;
  q?: ParkSpot;
  pts?: [number, number][];
  idx?: number;
  [key: string]: unknown;
}

export interface SoftAgent {
  id: number;
  kind?: string;
  bike: boolean;
  path: number[];
  pIdx: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  vmax: number;
  color: string | number[];
  targetBld?: Building | number;
  target?: ParkSpot | Building | number | null;
  segT?: number;
  bend?: number[];
  wait?: number;
  cur?: number;
  next?: number;
  t?: number;
  kid?: boolean;
  hx?: number;
  hz?: number;
  yo?: number;
  side?: number;
  seg?: number;
  ex?: number;
  ez?: number;
  xx?: number;
  xz?: number;
  cx?: number;
  cz?: number;
  turn?: number;
  len?: number;
  curve?: Bezier2D;
  fromB?: Building | null;
  toB?: Building | null;
  done?: ((t: number, ok: boolean) => void) | null;
  doing?: SoftDoing;
  mode?: string;
  visit?: { b: Building; until: number };
  pose?: string | null;
  sp?: number;
  born?: number;
  onArrive?: ((time: number, ok: boolean) => void) | null;
  ph?: { c: Bezier2D; t: number; out?: boolean; wander?: boolean; pause?: number } | null;
  walk?: { pts: [number, number][]; k: number; dir: number; ox: number; oz: number } | null;
}

export interface TransitLeg {
  line: number;
  from: number;
  to: number;
  type?: string;
}

export interface TransitWaitingPassenger {
  to?: number;
  n: number;
  t?: number;
  t0?: number;
  legs: TransitLeg[];
  li: number;
  onDone?: ((p?: TransitWaitingPassenger) => void) | null;
}

export interface TransitStop {
  id: number;
  type: 'bus' | 'tram' | 'rail';
  tile: number;
  side: number;
  name: string;
  waiting: TransitWaitingPassenger[];
  color: string | null;
}

export type TransitStopTarget = TransitStop | { tile: number; side?: number };

export interface TransitLine {
  id: number;
  type: 'bus' | 'tram' | 'rail';
  name: string;
  color: string;
  stops: number[];
  vehicles: number;
  fare: number;
  ridersMonth: number;
  ridersLast: number;
  broken: boolean;
  path?: number[];
  sidx?: number[];
  length?: number;
  loopTime?: number;
  poly?: number[];
  cum?: Float32Array;
  plen?: number;
  stopS?: number[];
  ribbon?: THREE.Mesh;
}

export interface TransitTrain {
  line: TransitLine;
  s: number;
  v: number;
  dwell: number;
  pass: TransitWaitingPassenger[];
  load: number;
  nextK: number;
}

export interface TransitRoute {
  time: number;
  o: TransitStop;
  d: TransitStop;
  legs: TransitLeg[];
  _t0?: number;
}

export interface ToolState {
  type: string;
  road?: number;
  rt?: number;
  zone?: number;
  z?: number;
  svc?: string;
  key?: string;
  id?: number;
  st?: 'bus' | 'tram' | 'rail';
  lt?: 'bus' | 'tram' | 'rail';
  pk?: number;
  rr?: number;
  apply?: IntersectionControl;
  path?: number;
  rail?: number;
  line?: number;
  mode?: string;
  editJunction?: number;
  districtId?: number;
  radius?: number;
  [key: string]: unknown;
}

export type DistrictSpecialization =
  | 'none'
  | 'eco_res'
  | 'nightlife'
  | 'organic'
  | 'farming'
  | 'forestry'
  | 'mining'
  | 'oil'
  | 'tech';

export interface DistrictPolicies {
  heavyTrafficBan?: boolean;
  waterMetering?: boolean;
  smokingBan?: boolean;
  recycling?: boolean;
  smokeDetectors?: boolean;
  freeTransit?: boolean;
  bikeCity?: boolean;
  localBusinessTaxRelief?: boolean;
}

export interface DistrictStats {
  tiles: number;
  pop: number;
  buildings: number;
  jobs: number;
  workers: number;
  avgLandValue: number;
  avgHappy: number;
  unemployment: number;
  crime: number;
  pollution: number;
  garbage: number;
  powerUsage: number;
  waterUsage: number;
  taxIncome: number;
}

export interface District {
  id: number;
  name: string;
  color: string;
  spec: DistrictSpecialization;
  policies: DistrictPolicies;
  stats: DistrictStats;
  cx: number;
  cy: number;
}

export interface CoverageMaps {
  police: Float32Array;
  fire: Float32Array;
  health: Float32Array;
  edu: Float32Array;
  park: Float32Array;
  transit: Float32Array;
  pollution: Float32Array;
  landValue: Float32Array;
  waterNear: Uint8Array;
}

export interface DemandData {
  rlow: number;
  rmed: number;
  rhigh: number;
  com: number;
  ind: number;
  off: number;
  res?: number;
}

export interface TaxRates {
  res: number;
  com: number;
  ind: number;
  off: number;
}

export interface SimStats {
  pop: number;
  workers?: number;
  employed: number;
  jobs: number;
  filled?: number;
  happy: number;
  unemp?: number;
  edu?: number;
  outsideIn?: number;
  transitShare?: number;
  commute?: number;
  buildingCount?: number;
  homeless?: number;
  taxIncome?: number;
  unemployment?: number;
  commuteAvg?: number;
  unhappyTax?: number;
  unhappyCommute?: number;
  unhappyHealth?: number;
  unhappyCrime?: number;
  unhappyPollution?: number;
  supply?: SupplyChainStats;
}

export interface Loan {
  balance: number;
  payment: number;
  monthsLeft: number;
  rate: number;
}

export interface BudgetLedger {
  tax: { res: number; com: number; ind: number; off: number };
  svc: Record<string, number>;
  transit: number;
  loan: number;
  inc: number;
  exp: number;
  net: number;
  fares?: number;
}

export interface BuildingSpec {
  kind?: 'zone' | 'svc';
  type?: string;
  x: number;
  y: number;
  fw: number;
  fh: number;
  w?: number;
  d?: number;
  dir: number;
  roadTile?: number;
  road?: number;
  baseY?: number;
  minY?: number;
  lvl?: number;
  zone?: number;
  svc?: string;
  parkKey?: string;
  svcKey?: string;
  name?: string;
  state?: 'site' | 'live' | 'aband' | 'burn' | 'build' | 'fire';
  buildT?: number;
  noLevel?: boolean;
}

export interface ServiceLotResult {
  ok: boolean;
  reason?: string;
  x?: number;
  y?: number;
  fw?: number;
  fh?: number;
  w?: number;
  d?: number;
  dir?: number;
  road?: number;
  baseY?: number;
  minY?: number;
}

export interface TransitStats {
  riders: number;
}

export interface LoanItem {
  amount: number;
  rate: number;
  left: number;
  payment: number;
}
export type LoanRecord = LoanItem;

export interface BudgetReport {
  inc: Record<string, number>;
  exp: Record<string, number>;
}

export interface BudgetState {
  [key: string]: unknown;
}

export interface SerializedTransitStop {
  id: number;
  type: 'bus' | 'tram' | 'rail';
  tile: number;
  side: number;
  name: string;
  color: string | null;
}

export interface SerializedTransitLine {
  id: number;
  type: 'bus' | 'tram' | 'rail';
  name: string;
  color: string;
  stops: number[];
  vehicles: number;
  fare?: number;
  ridersLast: number;
}

export interface SerializedTransit {
  stops: SerializedTransitStop[];
  lines: SerializedTransitLine[];
  nextStop: number;
  nextLine: number;
  stats?: TransitStats;
}

export interface SerializedDistrict {
  id: number;
  name: string;
  color: string;
  policies: DistrictPolicies;
  spec: DistrictSpecialization;
}

export interface SerializedJunction {
  tile: number;
  ctrl: IntersectionControl;
  stops: Record<number, boolean>;
  lanes: Record<number, number[]>;
  green?: [number, number];
}

export interface SerializedCity {
  v: number;
  name: string;
  seed: number;
  map: string;
  month: number;
  hour: number;
  money: number;
  tax: TaxRates;
  loans: LoanItem[];
  stats: SimStats;
  milestone: number;
  buildings: Partial<Building>[];
  lines: SerializedTransitLine[];
  stops: SerializedTransitStop[];
  road: string;
  link: string;
  pcell: string;
  rdir: string;
  rpart: string;
  curv: string;
  rail: string;
  zone: string;
  tree: string;
  resource?: string;
  district?: string;
  districts?: SerializedDistrict[];
  hce?: number[];
  hcEdits?: [number, number][];
  jcfg?: (SerializedJunction | { t?: number; c?: unknown; [key: number]: unknown })[];
  dayAcc?: number;
  nextId?: number;
  history?: { pop: number; money: number }[];
  last?: BudgetReport;
  budget?: BudgetReport;
  unseen?: string[];
  nextDistrictId?: number;
  transit?: SerializedTransit;
  [key: string]: unknown;
}
