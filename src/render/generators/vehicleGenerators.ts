// ============================================================================
// Vira City — Procedural Vehicle Mesh Generators
// ============================================================================

import * as THREE from 'three';
import { GB, lc } from '../geometryBuilder';
import { U } from '../../core/utils';

export const VEH_KINDS = [
  'car',
  'suv',
  'van',
  'truck',
  'bus',
  'tram',
  'police',
  'ambulance',
  'fire',
  'garbage',
  'hearse',
  'train',
  'bike',
  'bike2',
  'ped',
  'ped2',
  'sit',
  'ball',
  'barricade',
];

export const CAR_COLORS = [
  '#d8dadc',
  '#1e2125',
  '#8c1c1c',
  '#f2f2f2',
  '#25467a',
  '#5d686e',
  '#9aa0a4',
  '#3a5a3a',
  '#b8862f',
  '#6e2a4a',
  '#c45a1c',
  '#2b2b30',
].map(lc);

export let wheelLite = false;
export function setWheelLite(val: boolean) {
  wheelLite = val;
}

const WHEEL = new THREE.CylinderGeometry(1, 1, 1, 14).rotateX(Math.PI / 2);
const RIM = new THREE.CylinderGeometry(1, 1, 1, 10).rotateX(Math.PI / 2);
const WHEEL_LO = new THREE.CylinderGeometry(1, 1, 1, 8).rotateX(Math.PI / 2);

export function extrude(
  gb: GB,
  prof: [number, number][],
  z0: number,
  z1: number,
  col: string | number[],
  st: number = 0,
  inset: number = 0
) {
  const n = prof.length,
    k = inset || 0;
  for (let i = 0; i < n; i++) {
    const a = prof[i],
      b = prof[(i + 1) % n];
    gb.quad([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1], col, st);
  }
  let cx = 0,
    cy = 0;
  for (const p of prof) {
    cx += p[0];
    cy += p[1];
  }
  cx /= n;
  cy /= n;
  for (let i = 0; i < n; i++) {
    const a = prof[i],
      b = prof[(i + 1) % n];
    const sh = (p: [number, number], z: number) => [p[0] + (cx - p[0]) * k, p[1] + (cy - p[1]) * k, z];
    gb.tri(sh(a, z1), sh(b, z1), [cx, cy, z1], col, st);
    gb.tri(sh(b, z0), sh(a, z0), [cx, cy, z0], col, st);
  }
}

function wheelHQ(gb: GB, x: number, z: number, r: number, w: number, rimCol?: string) {
  if (wheelLite) {
    gb.addThree(
      WHEEL_LO,
      new THREE.Matrix4().makeScale(r, r, w).setPosition(x, r, z),
      '#141414',
      17
    );
    return;
  }
  gb.addThree(WHEEL, new THREE.Matrix4().makeScale(r, r, w).setPosition(x, r, z), '#141414', 17);
  const side = z > 0 ? 1 : -1;
  gb.addThree(
    RIM,
    new THREE.Matrix4().makeScale(r * 0.6, r * 0.6, 0.04).setPosition(x, r, z + side * (w * 0.5 + 0.015)),
    rimCol || '#b8bcc2',
    16
  );
}

function axle(gb: GB, x: number, W: number, r: number, w: number, rimCol: string = '#b8bcc2') {
  for (const s of [-1, 1]) {
    const zc = s * (W + 0.03 - w / 2);
    wheelHQ(gb, x, zc, r, w, rimCol);
    const zf = s * (W + 0.008);
    const a = r + 0.1,
      top = 2 * r + 0.08;
    extrude(
      gb,
      [
        [x - a, 0.12],
        [x + a, 0.12],
        [x + a, r + 0.05],
        [x + a * 0.7, top - 0.05],
        [x, top],
        [x - a * 0.7, top - 0.05],
        [x - a, r + 0.05],
      ],
      zf - 0.006,
      zf + 0.006,
      '#0e0e10',
      17
    );
  }
}

function pane(
  gb: GB,
  a: [number, number],
  b: [number, number],
  z0: number,
  z1: number,
  t0: number,
  t1: number,
  out: number
) {
  const lx = b[0] - a[0],
    ly = b[1] - a[1],
    l = Math.hypot(lx, ly),
    nx = (ly / l) * out,
    ny = (-lx / l) * out;
  const P = (t: number) => [a[0] + lx * t + nx, a[1] + ly * t + ny];
  const A = P(t0),
    B = P(t1);
  gb.quad([A[0], A[1], z0], [A[0], A[1], z1], [B[0], B[1], z1], [B[0], B[1], z0], '#fff', 9);
  gb.quad([A[0], A[1], z1], [A[0], A[1], z0], [B[0], B[1], z0], [B[0], B[1], z1], '#fff', 9);
}

function shrink(prof: [number, number][], k: number, dy?: number): [number, number][] {
  let cx = 0,
    cy = 0;
  for (const p of prof) {
    cx += p[0];
    cy += p[1];
  }
  cx /= prof.length;
  cy /= prof.length;
  return prof.map(p => [p[0] + (cx - p[0]) * k, p[1] + (cy - p[1]) * k + (dy || 0)]);
}

function sideGlass(gb: GB, prof: [number, number][], zs: number[]) {
  for (const z of zs) extrude(gb, prof, z - 0.012, z + 0.012, '#fff', 9);
}

function chamferRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  c: number,
  c2?: number
): [number, number][] {
  const d = c2 === undefined ? c : c2;
  return [
    [x0, y0 + d],
    [x0 + d, y0],
    [x1 - d, y0],
    [x1, y0 + d],
    [x1, y1 - c],
    [x1 - c, y1],
    [x0 + c, y1],
    [x0, y1 - c],
  ];
}

function carHQ(gb: GB, L: number, W: number, H: number, kind: string) {
  const body = '#fff',
    trim = '#24262a';
  const sill = 0.3,
    belt = H * 0.53,
    roof = H;
  const hood = L * 0.44,
    rear = -L * 0.8;
  extrude(
    gb,
    [
      [-L + 0.12, sill],
      [L - 0.15, sill],
      [L + 0.03, sill + 0.25],
      [L, belt - 0.2],
      [L - 0.35, belt + 0.02],
      [-L + 0.25, belt + 0.05],
      [-L - 0.02, belt - 0.12],
      [-L - 0.04, sill + 0.22],
    ],
    -W,
    W,
    body,
    0
  );
  const cab: [number, number][] =
    kind === 'suv'
      ? [
          [-L + 0.2, belt],
          [hood - 0.15, belt],
          [hood - 0.75, roof - 0.05],
          [hood - 0.95, roof],
          [-L + 0.42, roof],
          [-L + 0.3, roof - 0.08],
        ]
      : [
          [rear + 0.1, belt],
          [hood, belt],
          [hood - 0.95, roof - 0.04],
          [hood - 1.15, roof],
          [rear + 0.8, roof],
          [rear + 0.65, roof - 0.04],
        ];
  const cw = W - 0.1;
  extrude(gb, cab, -cw, cw, body, 0);
  pane(gb, cab[1], cab[2], -cw + 0.12, cw - 0.12, 0.08, 0.95, 0.012);
  pane(gb, cab[5], cab[0], -cw + 0.14, cw - 0.14, 0.05, 0.86, 0.012);
  const sg = shrink([cab[0], cab[1], cab[2], cab[3], cab[4], cab[5]], 0.2, 0.03);
  sideGlass(gb, sg, [-cw - 0.006, cw + 0.006]);
  for (const z of [-cw - 0.02, cw + 0.02])
    gb.box(-0.12, belt, z - 0.015, 0.06, roof - 0.06, z + 0.015, body);
  gb.box(L - 0.06, sill - 0.04, -W + 0.08, L + 0.1, sill + 0.3, W - 0.08, trim, 17);
  gb.box(-L - 0.12, sill - 0.04, -W + 0.08, -L + 0.06, sill + 0.3, W - 0.08, trim, 17);
  gb.box(L + 0.03, belt - 0.5, -W * 0.42, L + 0.06, belt - 0.3, W * 0.42, '#151618');
  gb.box(-L - 0.14, sill + 0.33, -0.3, -L - 0.1, sill + 0.5, 0.3, '#e8e8e0');
  for (const z of [-W + 0.28, W - 0.28]) {
    gb.box(L - 0.02, belt - 0.42, z - 0.22, L + 0.05, belt - 0.24, z + 0.22, '#fff', 6);
    gb.box(-L - 0.07, belt - 0.4, z - 0.24, -L, belt - 0.2, z + 0.24, '#fff', 7);
  }
  for (const z of [-W - 0.13, W + 0.13])
    gb.box(
      hood - 0.4,
      belt + 0.03,
      Math.min(z, z * 0.88) - 0.03,
      hood - 0.2,
      belt + 0.2,
      Math.max(z, z * 0.88) + 0.03,
      body
    );
  for (const z of [-W - 0.004, W + 0.004]) {
    gb.box(-L * 0.42, sill + 0.4, z - 0.004, -L * 0.42 + 0.04, belt - 0.06, z + 0.004, trim, 17);
    gb.box(0.2, belt - 0.2, z - 0.006, 0.42, belt - 0.15, z + 0.006, trim, 17);
  }
  gb.box(-L + 0.1, sill - 0.02, -W - 0.01, L - 0.1, sill + 0.08, W + 0.01, trim, 17);
  const wr = kind === 'suv' ? 0.42 : 0.35,
    wx = L * 0.64;
  for (const x of [-wx, wx]) axle(gb, x, W, wr, 0.24);
  if (kind === 'suv') {
    gb.box(-L * 0.6, roof + 0.07, -W + 0.15, L * 0.1, roof + 0.13, -W + 0.22, trim, 17);
    gb.box(-L * 0.6, roof + 0.07, W - 0.22, L * 0.1, roof + 0.13, W - 0.15, trim, 17);
  }
}

function cabHQ(
  gb: GB,
  x0: number,
  x1: number,
  H: number,
  W: number,
  col: string | number[],
  opts?: { slope?: number }
) {
  opts = opts || {};
  const prof: [number, number][] = [
    [x0, 0.45],
    [x1 - 0.1, 0.45],
    [x1 + 0.04, 0.7],
    [x1, H * 0.55],
    [x1 - (opts.slope || 0.45), H - 0.1],
    [x1 - (opts.slope || 0.45) - 0.12, H],
    [x0, H],
  ];
  extrude(gb, prof, -W, W, col, 0);
  pane(gb, prof[3], prof[4], -W + 0.15, W - 0.15, 0.06, 0.94, 0.012);
  const sg: [number, number][] = [
    [x0 + 0.25, H * 0.55],
    [x1 - 0.15, H * 0.55],
    [x1 - (opts.slope || 0.45) + 0.05, H - 0.2],
    [x0 + 0.25, H - 0.2],
  ];
  sideGlass(gb, sg, [-W - 0.006, W + 0.006]);
  gb.box(x1 - 0.02, 0.5, -W + 0.1, x1 + 0.12, 0.85, W - 0.1, '#24262a');
  for (const z of [-W + 0.28, W - 0.28])
    gb.box(x1 + 0.02, 0.95, z - 0.2, x1 + 0.07, 1.15, z + 0.2, '#fff', 6);
  for (const z of [-W - 0.15, W + 0.15])
    gb.box(
      x1 - 0.5,
      H * 0.55,
      Math.min(z, z * 0.9) - 0.03,
      x1 - 0.35,
      H * 0.55 + 0.35,
      Math.max(z, z * 0.9) + 0.03,
      '#24262a'
    );
}

function boxBody(
  gb: GB,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  W: number,
  col: string | number[],
  st: number = 0
) {
  extrude(gb, chamferRect(x0, y0, x1, y1, 0.12, 0.05), -W, W, col, st || 0);
}

function windowBand(gb: GB, x0: number, x1: number, y0: number, y1: number, W: number) {
  for (const z of [-W - 0.006, W + 0.006])
    extrude(gb, chamferRect(x0, y0, x1, y1, 0.06), z - 0.012, z + 0.012, '#fff', 9);
}

function tail(gb: GB, x: number, W: number, y: number) {
  for (const z of [-W + 0.25, W - 0.25])
    gb.box(x - 0.05, y, z - 0.18, x + 0.01, y + 0.25, z + 0.18, '#fff', 7);
}

function heavyHQ(gb: GB, kind: string): boolean {
  switch (kind) {
    case 'van':
      boxBody(gb, -2.8, 1.25, 0.4, 2.55, 1.0, '#fff');
      cabHQ(gb, 1.2, 2.8, 2.3, 0.98, '#fff', { slope: 0.6 });
      windowBand(gb, -0.4, 1.0, 1.55, 2.2, 1.0);
      tail(gb, -2.85, 1.0, 0.8);
      for (const x of [-1.85, 1.95]) axle(gb, x, 1.0, 0.38, 0.26);
      break;
    case 'ambulance':
      boxBody(gb, -2.8, 1.35, 0.4, 2.8, 1.05, '#f6f6f6');
      cabHQ(gb, 1.3, 2.85, 2.25, 1.02, '#f6f6f6', { slope: 0.6 });
      gb.box(-2.82, 1.15, -1.07, 2.86, 1.45, 1.07, '#d92a2a');
      gb.box(0.6, 2.8, -0.75, 1.3, 3.0, -0.05, '#ff3030', 5);
      gb.box(0.6, 2.8, 0.05, 1.3, 3.0, 0.75, '#2050ff', 5);
      tail(gb, -2.85, 1.05, 0.8);
      for (const x of [-1.85, 1.95]) axle(gb, x, 1.05, 0.38, 0.26);
      break;
    case 'hearse':
      boxBody(gb, -2.9, 1.25, 0.35, 2.5, 0.98, '#18191b');
      cabHQ(gb, 1.25, 2.7, 2.05, 0.96, '#18191b', { slope: 0.55 });
      windowBand(gb, -0.6, 1.0, 1.45, 1.85, 0.95);
      gb.box(-2.5, 1.3, -1.0, -0.5, 1.4, -0.96, '#d8d8d8');
      gb.box(-2.5, 1.3, 0.96, -0.5, 1.4, 1.0, '#d8d8d8');
      tail(gb, -2.95, 0.95, 0.75);
      for (const x of [-1.8, 1.8]) axle(gb, x, 0.98, 0.36, 0.25);
      break;
    case 'truck':
      cabHQ(gb, 1.55, 3.6, 2.95, 1.15, '#fff', { slope: 0.35 });
      boxBody(gb, -3.65, 1.45, 0.75, 3.55, 1.22, '#e8e6e0');
      gb.box(-3.66, 0.55, -1.0, 1.45, 0.75, 1.0, '#2a2c30');
      tail(gb, -3.7, 1.2, 0.9);
      for (const x of [-2.7, -1.5]) axle(gb, x, 1.22, 0.46, 0.32);
      axle(gb, 2.65, 1.15, 0.46, 0.3);
      break;
    case 'garbage':
      cabHQ(gb, 1.8, 3.6, 2.85, 1.15, '#f0f0f0', { slope: 0.3 });
      boxBody(gb, -3.65, 1.7, 0.6, 3.2, 1.2, '#2f7a3b');
      extrude(
        gb,
        [
          [-3.65, 0.6],
          [-3.2, 0.6],
          [-3.2, 3.2],
          [-3.9, 2.9],
          [-3.9, 1.0],
        ],
        -1.15,
        1.15,
        '#27662f'
      );
      tail(gb, -3.92, 1.1, 1.2);
      axle(gb, -2.5, 1.2, 0.46, 0.32);
      axle(gb, 2.6, 1.15, 0.46, 0.3);
      break;
    case 'fire':
      cabHQ(gb, 1.9, 3.6, 2.7, 1.2, '#c8231c', { slope: 0.3 });
      boxBody(gb, -3.6, 1.85, 0.5, 2.6, 1.22, '#c8231c');
      gb.box(-3.3, 2.65, -0.35, 1.7, 2.8, -0.25, '#d8d8d8');
      gb.box(-3.3, 2.65, 0.25, 1.7, 2.8, 0.35, '#d8d8d8');
      for (let k = 0; k < 9; k++)
        gb.box(-3.2 + k * 0.55, 2.66, -0.3, -3.12 + k * 0.55, 2.76, 0.3, '#d8d8d8');
      gb.box(2.5, 2.7, -0.8, 3.1, 2.9, 0.8, '#ff3030', 5);
      for (const z of [-1.23, 1.23])
        gb.box(-3.5, 1.2, z - 0.01, 1.8, 1.35, z + 0.01, '#f2d24a', 5);
      axle(gb, -2.4, 1.22, 0.46, 0.32);
      axle(gb, 2.5, 1.2, 0.46, 0.3);
      break;
    case 'bus':
      boxBody(gb, -5.2, 5.2, 0.4, 3.1, 1.25, '#fff');
      windowBand(gb, -4.9, 4.6, 1.45, 2.65, 1.25);
      pane(gb, [5.2, 1.3], [5.2, 2.95], -1.1, 1.1, 0.03, 0.97, 0.03);
      gb.box(5.21, 2.7, -0.7, 5.25, 2.95, 0.7, '#ffb000', 5);
      gb.box(-5.2, 3.1, -0.9, 3.0, 3.35, 0.9, '#d9d9d9');
      for (const z of [-0.95, 0.95]) gb.box(5.2, 0.7, z - 0.18, 5.26, 0.9, z + 0.18, '#fff', 6);
      tail(gb, -5.24, 1.25, 0.8);
      for (const x of [-3.4, 3.5]) axle(gb, x, 1.25, 0.5, 0.3);
      break;
    case 'tram':
      boxBody(gb, -6.8, 6.8, 0.35, 3.0, 1.25, '#fff');
      windowBand(gb, -6.3, 6.3, 1.3, 2.55, 1.25);
      for (const x of [6.8, -6.8])
        pane(gb, [x, 1.2], [x, 2.7], -1.05, 1.05, 0.03, 0.97, x > 0 ? 0.03 : -0.03);
      gb.box(-6.8, 3.0, -1.0, 6.8, 3.15, 1.0, '#cfcfcf');
      gb.box(-0.6, 3.15, -0.05, 0.6, 4.2, 0.05, '#333');
      gb.box(-1.2, 4.15, -0.45, 1.2, 4.25, 0.45, '#333');
      for (const z of [-0.95, 0.95]) gb.box(6.8, 0.6, z - 0.15, 6.86, 0.8, z + 0.15, '#fff', 6);
      for (const x of [-4.6, 4.6]) gb.box(x - 1.1, 0.0, -0.95, x + 1.1, 0.4, 0.95, '#2a2c30');
      break;
    default:
      return false;
  }
  return true;
}

function personHQ(gb: GB, pose: number) {
  const skin = '#d9a77f',
    pants = U.pick(['#2b3445', '#3a3f4a', '#5a4a3a', '#2a2c30'], () => 0.3),
    shoe = '#1e1e20';
  const sw = pose ? 0.28 : -0.28;
  for (const [z, k] of [
    [-0.11, 1],
    [0.11, -1],
  ]) {
    const off = sw * k;
    gb.box(-0.08 + off * 0.5, 0.45, z - 0.07, 0.08 + off * 0.5, 0.9, z + 0.07, pants, 17);
    gb.box(-0.07 + off, 0.06, z - 0.065, 0.07 + off, 0.47, z + 0.065, pants, 17);
    gb.box(-0.06 + off, 0, z - 0.07, 0.17 + off, 0.08, z + 0.07, shoe, 17);
  }
  extrude(
    gb,
    [
      [-0.12, 0.88],
      [0.12, 0.88],
      [0.14, 1.45],
      [-0.13, 1.45],
    ],
    -0.22,
    0.22,
    '#fff',
    0
  );
  gb.box(-0.1, 1.45, -0.25, 0.1, 1.52, 0.25, '#fff');
  for (const [z, k] of [
    [-0.29, -1],
    [0.29, 1],
  ]) {
    const off = sw * k * 0.8;
    gb.box(-0.05 + off * 0.3, 1.12, z - 0.05, 0.05 + off * 0.3, 1.47, z + 0.05, '#fff');
    gb.box(-0.045 + off, 0.86, z - 0.045, 0.045 + off, 1.14, z + 0.045, skin, 18);
  }
  gb.box(-0.05, 1.52, -0.05, 0.05, 1.6, 0.05, skin, 18);
  gb.addThree(
    new THREE.IcosahedronGeometry(0.12, 1),
    new THREE.Matrix4().makeScale(1, 1.12, 0.95).setPosition(0.01, 1.71, 0),
    skin,
    18
  );
  gb.addThree(
    new THREE.SphereGeometry(0.125, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.Matrix4().setPosition(-0.01, 1.73, 0),
    U.pick(['#2a1e16', '#4a3020', '#b08a50', '#151515'], () => 0.6)
  );
}

function sitHQ(gb: GB) {
  const skin = '#d9a77f',
    pants = '#2b3445',
    shoe = '#1e1e20';
  for (const z of [-0.11, 0.11]) {
    gb.box(-0.08, 0.42, z - 0.075, 0.42, 0.57, z + 0.075, pants, 17);
    gb.box(0.33, 0.06, z - 0.065, 0.46, 0.5, z + 0.065, pants, 17);
    gb.box(0.33, 0, z - 0.07, 0.58, 0.08, z + 0.07, shoe, 17);
  }
  extrude(
    gb,
    [
      [-0.14, 0.48],
      [0.12, 0.48],
      [0.13, 1.05],
      [-0.15, 1.05],
    ],
    -0.22,
    0.22,
    '#fff',
    0
  );
  gb.box(-0.12, 1.05, -0.25, 0.1, 1.12, 0.25, '#fff');
  for (const z of [-0.29, 0.29]) {
    gb.box(-0.05, 0.75, z - 0.05, 0.05, 1.08, z + 0.05, '#fff');
    gb.box(-0.02, 0.62, z - 0.045, 0.3, 0.7, z + 0.045, skin, 18);
  }
  gb.box(-0.05, 1.12, -0.05, 0.05, 1.2, 0.05, skin, 18);
  gb.addThree(
    new THREE.IcosahedronGeometry(0.12, 1),
    new THREE.Matrix4().makeScale(1, 1.12, 0.95).setPosition(0.0, 1.31, 0),
    skin,
    18
  );
  gb.addThree(
    new THREE.SphereGeometry(0.125, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.Matrix4().setPosition(-0.02, 1.33, 0),
    '#3a2a1e'
  );
}

function bikeHQ(gb: GB, pose: number) {
  const frame = '#fff',
    dark = '#1a1a1a',
    skin = '#d9a77f';
  const ring = new THREE.TorusGeometry(0.33, 0.035, 6, 18);
  for (const x of [-0.52, 0.52]) {
    gb.addThree(ring, new THREE.Matrix4().setPosition(x, 0.36, 0), dark, 17);
    gb.addThree(
      new THREE.CylinderGeometry(0.03, 0.03, 0.1, 6).rotateX(Math.PI / 2),
      new THREE.Matrix4().setPosition(x, 0.36, 0),
      '#999'
    );
  }
  const tube = (a: [number, number, number] | number[], b: [number, number, number] | number[], r: number, col: string | number[], st: number = 0) => {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]),
      len = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    gb.addThree(
      new THREE.CylinderGeometry(r, r, 1, 5),
      new THREE.Matrix4().compose(
        new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2),
        q,
        new THREE.Vector3(1, len, 1)
      ),
      col,
      st
    );
  };
  const bb = [0, 0.38, 0],
    st = [-0.15, 0.85, 0],
    ht = [0.4, 0.88, 0];
  tube([-0.52, 0.36, 0], bb, 0.025, frame);
  tube(bb, st, 0.028, frame);
  tube(st, ht, 0.026, frame);
  tube(bb, ht, 0.03, frame);
  tube([-0.52, 0.36, 0], st, 0.02, frame);
  tube(ht, [0.52, 0.36, 0], 0.025, frame);
  tube([0.4, 0.88, 0], [0.38, 1.0, 0], 0.02, dark, 17);
  tube([0.36, 1.0, -0.24], [0.36, 1.0, 0.24], 0.018, dark, 17);
  gb.box(-0.27, 0.9, -0.06, -0.05, 0.95, 0.06, dark, 17);
  const pants = '#2b3445';
  const k1 = pose ? 0.16 : -0.16;
  for (const [z, s] of [
    [-0.11, 1],
    [0.11, -1],
  ]) {
    const knee = [0.08 + k1 * s * 0.5, 0.72 + k1 * s * 0.4, z],
      hip = [-0.12, 0.98, z],
      foot = [0.02 + k1 * s, 0.32 + k1 * s * 0.25, z];
    tube(hip, knee, 0.065, pants);
    tube(knee, foot, 0.055, pants);
    gb.box(
      foot[0] - 0.04,
      foot[1] - 0.04,
      z - 0.05,
      foot[0] + 0.14,
      foot[1] + 0.03,
      z + 0.05,
      '#1e1e20',
      17
    );
  }
  tube([-0.12, 0.98, 0], [0.12, 1.45, 0], 0.17, '#fff');
  for (const z of [-0.2, 0.2]) {
    tube([0.08, 1.4, z], [0.34, 1.02, z * 1.1], 0.045, '#fff');
  }
  gb.addThree(
    new THREE.IcosahedronGeometry(0.115, 1),
    new THREE.Matrix4().setPosition(0.2, 1.62, 0),
    skin,
    18
  );
  gb.addThree(
    new THREE.SphereGeometry(0.135, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.Matrix4().makeScale(1.15, 0.9, 1).setPosition(0.19, 1.65, 0),
    '#e8e8e8'
  );
}

export function vehGeomHQ(kind: string, raw?: false): THREE.BufferGeometry | null;
export function vehGeomHQ(kind: string, raw: true): GB | null;
export function vehGeomHQ(kind: string, raw: boolean = false): GB | THREE.BufferGeometry | null {
  const gb = new GB();
  switch (kind) {
    case 'car':
      carHQ(gb, 2.15, 0.86, 1.5, 'car');
      break;
    case 'suv':
      carHQ(gb, 2.35, 0.95, 1.85, 'suv');
      break;
    case 'police':
      carHQ(gb, 2.15, 0.86, 1.5, 'car');
      gb.box(-0.95, 0.5, -0.875, 1.0, 0.95, 0.875, '#1b3a8a');
      gb.box(-0.5, 1.56, -0.55, 0.3, 1.72, -0.05, '#ff2020', 5);
      gb.box(-0.5, 1.56, 0.05, 0.3, 1.72, 0.55, '#2050ff', 5);
      break;
    case 'van':
    case 'ambulance':
    case 'hearse':
    case 'truck':
    case 'garbage':
    case 'fire':
    case 'bus':
    case 'tram':
      heavyHQ(gb, kind);
      break;
    case 'ped':
      personHQ(gb, 0);
      break;
    case 'sit':
      sitHQ(gb);
      break;
    case 'ball':
      gb.addThree(new THREE.IcosahedronGeometry(0.12, 2), new THREE.Matrix4(), '#fff');
      for (const r2 of [0, Math.PI / 2])
        gb.addThree(
          new THREE.TorusGeometry(0.121, 0.006, 3, 16).rotateY(r2),
          new THREE.Matrix4(),
          '#111',
          17
        );
      break;
    case 'ped2':
      personHQ(gb, 1);
      break;
    case 'bike':
      bikeHQ(gb, 0);
      break;
    case 'bike2':
      bikeHQ(gb, 1);
      break;
    case 'barricade':
      vehGeom('barricade', true, gb);
      break;
    default:
      return null;
  }
  return raw ? gb : gb.geometry();
}

export function vehGeom(kind: string, raw?: false, existingGb?: GB): THREE.BufferGeometry | null;
export function vehGeom(kind: string, raw: true, existingGb?: GB): GB | null;
export function vehGeom(kind: string, raw: boolean = false, existingGb?: GB): GB | THREE.BufferGeometry | null {
  const gb = existingGb || new GB();
  const wheels = (xs: number[], w: number) => {
    for (const x of xs)
      for (const z of [-w, w]) gb.box(x - 0.36, 0, z - 0.14, x + 0.36, 0.7, z + 0.14, '#111', 11);
  };
  switch (kind) {
    case 'car':
      gb.box(-2.1, 0.3, -0.85, 2.1, 1.0, 0.85, '#fff');
      gb.box(-1.15, 1.0, -0.76, 0.95, 1.52, 0.76, '#fff', 9);
      gb.box(2.08, 0.6, -0.7, 2.14, 0.85, -0.35, '#fff', 6);
      gb.box(2.08, 0.6, 0.35, 2.14, 0.85, 0.7, '#fff', 6);
      gb.box(-2.14, 0.65, -0.75, -2.08, 0.9, -0.4, '#fff', 7);
      gb.box(-2.14, 0.65, 0.4, -2.08, 0.9, 0.75, '#fff', 7);
      wheels([-1.35, 1.35], 0.8);
      break;
    case 'suv':
      gb.box(-2.3, 0.4, -0.95, 2.3, 1.25, 0.95, '#fff');
      gb.box(-1.9, 1.25, -0.88, 1.1, 1.95, 0.88, '#fff', 9);
      gb.box(2.28, 0.75, -0.8, 2.34, 1.0, -0.4, '#fff', 6);
      gb.box(2.28, 0.75, 0.4, 2.34, 1.0, 0.8, '#fff', 6);
      gb.box(-2.34, 0.8, -0.85, -2.28, 1.05, -0.45, '#fff', 7);
      gb.box(-2.34, 0.8, 0.45, -2.28, 1.05, 0.85, '#fff', 7);
      wheels([-1.5, 1.5], 0.9);
      break;
    case 'van':
      gb.box(-2.8, 0.4, -1.0, 1.6, 2.6, 1.0, '#fff');
      gb.box(1.6, 0.4, -1.0, 2.8, 1.6, 1.0, '#fff');
      gb.box(1.6, 1.6, -0.95, 2.3, 2.3, 0.95, '#fff', 9);
      gb.box(2.78, 0.8, -0.85, 2.84, 1.1, -0.5, '#fff', 6);
      gb.box(2.78, 0.8, 0.5, 2.84, 1.1, 0.85, '#fff', 6);
      wheels([-1.8, 1.9], 0.92);
      break;
    case 'truck':
      gb.box(1.6, 0.5, -1.15, 3.6, 2.9, 1.15, '#fff');
      gb.box(2.6, 1.8, -1.1, 3.62, 2.6, 1.1, '#fff', 9);
      gb.box(-3.6, 0.7, -1.2, 1.5, 3.5, 1.2, '#e8e6e0');
      gb.box(3.58, 0.9, -1.0, 3.64, 1.2, -0.6, '#fff', 6);
      gb.box(3.58, 0.9, 0.6, 3.64, 1.2, 1.0, '#fff', 6);
      gb.box(-3.64, 0.9, -1.1, -3.58, 1.2, -0.7, '#fff', 7);
      gb.box(-3.64, 0.9, 0.7, -3.58, 1.2, 1.1, '#fff', 7);
      wheels([-2.6, -1.4, 2.7], 1.05);
      break;
    case 'bus':
      gb.box(-5.2, 0.45, -1.25, 5.2, 3.1, 1.25, '#fff');
      gb.box(-5.0, 1.55, -1.27, 4.9, 2.65, 1.27, '#fff', 9);
      gb.box(5.15, 1.3, -1.2, 5.25, 2.9, 1.2, '#fff', 9);
      gb.box(-5.2, 3.1, -1.1, 5.2, 3.3, 1.1, '#dcdcdc');
      gb.box(5.2, 0.7, -1.0, 5.26, 1.0, -0.6, '#fff', 6);
      gb.box(5.2, 0.7, 0.6, 5.26, 1.0, 1.0, '#fff', 6);
      gb.box(-5.26, 0.8, -1.1, -5.2, 1.1, -0.7, '#fff', 7);
      gb.box(-5.26, 0.8, 0.7, -5.2, 1.1, 1.1, '#fff', 7);
      wheels([-3.4, 3.5], 1.1);
      break;
    case 'police':
      gb.box(-2.1, 0.3, -0.86, 2.1, 1.0, 0.86, '#f4f4f4');
      gb.box(-1.0, 0.45, -0.87, 1.2, 0.85, 0.87, '#1b3a8a');
      gb.box(-1.15, 1.0, -0.76, 0.95, 1.52, 0.76, '#fff', 9);
      gb.box(-0.4, 1.52, -0.6, 0.2, 1.7, -0.05, '#ff2020', 5);
      gb.box(-0.4, 1.52, 0.05, 0.2, 1.7, 0.6, '#2050ff', 5);
      gb.box(2.08, 0.6, -0.7, 2.14, 0.85, -0.35, '#fff', 6);
      gb.box(2.08, 0.6, 0.35, 2.14, 0.85, 0.7, '#fff', 6);
      wheels([-1.35, 1.35], 0.8);
      break;
    case 'ambulance':
      gb.box(-2.8, 0.4, -1.05, 1.5, 2.8, 1.05, '#f6f6f6');
      gb.box(1.5, 0.4, -1.05, 2.8, 1.7, 1.05, '#f6f6f6');
      gb.box(1.5, 1.7, -1.0, 2.2, 2.4, 1.0, '#fff', 9);
      gb.box(-2.8, 1.2, -1.06, 2.8, 1.5, 1.06, '#d92a2a');
      gb.box(0.6, 2.8, -0.7, 1.3, 3.0, 0.7, '#ff3030', 5);
      wheels([-1.8, 1.9], 0.95);
      break;
    case 'hearse':
      gb.box(-2.8, 0.35, -0.95, 1.4, 2.3, 0.95, '#1a1a1c');
      gb.box(1.4, 0.35, -0.95, 2.7, 1.5, 0.95, '#1a1a1c');
      gb.box(1.4, 1.5, -0.9, 2.0, 2.1, 0.9, '#fff', 9);
      gb.box(-2.8, 1.1, -0.96, 2.7, 1.25, 0.96, '#c0c0c0');
      wheels([-1.7, 1.8], 0.88);
      break;
    case 'fire':
      gb.box(-3.6, 0.5, -1.2, 3.6, 2.6, 1.2, '#c8231c');
      gb.box(2.0, 2.6, -1.15, 3.6, 3.3, 1.15, '#c8231c');
      gb.box(2.4, 1.8, -1.22, 3.62, 3.0, 1.22, '#fff', 9);
      gb.box(-3.2, 2.6, -0.3, 1.8, 3.0, 0.3, '#d8d8d8');
      gb.box(2.6, 3.3, -0.8, 3.2, 3.5, 0.8, '#ff3030', 5);
      wheels([-2.4, 2.5], 1.1);
      break;
    case 'garbage':
      gb.box(1.8, 0.5, -1.15, 3.6, 2.8, 1.15, '#f0f0f0');
      gb.box(2.6, 1.7, -1.17, 3.62, 2.5, 1.17, '#fff', 9);
      gb.box(-3.6, 0.6, -1.2, 1.7, 3.2, 1.2, '#2f7a3b');
      wheels([-2.5, 2.7], 1.05);
      break;
    case 'tram':
      gb.box(-6.8, 0.35, -1.25, 6.8, 3.0, 1.25, '#fff');
      gb.box(-6.5, 1.3, -1.27, 6.5, 2.5, 1.27, '#fff', 9);
      gb.box(6.75, 1.2, -1.1, 6.95, 2.7, 1.1, '#fff', 9);
      gb.box(-6.95, 1.2, -1.1, -6.75, 2.7, 1.1, '#fff', 9);
      gb.box(-6.8, 3.0, -1.0, 6.8, 3.2, 1.0, '#d0d0d0');
      gb.box(-0.6, 3.2, -0.05, 0.6, 4.3, 0.05, '#333');
      gb.box(-1.2, 4.25, -0.4, 1.2, 4.35, 0.4, '#333');
      gb.box(6.9, 0.6, -0.9, 6.96, 0.9, -0.5, '#fff', 6);
      gb.box(6.9, 0.6, 0.5, 6.96, 0.9, 0.9, '#fff', 6);
      break;
    case 'bike':
      gb.box(-0.85, 0.0, -0.04, 0.85, 0.7, 0.04, '#222');
      gb.box(-0.15, 0.7, -0.17, 0.25, 1.35, 0.17, '#fff');
      gb.box(-0.05, 1.35, -0.12, 0.2, 1.65, 0.12, '#e8c4a0');
      break;
    case 'ped':
      gb.box(-0.12, 0, -0.17, 0.12, 0.85, 0.17, '#3a3f4a');
      gb.box(-0.15, 0.85, -0.24, 0.15, 1.45, 0.24, '#fff');
      gb.box(-0.11, 1.45, -0.11, 0.11, 1.72, 0.11, '#e8c4a0');
      break;
    case 'sit':
      gb.box(-0.1, 0.42, -0.17, 0.42, 0.56, 0.17, '#3a3f4a');
      gb.box(0.3, 0, -0.15, 0.44, 0.45, 0.15, '#3a3f4a');
      gb.box(-0.14, 0.5, -0.24, 0.16, 1.08, 0.24, '#fff');
      gb.box(-0.09, 1.08, -0.11, 0.13, 1.33, 0.11, '#e8c4a0');
      break;
    case 'ball':
      gb.addThree(new THREE.IcosahedronGeometry(0.12, 1), new THREE.Matrix4(), '#fff');
      break;
    case 'train':
      gb.box(-6.9, 0.6, -1.4, 6.9, 3.6, 1.4, '#fff');
      gb.box(-6.4, 1.7, -1.42, 6.4, 2.9, 1.42, '#fff', 9);
      gb.box(-6.9, 3.6, -1.2, 6.9, 3.85, 1.2, '#cfd3d6');
      gb.box(-6.9, 0.25, -1.1, 6.9, 0.6, 1.1, '#333');
      gb.box(6.88, 1.7, -1.1, 6.96, 3.0, 1.1, '#fff', 9);
      gb.box(6.9, 0.8, -1.1, 6.96, 1.1, -0.6, '#fff', 6);
      gb.box(6.9, 0.8, 0.6, 6.96, 1.1, 1.1, '#fff', 6);
      break;
    case 'barricade':
      // Base wooden pallet & timber obstruction
      gb.box(-1.8, 0, -0.6, 1.8, 0.25, 0.6, '#8b5a2b');
      gb.box(-1.7, 0.25, -0.5, 1.7, 0.45, 0.5, '#a06a38');
      // Hazard-striped road blockade crossbeam
      gb.box(-1.9, 0.45, -0.15, 1.9, 0.95, 0.15, '#f59f00');
      gb.box(-1.3, 0.46, -0.16, -0.8, 0.94, 0.16, '#212529');
      gb.box(-0.25, 0.46, -0.16, 0.25, 0.94, 0.16, '#212529');
      gb.box(0.8, 0.46, -0.16, 1.3, 0.94, 0.16, '#212529');
      // Piled scrap tires
      gb.box(-1.4, 0, 0.2, -0.6, 0.4, 0.8, '#1e1e24');
      gb.box(-1.3, 0.38, 0.25, -0.7, 0.76, 0.75, '#2b2d42');
      gb.box(0.6, 0, -0.7, 1.4, 0.4, -0.2, '#1e1e24');
      // Metal barrel with burning warning flame
      gb.box(0.7, 0, 0.15, 1.3, 0.85, 0.65, '#5c1d1d');
      gb.box(0.8, 0.85, 0.25, 1.2, 1.2, 0.55, '#f76707', 15);
      gb.box(0.9, 1.15, 0.35, 1.1, 1.45, 0.45, '#ffd43b', 15);
      break;
  }
  return raw ? gb : gb.geometry();
}

const vehModels: Record<string, GB> = {};

export function vehModel(kind: string, isDetail: boolean = false): GB {
  const key = kind + (isDetail ? '+' : '');
  if (!vehModels[key]) {
    setWheelLite(true);
    vehModels[key] = (isDetail && vehGeomHQ(kind, true)) || vehGeom(kind, true);
    setWheelLite(false);
  }
  return vehModels[key];
}

export function clearVehModels() {
  for (const k in vehModels) delete vehModels[k];
}
