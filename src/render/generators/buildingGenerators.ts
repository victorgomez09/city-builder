// ============================================================================
// Open Skylines — Procedural Building & Lot Mesh Generators
// ============================================================================

import * as THREE from 'three';
import { GB, lc, FR } from '../geometryBuilder';
import { vehModel, extrude } from './vehicleGenerators';
import { C } from '../../core/constants';
import { U } from '../../core/utils';
import { Building } from '../../types';

const T = C.TILE, W = C.W;
  // ======================================================================
  // Palettes
  // ======================================================================
export const PAL = {
    resWall: ['#efe9dc', '#e6dcc6', '#d9cbb0', '#c9d3d6', '#e8e1c4', '#b9a58c', '#cfd8cf', '#dad4cc', '#a9b3a6', '#e3d2bd'],
    roof: ['#4b4f57', '#6b3e2e', '#3d4650', '#7a5a44', '#55504a', '#2f3640', '#5e3a33'],
    brick: ['#9c5a3c', '#8a4b34', '#b06b4b', '#7a4a3a', '#a88468', '#94634a'],
    conc: ['#d1cec6', '#b8b4ab', '#dcd8cf', '#a9a69f', '#c7c1b4', '#e2ded6'],
    glass: ['#8fa3b5', '#6f8aa0', '#9db0bd', '#5f7385', '#a7b6bf', '#7d95a3'],
    accent: ['#d9473c', '#2f86c9', '#e3a02b', '#3aa36a', '#8c4fc0', '#e0603a', '#1e9fa8'],
    ind: ['#9aa3a8', '#7f8a8f', '#b4ab9a', '#6f7f8c', '#a59276', '#8e9b8a'],
    lawn: ['#6b9444', '#73984a', '#62893f'],
    paved: '#a9a7a0', conc2: '#8f8d87', asphalt: '#45474b',
  };

  // ======================================================================
  // Buildings
  // ======================================================================
  function lotFrame(gb, b) {
    const X0 = b.x * T, Z0 = b.y * T, X1 = (b.x + b.fw) * T, Z1 = (b.y + b.fh) * T;
    const o = [[X0, Z0], [X1, Z0], [X1, Z1], [X0, Z1]][b.dir];
    gb.frame(o[0], b.baseY, o[1], b.dir);
    if (b.ang) {
      // lots on curved roads: turn the whole building to face the road, shrunk a little to stay on its lot,
      // and pushed back far enough that the front corner never reaches the sidewalk
      const LW = b.w * T, LD = b.d * T, c = Math.cos(b.ang), s = Math.sin(b.ang), as = Math.abs(s);
      const k = 1 / (c + as * 0.6);
      const pz = U.clamp((0.3 + k * as * LW / 2) / Math.max(0.05, 1 - k * c), LD / 2, LD / 2 + 3), px = LW / 2;
      const [ma, mb, mc, md] = FR[b.dir];
      const na = (ma * c + mb * s) * k, nb = (-ma * s + mb * c) * k, nc = (mc * c + md * s) * k, nd = (-mc * s + md * c) * k;
      gb.ox += ma * px + mb * pz - (na * px + nb * pz);
      gb.oz += mc * px + md * pz - (nc * px + nd * pz);
      gb.ma = na; gb.mb = nb; gb.mc = nc; gb.md = nd;
    }
  }
export const M8 = { brick: 32, siding: 64, stucco: 96, shingle: 128, tile: 160, concrete: 192, metal: 224, lawn: 256, paving: 288, wood: 320, gravel: 352, seam: 384, asph: 416, walk: 448, dirt: 480 };

  const LAWNS = new Set(['#6b9444', '#73984a', '#62893f', '#5f9a40', '#5c9840', '#557f38', '#4f7a34', '#6a9a44', '#649a44', '#6fa044', '#4a7230', '#4f8f3a']);
export function foundation(gb: GB, LW: number, LD: number, b: Building, top: string | number[], topSt?: number) {
    const dy = Math.min(-0.6, (b.minY || 0) - (b.baseY || 0) - 0.6);
    const ts = topSt !== undefined ? topSt : LAWNS.has(top as string) ? M8.lawn : (top === PAL.paved || top === '#c9c0ae' || top === '#cfc6b2' || top === '#d9d4c6' || top === '#c9c0ae') ? M8.paving : top === PAL.conc2 ? M8.concrete : 0;
    gb.box(0.05, dy, 0.05, LW - 0.05, 0.08, LD - 0.05, '#8d8a82', M8.concrete, { top, topSt: ts });
  }
  const PARK_COLS = ['#c8ccd0', '#2b2f36', '#8a1f1f', '#e6e6e6', '#1f3d6b', '#5f6b70', '#9aa0a4', '#3a5a3a', '#b8862f', '#6e2a4a'];
  // a parked vehicle of any kind; rot: true = nose along +z
export function parkedVeh(gb: GB, kind: string, x: number, z: number, rot: number | boolean, col: string | number[] = '#fff', flip: boolean = false) {
    const a = (rot === true ? Math.PI / 2 : rot === false ? 0 : rot) + (flip ? Math.PI : 0);
    gb.merge(vehModel(kind), x, 0.06, z, a, col);
  }
export function parkedCar(gb: GB, x: number, z: number, rot: number | boolean, r: () => number) { parkedVeh(gb, r() < 0.3 ? 'suv' : 'car', x, z, rot, U.pick(PARK_COLS, r), r() < 0.5); }
export function yardTree(gb: GB, x: number, z: number, r: () => number) {
    const g = U.pick(['#4f7d34', '#5c8a3a', '#3f6b30', '#6a9440'], r);
    gb.tree(x, 0, z, 0.75 + r() * 0.4, g, r() < 0.3);
  }

export const GEN: Record<string, any> = {};
export function hip(gb: GB, x0: number, z0: number, x1: number, z1: number, y: number, h: number, col: string | number[], st: number = M8.shingle) {
    const w = x1 - x0, d = z1 - z0; st = st === undefined ? M8.shingle : st;
    if (w >= d) {
      const k = d / 2, xa = x0 + k, xb = x1 - k, zm = (z0 + z1) / 2;
      gb.quad([x1, y, z0], [x0, y, z0], [xa, y + h, zm], [xb, y + h, zm], col, st);
      gb.quad([x0, y, z1], [x1, y, z1], [xb, y + h, zm], [xa, y + h, zm], col, st);
      gb.tri([x0, y, z0], [x0, y, z1], [xa, y + h, zm], col, st);
      gb.tri([x1, y, z1], [x1, y, z0], [xb, y + h, zm], col, st);
    } else {
      const k = w / 2, za = z0 + k, zb = z1 - k, xm = (x0 + x1) / 2;
      gb.quad([x0, y, z0], [x0, y, z1], [xm, y + h, zb], [xm, y + h, za], col, st);
      gb.quad([x1, y, z1], [x1, y, z0], [xm, y + h, za], [xm, y + h, zb], col, st);
      gb.tri([x1, y, z0], [x0, y, z0], [xm, y + h, za], col, st);
      gb.tri([x0, y, z1], [x1, y, z1], [xm, y + h, zb], col, st);
    }
  }
  // ---- house kit ----
  const HOUSE_WALL = ['#efe9dc', '#e6dcc6', '#d9cbb0', '#c9d3d6', '#e8e1c4', '#cfd8cf', '#dad4cc', '#e3d2bd', '#f2efe6', '#c7b7a3', '#b8c7cf', '#e9d9c9', '#a8b8a0', '#9fb3c4', '#d8c3a5'];
  const BRICKS = ['#9c5a3c', '#8a4b34', '#b06b4b', '#7a4a3a', '#a8735a', '#94634a', '#b8826a'];
  const HOUSE_ROOF = ['#4b4f57', '#3d4650', '#55504a', '#2f3640', '#5e5a55', '#424a52', '#6b4a3a', '#8a4a32', '#7a3e2c'];
  const WORN_WALL = ['#c9bfa8', '#b8ad96', '#a99f8a', '#c4c0b4', '#b5aa98', '#9fa59a', '#bfb3a0'];
  const WORN_ROOF = ['#5a5550', '#6a5040', '#4a4d50', '#605a52', '#7a6a5a'];
  const TRIM = ['#f4f1ea', '#ece7dc', '#ffffff', '#2f3237', '#3a4a52'];
  const SHUTTER = ['#2f4a3a', '#2a2d33', '#3a4f6a', '#6a2f2a', '#55606a'];
  const DOORS = ['#5a3d2b', '#8c1c1c', '#25467a', '#2f5a3a', '#2b2d31', '#c8a040', '#6a3a5a', '#e8e4dc'];
  const roofSt = col => (col === '#6b4a3a' || col === '#8a4a32' || col === '#7a3e2c' || col === '#7a6a5a' || col === '#704a3a') ? M8.tile : M8.shingle;
  // one framed window on a wall. face: 0 front(-z) 1 back(+z) 2 left(-x) 3 right(+x)
  function win(gb: any, face: number, a: number, y: number, plane: number, w: number, h: number, o: any = {}) {
    o = o || {};
    const trim = o.trim || '#f2efe8', t = 0.07, out = face === 0 || face === 2 ? -1 : 1;
    const bx = (u0: number, y0: number, u1: number, y1: number, d0: number, d1: number, col: any, st: number = 0) => {
      if (face < 2) gb.box(u0, y0, Math.min(plane + out * d0, plane + out * d1), u1, y1, Math.max(plane + out * d0, plane + out * d1), col, st);
      else gb.box(Math.min(plane + out * d0, plane + out * d1), y0, u0, Math.max(plane + out * d0, plane + out * d1), y1, u1, col, st);
    };
    bx(a - w / 2, y, a + w / 2, y + h, -0.02, 0.02, '#fff', 9);                       // glass
    bx(a - w / 2 - t, y + h, a + w / 2 + t, y + h + t, 0, 0.07, trim);                 // head
    bx(a - w / 2 - t, y - t, a + w / 2 + t, y, 0, 0.07, trim);
    bx(a - w / 2 - t, y, a - w / 2, y + h, 0, 0.07, trim); bx(a + w / 2, y, a + w / 2 + t, y + h, 0, 0.07, trim);
    bx(a - w / 2 - 0.12, y - 0.16, a + w / 2 + 0.12, y - 0.07, 0, 0.16, trim);         // sill
    bx(a - 0.025, y, a + 0.025, y + h, 0, 0.04, trim); bx(a - w / 2, y + h * 0.55, a + w / 2, y + h * 0.55 + 0.05, 0, 0.04, trim); // muntins
    if (o.shut) { bx(a - w / 2 - 0.5, y - 0.02, a - w / 2 - 0.1, y + h + 0.02, 0, 0.05, o.shut); bx(a + w / 2 + 0.1, y - 0.02, a + w / 2 + 0.5, y + h + 0.02, 0, 0.05, o.shut); }
    if (o.box) bx(a - w / 2, y - 0.5, a + w / 2, y - 0.16, 0.05, 0.3, '#4a7a36');      // flower box
  }
  function wallWindows(gb, x0, z0, w, d, floors, fh, o, skipFront) {
    o = o || {};
    for (let f = 0; f < floors; f++) {
      const y = f * fh + 0.95, hh = fh * 0.46;
      for (const face of [0, 1, 2, 3]) {
        const len = face < 2 ? w : d, n = Math.max(1, Math.floor((len - 0.6) / (o.spacing || 2.8)));
        if (face >= 2 && len < 4.5) continue;
        for (let k = 0; k < n; k++) {
          const u = (k + 0.5) / n * len;
          if (face === 0 && f === 0 && skipFront && Math.abs(u - skipFront) < 1.2) continue;
          const a = (face < 2 ? x0 : z0) + u, plane = face === 0 ? z0 : face === 1 ? z0 + d : face === 2 ? x0 : x0 + w;
          win(gb, face, a, y, plane, o.ww || 1.05, hh, { trim: o.trim, shut: face === 0 ? o.shut : null, box: face === 0 && f === 0 && o.box });
        }
      }
    }
  }
  function doorway(gb, x, z, col, trim, step) {
    gb.box(x - 0.62, 0, z - 0.1, x + 0.62, 2.35, z + 0.02, trim || '#f2efe8');
    gb.box(x - 0.48, 0, z - 0.13, x + 0.48, 2.2, z, col || '#5a3d2b', M8.wood);
    gb.box(x + 0.25, 1.0, z - 0.17, x + 0.32, 1.08, z - 0.13, '#c9a64a');
    gb.box(x - 0.08, 2.4, z - 0.25, x + 0.08, 2.55, z - 0.1, '#fff', 8);
    if (step) { gb.box(x - 0.8, 0, z - 0.7, x + 0.8, 0.18, z, '#b5b1a8', M8.concrete); gb.box(x - 0.7, 0.18, z - 0.4, x + 0.7, 0.34, z, '#b5b1a8', M8.concrete); }
  }
  function roofOn(gb, kind, x0, z0, x1, z1, y, col, wall, r) {
    const o = 0.45;
    if (kind === 'flat') { gb.box(x0 - 0.15, y, z0 - 0.15, x1 + 0.15, y + 0.55, z1 + 0.15, '#6d6a64', M8.concrete); gb.box(x0 + 0.2, y + 0.55, z0 + 0.2, x1 - 0.2, y + 0.6, z1 - 0.2, '#5d5a55', M8.gravel); return y + 0.6; }
    const span = Math.min(x1 - x0, z1 - z0), h = span * (kind === 'steep' ? 0.62 : 0.38);
    const rs = roofSt(col);
    const alongX = (x1 - x0) >= (z1 - z0);
    if (kind === 'hip') hip(gb, x0 - o, z0 - o, x1 + o, z1 + o, y, h, col, rs);
    else gb.gable(x0 - o, z0 - o, x1 + o, z1 + o, y, h, alongX, col, wall, rs, 0);
    // fascia boards and gutters along the eaves
    const fc = '#f2efe8';
    if (kind === 'hip' || alongX) { gb.box(x0 - o, y - 0.18, z0 - o - 0.05, x1 + o, y + 0.02, z0 - o + 0.05, fc); gb.box(x0 - o, y - 0.18, z1 + o - 0.05, x1 + o, y + 0.02, z1 + o + 0.05, fc); }
    if (kind === 'hip' || !alongX) { gb.box(x0 - o - 0.05, y - 0.18, z0 - o, x0 - o + 0.05, y + 0.02, z1 + o, fc); gb.box(x1 + o - 0.05, y - 0.18, z0 - o, x1 + o + 0.05, y + 0.02, z1 + o, fc); }
    gb.box(x0 - o + 0.1, y - 0.03, z0 - o - 0.1, x0 - o + 0.2, y, z0 - o - 0.05, '#9a9a96');
    gb.box(x0 - 0.05, 0, z0 - 0.08, x0 + 0.05, y, z0 + 0.02, '#e8e6e0');                // downspout
    return y + h;
  }
  function chimney(gb, x, z, y0, y1, col) { gb.box(x - 0.45, y0, z - 0.45, x + 0.45, y1, z + 0.45, col || '#8a4b34', M8.brick); gb.box(x - 0.55, y1, z - 0.55, x + 0.55, y1 + 0.15, z + 0.55, '#6a6862', M8.concrete); }
  function hedge(gb, x0, z0, x1, z1) { gb.box(x0, 0, z0, x1, 0.95, z1, '#3f6b30', M8.lawn, { top: '#4a7a36', topSt: M8.lawn }); }
  function fence(gb: any, x0: number, z0: number, x1: number, z1: number, col: any = '#e8e2d4') { gb.box(x0, 0, z0, x1, 1.1, z1, col || '#e8e2d4', M8.wood); }
  function picket(gb, x0, x1, z) { gb.box(x0, 0.35, z - 0.03, x1, 0.45, z + 0.03, '#f4f1ea'); for (let x = x0; x < x1; x += 0.28) gb.box(x, 0, z - 0.03, x + 0.09, 0.95, z + 0.03, '#f4f1ea'); }
  // park bench: slatted seat and back on cast iron legs. rot: long axis along z
  function bench(gb: any, x: number, z: number, rot: boolean | number = false) {
    const B = (a0: number, y0: number, b0: number, a1: number, y1: number, b1: number, col: any, st: number = 0) => rot ? gb.box(x + b0, y0, z + a0, x + b1, y1, z + a1, col, st) : gb.box(x + a0, y0, z + b0, x + a1, y1, z + b1, col, st);
    for (const a of [-0.75, 0.75]) { B(a - 0.04, 0, -0.25, a + 0.04, 0.45, 0.22, '#2a2d31'); B(a - 0.04, 0.45, 0.16, a + 0.04, 0.9, 0.22, '#2a2d31'); }
    for (let k = 0; k < 3; k++) B(-0.9, 0.42, -0.24 + k * 0.15, 0.9, 0.47, -0.13 + k * 0.15, '#8a6440', M8.wood);
    for (let k = 0; k < 2; k++) B(-0.9, 0.58 + k * 0.16, 0.18, 0.9, 0.7 + k * 0.16, 0.22, '#8a6440', M8.wood);
  }
  function lampPost(gb, x, z) {
    gb.cyl(x, 0, z, 0.12, 0.5, 8, '#2a2d31'); gb.cyl(x, 0.5, z, 0.06, 3.1, 6, '#2a2d31');
    gb.cyl(x, 3.55, z, 0.16, 0.08, 8, '#2a2d31'); gb.box(x - 0.14, 3.62, z - 0.14, x + 0.14, 3.98, z + 0.14, '#fff', 8);
    gb.pyr(x - 0.22, z - 0.22, x + 0.22, z + 0.22, 3.98, 0.25, '#2a2d31');
  }
  function bin(gb, x, z) { gb.cyl(x, 0, z, 0.28, 0.85, 8, '#2f4a3a', 0, '#1c1d20'); }
  function picnicTable(gb, x, z) {
    gb.box(x - 0.9, 0.72, z - 0.4, x + 0.9, 0.78, z + 0.4, '#8a6440', M8.wood);
    for (const s2 of [-0.68, 0.68]) gb.box(x - 0.9, 0.42, z + s2 - 0.13, x + 0.9, 0.47, z + s2 + 0.13, '#8a6440', M8.wood);
    for (const a of [-0.7, 0.7]) gb.box(x + a - 0.05, 0, z - 0.75, x + a + 0.05, 0.75, z + 0.75, '#6a4a30', M8.wood);
  }
  // basketball hoop facing +z (dir 1) or -z (dir -1) at the end of a court
  function hoop(gb: any, x: number, z: number, dir: number, alongX: boolean = false) {
    const B = (a0, y0, b0, a1, y1, b1, col) => alongX ? gb.box(x + Math.min(b0, b1), y0, z + a0, x + Math.max(b0, b1), y1, z + a1, col) : gb.box(x + a0, y0, z + Math.min(b0, b1), x + a1, y1, z + Math.max(b0, b1), col);
    gb.cyl(x, 0, z, 0.1, 3.2, 8, '#3a3d42');
    B(-0.06, 3.0, 0, 0.06, 3.1, dir * 0.9, '#3a3d42');
    B(-0.9, 2.75, dir * 0.9 - 0.04, 0.9, 3.8, dir * 0.9 + 0.04, '#f2f2f2');
    B(-0.3, 3.0, dir * 0.9 - 0.06, 0.3, 3.4, dir * 0.9 + 0.06, '#d84a2a');
    gb.cyl(x + (alongX ? dir * 1.15 : 0), 3.05, z + (alongX ? 0 : dir * 1.15), 0.23, 0.03, 10, '#e05a1a', 0, false);
  }
  function pathStrip(gb: any, x0: number, z0: number, x1: number, z1: number, col: any = '#cdbf9a') { gb.flat(x0, z0, x1, z1, 0.12, col || '#cdbf9a', M8.paving); }
  function bush(gb: any, x: number, z: number, s: number, col: any = '#4a7a36') { gb.addThree(new THREE.IcosahedronGeometry(0.75 * s, 0), new THREE.Matrix4().makeScale(1, 0.75, 1).setPosition(x, 0.45 * s, z), col || '#4a7a36'); }
  function flowerBed(gb, x0, z0, x1, z1, r) { gb.box(x0, 0, z0, x1, 0.3, z1, '#6a4a32', 0, { top: '#4a3626', topSt: M8.gravel }); for (let k = 0; k < Math.max(4, (x1 - x0) * (z1 - z0) * 2); k++) { const x = x0 + 0.25 + r() * (x1 - x0 - 0.5), z = z0 + 0.25 + r() * (z1 - z0 - 0.5); gb.box(x - 0.14, 0.3, z - 0.14, x + 0.14, 0.5 + r() * 0.15, z + 0.14, U.pick(['#e0503a', '#f2c230', '#d65aa0', '#f2f2f2', '#8a5ad8', '#4a7a36', '#4a7a36'], r)); } }
  function pond(gb, x, z, rad) { gb.cyl(x, 0.0, z, rad + 0.4, 0.18, 16, '#a9a28c', M8.paving, '#a9a28c'); gb.cyl(x, 0.0, z, rad, 0.2, 16, '#1d6f8a', 13, '#1d6f8a'); }
  function grove(gb: any, x0: number, z0: number, x1: number, z1: number, n: number, r: any, conif?: boolean) { for (let k = 0; k < n; k++) gb.tree(x0 + r() * (x1 - x0), 0, z0 + r() * (z1 - z0), 0.7 + r() * 0.5, U.pick(['#4f7d34', '#5c8a3a', '#3f6b30', '#2c5a2f', '#6a9440'], r), conif !== undefined ? conif : r() < 0.35); }
  function windingPath(gb: any, pts: any, w: number, col: any = '#cdbf9a') { for (let k = 0; k < pts.length - 1; k++) { const [ax, az] = pts[k], [bx, bz] = pts[k + 1]; const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2; gb.quad([ax + nx, 0.11, az + nz], [bx + nx, 0.11, bz + nz], [bx - nx, 0.11, bz - nz], [ax - nx, 0.11, az - nz], col || '#cdbf9a', M8.gravel); gb.quad([ax - nx, 0.11, az - nz], [bx - nx, 0.11, bz - nz], [bx + nx, 0.11, bz + nz], [ax + nx, 0.11, az + nz], col || '#cdbf9a', M8.gravel); } }
  // swing set: A-frame legs, top bar, chains and two seats (seats at x +- 0.7)
  function swing(gb, x, z) {
    const c = '#c8392e';
    for (const sx of [-1.6, 1.6]) for (const sz of [-0.7, 0.7]) gb.quad([x + sx - 0.05, 0, z + sz], [x + sx + 0.05, 0, z + sz], [x + sx + 0.05, 2.45, z], [x + sx - 0.05, 2.45, z], c), gb.quad([x + sx + 0.05, 0, z + sz], [x + sx - 0.05, 0, z + sz], [x + sx - 0.05, 2.45, z], [x + sx + 0.05, 2.45, z], c);
    gb.cyl(x - 1.65, 2.45, z, 0.07, 0.01, 6, c); gb.box(x - 1.65, 2.4, z - 0.06, x + 1.65, 2.52, z + 0.06, c);
    for (const o of [-0.7, 0.7]) { for (const d of [-0.22, 0.22]) gb.box(x + o + d - 0.012, 0.62, z - 0.012, x + o + d + 0.012, 2.4, z + 0.012, '#9aa0a6'); gb.box(x + o - 0.26, 0.56, z - 0.12, x + o + 0.26, 0.62, z + 0.12, '#222'); }
  }
  // slide: ladder up to a platform with a roof, chute down towards +z
  function slide(gb, x, z, col) {
    col = col || '#2f86c9';
    for (const [a, b] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) gb.box(x + a - 0.06, 0, z + b - 0.06, x + a + 0.06, 2.9, z + b + 0.06, col);
    gb.box(x - 0.8, 1.6, z - 0.8, x + 0.8, 1.72, z + 0.8, '#e3a02b');
    gb.pyr(x - 0.95, z - 0.95, x + 0.95, z + 0.95, 2.9, 0.8, '#d9473c');
    for (let k = 0; k < 5; k++) gb.box(x - 0.4, 0.3 + k * 0.3, z - 0.85, x + 0.4, 0.34 + k * 0.3, z - 0.8, '#ddd');
    gb.quad([x + 0.4, 1.66, z + 0.8], [x - 0.4, 1.66, z + 0.8], [x - 0.4, 0.25, z + 3.3], [x + 0.4, 0.25, z + 3.3], '#e3a02b');
    gb.quad([x - 0.4, 1.66, z + 0.8], [x + 0.4, 1.66, z + 0.8], [x + 0.4, 0.25, z + 3.3], [x - 0.4, 0.25, z + 3.3], '#e3a02b');
    for (const s2 of [-0.42, 0.42]) gb.quad([x + s2, 1.66, z + 0.8], [x + s2, 1.9, z + 0.8], [x + s2, 0.5, z + 3.3], [x + s2, 0.25, z + 3.3], '#e3a02b'), gb.quad([x + s2, 1.9, z + 0.8], [x + s2, 1.66, z + 0.8], [x + s2, 0.25, z + 3.3], [x + s2, 0.5, z + 3.3], '#e3a02b');
  }
  function statue(gb, x, z, s, col) { gb.box(x - 0.8 * s, 0, z - 0.8 * s, x + 0.8 * s, 1.2 * s, z + 0.8 * s, '#cfc8b8', M8.concrete); gb.box(x - 0.3 * s, 1.2 * s, z - 0.25 * s, x + 0.3 * s, 2.6 * s, z + 0.25 * s, col || '#6f8a7a'); gb.box(x - 0.2 * s, 2.6 * s, z - 0.2 * s, x + 0.2 * s, 3.0 * s, z + 0.2 * s, col || '#6f8a7a'); }
  function fountain(gb, x, z, s) { gb.cyl(x, 0, z, 3 * s, 0.7, 18, '#b7b0a2', M8.concrete, '#1d6f8a'); gb.cyl(x, 0.7, z, 2.7 * s, 0.02, 18, '#1d6f8a', 13); gb.cyl(x, 0.7, z, 0.45 * s, 2.2 * s, 8, '#d8d2c4'); gb.cyl(x, 0.7 + 2.2 * s, z, 1.1 * s, 0.25, 10, '#d8d2c4'); }
  function court(gb, x0, z0, x1, z1, col) { gb.flat(x0, z0, x1, z1, 0.12, col || '#c0603a'); const c = '#f2f2ec', lw = 0.15; gb.flat(x0 + 0.4, z0 + 0.4, x1 - 0.4, z0 + 0.4 + lw, 0.13, c); gb.flat(x0 + 0.4, z1 - 0.4 - lw, x1 - 0.4, z1 - 0.4, 0.13, c); gb.flat(x0 + 0.4, z0 + 0.4, x0 + 0.4 + lw, z1 - 0.4, 0.13, c); gb.flat(x1 - 0.4 - lw, z0 + 0.4, x1 - 0.4, z1 - 0.4, 0.13, c); gb.flat(x0 + 0.4, (z0 + z1) / 2 - lw / 2, x1 - 0.4, (z0 + z1) / 2 + lw / 2, 0.13, c); }
  function hip2(gb, x0, z0, x1, z1, y, h, col) { hip(gb, x0, z0, x1, z1, y, h, col, roofSt(col)); }
  function driveway(gb, x0, x1, z1, car, r) { gb.drive = true; gb.flat(x0, 0.06, x1, z1, 0.11, '#a8a59e', M8.concrete); if (car) parkedCar(gb, (x0 + x1) / 2, 2.8, true, r); }
  function garage(gb, x0, x1, z0, d, wall, rc, wm) {
    gb.box(x0, 0, z0, x1, 2.9, z0 + d, wall, wm, { top: rc });
    gb.box(x0 + 0.35, 0, z0 - 0.06, x1 - 0.35, 2.35, z0, '#ecebe6', M8.siding);
    gb.box(x0 + 0.25, 2.35, z0 - 0.1, x1 - 0.25, 2.48, z0, '#f2efe8');
    gb.box(x0 - 0.2, 2.9, z0 - 0.3, x1 + 0.2, 3.05, z0 + d + 0.2, rc, M8.shingle);
  }
  function mailbox(gb, x, z) { gb.box(x - 0.04, 0, z - 0.04, x + 0.04, 1.0, z + 0.04, '#3a3d42'); gb.box(x - 0.12, 1.0, z - 0.25, x + 0.12, 1.2, z + 0.2, '#2a2d33'); }
  function acUnit(gb, x, z) { gb.box(x - 0.45, 0, z - 0.45, x + 0.45, 0.8, z + 0.45, '#c9ccd0', M8.metal); }
  function trashBins(gb, x, z) { gb.box(x - 0.3, 0, z - 0.3, x + 0.3, 1.0, z + 0.3, '#2f5a3a'); gb.box(x + 0.45, 0, z - 0.3, x + 1.05, 1.0, z + 0.3, '#2a4a7a'); }

  // a detached house body with real windows, roof and door
  function house(gb, r, x0, z0, w, d, floors, roof, o) {
    const fh = 2.9, H = floors * fh + 0.35;
    gb.box(x0 - 0.06, 0, z0 - 0.06, x0 + w + 0.06, 0.5, z0 + d + 0.06, '#9a968e', M8.concrete);
    gb.box(x0, 0.5, z0, x0 + w, H, z0 + d, o.wall, o.wm);
    if (floors > 1 && o.band) gb.box(x0 - 0.05, fh + 0.32, z0 - 0.05, x0 + w + 0.05, fh + 0.45, z0 + d + 0.05, o.trim);
    for (const [xx, zz] of [[x0, z0], [x0 + w, z0], [x0, z0 + d], [x0 + w, z0 + d]]) gb.box(xx - 0.09, 0.5, zz - 0.09, xx + 0.09, H, zz + 0.09, o.trim);
    const dx = o.doorX !== undefined ? o.doorX : w / 2;
    if (o.door !== false) doorway(gb, x0 + dx, z0, o.doorCol, o.trim, true);
    wallWindows(gb, x0, z0, w, d, floors, fh, { trim: o.trim, shut: o.shut, box: o.box, spacing: o.spacing }, o.door !== false ? dx : null);
    const top = roofOn(gb, roof, x0, z0, x0 + w, z0 + d, H, o.rc, o.wall, r);
    if (o.chimney) chimney(gb, x0 + w * 0.8, z0 + d * 0.5, H - 0.5, top + 0.4, o.chimneyCol);
    return { H, top };
  }
  function porch(gb, x0, x1, z0, depth, h, rc, trim) {
    gb.box(x0, 0, z0 - depth, x1, 0.5, z0, '#a69f92', M8.wood);
    gb.box(x0 - 0.15, h, z0 - depth - 0.2, x1 + 0.15, h + 0.22, z0, rc, M8.shingle);
    const n = Math.max(2, Math.round((x1 - x0) / 2.2));
    for (let k = 0; k <= n; k++) { const x = x0 + 0.15 + (x1 - x0 - 0.3) * k / n; gb.box(x - 0.11, 0.5, z0 - depth + 0.05, x + 0.11, h, z0 - depth + 0.27, trim); }
    gb.box(x0, 0.95, z0 - depth + 0.1, x1, 1.02, z0 - depth + 0.2, trim);
  }

  GEN.rlow = function (gb, b, r, LW, LD) {
    const lvl = b.level, area = b.w * b.d;
    const worn = lvl <= 1, plain = lvl <= 2;
    foundation(gb, LW, LD, b, worn ? '#7a8a4a' : U.pick(PAL.lawn, r), M8.lawn);
    const brick = !worn && r() < (lvl >= 3 ? 0.4 : 0.2);
    const wall = brick ? U.pick(BRICKS, r) : worn ? U.pick(WORN_WALL, r) : U.pick(HOUSE_WALL, r);
    const wm = brick ? M8.brick : (r() < 0.7 ? M8.siding : M8.stucco);
    const rc = worn ? U.pick(WORN_ROOF, r) : U.pick(HOUSE_ROOF, r);
    const trim = worn ? '#d8d2c2' : U.pick(TRIM.slice(0, 3), r);
    const o = { wall, wm, rc, trim, doorCol: U.pick(DOORS, r), shut: !worn && r() < 0.45 ? U.pick(SHUTTER, r) : null, box: lvl >= 3 && r() < 0.4, chimney: r() < 0.6, band: lvl >= 2 };
    const roofK = plain ? U.pick(['gable', 'gable', 'steep'], r) : U.pick(['gable', 'hip', 'hip', 'steep'], r);
    const front = () => { pathStrip(gb, LW / 2 - 0.6, 0.1, LW / 2 + 0.6, 2.4, '#b5ada0'); };
    if (area === 1) {
      if (lvl >= 4) { modernBox(gb, r, 1.4, 2.4, LW - 2.8, 6.2, lvl); bush(gb, 1, 1.2, 0.8); bush(gb, LW - 1, 1.2, 0.8); return; }
      const w = 6.4, d = 5.8, x0 = (LW - w) / 2, z0 = 2.5;
      house(gb, r, x0, z0, w, d, 1, roofK === 'steep' ? 'steep' : 'gable', Object.assign({}, o, { spacing: 2.2 }));
      gb.box(x0 + w / 2 - 1.2, 2.4, z0 - 1.1, x0 + w / 2 + 1.2, 2.55, z0, rc, M8.shingle);
      pathStrip(gb, x0 + w / 2 - 0.5, 0.1, x0 + w / 2 + 0.5, z0 - 0.6, '#b5ada0');
      if (worn) wornYard(gb, r, LW, LD); else { picket(gb, 0.3, x0 + w / 2 - 0.8, 0.5); picket(gb, x0 + w / 2 + 0.8, LW - 0.3, 0.5); }
      mailbox(gb, x0 + w / 2 + 1.2, 0.6);
      if (r() < 0.6) yardTree(gb, LW - 1.2, LD - 1.2, r);
      return;
    }
    const POOLS = area >= 4 ? [null, ['duplex', 'ranchL'], ['duplex', 'ranchL', 'twostoryWide'], ['ranchL', 'twostoryWide', 'estate'], ['twostoryWide', 'estate', 'modernvilla'], ['estate', 'modernvilla', 'modernvilla']]
      : [null, ['saltbox', 'bungalow'], ['saltbox', 'bungalow', 'colonial'], ['colonial', 'bungalow', 'aframe', 'saltbox'], ['colonial', 'modern', 'craftsman'], ['modern', 'modern', 'craftsman']];
    const style = U.pick(POOLS[lvl], r);
    const sc = 0.88 + lvl * 0.03;
    if (style === 'colonial' || style === 'saltbox') {
      const w = Math.min(LW - 2.6, (7.6 + r() * 1.0) * sc), d = 7.2 * sc, x0 = 1.0 + r() * 0.5, z0 = 3.8;
      house(gb, r, x0, z0, w, d, 2, style === 'saltbox' ? 'steep' : (roofK === 'flat' ? 'hip' : roofK), o);
      gb.box(x0 + w / 2 - 1.1, 2.55, z0 - 1.2, x0 + w / 2 + 1.1, 2.7, z0, trim);
      for (const k of [-1, 1]) gb.box(x0 + w / 2 + k * 1.0 - 0.1, 0.18, z0 - 1.15, x0 + w / 2 + k * 1.0 + 0.1, 2.55, z0 - 0.95, trim);
      if (x0 + w + 3 < LW) driveway(gb, x0 + w + 0.4, LW - 0.4, z0 + 4, lvl >= 2 || r() < 0.4, r);
      pathStrip(gb, x0 + w / 2 - 0.55, 0.1, x0 + w / 2 + 0.55, z0 - 0.7, '#b5ada0');
    } else if (style === 'bungalow' || style === 'craftsman') {
      const w = Math.min(LW - 1.6, 8.4), d = (8 + r() * 1.5) * sc, x0 = (LW - w) / 2, z0 = 4.4;
      house(gb, r, x0, z0, w, d, style === 'craftsman' ? 2 : 1, style === 'craftsman' ? 'gable' : 'hip', Object.assign({}, o, { doorX: w * 0.3 }));
      porch(gb, x0 - 0.1, x0 + w + 0.1, z0, 2.2, 2.75, rc, trim);
      if (style === 'craftsman') gb.box(x0 + w * 0.55, 3.2, z0 - 0.4, x0 + w * 0.9, 4.6, z0, wall, wm);
      bench(gb, x0 + w * 0.7, z0 - 1.2);
      front();
    } else if (style === 'modern') {
      modernBox(gb, r, 1.2, 3.4, LW - 2.4, 9 + r() * 1.5, lvl);
      driveway(gb, LW * 0.62, LW - 0.4, 3.4, r() < 0.7, r);
      if (lvl >= 4 && LD > 15) pool(gb, 1.6, LD - 6, 6, 3.6);
    } else if (style === 'aframe') {
      const w = 7, d = 8, x0 = (LW - w) / 2, z0 = 4;
      gb.gable(x0, z0, x0 + w, z0 + d, 0, 7.5, false, rc, wall, roofSt(rc), M8.wood);
      gb.tri([x0 + 0.7, 0.1, z0 - 0.03], [x0 + w - 0.7, 0.1, z0 - 0.03], [x0 + w / 2, 6.3, z0 - 0.03], '#fff', 9);
      gb.tri([x0 + w - 0.7, 0.1, z0 - 0.03], [x0 + 0.7, 0.1, z0 - 0.03], [x0 + w / 2, 6.3, z0 - 0.03], '#fff', 9);
      for (const k of [0.33, 0.66]) gb.box(x0 + 0.7 + (w - 1.4) * k - 0.04, 0.1, z0 - 0.06, x0 + 0.7 + (w - 1.4) * k + 0.04, 6.2 - Math.abs(k - 0.5) * 6, z0 - 0.02, '#2a2d33');
      doorway(gb, x0 + w / 2, z0 - 0.05, '#5a3d2b', '#2a2d33', false);
      gb.box(x0 - 0.6, 0, z0 - 2.6, x0 + w + 0.6, 0.45, z0, '#8a6a4a', M8.wood);
    } else if (style === 'ranchL') {
      const x0 = 1.2, z0 = 3.6, w = LW - 6.8, d = 7.2;
      house(gb, r, x0, z0, w, d, 1, roofK === 'flat' ? 'hip' : roofK, Object.assign({}, o, { doorX: w * 0.35 }));
      house(gb, r, x0, z0 + d, 6.6, Math.max(4, LD - z0 - d - 4), 1, 'hip', Object.assign({}, o, { door: false, chimney: false }));
      garage(gb, x0 + w + 0.1, LW - 0.8, z0 + 0.8, 6.2, wall, rc, wm);
      driveway(gb, x0 + w + 0.3, LW - 1.0, z0 + 0.8, true, r);
      if (lvl >= 2 && LD > 15) pool(gb, 10, LD - 7.2, LW - 12, 4.2); else grove(gb, 9, LD - 7, LW - 2, LD - 2, 2, r);
      fence(gb, 0.2, LD - 0.4, LW - 0.2, LD - 0.25, '#b49a78');
    } else if (style === 'twostoryWide') {
      const w = LW - 5, d = 9, x0 = 2.5, z0 = 4.6;
      house(gb, r, x0, z0, w, d, 2, 'hip', Object.assign({}, o, { spacing: 2.6 }));
      porch(gb, x0 + w / 2 - 2.2, x0 + w / 2 + 2.2, z0, 1.7, 2.75, rc, trim);
      pathStrip(gb, x0 + w / 2 - 0.7, 0.1, x0 + w / 2 + 0.7, z0 - 1.7, '#b5ada0');
      hedge(gb, 0.4, 0.4, x0 + w / 2 - 1.3, 1.1); hedge(gb, x0 + w / 2 + 1.3, 0.4, LW - 0.4, 1.1);
      grove(gb, 1.5, LD - 5, LW - 1.5, LD - 1.5, 3, r);
    } else if (style === 'duplex') {
      for (const side of [0, 1]) {
        const x0 = side ? LW / 2 + 0.05 : 1.5, w = LW / 2 - 1.55, z0 = 4.2;
        const o2 = Object.assign({}, o, { wall: side && !brick ? U.pick(HOUSE_WALL, r) : wall, doorX: side ? w - 1.6 : 1.6, chimney: false });
        house(gb, r, x0, z0, w, 9, 2, 'gable', o2);
        trashBins(gb, side ? LW - 1.4 : 0.9, z0 + 1);
      }
      fence(gb, LW / 2 - 0.05, 13.4, LW / 2 + 0.05, LD - 0.4);
      yardTree(gb, 4, LD - 3, r); yardTree(gb, LW - 4, LD - 3, r);
    } else if (style === 'estate' || style === 'modernvilla') {
      const cx = LW / 2, z0 = 8;
      if (style === 'modernvilla') {
        modernBox(gb, r, cx - 6.5, z0, 13, 9.5, 5);
        pool(gb, cx - 5, z0 + 12, 10, 5);
      } else {
        const mw = Math.min(LW - 7, 12), md = 9;
        house(gb, r, cx - mw / 2, z0, mw, md, 2, 'hip', Object.assign({}, o, { chimney: true, spacing: 2.4, shut: o.shut || '#2a2d33' }));
        for (const sx of [-1, 1]) house(gb, r, sx < 0 ? cx - mw / 2 - 4.6 : cx + mw / 2, z0 + 1.6, 4.6, md - 2.2, 1, 'hip', Object.assign({}, o, { door: false, chimney: false }));
        gb.box(cx - 2.3, 0, z0 - 2.3, cx + 2.3, 0.45, z0, '#cfc8b8', M8.concrete);
        for (const k of [-1.9, -0.65, 0.65, 1.9]) gb.cyl(cx + k, 0.45, z0 - 1.8, 0.2, 5.2, 8, '#f4f1ea');
        gb.box(cx - 2.5, 5.65, z0 - 2.4, cx + 2.5, 6.05, z0, '#f4f1ea');
        gb.cyl(cx, 0.06, 4, 3.4, 0.06, 18, '#c9c1ad', M8.gravel, '#c9c1ad');
        gb.cyl(cx, 0.12, 4, 1.6, 0.05, 14, '#5f9a40', M8.lawn, '#5f9a40');
        statue(gb, cx, 4, 0.6, '#cfc8b8');
        grove(gb, 1, LD - 8, 6, LD - 1, 3, r); grove(gb, LW - 6, LD - 8, LW - 1, LD - 1, 3, r);
        flowerBed(gb, cx - 4, LD - 5, cx + 4, LD - 3, r);
      }
      hedge(gb, 0.3, 0.3, cx - 3.6, 0.95); hedge(gb, cx + 3.6, 0.3, LW - 0.3, 0.95);
      parkedCar(gb, cx + 2.6, 5.4, false, r);
    }
    if (area === 3) {
      gb.box(LW - 4.2, 0, LD - 4.6, LW - 1.2, 2.4, LD - 1.4, U.pick(['#8a6a4a', '#9c5a3c', '#cfd8cf'], r), M8.wood, { top: rc });
      for (let k = 0; k < 3; k++) gb.box(1.2, 0, LD - 9 + k * 2.1, 5.6, 0.3, LD - 8.1 + k * 2.1, '#6a4a32', 0, { top: '#4a7a36', topSt: M8.lawn });
    }
    if (worn) wornYard(gb, r, LW, LD);
    else { mailbox(gb, 1.0, 0.6); acUnit(gb, LW - 0.8, LD * 0.45); }
    if (lvl >= 3 && area >= 2) { flowerBed(gb, 0.6, 1.3, 2.8, 2.4, r); bush(gb, LW - 1.2, 1.6, 0.9); }
    if (area >= 2 && lvl >= 2 && style !== 'ranchL' && style !== 'duplex') { fence(gb, 0.2, LD - 0.4, LW - 0.2, LD - 0.25, '#b49a78'); fence(gb, 0.2, LD * 0.55, 0.35, LD - 0.25, '#b49a78'); fence(gb, LW - 0.35, LD * 0.55, LW - 0.2, LD - 0.25, '#b49a78'); }
    if (area === 2 && r() < 0.8) yardTree(gb, 1.6 + r() * 2, LD - 2.5 - r() * 3, r);
  };
  function pool(gb, x0, z0, w, d) {
    gb.flat(x0 - 0.7, z0 - 0.7, x0 + w + 0.7, z0 + d + 0.7, 0.1, '#e3ddd0', M8.paving);
    gb.box(x0, 0, z0, x0 + w, 0.16, z0 + d, '#3aa8c8', 13);
    for (let k = 0; k < 2; k++) gb.box(x0 + w + 1.0, 0, z0 + 0.6 + k * 1.4, x0 + w + 2.6, 0.35, z0 + 1.2 + k * 1.4, '#f2f2f2');
  }
  function modernBox(gb, r, x0, z0, w, d, lvl) {
    const dark = r() < 0.45, base = dark ? '#3a3d42' : '#ece9e2', up = dark ? '#ece9e2' : '#6a5038';
    gb.box(x0, 0, z0, x0 + w * 0.62, 3.2, z0 + d, base, M8.stucco);
    gb.box(x0 + w * 0.28, 3.2, z0 + 0.8, x0 + w, 6.3, z0 + d, up, dark ? M8.stucco : M8.wood);
    gb.box(x0 - 0.15, 3.12, z0 - 0.3, x0 + w * 0.62 + 0.1, 3.38, z0 + d + 0.1, '#2b2b30');
    gb.box(x0 + w * 0.28 - 0.1, 6.3, z0 + 0.6, x0 + w + 0.15, 6.55, z0 + d + 0.15, '#2b2b30');
    gb.box(x0 + 2.2, 0.35, z0 - 0.04, x0 + w * 0.6 - 0.2, 2.9, z0, '#fff', 9);
    gb.box(x0 + w * 0.32, 3.6, z0 + 0.76, x0 + w - 0.3, 5.9, z0 + 0.8, '#fff', 9);
    for (let k = 1; k < 4; k++) gb.box(x0 + 2.2 + (w * 0.6 - 2.4) * k / 4 - 0.03, 0.35, z0 - 0.07, x0 + 2.2 + (w * 0.6 - 2.4) * k / 4 + 0.03, 2.9, z0 - 0.02, '#1c1d20');
    gb.box(x0 + w * 0.62, 0, z0 + 2, x0 + w, 2.9, z0 + d, '#5a5d62', M8.metal);
    doorway(gb, x0 + 1.2, z0, '#2b2b30', '#1c1d20', false);
    gb.box(x0 - 0.5, 0, z0 - 1.8, x0 + 2.4, 0.22, z0, '#8a6a4a', M8.wood);
    gb.box(x0 + w * 0.3, 0.6, z0 + d + 0.02, x0 + w * 0.55, 2.6, z0 + d + 0.06, '#fff', 9);
  }
  function wornYard(gb, r, LW, LD) {
    for (const y of [0.1, 1.05]) gb.box(0.2, y, LD - 0.36, LW - 0.2, y + 0.04, LD - 0.32, '#8a9095');
    for (let x = 0.2; x <= LW - 0.2; x += 2.5) gb.box(x - 0.04, 0, LD - 0.38, x + 0.04, 1.15, LD - 0.3, '#7a8086');
    const drive = gb.drive; gb.drive = false; // the house already has a paved driveway: no gravel pad on top of it
    if (!drive) gb.flat(LW - 3.4, 0.1, LW - 0.6, Math.min(5, LD - 1), 0.1, '#8a8478', M8.gravel);
    if (r() < 0.6 && LD > 12) gb.box(0.8, 0, LD - 3.6, 3.2, 2.0, LD - 1.2, '#8a8a84', M8.metal, { top: '#6e6a62' });
    if (r() < 0.4 && !drive) parkedCarOld(gb, LW - 2, 2.6, r);
  }
  function parkedCarOld(gb, x, z, r) { parkedVeh(gb, r() < 0.3 ? 'van' : 'car', x, z, true, U.pick(['#7a6a5a', '#5a6a6e', '#8a7a4a', '#6e6a62', '#7a4a3a'], r), r() < 0.5); }

  // ---- medium density: terraced row houses (and walk-ups at high levels) ----
  const ROW_WALL = [['#9c5a3c', 32], ['#8a4b34', 32], ['#b06b4b', 32], ['#e8dcc4', 96], ['#d8d0c0', 96], ['#c8cfd2', 64], ['#9fb0a0', 64], ['#2f3e52', 64], ['#e9e4d8', 96], ['#7a4a3a', 32], ['#c9a882', 96]];
  GEN.rmed = function (gb, b, r, LW, LD) {
    const lvl = b.level;
    foundation(gb, LW, LD, b, '#a9a69e', M8.paving);
    const n = Math.max(2, Math.round(LW / 4.6)), uw = LW / n;
    const floors = 2 + (lvl >= 2 ? 1 : 0) + (lvl >= 4 && r() < 0.5 ? 1 : 0);
    const fh = 3.0, H = floors * fh + 0.4, z0 = 3.2, d = Math.min(LD - z0 - 3, 10.5);
    const rc = U.pick(['#3d4650', '#4b4f57', '#2f3640', '#5a3a30', '#6b4a3a'], r);
    const mansard = lvl >= 3 && r() < 0.35;
    const trimAll = U.pick(['#f4f1ea', '#ece7dc', '#e8e4dc'], r);
    for (let k = 0; k < n; k++) {
      const x0 = k * uw, x1 = x0 + uw, cx = (x0 + x1) / 2;
      const [wall, wm] = U.pick(ROW_WALL, r);
      const hj = (r() - 0.5) * 0.5;
      // body
      gb.box(x0, 0, z0, x1, 0.6, z0 + d, '#8a8780', M8.concrete);
      gb.box(x0 + 0.02, 0.6, z0, x1 - 0.02, H + hj, z0 + d, wall, wm);
      gb.box(x0 - 0.02, H + hj - 0.25, z0 - 0.12, x1 + 0.02, H + hj, z0 + 0.02, trimAll);           // cornice
      // party wall parapet with chimney
      if (k > 0) { gb.box(x0 - 0.18, H - 0.2, z0, x0 + 0.18, H + 2.4, z0 + d, '#7a6a5e', M8.brick); chimney(gb, x0, z0 + d * 0.55, H + 2.2, H + 3.3, '#7a4a3a'); }
      // windows: two per floor (door + one window on the ground floor)
      const doorLeft = (k % 2 === 0);
      const dx = doorLeft ? x0 + uw * 0.28 : x1 - uw * 0.28, wx = doorLeft ? x1 - uw * 0.3 : x0 + uw * 0.3;
      const bay = lvl >= 2 && r() < 0.55;
      if (bay) {
        gb.box(wx - 1.1, 0.6, z0 - 0.75, wx + 1.1, fh + 0.4, z0, wall, wm);
        gb.box(wx - 0.95, 1.0, z0 - 0.79, wx + 0.95, fh - 0.1, z0 - 0.74, '#fff', 9);
        for (const q of [-0.32, 0.32]) gb.box(wx + q - 0.04, 1.0, z0 - 0.82, wx + q + 0.04, fh - 0.1, z0 - 0.76, trimAll);
        gb.box(wx - 1.2, fh + 0.4, z0 - 0.85, wx + 1.2, fh + 0.55, z0, trimAll);
      } else win(gb, 0, wx, 1.1, z0, 1.2, 1.6, { trim: trimAll, box: r() < 0.4 });
      for (let f = 1; f < floors; f++) for (const ax of [dx, wx]) win(gb, 0, ax, f * fh + 1.0, z0, 1.0, 1.55, { trim: trimAll });
      for (let f = 0; f < floors; f++) for (const ax of [x0 + uw * 0.3, x1 - uw * 0.3]) win(gb, 1, ax, f * fh + 1.0, z0 + d, 1.0, 1.45, { trim: trimAll });
      // door with transom, stoop and railings
      doorway(gb, dx, z0, U.pick(DOORS, r), trimAll, false);
      gb.box(dx - 0.6, 2.4, z0 - 0.06, dx + 0.6, 2.85, z0 + 0.01, '#fff', 9);
      for (let st = 0; st < 3; st++) gb.box(dx - 0.75, 0, z0 - 1.5 + st * 0.45, dx + 0.75, 0.2 + st * 0.2, z0, '#b8b2a6', M8.concrete);
      for (const s2 of [-0.78, 0.78]) gb.box(dx + s2 - 0.03, 0.2, z0 - 1.5, dx + s2 + 0.03, 1.15, z0, '#1c1d20');
      // front garden: low wall + iron railing, bins, a shrub
      gb.box(x0 + 0.1, 0, 0.4, x1 - 0.1, 0.5, 0.65, '#9a948a', M8.brick);
      for (let x = x0 + 0.25; x < x1 - 0.2; x += 0.22) gb.box(x, 0.5, 0.5, x + 0.03, 1.05, 0.55, '#1c1d20');
      gb.flat(doorLeft ? x1 - uw * 0.55 : x0 + 0.2, 0.7, doorLeft ? x1 - 0.2 : x0 + uw * 0.55, z0 - 0.2, 0.12, '#4a7a36', M8.lawn);
      if (r() < 0.6) bush(gb, wx, 1.6, 0.8);
      if (r() < 0.5) trashBins(gb, doorLeft ? x0 + 0.5 : x1 - 1.6, z0 - 0.7);
      // back yard: lawn, patio, fence; end-of-terrace side windows
      gb.flat(x0 + 0.05, z0 + d + 2.2, x1 - 0.05, LD - 0.25, 0.115, U.pick(['#5f8a3e', '#6a9444', '#58823a'], r), M8.lawn);
      gb.flat(x0 + 0.05, z0 + d, x1 - 0.05, z0 + d + 2.2, 0.115, '#b8b2a6', M8.paving);
      gb.box(x0, 0, z0 + d, x0 + 0.06, 1.6, LD - 0.2, '#8a6a4a', M8.wood);
      if (k === n - 1) gb.box(x1 - 0.06, 0, z0 + d, x1, 1.6, LD - 0.2, '#8a6a4a', M8.wood);
      gb.box(x0, 0, LD - 0.26, x1, 1.6, LD - 0.2, '#8a6a4a', M8.wood);
      if (k === 0 || k === n - 1) for (let f = 0; f < floors; f++) for (const zz of [z0 + d * 0.3, z0 + d * 0.7]) win(gb, k === 0 ? 2 : 3, zz, f * fh + 1.0, k === 0 ? x0 + 0.02 : x1 - 0.02, 0.9, 1.4, { trim: trimAll });
      if (r() < 0.5) yardTree(gb, cx, Math.min(LD - 1.8, z0 + d + 2.4), r);
      // roof
      const ry = H + hj;
      if (mansard) {
        gb.quad([x1, ry, z0], [x0, ry, z0], [x0, ry + 2.2, z0 + 0.9], [x1, ry + 2.2, z0 + 0.9], rc, M8.shingle);
        gb.quad([x0, ry, z0 + d], [x1, ry, z0 + d], [x1, ry + 2.2, z0 + d - 0.9], [x0, ry + 2.2, z0 + d - 0.9], rc, M8.shingle);
        gb.box(x0, ry + 2.2, z0 + 0.9, x1, ry + 2.3, z0 + d - 0.9, '#55524c', M8.gravel);
        for (const [ex, end] of [[x0, k === 0], [x1, k === n - 1]]) if (end) {
          const P = [[ex, ry, z0], [ex, ry, z0 + d], [ex, ry + 2.2, z0 + d - 0.9], [ex, ry + 2.2, z0 + 0.9]];
          gb.quad(P[0], P[1], P[2], P[3], wall, wm); gb.quad(P[1], P[0], P[3], P[2], wall, wm);
        }
        gb.box(cx - 0.5, ry + 0.4, z0 + 0.25, cx + 0.5, ry + 1.6, z0 + 0.5, wall, wm); win(gb, 0, cx, ry + 0.6, z0 + 0.24, 0.6, 0.85, { trim: trimAll });
      } else {
        gb.gable(x0, z0 - 0.3, x1, z0 + d + 0.3, ry, Math.min(3.6, d * 0.36), true, rc, wall, roofSt(rc), wm);
        if (r() < 0.6) { // dormer
          gb.box(cx - 0.65, ry + 0.2, z0 + 0.6, cx + 0.65, ry + 1.6, z0 + 2.2, wall, wm);
          gb.gable(cx - 0.8, z0 + 0.5, cx + 0.8, z0 + 2.3, ry + 1.6, 0.7, false, rc, wall, roofSt(rc), wm);
          win(gb, 0, cx, ry + 0.45, z0 + 0.6, 0.7, 0.85, { trim: trimAll });
        }
      }
    }
    // tired blocks get window AC units and dishes; new ones get bike racks and planters
    if (lvl <= 2) for (let k = 0; k < n; k++) { const cx = (k + 0.5) * uw; if (r() < 0.5) acBox(gb, cx + uw * 0.25, fh + 0.9, z0, -1); if (r() < 0.35) dish(gb, cx - uw * 0.3, floors * fh - 0.6, z0 - 0.15, -1); }
    else if (lvl >= 4) for (let k = 0; k < n; k++) planterBox(gb, (k + 0.5) * uw - 0.5, 0.3);
  };
  function walkup(gb, b, r, LW, LD) {
    const lvl = b.level;
    const [wall, wm] = U.pick(ROW_WALL.slice(0, 3).concat(ROW_WALL.slice(3, 5)), r);
    const floors = 3 + lvl + (r() < 0.4 ? 1 : 0), fh = 3.1, H = floors * fh;
    const z0 = 2.4, d = Math.min(LD - 4, 14), x0 = 1.0, x1 = LW - 1.0;
    gb.box(x0, 0, z0, x1, 3.6, z0 + d, '#cfcac0', 3 + M8.stucco);
    gb.box(x0, 3.6, z0, x1, H, z0 + d, wall, 1 + Number(wm), { vb: 0.5 });
    gb.box(x0 - 0.25, H, z0 - 0.25, x1 + 0.25, H + 0.7, z0 + d + 0.25, '#e8e4dc', M8.concrete);
    gb.box(LW / 2 - 3, H + 0.7, z0 + 4, LW / 2 + 3, H + 3, z0 + 8, '#8f8b84', M8.concrete);
    for (let f = 2; f < floors; f++) for (let k = 0; k < 3; k++) { const bx = x0 + 1.6 + k * (x1 - x0 - 3.2) / 2 - 1.6; gb.box(bx, f * fh - 0.15, z0 - 1.2, bx + 3.2, f * fh + 0.05, z0, '#d6d2c8', M8.concrete); gb.box(bx, f * fh + 0.05, z0 - 1.2, bx + 3.2, f * fh + 1.05, z0 - 1.15, '#2b2d31'); }
    doorway(gb, LW / 2, z0, '#2b2d31', '#e8e4dc', true);
    gb.box(LW / 2 - 1.6, 3.0, z0 - 1.6, LW / 2 + 1.6, 3.2, z0, '#2b2d31');
    yardTree(gb, 2.5, LD - 2, r); yardTree(gb, LW - 2.5, LD - 2, r);
    for (let k = 0; k < 4; k++) parkedCar(gb, 3 + k * 4.6, LD - 1.5 - 0, true, r);
  }

  // ---- low density commercial ----
  const AWN = ['#c8392e', '#2f6f9a', '#2f7a4a', '#d8a02b', '#5a3a6a', '#2a2d33', '#c8642a'];
  function storefront(gb, x0, x1, z, H, acc, r, kind) {
    // display glass, mullions, door, sign band, awning
    gb.box(x0, 0, z - 0.05, x1, 0.55, z + 0.02, '#3a3d42');
    gb.box(x0 + 0.15, 0.55, z - 0.04, x1 - 0.15, H - 0.9, z, '#fff', 9);
    const n = Math.max(2, Math.round((x1 - x0) / 1.6));
    for (let k = 0; k <= n; k++) { const x = x0 + 0.1 + (x1 - x0 - 0.2) * k / n; gb.box(x - 0.05, 0.55, z - 0.1, x + 0.05, H - 0.9, z, '#2a2c30'); }
    const dxp = x0 + (x1 - x0) * 0.78;
    gb.box(dxp - 0.55, 0, z - 0.12, dxp + 0.55, 2.3, z - 0.05, '#3a4a52', 9);
    gb.box(x0, H - 0.9, z - 0.14, x1, H, z, '#2a2d33');
    gb.box(x0 + 0.5, H - 0.75, z - 0.2, x1 - 0.5, H - 0.15, z - 0.14, acc, 5);                   // illuminated sign
    { // lettering
      const nL = Math.max(4, Math.floor((x1 - x0 - 1.6) / 0.42)), lx = (x0 + x1) / 2 - nL * 0.21;
      for (let k = 0; k < nL; k++) { if (r() < 0.12) continue; const h = 0.3 + (k === 0 ? 0.08 : 0); gb.box(lx + k * 0.42 + 0.05, H - 0.6, z - 0.24, lx + k * 0.42 + 0.33, H - 0.6 + h, z - 0.2, '#ffffff', 15); }
    }
    for (const px of [x0 - 0.05, x1 - 0.3]) gb.box(px, 0, z - 0.22, px + 0.35, H, z, '#e8e4dc', M8.concrete);   // pilasters
    // striped awning sloping out
    const ay = H - 1.0, depth = 1.5, stripes = Math.max(4, Math.round((x1 - x0) / 0.6));
    for (let k = 0; k < stripes; k++) {
      const a0 = x0 + (x1 - x0) * k / stripes, a1 = x0 + (x1 - x0) * (k + 1) / stripes, col = k % 2 ? '#f2efe6' : acc;
      gb.quad([a0, ay, z], [a1, ay, z], [a1, ay - 0.55, z - depth], [a0, ay - 0.55, z - depth], col);
      gb.quad([a1, ay, z], [a0, ay, z], [a0, ay - 0.55, z - depth], [a1, ay - 0.55, z - depth], col);
      gb.box(a0, ay - 0.85, z - depth - 0.02, a1, ay - 0.55, z - depth + 0.02, col);
    }
    if (kind === 'cafe') { for (let k = 0; k < 2; k++) { const x = x0 + 1.2 + k * 2.4; gb.cyl(x, 0, z - 2.6, 0.45, 0.75, 8, '#f2f2f2', 0, '#f2f2f2'); gb.cyl(x, 0.75, z - 2.6, 0.04, 1.4, 4, '#888'); gb.cone(x, 2.15, z - 2.6, 1.2, 0.45, 8, acc); } }
    if (kind === 'grocer') for (let k = 0; k < 3; k++) gb.box(x0 + 0.4 + k * 1.1, 0, z - 0.9, x0 + 1.3 + k * 1.1, 0.8, z - 0.25, U.pick(['#d84a2a', '#e3a02b', '#4a8a3a'], r), 0, { top: U.pick(['#e85a3a', '#f2c230', '#6aa83a'], r) });
    if (kind === 'sign') { gb.box(x1 - 0.6, 0, z - 1.3, x1 - 0.1, 0.9, z - 1.0, '#2a2d33'); }
  }
  GEN.clow = function (gb, b, r, LW, LD) {
    if (LW <= T + 0.1 && LD <= T + 0.1) {
      const k = r();
      if (k < 0.24) { gasStation(gb, b, r, LW, LD); return; }
      if (k < 0.4) { fastFood(gb, b, r, LW, LD); return; }
      if (k < 0.55) { kiosk(gb, b, r, LW, LD); return; }
      if (k < 0.66) { laundromat(gb, b, r, LW, LD); return; }
    }
    foundation(gb, LW, LD, b, '#b8b4ab', M8.paving);
    const lvl = b.level, acc = U.pick(AWN, r);
    const kind = U.pick(['cafe', 'grocer', 'sign', 'plain'], r);
    if (LW <= T + 0.1) {
      const up = Math.min(3, 1 + Math.floor((lvl - 1) / 2) + (r() < 0.3 ? 1 : 0));
      const brick = r() < 0.65, wall = brick ? U.pick(BRICKS, r) : U.pick(HOUSE_WALL, r), wm = brick ? M8.brick : M8.stucco;
      const z0 = 1.6, d = Math.min(LD - 4, 12 + r() * 2), Hg = 4.3, H = Hg + up * 3.1;
      gb.box(0.15, 0, z0, LW - 0.15, H, z0 + d, wall, wm);
      storefront(gb, 0.4, LW - 0.4, z0, Hg, acc, r, kind);
      for (let f = 0; f < up; f++) for (const ax of [LW * 0.27, LW * 0.73]) win(gb, 0, ax, Hg + 0.6 + f * 3.1, z0, 1.2, 1.7, { trim: '#ece7dc' });
      for (let f = 0; f < up; f++) for (const ax of [LW * 0.3, LW * 0.7]) win(gb, 1, ax, Hg + 0.6 + f * 3.1, z0 + d, 1.1, 1.5, { trim: '#ece7dc' });
      gb.box(0.05, H - 0.35, z0 - 0.3, LW - 0.05, H, z0 + d + 0.05, '#e8e4dc', M8.concrete);   // cornice
      gb.box(0.15, H, z0, LW - 0.15, H + 0.9, z0 + 0.3, wall, wm);                              // parapet
      gb.box(0.15, H, z0 + 0.3, LW - 0.15, H + 0.05, z0 + d, '#55524c', M8.gravel);
      acUnit(gb, LW * 0.6, z0 + d * 0.6); gb.box(LW * 0.25 - 0.45, H, z0 + d * 0.6 - 0.45, LW * 0.25 + 0.45, H + 0.8, z0 + d * 0.6 + 0.45, '#c9ccd0', M8.metal);
      gb.box(LW - 1.8, 0, z0 + d + 0.4, LW - 0.4, 1.4, z0 + d + 1.4, '#2f5a3a');                 // dumpster
      parkedCar(gb, 3, LD - 2.6, true, r);
    } else {
      // small strip mall / grocery with a parking lot
      const big = lvl >= 3 || r() < 0.5;
      const z0 = big ? 9.5 : 2, d = LD - z0 - 1.2, H = 5.4;
      gb.box(1, 0, z0, LW - 1, H, z0 + d, U.pick(['#d8d2c4', '#c9c2b4', '#e2ddd2'], r), M8.concrete);
      const units = big ? 1 : 3;
      for (let k = 0; k < units; k++) { const a0 = 1 + (LW - 2) * k / units, a1 = 1 + (LW - 2) * (k + 1) / units; storefront(gb, a0 + 0.2, a1 - 0.2, z0, H - 0.6, units === 1 ? acc : U.pick(AWN, r), r, units === 1 ? 'grocer' : U.pick(['cafe', 'sign', 'plain'], r)); }
      gb.box(0.8, H, z0 - 0.3, LW - 0.8, H + 1.0, z0 + 0.1, U.pick(['#d8d2c4', '#bfb8aa'], r), M8.concrete);
      if (big) gb.box(LW / 2 - 4, H + 0.2, z0 - 0.4, LW / 2 + 4, H + 1.4, z0 - 0.3, acc, 5);
      gb.box(1.2, H, z0 + 0.1, LW - 1.2, H + 0.05, z0 + d - 0.2, '#55524c', M8.gravel);
      for (let k = 0; k < 3; k++) acUnit(gb, 4 + k * 5, z0 + d * 0.6);
      if (big) {
        gb.flat(0.5, 0.5, LW - 0.5, z0 - 0.5, 0.11, '#45474b');
        for (let k = 0; k <= 6; k++) gb.flat(1.5 + k * 2.8, 2.5, 1.62 + k * 2.8, 7.5, 0.12, '#e6e6df');
        for (let k = 0; k < 6; k++) if (r() < 0.65) parkedCar(gb, 2.9 + k * 2.8, 5, true, r);
        lampPost(gb, LW / 2, 8.4); gb.box(LW - 3, 0, 8.2, LW - 1.2, 1.1, 8.8, '#9aa0a6', M8.metal);
      }
    }
  };
  // ======================================================================
  // Apartments, towers, offices. Level 1-2 look tired (stained concrete, AC boxes, dishes, chain link),
  // level 3 is ordinary, level 4-5 is new and modern (glass, timber, green roofs, solar).
  // ======================================================================
  const tierOf = lvl => lvl <= 2 ? 0 : lvl === 3 ? 1 : 2;
  function dish(gb, x, y, z, fz) { gb.box(x - 0.03, y, z - 0.03, x + 0.03, y + 0.35, z + 0.03, '#8a8d90'); gb.cyl(x, y + 0.3, z + fz * 0.12, 0.32, 0.06, 8, '#d8d8d4', 0, '#c8c8c4'); }
  function acBox(gb, x, y, z, fz) { gb.box(x - 0.35, y, Math.min(z, z + fz * 0.45), x + 0.35, y + 0.45, Math.max(z, z + fz * 0.45), '#c4c4bc', M8.metal); }
  function roofJunk(gb, x0, z0, x1, z1, y, r, worn) {
    const n = Math.max(2, Math.floor((x1 - x0) * (z1 - z0) / 40));
    for (let k = 0; k < n; k++) { const x = x0 + 1 + r() * (x1 - x0 - 2), z = z0 + 1 + r() * (z1 - z0 - 2); if (r() < 0.5) acUnit(gb, x, z); else gb.box(x - 0.3, y, z - 0.3, x + 0.3, y + 0.9, z + 0.3, worn ? '#6a6460' : '#9aa0a6', M8.metal); }
    if (worn) for (let k = 0; k < 2; k++) dish(gb, x0 + 1.5 + r() * (x1 - x0 - 3), y, z0 + 1 + r() * 2, -1);
  }
  function roofGarden(gb, x0, z0, x1, z1, y, r) {
    gb.box(x0, y, z0, x1, y + 0.25, z1, '#5f8a3e', M8.lawn, { top: '#5f8a3e', topSt: M8.lawn });
    for (let k = 0; k < 4; k++) bush(gb, x0 + 1 + r() * (x1 - x0 - 2), z0 + 1 + r() * (z1 - z0 - 2), 0.7, '#4a7a36');
    const px = (x0 + x1) / 2;
    for (const x of [px - 2, px + 2]) for (const z of [z0 + 1, z0 + 3.4]) gb.box(x - 0.08, y + 0.25, z - 0.08, x + 0.08, y + 2.6, z + 0.08, '#6a4a30', M8.wood);
    for (let k = 0; k < 6; k++) gb.box(px - 2.2, y + 2.6, z0 + 0.8 + k * 0.5, px + 2.2, y + 2.7, z0 + 0.9 + k * 0.5, '#6a4a30', M8.wood);
  }
  function solar(gb, x0, z0, x1, z1, y) {
    for (let x = x0; x < x1 - 1.6; x += 2.2) for (let z = z0; z < z1 - 1; z += 1.6) gb.quad([x, y + 0.3, z], [x + 1.8, y + 0.3, z], [x + 1.8, y + 0.8, z + 1.2], [x, y + 0.8, z + 1.2], '#1d2a44', 9), gb.quad([x + 1.8, y + 0.3, z], [x, y + 0.3, z], [x, y + 0.8, z + 1.2], [x + 1.8, y + 0.8, z + 1.2], '#1d2a44', 9);
  }
  // a stack of balconies on the front wall (plane z). kind 0 concrete slab + railing, 1 glass
  function balconies(gb, x0, x1, y0, floors, fh, z, depth, kind, col) {
    for (let f = 0; f < floors; f++) {
      const y = y0 + f * fh;
      gb.box(x0, y - 0.18, z - depth, x1, y, z, col || '#c8c4ba', M8.concrete);
      if (kind === 1) { gb.box(x0, y, z - depth - 0.02, x1, y + 1.05, z - depth + 0.02, '#fff', 9); gb.box(x0, y + 1.0, z - depth - 0.04, x1, y + 1.07, z - depth + 0.04, '#cfd3d6'); }
      else if (kind === 2) gb.box(x0, y, z - depth, x1, y + 1.0, z - depth + 0.12, col || '#c8c4ba', M8.concrete);
      else { gb.box(x0, y + 0.95, z - depth - 0.03, x1, y + 1.02, z - depth + 0.03, '#3a3d42'); for (let x = x0; x <= x1 + 0.01; x += 0.35) gb.box(x - 0.02, y, z - depth - 0.02, x + 0.02, y + 0.98, z - depth + 0.02, '#3a3d42'); }
    }
  }
  function fins(gb: any, x0: number, x1: number, y0: number, y1: number, z: number, step: number, col: any = '#d8dadc') { for (let x = x0; x <= x1 + 0.01; x += step) gb.box(x - 0.08, y0, z - 0.5, x + 0.08, y1, z, col || '#d8dadc', M8.metal); }
  function treesAlong(gb, x0, x1, z, r) { for (let x = x0; x <= x1; x += 6) yardTree(gb, x, z, r); }
  function grungeLot(gb, LW, LD, r) { // cracked asphalt lot, chain link and a dumpster
    gb.box(LW - 2.2, 0, LD - 1.5, LW - 0.6, 1.3, LD - 0.5, '#3f5a3a', M8.metal);
    for (let k = 0; k < 4; k++) { const x = 2 + r() * (LW - 4), z = LD - 2 - r() * 3; gb.flat(x - 0.9, z - 0.4, x + 0.9, z + 0.4, 0.105, '#4a4c50'); }
  }

  // ---- medium density apartments ----
  GEN.rapt = function (gb, b, r, LW, LD) {
    const lvl = b.level, tr = tierOf(lvl);
    foundation(gb, LW, LD, b, tr === 0 ? '#8e8b84' : PAL.paved, tr === 0 ? M8.concrete : M8.paving);
    const x0 = 1.0, x1 = LW - 1.0, z0 = tr === 2 ? 3.2 : 2.6, d = Math.min(LD - z0 - (LD > 15 ? 5 : 2.5), 15);
    const fh = 3.0, floors = 3 + lvl + (tr === 2 ? 1 : 0), H = floors * fh;
    if (tr === 0) {
      // tired walk-up slab: beige panels or brown brick, AC units in windows, dishes, exterior stair
      const wall = U.pick(['#c9b99a', '#b8a888', '#a89880', '#9a7a62', '#c8bfa8'], r);
      gb.box(x0, 0, z0, x1, H, z0 + d, wall, 1, { vb: 0.4 });
      gb.box(x0, 0, z0 - 0.02, x1, 0.9, z0 + d + 0.02, '#7a756c', M8.concrete);           // grimy base
      for (let f = 1; f < floors; f++) gb.box(x0 - 0.05, f * fh - 0.12, z0 - 0.06, x1 + 0.05, f * fh + 0.08, z0, '#a8a090', M8.concrete);
      for (let f = 0; f < floors; f++) for (let x = x0 + 1.4; x < x1 - 1; x += 2.9) if (r() < 0.35) acBox(gb, x, f * fh + 0.95, z0, -1);
      for (let f = 1; f < floors; f++) if (r() < 0.5) dish(gb, x0 + 1 + r() * (x1 - x0 - 2), f * fh + 1.6, z0 - 0.2, -1);
      balconies(gb, (x0 + x1) / 2 - 1.6, (x0 + x1) / 2 + 1.6, fh, floors - 1, fh, z0, 1.0, 0, '#a8a090');
      doorway(gb, (x0 + x1) / 2, z0, '#5a4a3a', '#8a857c', true);
      gb.box(x0 - 0.15, H, z0 - 0.15, x1 + 0.15, H + 0.5, z0 + d + 0.15, '#6d6a64', M8.concrete);
      roofJunk(gb, x0, z0, x1, z0 + d, H + 0.5, r, true);
      chainFence(gb, 0.3, z0 + d + 0.4, LW - 0.3, LD - 0.3);
      grungeLot(gb, LW, LD, r);
      if (LD > 15) for (let k = 0; k < Math.floor((LW - 4) / 2.8); k++) if (r() < 0.6) parkedVeh(gb, U.pick(['car', 'car', 'van']), 2.4 + k * 2.8, LD - 3.2, true, U.pick(['#7a6a5a', '#5a6a6e', '#8a7a4a', '#6e6a62', '#4a5560'], r));
    } else if (tr === 1) {
      // brick mid-rise with bays, cornice, canopy and trees
      const [wall, wm] = U.pick(ROW_WALL.slice(0, 5), r);
      gb.box(x0, 0, z0, x1, 3.6, z0 + d, '#cfcac0', 3 + M8.stucco);
      gb.box(x0, 3.6, z0, x1, H, z0 + d, wall, 1 + Number(wm), { vb: 0.5 });
      for (let k = 0; k < Math.max(1, Math.floor((x1 - x0) / 7)); k++) { const bx = x0 + 1.4 + k * 7; gb.box(bx, 3.6, z0 - 0.9, bx + 2.8, H - 0.6, z0, wall, 1 + Number(wm), { vb: 0.5 }); }
      gb.box(x0 - 0.3, H, z0 - 0.4, x1 + 0.3, H + 0.8, z0 + d + 0.3, '#e8e4dc', M8.concrete);
      doorway(gb, LW / 2, z0, '#2b2d31', '#e8e4dc', true);
      canopy(gb, LW / 2 - 1.6, LW / 2 + 1.6, z0 - 1.6, z0, 3.0, '#2b2d31');
      roofJunk(gb, x0, z0, x1, z0 + d, H + 0.8, r, false);
      treesAlong(gb, 2.5, LW - 2.5, 1.2, r);
      if (LD > 15) for (let k = 0; k < Math.floor((LW - 4) / 2.8); k++) if (r() < 0.7) parkedCar(gb, 2.4 + k * 2.8, LD - 3, true, r);
    } else {
      // new build: white render and timber cladding, big windows, glass balconies, roof garden, solar
      const wall = U.pick(['#eceae4', '#e2e0da', '#d8d6d0', '#3a3d42'], r), wood = '#a0703f';
      gb.box(x0, 0, z0, x1, 4.0, z0 + d, '#2f3236', 2, { vb: 0.3 });
      gb.box(x0, 4.0, z0, x1, H, z0 + d, wall, 2, { vb: 0.5 });
      for (let k = 0; k < Math.max(1, Math.floor((x1 - x0) / 6)); k++) gb.box(x0 + 0.6 + k * 6, 4, z0 - 0.08, x0 + 2.2 + k * 6, H, z0, wood, M8.wood);
      balconies(gb, x0 + 2.6, x1 - 0.6, 4 + fh, floors - 2, fh, z0, 1.4, 1, '#d8d6d0');
      glassDoor(gb, x0 + 1.4, z0, 1.6);
      gb.box(x0 - 0.1, H, z0 - 0.1, x1 + 0.1, H + 0.45, z0 + d + 0.1, '#2a2d31');
      roofGarden(gb, x0 + 0.6, z0 + 0.6, (x0 + x1) / 2, z0 + d - 0.6, H + 0.45, r);
      solar(gb, (x0 + x1) / 2 + 0.6, z0 + 1, x1 - 0.6, z0 + d - 1, H + 0.45);
      gb.flat(0.6, 0.4, LW - 0.6, z0 - 1.5, 0.11, '#6b9444', M8.lawn);
      shrubs(gb, 1.2, LW - 1.2, 1.0, r); bikeRack(gb, LW - 3.6, z0 - 0.8);
      if (LD > 15) gb.flat(0.6, z0 + d + 0.6, LW - 0.6, LD - 0.6, 0.11, '#6b9444', M8.lawn), treesAlong(gb, 3, LW - 3, LD - 2.2, r);
    }
  };

  // ---- high density residential ----
  GEN.rhigh = function (gb, b, r, LW, LD) {
    const lvl = b.level, tr = tierOf(lvl);
    foundation(gb, LW, LD, b, tr === 0 ? '#8e8b84' : PAL.paved, tr === 0 ? M8.concrete : M8.paving);
    const floors = 9 + lvl * 4 + Math.floor(r() * 6) + (LD > 25 ? 4 : 0), fh = 3.0;
    const cx = LW / 2, cz = LD / 2 - 0.5;
    if (tr === 0) {
      // slab tower in raw concrete: stacked balconies with solid parapets, stains, dishes, a parking podium
      const w = Math.min(LW - 4, 16), d = Math.min(LD - 6, 10), x0 = cx - w / 2, x1 = cx + w / 2, z0 = 3.5, z1 = z0 + d, H = floors * fh;
      gb.box(1, 0, 1.2, LW - 1, 3.2, LD - 1.2, '#8a8780', 4 + M8.concrete);                 // parking podium
      for (let x = 2; x < LW - 2; x += 3) gb.box(x, 0.4, 1.15, x + 2.2, 2.6, 1.2, '#1c1d20');
      gb.box(x0, 3.2, z0, x1, H, z1, U.pick(['#b8b2a6', '#a8a298', '#c2bab0', '#9e988c'], r), 1, { vb: 0.2 });
      for (let k = 0; k < 4; k++) { const sx = x0 + r() * w; gb.box(sx, 3.2, z0 - 0.03, sx + 0.6 + r() * 0.8, H * (0.4 + r() * 0.6), z0, '#7a7468', M8.concrete); } // water stains
      for (const bx of [x0 + 1.2, x1 - 4.8]) balconies(gb, bx, bx + 3.6, 3.2 + fh, floors - 2, fh, z0, 1.2, 2, '#b4aea2');
      for (let f = 2; f < floors; f += 1) if (r() < 0.45) dish(gb, x0 + 1.6 + r() * (w - 3), f * fh + 1.2, z0 - 1.25, -1);
      for (let f = 2; f < floors; f++) for (let k = 0; k < 2; k++) if (r() < 0.3) acBox(gb, x0 + 5.5 + r() * (w - 11), f * fh + 0.95, z0, -1);
      gb.box(x0 - 0.2, H, z0 - 0.2, x1 + 0.2, H + 0.6, z1 + 0.2, '#6d6a64', M8.concrete);
      gb.box(cx - 2.2, H + 0.6, z0 + 2, cx + 2.2, H + 3.6, z0 + 6, '#8a8780', M8.concrete);       // lift tower
      roofJunk(gb, x0, z0, x1, z1, H + 0.6, r, true);
      chainFence(gb, 0.3, 0.3, LW - 0.3, LD - 0.3, cx - 3, cx + 3);
    } else if (tr === 1) {
      // brick and concrete tower over a retail podium, regular balconies
      const pod = U.pick(PAL.brick, r), tw = U.pick(['#d1cec6', '#c8c2b4', '#b8b4ab', '#a88468'], r);
      gb.box(1, 0, 1, LW - 1, 4.2, LD - 3, pod, 3);
      for (let k = 0; k < 3; k++) gb.box(2 + k * (LW - 4) / 3 + 0.3, 3.2, 0.7, 2 + (k + 1) * (LW - 4) / 3 - 0.3, 3.8, 1.0, U.pick(AWN, r), 5);
      const s = 6.5 + r() * 1.5, H = 4.2 + floors * fh;
      gb.box(cx - s, 4.2, cz - s, cx + s, H, cz + s, tw, 1, { vb: 0.3 });
      balconies(gb, cx - s + 1, cx - s + 4.5, 4.2 + fh, floors - 1, fh, cz - s, 1.1, 0, '#c8c4ba');
      balconies(gb, cx + s - 4.5, cx + s - 1, 4.2 + fh, floors - 1, fh, cz - s, 1.1, 0, '#c8c4ba');
      gb.box(cx - s - 0.3, H, cz - s - 0.3, cx + s + 0.3, H + 0.9, cz + s + 0.3, '#5c5a56');
      gb.box(cx - 2.5, H + 0.9, cz - 2.5, cx + 2.5, H + 3.6, cz + 2.5, '#8c8984');
      roofJunk(gb, cx - s, cz - s, cx + s, cz + s, H + 0.9, r, false);
      yardTree(gb, 2.5, LD - 1.6, r); yardTree(gb, LW - 2.5, LD - 1.6, r);
    } else {
      // glass tower with wraparound glass balconies, setbacks, sky garden and a lit crown
      const s = 7 + r() * 1.2, h1 = 5 + floors * fh * (0.62 + r() * 0.1), H = 5 + floors * fh;
      const glass = U.pick(['#8fa3b5', '#7d95a3', '#a7b6bf', '#6f8aa0'], r);
      gb.box(1, 0, 1, LW - 1, 5, LD - 3, '#2f3236', 2, { vb: 0.2 });                          // glazed lobby podium
      roofGarden(gb, 1.5, LD - 9, LW - 1.5, LD - 3.5, 5, r);
      gb.box(cx - s, 5, cz - s, cx + s, h1, cz + s, glass, 2, { vb: 0.4 });
      const nb = Math.floor((h1 - 5) / fh);
      balconies(gb, cx - s, cx + s, 5 + fh, nb - 1, fh, cz - s, 1.3, 1, '#e2e0da');
      gb.box(cx - s + 1.4, h1, cz - s + 1.4, cx + s - 1.4, h1 + 3, cz + s - 1.4, '#5f8a3e', M8.lawn); // sky garden floor
      for (let k = 0; k < 4; k++) bush(gb, cx - s + 2.4 + k * (2 * s - 4.8) / 3, h1 + 0.4, cz - s + 2, 0.8);
      gb.box(cx - s + 1.4, h1 + 3, cz - s + 1.4, cx + s - 1.4, H, cz + s - 1.4, glass, 2, { vb: 0.4 });
      fins(gb, cx - s + 1.4, cx + s - 1.4, h1 + 3, H, cz - s + 1.4, 1.7, '#e8eaec');
      gb.box(cx - s + 1.2, H, cz - s + 1.2, cx + s - 1.2, H + 2.4, cz + s - 1.2, '#e8eaec', M8.metal);
      gb.box(cx - s + 1.15, H + 1.6, cz - s + 1.15, cx + s - 1.15, H + 1.9, cz + s - 1.15, '#8fd8ff', 15, { skip: 16 }); // LED crown
      treesAlong(gb, 2.5, LW - 2.5, 0.9, r);
    }
  };

  // ---- high density commercial ----
  GEN.chigh = function (gb, b, r, LW, LD) {
    const lvl = b.level, tr = tierOf(lvl);
    foundation(gb, LW, LD, b, PAL.paved);
    const acc = U.pick(PAL.accent, r), deep = LD > 25;
    if (tr === 0) {
      // dated plaza mall: beige panels, dark band windows, big box signs, roof clutter
      const H = 6 + lvl * 3.4 + (deep ? 6 : 0);
      gb.box(1, 0, 4, LW - 1, H, LD - 1.5, U.pick(['#cfc4ae', '#bfb39c', '#d8cdb8'], r), 3 + M8.concrete, { vb: 0.8 });
      for (let k = 0; k < Math.floor((LW - 2) / 6); k++) storefront(gb, 1.4 + k * 6, 6.8 + k * 6, 4, 4.2, U.pick(AWN, r), r, U.pick(['sign', 'plain'], r));
      for (let k = 0; k < 2; k++) signBoard(gb, 2 + k * (LW - 4) / 2, 2 + (k + 1) * (LW - 4) / 2 - 1, H - 2.0, H - 0.6, 4, U.pick(['#d8342a', '#1f6fd0', '#e8a21a'], r), '#ffffff', r);
      gb.box(0.8, H, 3.8, LW - 0.8, H + 0.5, LD - 1.3, '#6d6a64', M8.concrete);
      roofJunk(gb, 1, 4, LW - 1, LD - 1.5, H + 0.5, r, true);
      gb.flat(0.6, 0.4, LW - 0.6, 3.6, 0.11, '#4a4c50');
    } else if (tr === 1) {
      // retail podium with offices above
      const floors = (deep ? 8 : 3) + lvl * (deep ? 2 : 1) + Math.floor(r() * 3), H = 8.2 + floors * 3.6, inset = deep ? 3 : 1.5;
      gb.box(1, 0, 1, LW - 1, 8.2, LD - 1.5, U.pick(PAL.conc, r), 3);
      for (let k = 0; k < Math.floor((LW - 2) / 6.5); k++) storefront(gb, 1.4 + k * 6.5, 7.4 + k * 6.5, 1, 4.6, U.pick(AWN, r), r, 'plain');
      gb.box(1 + inset, 8.2, 1 + inset, LW - 1 - inset, H, LD - 1.5 - inset, U.pick(PAL.glass, r), 2, { vb: 0.4 });
      gb.box(1 + inset - 0.2, H, 1 + inset - 0.2, LW - 1 - inset + 0.2, H + 1.0, LD - 1.5 - inset + 0.2, '#4c4f55');
      gb.box(3, 8.6, 0.6, LW - 3, 10.2, 1.0, acc, 5);
      roofJunk(gb, 1 + inset, 1 + inset, LW - 1 - inset, LD - 1.5 - inset, H + 1, r, false);
    } else {
      // glass flagship: double-height storefronts, LED screens, terrace and a tower with a crown
      const floors = (deep ? 12 : 4) + lvl * (deep ? 3 : 1) + Math.floor(r() * 3), H = 10 + floors * 3.6, inset = deep ? 3.5 : 1.8;
      gb.box(1, 0, 1.5, LW - 1, 10, LD - 1.5, '#2a2d31', 2, { vb: 0.2 });
      ribbon(gb, 1.5, LW - 1.5, 0.4, 8.6, 1.5, 0, 2.4, '#1c1d20');
      gb.box(2, 6.5, 1.3, 2 + Math.min(8, LW * 0.4), 9.5, 1.45, '#3ad0ff', 15);                // LED screen
      gb.box(LW - 2 - Math.min(5, LW * 0.25), 6.8, 1.3, LW - 2, 9.2, 1.45, acc, 15);
      roofGarden(gb, 1.4, LD - 7, LW - 1.4, LD - 1.9, 10, r);
      gb.box(1 + inset, 10, 1.5 + inset, LW - 1 - inset, H, LD - 7.5, U.pick(['#7d95a3', '#8fa3b5', '#5f7385'], r), 2, { vb: 0.4 });
      fins(gb, 1 + inset, LW - 1 - inset, 10, H, 1.5 + inset, 1.8, '#d8dadc');
      gb.box(1 + inset - 0.2, H, 1.5 + inset - 0.2, LW - 1 - inset + 0.2, H + 2.6, LD - 7.3, '#e8eaec', M8.metal);
      gb.box(1 + inset - 0.25, H + 1.8, 1.5 + inset - 0.25, LW - 1 - inset + 0.25, H + 2.1, LD - 7.25, acc, 15, { skip: 16 });
      treesAlong(gb, 3, LW - 3, 0.7, r);
    }
  };

  // ---- offices ----
  GEN.office = function (gb, b, r, LW, LD) {
    const lvl = b.level, tr = tierOf(lvl);
    foundation(gb, LW, LD, b, PAL.paved);
    const floors = 7 + lvl * 4 + Math.floor(r() * 5) + (LD > 25 ? 5 : 0), cx = LW / 2, cz = LD / 2;
    const sx = LW / 2 - 3, sz = LD / 2 - 3;
    if (tr === 0) {
      // 1970s concrete grid block with dark windows and a surface car park
      const H = 4 + floors * 3.4 * 0.7;
      gb.box(cx - sx, 0, cz - sz, cx + sx, H, cz + sz, U.pick(['#b8b2a6', '#c2bab0', '#a8a298'], r), 3 + M8.concrete, { vb: 0.6 });
      for (let x = cx - sx; x <= cx + sx + 0.01; x += 2.1) gb.box(x - 0.15, 4, cz - sz - 0.25, x + 0.15, H, cz - sz, '#c9c2b4', M8.concrete);
      gb.box(cx - sx - 0.3, H, cz - sz - 0.3, cx + sx + 0.3, H + 0.8, cz + sz + 0.3, '#7a756c', M8.concrete);
      roofJunk(gb, cx - sx, cz - sz, cx + sx, cz + sz, H + 0.8, r, true);
      glassDoor(gb, cx, cz - sz - 0.25, 2.2);
      gb.flat(0.6, 0.4, LW - 0.6, cz - sz - 0.8, 0.11, '#4a4c50');
    } else if (tr === 1) {
      // blue glass box on a stone podium
      const H = 5 + floors * 3.6, glass = U.pick(PAL.glass, r);
      gb.box(1.5, 0, 1.5, LW - 1.5, 5, LD - 1.5, '#c9c5bd', 3);
      gb.box(cx - sx, 5, cz - sz, cx + sx, H, cz + sz, glass, 2, { vb: 1 });
      gb.box(cx - 3, H, cz - 3, cx + 3, H + 2.4, cz + 3, '#555a60');
      gb.box(cx - sx + 2.2, H - 1.2, cz - sz - 0.06, cx + sx - 2.2, H - 0.4, cz - sz, '#9fd3ff', 5);
      treesAlong(gb, 2.5, LW - 2.5, 0.9, r);
    } else {
      // modern tower: vertical fins, setbacks, glass lobby, plaza and a lit spire
      const H = 6 + floors * 3.7, h1 = 6 + (H - 6) * 0.55, h2 = 6 + (H - 6) * 0.82, glass = U.pick(['#6f8aa0', '#5f7385', '#8fa3b5', '#7d95a3'], r);
      gb.box(cx - sx, 0, cz - sz, cx + sx, 6, cz + sz, '#2a2d31', 2, { vb: 0.2 });
      gb.box(cx - sx, 6, cz - sz, cx + sx, h1, cz + sz, glass, 2, { vb: 0.4 });
      fins(gb, cx - sx, cx + sx, 6, h1, cz - sz, 1.6);
      gb.box(cx - sx + 1.6, h1, cz - sz + 1.6, cx + sx - 1.6, h2, cz + sz - 1.6, glass, 2, { vb: 0.4 });
      fins(gb, cx - sx + 1.6, cx + sx - 1.6, h1, h2, cz - sz + 1.6, 1.6);
      gb.box(cx - sx + 3.2, h2, cz - sz + 3.2, cx + sx - 3.2, H, cz + sz - 3.2, glass, 2, { vb: 0.4 });
      gb.box(cx - sx + 3, H, cz - sz + 3, cx + sx - 3, H + 1.6, cz + sz - 3, '#e8eaec', M8.metal);
      gb.cyl(cx, H + 1.6, cz, 0.5, 14 + lvl * 2, 6, '#d8dadc', 0, null, 0.08);
      gb.box(cx - 0.3, H + 15.6 + lvl * 2, cz - 0.3, cx + 0.3, H + 16.2 + lvl * 2, cz + 0.3, '#f33', 7);
      gb.box(cx - sx + 3, H + 0.6, cz - sz + 2.95, cx + sx - 3, H + 0.9, cz - sz + 3, '#ffffff', 15);
      gb.flat(0.6, 0.4, LW - 0.6, cz - sz - 0.4, 0.115, '#cfc6b2', M8.paving);
      treesAlong(gb, 2.5, LW - 2.5, 1.2, r); bench(gb, cx, 1.6, false);
    }
  };
  // ---- low density offices: small professional buildings on 1x1 to 2x2 lots ----
  // tier 0: tired 70s strip office or a house converted into an office; tier 1: brick two/three storey with
  // a canopy and side parking; tier 2: timber and glass pavilion with a green roof, solar and landscaping.
  GEN.olow = function (gb, b, r, LW, LD) {
    const lvl = b.level, tr = tierOf(lvl), wide = LW >= 19, deep = LD >= 19;
    if (tr === 0) {
      if (!wide && r() < 0.55) {
        // converted house: siding, porch, small sign on a post, paved front for parking
        foundation(gb, LW, LD, b, '#7f9a4a', M8.lawn);
        const w = LW - 3.2, d = Math.min(LD - 6, 8.5), x0 = 1.6, z0 = 4.4;
        const wall = U.pick(WORN_WALL, r), trim = '#d8d2c2';
        house(gb, r, x0, z0, w, d, 2, 'gable', { wall, wm: M8.siding, rc: U.pick(WORN_ROOF, r), trim, doorCol: '#3d4650', spacing: 2.4, band: false });
        porch(gb, x0 + w / 2 - 1.6, x0 + w / 2 + 1.6, z0, 1.4, 2.6, '#55504a', trim);
        gb.flat(0.5, 0.3, LW - 0.5, 2.8, 0.11, '#5a5c60');
        for (let k = 0; k < 2; k++) parkedCarOld(gb, 2.4 + k * (LW - 4.8), 1.5, r);
        gb.box(LW / 2 - 0.05, 0, 3.2, LW / 2 + 0.05, 1.6, 3.3, '#3a3d42');
        gb.box(LW / 2 - 1.1, 1.0, 3.15, LW / 2 + 1.1, 1.9, 3.35, U.pick(['#2f5a9a', '#7a3a2a', '#2f6a4a'], r), 5);
        acBox(gb, x0 + w - 0.8, 3.2, z0 - 0.02, -1);
        return;
      }
      // one/two storey strip office: brown brick, band windows, flat roof with units, cracked lot in front
      foundation(gb, LW, LD, b, '#55575b');
      const floors = lvl === 1 ? 1 : 2, H = floors * 3.6 + 0.6, z0 = Math.min(7, LD * 0.42), z1 = LD - 1;
      const br = U.pick(['#7a5a44', '#8a6a4a', '#6e5a48', '#9a8a70'], r);
      gb.box(1, 0, z0, LW - 1, H, z1, br, 3 + M8.brick, { vb: 0.6 });
      gb.box(0.8, H, z0 - 0.2, LW - 0.8, H + 0.5, z1 + 0.2, '#6d6a64', M8.concrete);
      gb.box(1, H - 0.9, z0 - 1.2, LW - 1, H - 0.6, z0, '#5a4a3a');
      for (let x = 2.5; x < LW - 2; x += Math.max(4, (LW - 4) / 3)) glassDoor(gb, x, z0, 1.2);
      roofJunk(gb, 1, z0, LW - 1, z1, H + 0.5, r, true);
      parkingLot(gb, 0.6, 0.6, LW - 0.6, z0 - 1.4, Math.max(2, Math.floor((LW - 1.2) / 2.6)), r, 0.45);
      gb.box(LW - 1.5, 0, 0.5, LW - 1.4, 3.0, 0.6, '#3a3d42');
      gb.box(LW - 2.8, 2.2, 0.45, LW - 0.1, 3.1, 0.65, U.pick(['#d8a23a', '#c8392e', '#e8e2d4'], r), 15);
      return;
    }
    if (tr === 1) {
      // brick office: punched windows with stone trim, cornice, entrance canopy, landscaped strip and parking
      foundation(gb, LW, LD, b, '#a9a69e', M8.paving);
      const floors = (wide ? 3 : 2) + (lvl >= 3 && r() < 0.4 ? 1 : 0), H = floors * 3.4 + 0.5;
      const bw = wide ? LW - 2.4 : LW - 2, x0 = (LW - bw) / 2, z0 = 3.2, z1 = deep ? Math.min(LD - 7, 16) : LD - 1.2;
      const br = U.pick(PAL.brick, r), stone = '#e3dccd';
      gb.box(x0, 0, z0, x0 + bw, 0.9, z1, '#bdb6a8', M8.concrete);
      gb.box(x0, 0.9, z0, x0 + bw, H, z1, br, 1 + M8.brick, { vb: 0.4 });
      for (let f = 1; f < floors; f++) gb.box(x0 - 0.05, 0.9 + f * 3.4 - 0.1, z0 - 0.08, x0 + bw + 0.05, 0.9 + f * 3.4 + 0.1, z1 + 0.08, stone, M8.concrete);
      gb.box(x0 - 0.3, H, z0 - 0.3, x0 + bw + 0.3, H + 0.55, z1 + 0.3, stone, M8.concrete);
      gb.box(x0 + 0.2, H + 0.55, z0 + 0.2, x0 + bw - 0.2, H + 0.75, z1 - 0.2, '#56514c');
      const dx = x0 + bw / 2;
      glassDoor(gb, dx, z0, 1.8);
      canopy(gb, dx - 2.0, dx + 2.0, z0 - 1.6, z0, 3.0, '#2f3640');
      gb.box(dx - 1.6, 3.4, z0 - 0.1, dx + 1.6, 3.9, z0 - 0.02, '#f2efe8', 15);
      shrubs(gb, x0 + 0.6, dx - 2.4, z0 - 0.9, r); shrubs(gb, dx + 2.6, x0 + bw - 0.4, z0 - 0.9, r);
      pathStrip(gb, dx - 1.0, 0.2, dx + 1.0, z0 - 1.6, '#cfc6b2');
      for (let k = 0; k < Math.floor(bw / 4); k++) acBox(gb, x0 + 1.5 + k * 4, H + 0.75, z0 + 2, 1);
      if (deep) { parkingLot(gb, 0.8, z1 + 0.8, LW - 0.8, LD - 0.6, Math.max(3, Math.floor((LW - 1.6) / 2.6)), r, 0.7); }
      else if (wide) flagpole(gb, x0 + 0.4, 1.0, 7);
      if (!wide) yardTree(gb, LW - 1.0, 1.0, r);
      return;
    }
    // modern pavilion: dark timber box cantilevered over a glass ground floor, green roof, solar, planting
    foundation(gb, LW, LD, b, '#6b9444', M8.lawn);
    const top = lvl >= 5 && (wide || deep) ? 3 : 2, z0 = 3.0, z1 = deep ? Math.min(LD - 6.5, 15) : LD - 1.4, x0 = 1.2, x1 = LW - 1.2;
    gb.flat(0.4, 0.3, LW - 0.4, z0 - 0.2, 0.12, '#d9d4c6', M8.paving);
    gb.box(x0 + 1.2, 0, z0 + 0.8, x1 - 1.2, 3.6, z1 - 0.4, '#fff', 2, { vb: 0.3 });                        // glass ground floor
    for (let x = x0 + 1.2; x <= x1 - 1.2 + 0.01; x += 2.4) gb.box(x - 0.05, 0, z0 + 0.74, x + 0.05, 3.6, z0 + 0.8, '#2a2d31');
    const timber = U.pick(['#6a4a32', '#5a3d2b', '#7a5a3a'], r), yTop = 3.6 + (top - 1) * 3.5;
    gb.box(x0, 3.6, z0, x1, yTop, z1, timber, M8.wood);
    ribbon(gb, x0 + 0.6, x1 - 0.6, 4.3, 3.6 + 2.6, z0, 0, 1.8, '#1c1d20');
    if (top === 3) ribbon(gb, x0 + 0.6, x1 - 0.6, 7.8, 7.8 + 2.3, z0, 0, 1.8, '#1c1d20');
    gb.box(x0 - 0.15, yTop, z0 - 0.15, x1 + 0.15, yTop + 0.35, z1 + 0.15, '#e8eaec', M8.metal);
    roofGarden(gb, x0 + 0.3, z0 + 0.3, (x0 + x1) / 2, z1 - 0.3, yTop + 0.35, r);
    solar(gb, (x0 + x1) / 2 + 0.4, z0 + 0.6, x1 - 0.4, z1 - 0.4, yTop + 0.35);
    glassDoor(gb, LW / 2, z0 + 0.8, 2.2);
    for (const x of [1.0, LW - 2.0]) planterBox(gb, x, 0.8);
    bikeRack(gb, LW / 2 + 2.2, 1.4); bench(gb, LW / 2 - 3.0, 1.4, false);
    if (deep) { parkingLot(gb, 0.8, z1 + 0.9, LW - 0.8, LD - 0.6, Math.max(3, Math.floor((LW - 1.6) / 2.6)), r, 0.55); }
    else { yardTree(gb, 0.9, LD - 1.0, r); yardTree(gb, LW - 0.9, LD - 1.0, r); }
  };
  // ---- services ----
  function cross(gb, x, y, z, s) {
    gb.box(x - 0.35 * s, y - 1.1 * s, z - 0.12, x + 0.35 * s, y + 1.1 * s, z, '#e0282c', 5);
    gb.box(x - 1.1 * s, y - 0.35 * s, z - 0.12, x + 1.1 * s, y + 0.35 * s, z, '#e0282c', 5);
  }
  function field(gb, x0, z0, x1, z1) {
    gb.flat(x0, z0, x1, z1, 0.12, '#4f8f3a');
    const lw = 0.25, c = '#e8e8e0';
    gb.flat(x0 + 0.5, z0 + 0.5, x1 - 0.5, z0 + 0.5 + lw, 0.14, c);
    gb.flat(x0 + 0.5, z1 - 0.5 - lw, x1 - 0.5, z1 - 0.5, 0.14, c);
    gb.flat(x0 + 0.5, z0 + 0.5, x0 + 0.5 + lw, z1 - 0.5, 0.14, c);
    gb.flat(x1 - 0.5 - lw, z0 + 0.5, x1 - 0.5, z1 - 0.5, 0.14, c);
    gb.flat((x0 + x1) / 2 - lw / 2, z0 + 0.5, (x0 + x1) / 2 + lw / 2, z1 - 0.5, 0.14, c);
  }
export const SGEN: Record<string, any> = {};
  function lumps(gb, x0, z0, x1, z1, y, n, r) {
    for (let k = 0; k < n; k++) { const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0), s = 0.35 + r() * 0.5; gb.box(x - s, y, z - s * 0.8, x + s, y + s * (0.6 + r() * 0.6), z + s * 0.8, U.pick(['#3a3d42', '#5a5a52', '#7a6a4a', '#2f4a6a', '#8a8a80', '#c8c4b8', '#4a5a3a', '#6a3a2a'], r)); }
  }
  function parkingLot(gb, x0, z0, x1, z1, stalls, r, fill) {
    gb.flat(x0, z0, x1, z1, 0.11, '#45474b');
    const sw = (x1 - x0) / stalls;
    for (let k = 0; k <= stalls; k++) gb.flat(x0 + k * sw - 0.06, z0 + 0.3, x0 + k * sw + 0.06, z0 + 5.0, 0.12, '#e6e6df');
    for (let k = 0; k < stalls; k++) if (r() < (fill || 0.6)) parkedCar(gb, x0 + (k + 0.5) * sw, z0 + 2.6, true, r);
  }
  function chainFence(gb: any, x0: number, z0: number, x1: number, z1: number, gapX0?: number, gapX1?: number) {
    const post = (x, z) => gb.box(x - 0.05, 0, z - 0.05, x + 0.05, 2.0, z + 0.05, '#7a8086');
    const run = (ax, az, bx, bz) => { for (const y of [0.15, 1.0, 1.9]) gb.box(Math.min(ax, bx) - 0.02, y, Math.min(az, bz) - 0.02, Math.max(ax, bx) + 0.02, y + 0.05, Math.max(az, bz) + 0.02, '#8a9096'); for (let t = 0; t <= 1; t += 0.02) { const x = ax + (bx - ax) * t, z = az + (bz - az) * t; gb.box(x - 0.008, 0.15, z - 0.008, x + 0.008, 1.9, z + 0.008, '#9aa0a6'); } const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 3)); for (let k = 0; k <= n; k++) post(ax + (bx - ax) * k / n, az + (bz - az) * k / n); };
    if (gapX0 !== undefined) { run(x0, z0, gapX0, z0); run(gapX1, z0, x1, z0); } else run(x0, z0, x1, z0);
    run(x0, z1, x1, z1); run(x0, z0, x0, z1); run(x1, z0, x1, z1);
  }
  SGEN.clinic = function (gb, b, r, LW, LD, big) {
    foundation(gb, LW, LD, b, '#b8b4ab', M8.paving);
    if (big) { SGEN.hospitalBig(gb, b, r, LW, LD); return; }
    const z0 = 8.2, z1 = LD - 1.5;
    parkingLot(gb, 0.8, 0.6, 12.6, 6.4, 5, r, 0.7);
    // main block: white panels, ribbon windows upstairs
    gb.box(1.5, 0, z0, 13, 0.45, z1, '#9a968e', M8.concrete);
    gb.box(1.5, 0.45, z0, 13, 3.7, z1, '#f0eee8', M8.concrete);
    gb.box(1.5, 3.7, z0, 13, 7.6, z1, '#f0eee8', 2 + M8.concrete);
    gb.box(1.3, 3.55, z0 - 0.15, 13.2, 3.75, z1 + 0.1, '#5a7a8a');
    gb.box(1.3, 7.6, z0 - 0.15, 13.2, 8.1, z1 + 0.15, '#dcdad4', M8.concrete);
    for (let k = 0; k < 4; k++) win(gb, 0, 3 + k * 2.6, 1.0, z0, 1.6, 1.9, { trim: '#5a7a8a' });
    // glass entrance atrium
    gb.box(13, 0, z0 + 1, 18.6, 5.6, z1 - 3, '#fff', 9);
    for (let k = 0; k <= 5; k++) gb.box(13 + k * 1.12 - 0.05, 0, z0 + 0.94, 13 + k * 1.12 + 0.05, 5.6, z0 + 1.0, '#cfd3d6');
    gb.box(13, 2.75, z0 + 0.92, 18.6, 2.85, z0 + 1.0, '#cfd3d6');
    gb.box(12.8, 5.6, z0 + 0.8, 18.8, 6.0, z1 - 2.8, '#dcdad4', M8.concrete);
    // canopy with columns
    gb.box(13.2, 3.2, z0 - 2.4, 18.4, 3.45, z0 + 1, '#e8e6e0', M8.concrete);
    for (const x of [13.6, 18.0]) gb.cyl(x, 0, z0 - 2, 0.16, 3.2, 8, '#cfd3d6');
    gb.box(15.2, 0, z0 + 0.8, 16.6, 2.4, z0 + 0.9, '#3a4a52', 9);
    // red cross signs
    const cross = (x, y, z, s) => { gb.box(x - 0.3 * s, y - 1 * s, z - 0.1, x + 0.3 * s, y + 1 * s, z, '#e0282c', 15); gb.box(x - 1 * s, y - 0.3 * s, z - 0.1, x + 1 * s, y + 0.3 * s, z, '#e0282c', 15); };
    gb.box(10.6, 5.0, z0 - 0.14, 12.6, 7.0, z0 - 0.04, '#ffffff', 5); cross(11.6, 6.0, z0 - 0.15, 0.75);
    gb.box(15.2, 6.0, z0 + 0.7, 17.8, 7.5, z0 + 0.8, '#ffffff', 5); cross(16.5, 6.75, z0 + 0.69, 0.55);
    // ambulance bay
    gb.box(13, 0, z1 - 3, 18.6, 3.6, z1, '#e4e2dc', M8.concrete);
    gb.box(14.2, 0, z1 - 3.06, 17.4, 3.0, z1 - 3, '#d0d2d4', M8.siding);
    gb.flat(13.4, 6.6, 18.6, z1 - 3.1, 0.115, '#8f8d87', M8.concrete);
    for (const z of [9.0, 10.4]) gb.flat(14.4, z, 17.4, z + 0.3, 0.12, '#e3c23a');
    // planting, bench, flagpole
    for (const [x, z] of [[1.2, 7.2], [19, 7.2], [19, LD - 1.2]]) yardTree(gb, x, z, r);
    gb.box(13.6, 0, 6.8, 18.4, 0.5, 7.4, '#8f877a', M8.concrete, { top: '#4f7d34', topSt: M8.lawn });
    for (let k = 0; k < 4; k++) bush(gb, 14.2 + k * 1.2, 7.1, 0.55);
    bench(gb, 16, 6.2, false);
    gb.cyl(19, 0, 1.2, 0.07, 8, 6, '#cfd3d6'); gb.box(19.07, 6.8, 1.2, 20.1, 7.6, 1.24, '#2f6fd0');
    acUnit(gb, 4, z0 + 4); gb.box(6, 8.1, z0 + 3, 9, 9.4, z0 + 6, '#c9ccd0', M8.metal);
  };
  SGEN.garbage = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#8f8d87', M8.concrete);
    // yard paving and stains
    gb.flat(0.6, 0.6, LW - 0.6, LD - 0.6, 0.11, '#7d7b75', M8.concrete);
    for (let k = 0; k < 6; k++) { const x = 3 + r() * 22, z = 2 + r() * 4; gb.flat(x - 0.8, z - 0.5, x + 0.8, z + 0.5, 0.115, '#5a5852'); }
    // tipping shed: corrugated walls, standing-seam roof
    const x0 = 1.5, x1 = 19.5, z0 = 6.5, z1 = LD - 1.2, H = 9.5;
    gb.box(x0, 0, z0, x1, 1.2, z1, '#8a8780', M8.concrete);
    gb.box(x0, 1.2, z0, x1, H, z1, '#6f8f7a', M8.metal);
    gb.gable(x0 - 0.4, z0 - 0.4, x1 + 0.4, z1 + 0.4, H, 2.2, true, '#5b6560', '#6f8f7a', M8.seam, M8.metal);
    // three big bays, one door half up
    for (let k = 0; k < 3; k++) {
      const a0 = x0 + 1 + k * 5.6, a1 = a0 + 4.6;
      gb.box(a0, 0.05, z0 - 0.06, a1, 6.2, z0 + 0.2, '#16181b');
      gb.box(a0 - 0.25, 6.2, z0 - 0.14, a1 + 0.25, 6.6, z0 + 0.02, '#3a3d42');
      if (k === 2) gb.box(a0, 3.2, z0 - 0.1, a1, 6.2, z0 - 0.04, '#9aa0a6', M8.metal);
      lumps(gb, a0 + 0.2, z0 + 0.4, a1 - 0.2, z0 + 3.5, 0.05, 9, r);
      gb.box(a0 - 0.6, 0, z0 - 0.3, a0 - 0.3, 1.0, z0, '#e3c23a'); gb.box(a1 + 0.3, 0, z0 - 0.3, a1 + 0.6, 1.0, z0, '#e3c23a');
    }
    gb.box(x0 + 2, 0, z0 - 0.06, x0 + 2.1, 0.02, z0 - 0.01, '#fff');
    gb.cyl(x1 - 2.5, H + 1.6, z0 + 6, 0.5, 3.8, 10, '#9aa0a6', M8.metal, '#555');
    gb.box(x0 + 3, H + 1.2, z1 - 4, x0 + 6, H + 2.0, z1 - 2, '#9aa0a6', M8.metal);
    // scale house and weighbridge
    gb.box(22, 0, 1.6, 27.5, 3.2, 5.2, '#d8d4ca', M8.siding);
    gb.box(21.8, 3.2, 1.4, 27.7, 3.45, 5.4, '#3a3d42');
    win(gb, 2, 3.4, 1.1, 22, 1.6, 1.2, { trim: '#3a3d42' }); win(gb, 0, 24.7, 1.1, 1.6, 2.2, 1.2, { trim: '#3a3d42' });
    doorway(gb, 26.4, 1.6, '#3a4a52', '#3a3d42', false);
    gb.box(15, 0.05, 1.4, 21, 0.2, 4.6, '#6a6e72', M8.seam);
    // roll-off containers with garbage
    const cc = ['#2f6a3a', '#2a4a7a', '#7a2a22', '#2f6a3a'];
    for (let k = 0; k < 3; k++) {
      const cz = 7.5 + k * 4.2;
      extrude(gb, [[21.5, 0.1], [28.5, 0.1], [28.8, 2.2], [21.2, 2.2]], cz, cz + 2.4, cc[k], M8.metal);
      lumps(gb, 21.6, cz + 0.2, 28.4, cz + 2.2, 1.8, 10, r);
      for (let q = 0; q < 6; q++) gb.box(21.8 + q * 1.25, 0.2, cz - 0.02, 21.9 + q * 1.25, 2.1, cz, '#1c1d20');
    }
    // fence with gate gap on the road side
    chainFence(gb, 0.4, 0.4, LW - 0.4, LD - 0.4, 3, 14.5);
    for (const x of [3, 14.5]) gb.box(x - 0.18, 0, 0.22, x + 0.18, 2.4, 0.58, '#3a3d42');
    lampPost(gb, 20.5, 6); lampPost(gb, 1.2, 4);
  };
  SGEN.hospital = (gb, b, r, LW, LD) => SGEN.clinic(gb, b, r, LW, LD, true);
  SGEN.plaza = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#c9c0ae');
    gb.cyl(10, 0, 10, 4, 0.7, 14, '#b7b0a2', 0, '#1d6f8a');
    gb.cyl(10, 0.7, 10, 3.6, 0.02, 14, '#1d6f8a', 13);
    gb.cyl(10, 0.7, 10, 0.6, 2.6, 8, '#d8d2c4');
    gb.cyl(10, 3.3, 10, 1.4, 0.3, 8, '#d8d2c4');
    for (const [x, z] of [[3, 3], [17, 3], [3, 17], [17, 17]]) { gb.box(x - 1.4, 0, z - 1.4, x + 1.4, 0.7, z + 1.4, '#8f877a', 0, { top: '#4f7d34' }); yardTree(gb, x, z, r); }
    for (const z of [7, 13]) { gb.box(1.5, 0, z, 3.5, 0.5, z + 0.5, '#7a5a3c'); gb.box(16.5, 0, z, 18.5, 0.5, z + 0.5, '#7a5a3c'); }
  };
  SGEN.bigpark = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#5c9840');
    gb.cyl(26, 0.0, 26, 8, 0.14, 12, '#1d6f8a', 13);
    gb.flat(19, 0.5, 21, 39.5, 0.11, '#cdbf9a');
    gb.flat(0.5, 13, 39.5, 15, 0.11, '#cdbf9a');
    gb.cyl(9, 0, 30, 3, 0.4, 8, '#d8d2c4');
    for (let k = 0; k < 4; k++) gb.box(6.5 + k * 1.6, 0.4, 28.9, 6.7 + k * 1.6, 3.2, 29.1, '#d8d2c4');
    gb.pyr(5.5, 26.5, 12.5, 33.5, 3.2, 2.2, '#6b3e2e');
    for (let k = 0; k < 18; k++) {
      const x = 2 + r() * 36, z = 2 + r() * 36;
      if (Math.hypot(x - 26, z - 26) < 9.5 || Math.abs(x - 20) < 2 || Math.abs(z - 14) < 2 || Math.hypot(x - 9, z - 30) < 4.5) continue;
      yardTree(gb, x, z, r);
    }
  };
  SGEN.stadium = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, PAL.paved);
    const cx = LW / 2, cz = LD / 2, seg = 20;
    gb.cyl(cx, 0, cz, 18.5, 13, seg, '#d6d3cc', 4, false);
    // stands (facing inward)
    for (let k = 0; k < seg; k++) {
      const a1 = k / seg * Math.PI * 2, a2 = (k + 1) / seg * Math.PI * 2;
      const p = (a, rr, y) => [cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr];
      gb.quad(p(a1, 11, 1), p(a2, 11, 1), p(a2, 18.3, 12.5), p(a1, 18.3, 12.5), k % 2 ? '#2f5f9e' : '#2a5590');
      gb.quad(p(a1, 18.3, 12.5), p(a2, 18.3, 12.5), p(a2, 18.5, 13), p(a1, 18.5, 13), '#b8b5ae');
    }
    gb.flat(cx - 9, cz - 6, cx + 9, cz + 6, 0.5, '#3f8f34');
    gb.flat(cx - 0.1, cz - 6, cx + 0.1, cz + 6, 0.52, '#eee');
    for (const [x, z] of [[3, 3], [LW - 3, 3], [3, LD - 3], [LW - 3, LD - 3]]) {
      gb.box(x - 0.3, 0, z - 0.3, x + 0.3, 24, z + 0.3, '#9a9a9a');
      gb.box(x - 1.5, 24, z - 1.5, x + 1.5, 25.5, z + 1.5, '#fff', 8);
    }
  };
  SGEN.tower = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#c9c0ae');
    const cx = LW / 2, cz = LD / 2;
    gb.cyl(cx, 0, cz, 5, 4, 12, '#bdb7aa', 3);
    gb.cyl(cx, 4, cz, 2.4, 92, 12, '#d8d4cb');
    gb.cyl(cx, 92, cz, 3.2, 3, 16, '#d8d4cb', 0, null, 7);
    gb.cyl(cx, 95, cz, 7, 6, 16, '#7d95a3', 2);
    gb.cyl(cx, 101, cz, 7, 1.2, 16, '#e0dcd2', 0, '#e0dcd2', 5);
    gb.cyl(cx, 102.2, cz, 0.5, 26, 6, '#cfcfcf', 0, null, 0.15);
    gb.box(cx - 0.4, 128, cz - 0.4, cx + 0.4, 129, cz + 0.4, '#f22', 7);
  };
  // ======================================================================
  // Commercial / industrial / civic kit
  // ======================================================================
  // glass band on a wall plane with mullions. face: 0 front (-z, plane = z) 1 back 2 left (-x, plane = x) 3 right
  function ribbon(gb: any, a0: number, a1: number, y0: number, y1: number, plane: number, face: number, mull: number, frameCol: any = '#2a2d31') {
    const out = face === 0 || face === 2 ? -1 : 1, fc = frameCol || '#2a2d31';
    const bx = (u0: number, v0: number, u1: number, v1: number, d0: number, d1: number, col: any, st: number = 0) => {
      if (face < 2) gb.box(u0, v0, Math.min(plane + out * d0, plane + out * d1), u1, v1, Math.max(plane + out * d0, plane + out * d1), col, st);
      else gb.box(Math.min(plane + out * d0, plane + out * d1), v0, u0, Math.max(plane + out * d0, plane + out * d1), v1, u1, col, st);
    };
    bx(a0, y0, a1, y1, -0.02, 0.03, '#fff', 9);
    const n = Math.max(1, Math.round((a1 - a0) / (mull || 1.5)));
    for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; bx(a - 0.05, y0, a + 0.05, y1, 0, 0.07, fc); }
    bx(a0 - 0.05, y0 - 0.08, a1 + 0.05, y0, 0, 0.09, fc); bx(a0 - 0.05, y1, a1 + 0.05, y1 + 0.08, 0, 0.09, fc);
  }
  // sectional roll-up door on the front wall (plane z), with jambs and a header
  function rollDoor(gb: any, x0: number, x1: number, h: number, z: number, col: any = '#c9ccd0', glass: boolean = false) {
    gb.box(x0 - 0.18, 0, z - 0.14, x0, h + 0.2, z + 0.02, '#3a3d42'); gb.box(x1, 0, z - 0.14, x1 + 0.18, h + 0.2, z + 0.02, '#3a3d42');
    gb.box(x0 - 0.18, h, z - 0.14, x1 + 0.18, h + 0.3, z + 0.02, '#3a3d42');
    gb.box(x0, 0.02, z - 0.07, x1, h, z, col || '#c9ccd0', M8.siding);
    if (glass) for (let k = 0; k < 4; k++) { const a = x0 + 0.25 + (x1 - x0 - 0.5) * k / 4; gb.box(a + 0.08, h * 0.62, z - 0.09, a + (x1 - x0 - 0.5) / 4 - 0.08, h * 0.8, z - 0.06, '#fff', 9); }
  }
  function dockBay(gb, x0, x1, z, H) {
    gb.box(x0 - 0.4, 0, z - 1.6, x1 + 0.4, 1.2, z, '#8f8d87', M8.concrete);
    for (const x of [x0 - 0.1, x1 - 0.2]) gb.box(x, 0.4, z - 1.75, x + 0.3, 1.1, z - 1.6, '#1c1d20');
    rollDoor(gb, x0, x1, (H || 3.6), z, '#b8bcc0');
    gb.box(x0 - 0.5, 1.2, z - 0.25, x1 + 0.5, (H || 3.6) + 1.2, z - 0.05, '#1c1d20', 0, { skip: 4 });
    gb.box((x0 + x1) / 2 - 0.25, (H || 3.6) + 1.45, z - 0.35, (x0 + x1) / 2 + 0.25, (H || 3.6) + 1.6, z - 0.05, '#fff', 8);
  }
  function container(gb: any, x: number, z: number, along: boolean, col: any, y: number = 0) {
    const L = 6.1, Wd = 2.44, H = 2.6, y0 = y || 0;
    const [x0, x1, z0, z1] = along ? [x - Wd / 2, x + Wd / 2, z - L / 2, z + L / 2] : [x - L / 2, x + L / 2, z - Wd / 2, z + Wd / 2];
    gb.box(x0, y0, z0, x1, y0 + H, z1, col, M8.metal);
    gb.box(x0 - 0.04, y0, z0 - 0.04, x1 + 0.04, y0 + 0.12, z1 + 0.04, '#3a3d42');
    // top rails: a frame around the roof edge, standing a little proud of the roof so nothing is coplanar
    const rw = 0.14, yt = y0 + H, rh = 0.06;
    gb.box(x0 - 0.04, yt - 0.12, z0 - 0.04, x1 + 0.04, yt + rh, z0 + rw, '#3a3d42');
    gb.box(x0 - 0.04, yt - 0.12, z1 - rw, x1 + 0.04, yt + rh, z1 + 0.04, '#3a3d42');
    gb.box(x0 - 0.04, yt - 0.12, z0 + rw, x0 + rw, yt + rh, z1 - rw, '#3a3d42');
    gb.box(x1 - rw, yt - 0.12, z0 + rw, x1 + 0.04, yt + rh, z1 - rw, '#3a3d42');
  }
  function pallets(gb, x, z, n, r) {
    for (let k = 0; k < n; k++) {
      const px = x + (k % 2) * 1.3, pz = z + Math.floor(k / 2) * 1.3;
      gb.box(px, 0, pz, px + 1.2, 0.15, pz + 1.0, '#a8875a', M8.wood);
      const h = 0.5 + r() * 0.8;
      gb.box(px + 0.05, 0.15, pz + 0.05, px + 1.15, 0.15 + h, pz + 0.95, U.pick(['#b89a6a', '#c8b48a', '#8a9aa8', '#d8d4cc'], r));
    }
  }
  function tank(gb, x, z, rad, h, col) {
    gb.cyl(x, 0, z, rad + 0.3, 0.4, 14, '#8f8d87', M8.concrete, '#8f8d87');
    gb.cyl(x, 0.4, z, rad, h, 16, col || '#e2e0da', M8.metal, false);
    gb.cyl(x, 0.4 + h, z, rad, rad * 0.35, 16, col || '#e2e0da', M8.metal, null, rad * 0.25);
    for (const y of [h * 0.33, h * 0.66]) gb.cyl(x, 0.4 + y, z, rad + 0.04, 0.12, 16, '#9aa0a6', 0, false);
    gb.box(x + rad, 0.4, z - 0.25, x + rad + 0.08, 0.4 + h + 0.3, z + 0.25, '#5a5e64');
    for (let y = 1; y < h; y += 0.8) gb.box(x + rad + 0.02, 0.4 + y, z - 0.25, x + rad + 0.12, 0.45 + y, z + 0.25, '#5a5e64');
  }
  function smokestack(gb, x, z, y0, h, rad) {
    gb.cyl(x, y0, z, rad, h, 12, '#9a6a54', M8.brick, null, rad * 0.8);
    gb.cyl(x, y0 + h - 1.4, z, rad * 0.86, 1.4, 12, '#2a2c30', 0, '#111');
    gb.cyl(x, y0 + h * 0.6, z, rad * 0.95, 0.5, 12, '#c8392e', 0, false);
  }
  function flagpole(gb: any, x: number, z: number, h: number, col: any = '#c8392e') {
    gb.cyl(x, 0, z, 0.07, h, 6, '#d8dadc'); gb.box(x - 0.1, h, z - 0.1, x + 0.1, h + 0.2, z + 0.1, '#d8c27a');
    gb.box(x + 0.07, h - 1.3, z - 0.02, x + 2.1, h - 0.1, z + 0.02, col || '#c8392e');
  }
  // lit sign with block lettering on the front wall plane z
  function signBoard(gb: any, x0: number, x1: number, y0: number, y1: number, z: number, col: any, letterCol: any, r?: any) {
    gb.box(x0, y0, z - 0.12, x1, y1, z, col, 5);
    const n = Math.max(3, Math.floor((x1 - x0 - 0.6) / 0.5)), lx = (x0 + x1) / 2 - n * 0.25, h = (y1 - y0) * 0.55;
    for (let k = 0; k < n; k++) { if (r && r() < 0.1) continue; gb.box(lx + k * 0.5 + 0.06, (y0 + y1) / 2 - h / 2, z - 0.17, lx + k * 0.5 + 0.4, (y0 + y1) / 2 + h / 2, z - 0.12, letterCol || '#ffffff', 15); }
  }
  function shrubs(gb, x0, x1, z, r) { for (let x = x0; x < x1; x += 1.1) bush(gb, x + r() * 0.3, z, 0.55 + r() * 0.25, U.pick(['#4a7a36', '#3f6b30', '#5a8a3c'], r)); }
  function bollards(gb, x0, x1, z) { for (let x = x0; x <= x1 + 0.01; x += 1.4) gb.cyl(x, 0, z, 0.12, 0.9, 6, '#3a3d42', 0, '#e3c23a'); }
  function bikeRack(gb, x, z) { for (let k = 0; k < 4; k++) { gb.box(x + k * 0.7, 0, z - 0.03, x + k * 0.7 + 0.05, 0.8, z + 0.03, '#9aa0a6'); gb.box(x + k * 0.7 + 0.45, 0, z - 0.03, x + k * 0.7 + 0.5, 0.8, z + 0.03, '#9aa0a6'); gb.box(x + k * 0.7, 0.75, z - 0.03, x + k * 0.7 + 0.5, 0.8, z + 0.03, '#9aa0a6'); } }
  function hydrant(gb, x, z) { gb.cyl(x, 0, z, 0.16, 0.7, 8, '#d8342a', 0, '#d8342a'); gb.cyl(x, 0.7, z, 0.12, 0.18, 8, '#d8342a', 0, '#e8e2d4'); gb.box(x - 0.25, 0.4, z - 0.07, x + 0.25, 0.52, z + 0.07, '#d8342a'); }
  function canopy(gb: any, x0: number, x1: number, z0: number, z1: number, y: number, col: any = '#e8e6e0') {
    gb.box(x0, y, z0, x1, y + 0.35, z1, col || '#e8e6e0', M8.concrete);
    for (const x of [x0 + 0.3, x1 - 0.3]) gb.cyl(x, 0, z0 + 0.3, 0.14, y, 8, '#cfd3d6');
  }
  // a door with a glass panel, for civic buildings
  function glassDoor(gb, x, z, w) { gb.box(x - w / 2 - 0.12, 0, z - 0.1, x + w / 2 + 0.12, 2.6, z + 0.02, '#2a2d31'); gb.box(x - w / 2, 0, z - 0.13, x + w / 2, 2.45, z - 0.08, '#fff', 9); gb.box(x - 0.03, 0, z - 0.16, x + 0.03, 2.45, z - 0.1, '#2a2d31'); }
  // white "lettering" sign (painted, not lit) on a wall
  function wallLetters(gb, x0, x1, y, z, h, col) {
    const n = Math.max(3, Math.floor((x1 - x0) / (h * 0.8)));
    for (let k = 0; k < n; k++) gb.box(x0 + (x1 - x0) * k / n + h * 0.1, y, z - 0.1, x0 + (x1 - x0) * (k + 1) / n - h * 0.1, y + h, z - 0.05, col, 5);
  }

  // ======================================================================
  // Small shops (single 10 x 10 lots)
  // ======================================================================
  function gasStation(gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#4a4c50', 0);
    const acc = U.pick(['#d8342a', '#1f6fd0', '#2f9a48', '#e8a21a', '#2a2d33'], r);
    gb.flat(0.6, 1.0, 7.6, 6.6, 0.1, '#9a978f', M8.concrete);
    // pump islands
    for (const z of [2.6, 4.7]) {
      gb.box(2.0, 0, z, 6.2, 0.25, z + 0.7, '#b8b4ab', M8.concrete);
      for (const x of [2.8, 5.0]) {
        gb.box(x - 0.35, 0.25, z + 0.12, x + 0.35, 1.9, z + 0.58, '#eceae4');
        gb.box(x - 0.36, 1.6, z + 0.1, x + 0.36, 1.95, z + 0.6, acc);
        gb.box(x - 0.2, 1.05, z + 0.08, x + 0.2, 1.4, z + 0.1, '#bfe6ff', 15); gb.box(x - 0.2, 1.05, z + 0.6, x + 0.2, 1.4, z + 0.62, '#bfe6ff', 15);
        gb.box(x + 0.36, 0.7, z + 0.2, x + 0.42, 1.3, z + 0.5, '#1c1d20');
      }
      gb.box(1.8, 0, z + 0.2, 2.0, 0.9, z + 0.5, '#e3c23a'); gb.box(6.2, 0, z + 0.2, 6.4, 0.9, z + 0.5, '#e3c23a');
    }
    // canopy with lit fascia and downlights
    const cy = 4.5;
    for (const [x, z] of [[2.0, 2.9], [6.2, 2.9], [2.0, 5.0], [6.2, 5.0]]) gb.box(x - 0.16, 0.25, z - 0.16, x + 0.16, cy, z + 0.16, '#eceae4');
    gb.box(0.8, cy, 1.4, 7.4, cy + 0.75, 6.6, '#f4f2ee');
    gb.box(0.75, cy + 0.12, 1.35, 7.45, cy + 0.6, 6.65, acc, 5, { skip: 16 });
    for (let k = 0; k < 6; k++) gb.box(1.6 + (k % 3) * 2.2, cy - 0.05, 2.2 + Math.floor(k / 3) * 2.8, 2.6 + (k % 3) * 2.2, cy, 2.6 + Math.floor(k / 3) * 2.8, '#fff', 8);
    // convenience store at the back
    const z0 = 7.2;
    gb.box(0.5, 0, z0, 7.2, 3.6, LD - 0.4, '#e2ded6', M8.stucco);
    ribbon(gb, 0.9, 5.2, 0.5, 2.7, z0, 0, 1.4);
    glassDoor(gb, 6.1, z0, 1.2);
    gb.box(0.4, 3.0, z0 - 0.2, 7.3, 3.9, z0, acc, 5);
    gb.box(0.4, 3.6, z0, 7.3, 3.9, LD - 0.3, '#5d5a55', M8.gravel);
    gb.box(5.6, 0, z0 - 0.9, 6.6 - 0.9, 1.1, z0 - 0.2, '#f4f6f8');
    acUnit(gb, 2.2, LD - 1.4); gb.box(7.3, 0, z0 + 0.5, 7.9, 1.6, z0 + 1.1, '#2a4a7a');
    // price pylon
    gb.box(8.7, 0, 0.8, 9.0, 4.4, 1.1, '#3a3d42');
    gb.box(8.0, 4.4, 0.75, 9.7, 7.0, 1.15, acc, 5);
    for (let k = 0; k < 3; k++) gb.box(8.15, 4.7 + k * 0.7, 0.7, 9.55, 5.2 + k * 0.7, 0.75, '#ffffff', 15);
    // cars: one at a pump, one parked
    if (r() < 0.8) parkedCar(gb, 4.0, 3.75, false, r);
    if (r() < 0.6) parkedCar(gb, 8.7, 6.4, true, r);
  }
  function fastFood(gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#4a4c50', 0);
    const acc = U.pick(['#d8342a', '#e8a21a', '#2f9a48', '#7a2a8a'], r);
    const x0 = 0.6, x1 = 6.8, z0 = 3.4, z1 = 8.8;
    gb.box(x0, 0, z0, x1, 0.6, z1, '#8a6a4a', M8.brick);
    gb.box(x0, 0.6, z0, x1, 3.8, z1, '#ece6da', M8.stucco);
    ribbon(gb, x0 + 0.4, x1 - 1.8, 0.8, 2.8, z0, 0, 1.2);
    glassDoor(gb, x1 - 1.0, z0, 1.1);
    ribbon(gb, z0 + 0.6, z1 - 0.8, 0.9, 2.6, x1, 3, 1.3);
    gb.box(x0 - 0.2, 3.8, z0 - 0.2, x1 + 0.2, 4.5, z1 + 0.2, acc, 5);
    gb.box(x0 + 0.5, 4.5, z0 + 0.5, x1 - 0.5, 4.6, z1 - 0.5, '#5d5a55', M8.gravel);
    gb.box(x0 + 1.5, 4.5, z0 + 2, x0 + 3, 5.3, z0 + 3.5, '#c9ccd0', M8.metal);
    // drive-through window and lane
    gb.box(x0 - 0.05, 1.0, z1 - 2.2, x0 + 0.02, 2.2, z1 - 1.0, '#fff', 9);
    gb.box(x0 - 0.7, 2.6, z1 - 2.6, x0, 2.8, z1 - 0.6, acc);
    for (let z = 1.0; z < LD - 0.5; z += 1.5) gb.flat(x0 - 0.45, z, x0 - 0.3, z + 0.8, 0.12, '#e6e6df');
    gb.box(x0 - 0.75, 0, z0 + 0.6, x0 - 0.55, 1.8, z0 + 1.6, '#2a2d31'); gb.box(x0 - 0.8, 0.8, z0 + 0.5, x0 - 0.75, 1.75, z0 + 1.7, '#ffe8a0', 15);
    // pole sign
    gb.cyl(8.9, 0, 1.4, 0.15, 6.5, 8, '#3a3d42');
    gb.box(8.0, 6.5, 1.15, 9.8, 8.0, 1.65, acc, 5);
    gb.box(8.2, 6.85, 1.1, 9.6, 7.65, 1.15, '#ffffff', 15);
    // tables out front
    for (const x of [1.5, 3.6]) { gb.cyl(x, 0, 1.9, 0.5, 0.75, 8, '#d8d4cc', 0, '#d8d4cc'); gb.cyl(x, 0.75, 1.9, 0.04, 1.3, 4, '#888'); gb.cone(x, 2.05, 1.9, 1.0, 0.35, 8, acc); }
    if (r() < 0.7) parkedCar(gb, 8.7, 6.6, true, r);
    gb.box(LW - 2.2, 0, LD - 1.2, LW - 0.8, 1.3, LD - 0.4, '#2f5a3a');
  }
  function kiosk(gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#b8b0a2', M8.paving);
    const acc = U.pick(AWN, r), kind = U.pick(['cafe', 'florist', 'books'], r);
    const x0 = 1.0, x1 = 9.0, z0 = 4.2, z1 = LD - 0.6;
    gb.box(x0, 0, z0, x1, 3.4, z1, kind === 'florist' ? '#3f5a48' : U.pick(['#2a3a4a', '#5a3a2a', '#3a3d42'], r), M8.wood);
    ribbon(gb, x0 + 0.3, x1 - 1.6, 0.4, 2.6, z0, 0, 1.0, '#d8c8a0');
    glassDoor(gb, x1 - 0.9, z0, 1.0);
    gb.box(x0 - 0.1, 2.75, z0 - 0.25, x1 + 0.1, 3.3, z0, '#1c1d20');
    signBoard(gb, x0 + 1.5, x1 - 1.5, 2.8, 3.25, z0 - 0.25, '#1c1d20', '#ffe8b0', r);
    gb.box(x0 - 0.2, 3.4, z0 - 0.2, x1 + 0.2, 3.6, z1 + 0.2, '#2a2d31');
    // striped awning
    for (let k = 0; k < 10; k++) {
      const a0 = x0 + (x1 - x0) * k / 10, a1 = x0 + (x1 - x0) * (k + 1) / 10, col = k % 2 ? '#f2efe6' : acc;
      gb.quad([a0, 2.7, z0], [a1, 2.7, z0], [a1, 2.2, z0 - 1.4], [a0, 2.2, z0 - 1.4], col); gb.quad([a1, 2.7, z0], [a0, 2.7, z0], [a0, 2.2, z0 - 1.4], [a1, 2.2, z0 - 1.4], col);
    }
    if (kind === 'florist') { for (let k = 0; k < 4; k++) flowerBed(gb, 1.2 + k * 1.6, 2.0, 2.4 + k * 1.6, 2.9, r); }
    else for (const x of [2.2, 4.6, 7.0]) { gb.cyl(x, 0, 1.8, 0.4, 0.74, 8, '#f2f2f2', 0, '#f2f2f2'); for (const s of [-0.7, 0.7]) gb.box(x + s - 0.2, 0, 1.6, x + s + 0.2, 0.45, 2.0, '#3a3d42'); gb.cyl(x, 0.74, 1.8, 0.03, 1.4, 4, '#888'); gb.cone(x, 2.1, 1.8, 1.1, 0.4, 8, acc); }
    planterBox(gb, 0.3, 0.4); planterBox(gb, LW - 1.3, 0.4);
  }
  function planterBox(gb, x, z) { gb.box(x, 0, z, x + 1, 0.6, z + 1, '#8f877a', M8.concrete, { top: '#4f3a28' }); bush(gb, x + 0.5, z + 0.5, 0.6); }
  function laundromat(gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#b8b4ab', M8.paving);
    const wall = U.pick(['#d8d0c0', '#c9d3d6', '#e2dccf', '#b9a58c'], r), z0 = 1.8, H = 4.2;
    gb.box(0.3, 0, z0, LW - 0.3, H, LD - 0.8, wall, M8.stucco);
    ribbon(gb, 0.8, LW - 2.4, 0.5, 2.9, z0, 0, 1.3);
    glassDoor(gb, LW - 1.5, z0, 1.1);
    gb.box(0.2, 3.1, z0 - 0.2, LW - 0.2, 3.9, z0, '#1f4a8a');
    signBoard(gb, 1.2, LW - 1.2, 3.2, 3.8, z0 - 0.2, '#1f4a8a', '#ffffff', r);
    for (let k = 0; k < 4; k++) gb.box(1.0 + k * 1.4, 0.5, z0 + 0.4, 2.0 + k * 1.4, 1.5, z0 + 1.2, '#eef0f2');
    gb.box(0.1, H, z0 - 0.1, LW - 0.1, H + 0.4, LD - 0.7, '#6d6a64', M8.concrete);
    acUnit(gb, 3, LD - 3); bikeRack(gb, 0.6, 0.9);
  }

  // ======================================================================
  // Industry
  // ======================================================================
  const IND_WALL = ['#9aa3a8', '#b4b8bc', '#8a9aa6', '#c8c2b4', '#7f8a8f', '#a8b0a0', '#c9ccd0'];
  function warehouse(gb: any, x0: number, z0: number, x1: number, z1: number, H: number, wall: any, roofc: any, r: any, docks: boolean | number = true) {
    gb.box(x0, 0, z0, x1, 1.2, z1, '#8a8780', M8.concrete);
    gb.box(x0, 1.2, z0, x1, H, z1, wall, M8.metal);
    gb.box(x0 - 0.2, H, z0 - 0.2, x1 + 0.2, H + 0.5, z1 + 0.2, '#5d6266');
    gb.box(x0 + 0.3, H + 0.5, z0 + 0.3, x1 - 0.3, H + 0.55, z1 - 0.3, roofc || '#7a7d80', M8.seam);
    // skylights and roof units
    for (let x = x0 + 3; x < x1 - 3; x += 6) gb.box(x, H + 0.55, z0 + 3, x + 1.6, H + 0.9, z1 - 3, '#cfe4f2', 9);
    for (let k = 0; k < Math.floor((x1 - x0) / 9); k++) acUnit(gb, x0 + 4 + k * 8, (z0 + z1) / 2);
    const n = typeof docks === 'number' ? docks : (docks ? Math.max(1, Math.floor((x1 - x0 - 4) / 4.4)) : 0);
    for (let k = 0; k < n; k++) dockBay(gb, x0 + 1.6 + k * 4.4, x0 + 4.4 + k * 4.4, z0, 3.4);
    // corner signs and wall lights
    for (let x = x0 + 2; x < x1 - 1; x += 7) gb.box(x, H - 1.2, z0 - 0.1, x + 0.4, H - 1.0, z0, '#fff', 8);
  }
  function officeFront(gb, x0, x1, z0, z1, floors, r) {
    const col = U.pick(['#d8d4ca', '#c9c5bb', '#e2ded6', '#b8b4aa'], r), H = floors * 3.3;
    gb.box(x0, 0, z0, x1, H, z1, col, M8.concrete);
    for (let f = 0; f < floors; f++) ribbon(gb, x0 + 0.5, x1 - 0.5, f * 3.3 + 0.9, f * 3.3 + 2.4, z0, 0, 1.4);
    glassDoor(gb, x0 + 1.5, z0, 1.2);
    canopy(gb, x0 + 0.4, x0 + 2.8, z0 - 1.6, z0, 2.9);
    gb.box(x0 - 0.15, H, z0 - 0.15, x1 + 0.15, H + 0.5, z1 + 0.15, '#5d6266');
    return H;
  }
  function semi(gb, x, z, r) { parkedVeh(gb, 'truck', x, z, -Math.PI / 2, U.pick(['#f2f2f2', '#2f5f9e', '#c8392e', '#2a2d33', '#e3a02b'], r)); }
  function workshop(gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, PAL.conc2);
    const wall = U.pick(IND_WALL, r), acc = U.pick(['#d8342a', '#1f6fd0', '#e8a21a', '#2f9a48'], r);
    const z0 = 3.4, z1 = LD - 0.5, H = 5.2;
    gb.box(0.5, 0, z0, LW - 0.5, H, z1, wall, M8.metal);
    gb.gable(0.2, z0 - 0.3, LW - 0.2, z1 + 0.3, H, 1.2, false, '#6a6e72', wall, M8.seam, M8.metal);
    rollDoor(gb, 1.2, 5.4, 3.8, z0, '#c9ccd0', true);
    doorway(gb, 7.6, z0, '#3a4a52', '#2a2d31', false);
    win(gb, 0, 7.6, 2.9, z0, 1.0, 0.8, { trim: '#2a2d31' });
    signBoard(gb, 1.2, 5.4, 4.2, 4.9, z0, acc, '#ffffff', r);
    gb.box(5.2, 4.6, z0 - 0.3, 5.6, 4.8, z0, '#fff', 8);
    if (r() < 0.6) parkedVeh(gb, 'van', 3.3, 1.4, false, U.pick(['#f2f2f2', '#c8c4b8', '#2f5f9e'], r));
    pallets(gb, 7.1, 0.6, 2, r);
    gb.box(LW - 1.5, 0, z0 + 1, LW - 0.6, 1.2, z0 + 2.4, '#2f5a3a');
  }
  function autoShop(gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#55575b', 0);
    const z0 = 4.0, z1 = LD - 0.5, H = 4.8;
    gb.box(0.4, 0, z0, LW - 0.4, H, z1, '#e2ded6', M8.concrete);
    for (const x0 of [0.9, 4.5]) { rollDoor(gb, x0, x0 + 3.2, 3.6, z0, '#dfe2e6', true); }
    gb.box(0.3, 3.95, z0 - 0.2, LW - 0.3, 4.6, z0, '#1f4a8a');
    wallLetters(gb, 1.2, LW - 1.2, 4.05, z0 - 0.2, 0.45, '#ffffff');
    gb.box(0.2, H, z0 - 0.1, LW - 0.2, H + 0.3, z1 + 0.1, '#6d6a64', M8.concrete);
    // tyres, a car on the lot, one in a bay
    for (let k = 0; k < 4; k++) gb.cyl(8.8, k * 0.28, 1.0, 0.4, 0.26, 10, '#1a1a1c', 17, '#1a1a1c');
    parkedCar(gb, 2.5, 2.0, false, r); parkedCar(gb, 6.1, z0 + 2.4, true, r);
  }
  function storageYard(gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#8a8780', M8.gravel);
    const cc = ['#2f6f9e', '#b5502f', '#3a7a4a', '#c8a03a', '#8a3a3a', '#5a6a7a'];
    container(gb, 3.5, 5.0, false, U.pick(cc, r)); container(gb, 3.5, 7.7, false, U.pick(cc, r));
    if (r() < 0.7) container(gb, 3.5, 5.0, false, U.pick(cc, r), 2.66);
    container(gb, 8.4, 6.6, true, U.pick(cc, r));
    // site cabin
    gb.box(0.7, 0.2, 1.0, 4.4, 2.8, 3.2, '#e8e2d4', M8.siding); win(gb, 0, 1.8, 1.2, 1.0, 1.0, 0.9, { trim: '#2a2d31' }); doorway(gb, 3.5, 1.0, '#3a4a52', '#2a2d31', false);
    gb.box(0.6, 2.8, 0.9, 4.5, 2.95, 3.3, '#5a5e64');
    chainFence(gb, 0.3, 0.3, LW - 0.3, LD - 0.3, 5.0, 9.4);
    lampPost(gb, 9.2, 4.5);
  }
  GEN.ind = function (gb, b, r, LW, LD) {
    const lvl = b.level;
    if (LW <= T + 0.1 && LD <= T + 0.1) { [workshop, autoShop, storageYard][Math.floor(r() * 3)](gb, b, r, LW, LD); return; }
    foundation(gb, LW, LD, b, PAL.conc2);
    const wall = U.pick(IND_WALL, r);
    if (LW <= T + 0.1 || LD <= T + 0.1) {
      // narrow lot: small warehouse with a dock
      const deep = LD > LW;
      const x1 = LW - 0.6, z0 = deep ? 6 : 3.5, z1 = LD - 0.6;
      warehouse(gb, 0.6, z0, x1, z1, 6.5, wall, null, r, 1);
      officeFront(gb, x1 - 4.2, x1, z0 - 0.01 - 3, z0 + 0.5, 1, r);
      if (deep) semi(gb, 3.0, 2.0, r); else pallets(gb, 1, 0.6, 2, r);
      return;
    }
    const kind = (b.seed + lvl) % 3;
    if (kind === 0) {
      // distribution warehouse with loading docks and trucks
      const z0 = Math.min(12, LD * 0.4), H = 8 + lvl * 0.5;
      warehouse(gb, 1, z0, LW - 1, LD - 1, H, wall, null, r);
      officeFront(gb, LW - 9, LW - 1, z0 - 4, z0 + 0.5, 2, r);
      gb.flat(0.5, 0.5, LW - 0.5, z0 - 1.7, 0.1, '#5a5c60');
      const n = Math.max(1, Math.floor((LW - 12) / 4.4));
      for (let k = 0; k < n; k++) if (r() < 0.7) semi(gb, 3.0 + k * 4.4, z0 - 5.4, r);
      for (let x = 2; x < LW - 10; x += 3) gb.flat(x, 0.8, x + 0.12, 2.6, 0.12, '#e6e6df');
    } else if (kind === 1) {
      // brick factory hall with sawtooth roof, chimney and an office block
      const z0 = 7, z1 = LD - 1.5, x0 = 1.5, x1 = LW - 1.5, H = 7 + lvl * 0.4;
      const br = U.pick(['#8a4b34', '#9c5a3c', '#7a4a3a', '#a86a50'], r);
      gb.box(x0, 0, z0, x1, H, z1, br, M8.brick);
      for (let f = 0; f < 1; f++) for (let x = x0 + 1.5; x < x1 - 2; x += 3.2) win(gb, 0, x + 0.8, 1.6, z0, 1.6, 3.4, { trim: '#3a3d42' });
      const n = Math.max(2, Math.floor((z1 - z0) / 4.5)), step = (z1 - z0) / n;
      for (let k = 0; k < n; k++) {
        const za = z0 + k * step, zb = za + step;
        gb.quad([x1, H, za], [x0, H, za], [x0, H + 2.4, zb], [x1, H + 2.4, zb], '#5d6266', M8.seam);
        gb.quad([x0, H, zb], [x1, H, zb], [x1, H + 2.4, zb], [x0, H + 2.4, zb], '#fff', 9);
        gb.tri([x0, H, za], [x0, H, zb], [x0, H + 2.4, zb], br, M8.brick);
        gb.tri([x1, H, zb], [x1, H, za], [x1, H + 2.4, zb], br, M8.brick);
      }
      rollDoor(gb, x1 - 6, x1 - 2, 4.4, z0, '#9aa0a6');
      officeFront(gb, x0, x0 + 8, 2.6, z0, 2, r);
      smokestack(gb, x1 - 2.5, z1 - 2.5, 0, 18 + lvl * 2, 1.0);
      if (LW > 22) { tank(gb, x0 + 12, 3.4, 1.8, 5, '#d9d6cf'); }
      pallets(gb, x1 - 5, 1, 4, r);
    } else {
      // processing plant: tanks, pipe rack, silos and a shed
      const z0 = 9, H = 7;
      warehouse(gb, 1, z0, Math.min(LW - 1, 1 + LW * 0.55), LD - 1, H, wall, null, r, 1);
      const tx = 1 + LW * 0.55 + 4;
      for (let k = 0; k < 3; k++) { const z = z0 + 3 + k * 5.2; if (z < LD - 3 && tx < LW - 2) tank(gb, tx, z, 2.1, 6 + lvl, U.pick(['#e2e0da', '#d4dce2', '#e8e2d0'], r)); }
      // pipe rack between shed and tanks
      const px = tx - 3.2;
      for (let z = z0 + 1; z < LD - 2; z += 3) { gb.box(px - 0.1, 0, z - 0.1, px + 0.1, 4.2, z + 0.1, '#5a5e64'); gb.box(px - 0.6, 4.0, z - 0.1, px + 0.6, 4.2, z + 0.1, '#5a5e64'); }
      for (const o of [-0.35, 0.05, 0.4]) gb.box(px + o - 0.12, 4.2, z0 + 1, px + o + 0.12, 4.45, LD - 2, U.pick(['#9aa0a6', '#c8a03a', '#4a7a9a'], r));
      officeFront(gb, 1.5, 9.5, 2.6, z0 - 0.5, 1, r);
      if (lvl >= 3) smokestack(gb, LW - 3, 3.5, 0, 16 + lvl * 2, 0.8);
      semi(gb, 13, 4.5, r);
    }
    lampPost(gb, LW - 1.2, 1.2);
  };

  // ======================================================================
  // Fire, police, health, education
  // ======================================================================
  function fireHouse(gb, b, r, LW, LD, bays) {
    foundation(gb, LW, LD, b, PAL.paved);
    const br = '#8e3b2c', trim = '#ece6da', bw = 3.8, gap = 0.9;
    const x0 = 1.2, bayW = bays * (bw + gap) + gap, z0 = 6.5, z1 = LD - (bays > 3 ? 9 : 2.5), H = 8.4;
    gb.flat(x0, 0.2, x0 + bayW, z0, 0.1, '#a8a59e', M8.concrete);
    // apparatus hall
    gb.box(x0, 0, z0, x0 + bayW, H, z1, br, M8.brick);
    for (let k = 0; k < bays; k++) {
      const a0 = x0 + gap + k * (bw + gap), a1 = a0 + bw;
      gb.box(a0 - 0.25, 0, z0 - 0.15, a1 + 0.25, 4.85, z0 + 0.02, trim);
      if (k === 0) { // open bay: dark interior with an engine nosing out
        gb.box(a0, 0.02, z0 - 0.02, a1, 4.6, z0 + 0.3, '#16181b');
        parkedVeh(gb, 'fire', (a0 + a1) / 2, z0 + 1.6, -Math.PI / 2);
      } else {
        gb.box(a0, 0.02, z0 - 0.17, a1, 4.6, z0 - 0.12, '#f2f0ea', M8.siding);
        for (let q = 0; q < 4; q++) gb.box(a0 + 0.2 + q * (bw - 0.4) / 4 + 0.06, 3.0, z0 - 0.2, a0 + 0.2 + (q + 1) * (bw - 0.4) / 4 - 0.06, 3.9, z0 - 0.16, '#fff', 9);
      }
      win(gb, 0, (a0 + a1) / 2, 5.6, z0, 1.4, 1.6, { trim });
    }
    gb.box(x0 - 0.2, H, z0 - 0.25, x0 + bayW + 0.2, H + 0.55, z1 + 0.2, trim, M8.concrete);
    gb.box(x0 + 1, H + 0.55, z0 + 1, x0 + bayW - 1, H + 0.6, z1 - 1, '#5d5a55', M8.gravel);
    signBoard(gb, x0 + bayW / 2 - 3, x0 + bayW / 2 + 3, 7.35, 8.15, z0 - 0.02, '#ece6da', '#c8231c');
    // office wing
    const ox0 = x0 + bayW, ox1 = LW - 1;
    if (ox1 - ox0 > 3) {
      gb.box(ox0, 0, z0 + 0.5, ox1, 7.2, z1 - 2, '#d8cfc0', M8.brick);
      for (let f = 0; f < 2; f++) for (let x = ox0 + 1.2; x < ox1 - 0.6; x += 2.2) win(gb, 0, x, 0.9 + f * 3.4, z0 + 0.5, 1.1, 1.6, { trim });
      glassDoor(gb, ox1 - 1.2, z0 + 0.5, 1.1); canopy(gb, ox1 - 2.4, ox1, z0 - 1.2, z0 + 0.5, 2.8);
      gb.box(ox0 - 0.1, 7.2, z0 + 0.3, ox1 + 0.15, 7.6, z1 - 1.8, trim, M8.concrete);
      flagpole(gb, ox1 - 0.6, 1.4, 8.5, '#2050a0');
    }
    // hose drying tower
    const tx0 = x0 + bayW - 4.2, tz0 = z1 - 0.2;
    gb.box(tx0, 0, tz0, tx0 + 3.6, 14 + bays, tz0 + 2.3, br, M8.brick);
    for (const y of [10.5 + bays, 12 + bays]) gb.box(tx0 + 0.7, y, tz0 - 0.05, tx0 + 2.9, y + 0.9, tz0, '#2a2d31');
    gb.box(tx0 - 0.15, 14 + bays, tz0 - 0.15, tx0 + 3.75, 14.4 + bays, tz0 + 2.45, trim);
    gb.pyr(tx0 - 0.15, tz0 - 0.15, tx0 + 3.75, tz0 + 2.45, 14.4 + bays, 1.6, '#3a3a3a', M8.shingle);
    hydrant(gb, LW - 0.8, 0.6); bollards(gb, x0, x0 + bayW, 0.4);
    if (bays > 3) { parkedVeh(gb, 'fire', x0 + gap + 1 * (bw + gap) + bw / 2, 3.2, -Math.PI / 2); parkedVeh(gb, 'ambulance', x0 + gap + 2 * (bw + gap) + bw / 2, 3.4, -Math.PI / 2); }
    for (let x = 1.5; x < LW - 4; x += 2.6) if (r() < 0.6) parkedCar(gb, x, LD - 1.2, true, r);
  }
  SGEN.fire = (gb, b, r, LW, LD) => fireHouse(gb, b, r, LW, LD, 3);
  SGEN.firehq = function (gb, b, r, LW, LD) {
    fireHouse(gb, b, r, LW, LD, 4);
    // training tower in the yard
    gb.box(LW - 6, 0, LD - 7, LW - 2, 16, LD - 3.5, '#b8b4aa', M8.concrete);
    for (let f = 1; f < 5; f++) gb.box(LW - 6.05, f * 3.2, LD - 6, LW - 5.95, f * 3.2 + 1.6, LD - 4.5, '#16181b');
  };
  function policeStation(gb, b, r, LW, LD, big) {
    foundation(gb, LW, LD, b, PAL.paved);
    const blue = '#1f4a9a', stone = '#d8d4ca', fl = big ? 5 : 2, H = fl * 3.6 + 0.6;
    const x0 = 1.2, x1 = big ? LW - 1.2 : LW - 4.5, z0 = big ? 7 : 4.5, z1 = big ? LD - 10 : LD - 7;
    // stone ground floor, upper floors with ribbon windows
    gb.box(x0, 0, z0, x1, 3.8, z1, '#bdb8ac', M8.concrete);
    gb.box(x0, 3.8, z0, x1, H, z1, stone, M8.concrete);
    ribbon(gb, x0 + 0.6, x1 - 5, 0.9, 2.9, z0, 0, 1.5);
    for (let f = 1; f < fl; f++) ribbon(gb, x0 + 0.5, x1 - 0.5, f * 3.6 + 0.9, f * 3.6 + 2.7, z0, 0, 1.6);
    for (let f = 1; f < fl; f++) ribbon(gb, z0 + 0.5, z1 - 0.5, f * 3.6 + 0.9, f * 3.6 + 2.7, x1, 3, 1.6);
    gb.box(x0 - 0.1, 3.5, z0 - 0.15, x1 + 0.1, 3.95, z1 + 0.1, blue);
    gb.box(x0 - 0.2, H, z0 - 0.2, x1 + 0.2, H + 0.5, z1 + 0.2, '#3c4148');
    gb.box(x0 + 0.5, H + 0.5, z0 + 0.5, x1 - 0.5, H + 0.55, z1 - 0.5, '#5d5a55', M8.gravel);
    // glass entrance with canopy and lit sign
    const ex = x1 - 2.6;
    gb.box(ex - 2.2, 0, z0 - 0.6, ex + 2.2, 3.4, z0, '#fff', 9);
    for (let k = 0; k <= 4; k++) gb.box(ex - 2.2 + k * 1.1 - 0.04, 0, z0 - 0.66, ex - 2.2 + k * 1.1 + 0.04, 3.4, z0 - 0.58, '#2a2d31');
    gb.box(ex - 2.8, 3.4, z0 - 2.4, ex + 2.8, 3.75, z0, '#e8e6e0', M8.concrete);
    for (const x of [ex - 2.5, ex + 2.5]) gb.cyl(x, 0, z0 - 2.1, 0.13, 3.4, 8, '#cfd3d6');
    signBoard(gb, ex - 2.4, ex + 2.4, 3.75, 4.45, z0 - 2.3, blue, '#ffffff');
    gb.box(ex - 0.5, 2.4, z0 - 2.45, ex + 0.5, 2.6, z0 - 2.38, '#5aa0ff', 5);
    // flags, planters, bollards
    flagpole(gb, x0 + 0.8, 1.6, 9, '#2050a0'); flagpole(gb, x0 + 2.6, 1.6, 9, '#c8392e');
    shrubs(gb, x0 + 4, ex - 3.2, z0 - 0.9, r);
    bollards(gb, ex - 2.5, ex + 2.5, 0.6);
    // radio mast
    gb.cyl(x0 + 2, H + 0.5, z1 - 2, 0.15, big ? 12 : 8, 4, '#cfd3d6', 0, null, 0.06);
    gb.box(x0 + 1.7, H + (big ? 9 : 6), z1 - 2.3, x0 + 2.3, H + (big ? 9.6 : 6.6), z1 - 1.7, '#e8e8e8');
    if (big) { gb.cyl(x1 - 6, H + 0.55, (z0 + z1) / 2, 4, 0.12, 16, '#3a3d42', 0, '#3a3d42'); gb.box(x1 - 7.2, H + 0.68, (z0 + z1) / 2 - 0.2, x1 - 4.8, H + 0.72, (z0 + z1) / 2 + 0.2, '#f2f2f2'); gb.box(x1 - 7.2, H + 0.68, (z0 + z1) / 2 - 1.4, x1 - 6.8, H + 0.72, (z0 + z1) / 2 + 1.4, '#f2f2f2'); gb.box(x1 - 5.2, H + 0.68, (z0 + z1) / 2 - 1.4, x1 - 4.8, H + 0.72, (z0 + z1) / 2 + 1.4, '#f2f2f2'); }
    // secure car park behind, with patrol cars
    const pz0 = z1 + 1, pz1 = LD - 0.6;
    gb.flat(0.6, pz0, LW - 0.6, pz1, 0.1, '#4a4c50');
    const nCars = big ? 7 : 3;
    for (let k = 0; k < nCars; k++) { const x = 2 + k * 3.1; if (x < LW - 2) { gb.flat(x - 1.45, pz0 + 0.3, x - 1.35, pz1 - 0.3, 0.11, '#e6e6df'); parkedVeh(gb, 'police', x, (pz0 + pz1) / 2, true, null, k % 2 === 0); } }
    chainFence(gb, 0.4, pz0 - 0.4, LW - 0.4, LD - 0.3, LW - 5, LW - 1);
    if (!big) { // side lot for visitors
      gb.flat(x1 + 0.6, 0.5, LW - 0.4, z1, 0.1, '#4a4c50');
      parkedCar(gb, x1 + 2.2, 4, true, r); parkedVeh(gb, 'police', x1 + 2.2, 9.5, true);
    }
  }
  SGEN.police = (gb, b, r, LW, LD) => policeStation(gb, b, r, LW, LD, false);
  SGEN.policehq = (gb, b, r, LW, LD) => policeStation(gb, b, r, LW, LD, true);
  SGEN.hospitalBig = function (gb, b, r, LW, LD) {
    const x0 = 2, x1 = LW - 2, z0 = 7, white = '#f0eee8';
    // podium with emergency entrance
    gb.box(x0, 0, z0, x1, 5, LD - 7, '#d8d6d0', M8.concrete);
    ribbon(gb, x0 + 0.6, x1 - 8, 1.0, 3.8, z0, 0, 1.6);
    gb.box(x1 - 7, 0, z0 - 4, x1, 3.6, z0 - 3.6, '#e8e6e0', M8.concrete); // ER canopy
    gb.box(x1 - 7.2, 3.6, z0 - 4.2, x1 + 0.2, 4.0, z0, '#d92a2a');
    for (const x of [x1 - 6.6, x1 - 0.6]) gb.cyl(x, 0, z0 - 3.6, 0.16, 3.6, 8, '#cfd3d6');
    signBoard(gb, x1 - 6.4, x1 - 0.8, 4.05, 4.7, z0 - 4.2, '#d92a2a', '#ffffff');
    parkedVeh(gb, 'ambulance', x1 - 4.8, z0 - 1.8, false); parkedVeh(gb, 'ambulance', x1 - 2.0, z0 - 1.8, false, null, true);
    // ward tower: curtain wall
    const tz0 = z0 + 1.5, tz1 = z0 + 12, tx0 = x0 + 2, tx1 = x1 - 9;
    gb.box(tx0, 5, tz0, tx1, 22, tz1, white, M8.concrete);
    for (let f = 0; f < 5; f++) { ribbon(gb, tx0 + 0.4, tx1 - 0.4, 5.9 + f * 3.3, 7.9 + f * 3.3, tz0, 0, 1.6); ribbon(gb, tz0 + 0.4, tz1 - 0.4, 5.9 + f * 3.3, 7.9 + f * 3.3, tx1, 3, 1.6); ribbon(gb, tz0 + 0.4, tz1 - 0.4, 5.9 + f * 3.3, 7.9 + f * 3.3, tx0, 2, 1.6); }
    gb.box(tx0 - 0.2, 22, tz0 - 0.2, tx1 + 0.2, 22.6, tz1 + 0.2, '#6c7a86');
    gb.box(LW / 2 - 1.2, 16, tz0 - 0.15, LW / 2 + 1.2, 20, tz0 - 0.05, '#e0282c', 15); gb.box(LW / 2 - 2, 17.2, tz0 - 0.15, LW / 2 + 2, 18.8, tz0 - 0.05, '#e0282c', 15);
    // helipad
    const hx = (tx0 + tx1) / 2, hz = (tz0 + tz1) / 2;
    gb.cyl(hx, 22.6, hz, 4.2, 0.3, 20, '#505860', 0, '#3e454c');
    gb.box(hx - 1.6, 22.92, hz - 0.2, hx + 1.6, 22.96, hz + 0.2, '#f2f2f2'); gb.box(hx - 1.6, 22.92, hz - 1.6, hx - 1.2, 22.96, hz + 1.6, '#f2f2f2'); gb.box(hx + 1.2, 22.92, hz - 1.6, hx + 1.6, 22.96, hz + 1.6, '#f2f2f2');
    // clinic wing
    gb.box(x1 - 8, 5, tz0, x1, 12, LD - 8, '#e1dfd8', M8.concrete);
    for (let f = 0; f < 2; f++) ribbon(gb, tz0 + 0.5, LD - 8.5, 5.9 + f * 3.3, 7.9 + f * 3.3, x1, 3, 1.6);
    acUnit(gb, x1 - 4, LD - 10); gb.box(x1 - 6, 12, tz0 + 2, x1 - 2, 13.5, tz0 + 6, '#c9ccd0', M8.metal);
    // car park and landscaping
    parkingLot(gb, 1, LD - 5.6, LW - 1, LD - 0.6, 10, r, 0.75);
    gb.flat(0.6, 0.6, x1 - 8, z0 - 0.6, 0.11, '#6b9444', M8.lawn);
    for (let x = 3; x < x1 - 9; x += 4.5) yardTree(gb, x, 3.2, r);
    flagpole(gb, 1.5, 1.2, 9);
  };
  // school bus parked on a lot
  function schoolBus(gb, x, z, rot) { parkedVeh(gb, 'bus', x, z, rot, '#f2b41b'); }
  function playEquip(gb, x, z, r) { swing(gb, x, z); slide(gb, x + 4.4, z - 0.6, U.pick(['#2f86c9', '#d9473c', '#3aa36a'], r)); }
  SGEN.elem = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#6b9444');
    const br = U.pick(['#a8604a', '#9c5a3c', '#b8826a', '#8a4b34'], r), trim = '#ece6da';
    // L-shaped single storey classroom block with big windows
    gb.box(1.2, 0, 3.2, 14, 4.6, 9.2, br, M8.brick);
    gb.box(1.2, 0, 9.2, 6.6, 4.6, 15.5, br, M8.brick);
    for (let x = 2.4; x < 13.5; x += 2.4) if (Math.abs(x - 9.6) > 1.2) win(gb, 0, x, 1.0, 3.2, 1.8, 2.2, { trim });
    for (let z = 10.5; z < 15; z += 2.4) win(gb, 3, z, 1.0, 6.6, 1.8, 2.2, { trim });
    for (const [x0, z0, x1, z1] of [[1.2, 3.2, 14, 9.2], [1.2, 9.2, 6.6, 15.5]]) roofOn(gb, 'flat', x0, z0, x1, z1, 4.6, '#5a5550', br, r);
    // entrance with canopy and sign
    glassDoor(gb, 9.6, 3.2, 1.6);
    canopy(gb, 8.0, 11.2, 1.0, 3.2, 3.0, '#e3a02b');
    signBoard(gb, 7.6, 11.6, 3.6, 4.3, 3.15, '#2a5aa0', '#ffffff');
    flagpole(gb, 12.6, 1.2, 8);
    // gym with a metal roof
    gb.box(14, 0, 3.8, LW - 1, 6.2, 9.2, '#c8c2b4', M8.concrete);
    gb.gable(13.8, 3.6, LW - 0.8, 9.4, 6.2, 1.2, true, '#6a7a8a', '#c8c2b4', M8.seam, M8.concrete);
    // playground, small field, bus
    gb.flat(7.4, 10.0, LW - 0.8, 15.6, 0.11, '#c9a87a');
    playEquip(gb, 9.4, 12.6, r);
    gb.cyl(16.6, 0.1, 13.4, 1.2, 0.4, 10, '#e3a02b', 0, '#d8c4a0');
    field(gb, 7.4, 16.2, LW - 0.8, LD - 0.6);
    for (const x of [7.9, LW - 1.3]) { gb.box(x - 0.05, 0, (16.2 + LD) / 2 - 1.2, x + 0.05, 1.8, (16.2 + LD) / 2 + 1.2, '#f2f2f2'); }
    schoolBus(gb, 3.8, 18.0, false);
    chainFence(gb, 0.4, 9.6, LW - 0.4, LD - 0.3, 0.4, 7.0);
    for (const [x, z] of [[0.9, 1.0], [5.5, 1.2], [15, 1.4]]) yardTree(gb, x, z, r);
  };
  SGEN.high = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#6b9444');
    const br = U.pick(PAL.brick, r), trim = '#ece6da';
    // three storey main building with a columned entrance
    gb.box(1.5, 0, 3.5, 21, 10.5, 11.5, br, M8.brick);
    for (let f = 0; f < 3; f++) for (let x = 2.8; x < 20; x += 2.2) if (f > 0 || Math.abs(x - 11.2) > 2) win(gb, 0, x, 0.9 + f * 3.4, 3.5, 1.4, 2.0, { trim });
    for (let f = 0; f < 3; f++) for (let z = 5; z < 11; z += 2.2) win(gb, 2, z, 0.9 + f * 3.4, 1.5, 1.4, 2.0, { trim });
    roofOn(gb, 'flat', 1.5, 3.5, 21, 11.5, 10.5, '#56514c', br, r);
    gb.box(8.4, 0, 1.4, 14, 0.4, 3.5, '#bdb8ac', M8.concrete);
    for (let k = 0; k < 4; k++) gb.cyl(8.9 + k * 1.6, 0.4, 1.8, 0.28, 6.6, 10, trim, M8.concrete);
    gb.box(8.2, 7.0, 1.2, 14.2, 7.7, 3.5, trim, M8.concrete); gb.pyr(8.2, 1.2, 14.2, 3.5, 7.7, 1.4, trim);
    glassDoor(gb, 11.2, 3.5, 2.2);
    signBoard(gb, 9.2, 13.2, 6.0, 6.7, 3.45, '#2a5aa0', '#ffffff');
    // gym / auditorium with barrel-ish roof
    gb.box(21.5, 0, 3.5, LW - 1, 8, 13, '#c9c5bb', M8.concrete);
    gb.gable(21.3, 3.3, LW - 0.8, 13.2, 8, 1.6, true, '#7a8a96', '#c9c5bb', M8.seam, M8.concrete);
    wallLetters(gb, 22.5, LW - 2, 5.6, 3.5, 0.9, '#2a5aa0');
    // track and field with bleachers
    const fx0 = 1.5, fz0 = 14, fx1 = 21, fz1 = LD - 1;
    gb.flat(fx0, fz0, fx1, fz1, 0.11, '#b5503a');
    field(gb, fx0 + 1.6, fz0 + 1.6, fx1 - 1.6, fz1 - 1.6);
    for (let k = 0; k < 4; k++) gb.box(fx1 + 0.5 + k * 0.7, 0, fz0 + 2, fx1 + 1.2 + k * 0.7, 0.5 + k * 0.5, fz1 - 2, k % 2 ? '#9aa0a6' : '#b8bcc0');
    // parking with buses
    gb.flat(fx1 + 4.2, fz0, LW - 0.6, LD - 0.6, 0.1, '#4a4c50');
    schoolBus(gb, fx1 + 5.8, fz0 + 6, true); schoolBus(gb, fx1 + 8.6, fz0 + 6, true);
    flagpole(gb, 3, 1.4, 9);
    for (const x of [4, 17, 25]) yardTree(gb, x, 1.4, r);
  };
  SGEN.univ = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#6b9444');
    const st = '#cdb894', rf = '#4e5a63', trim = '#f2ece0';
    // main hall with portico and dome
    gb.box(9, 0, 3, 31, 12, 12, st, M8.concrete);
    for (let f = 0; f < 3; f++) for (let x = 10.2; x < 30.5; x += 2.0) if (Math.abs(x - 20) > 3 || f > 0) win(gb, 0, x, 1.0 + f * 3.7, 3, 1.2, 2.2, { trim: '#e8e0cc' });
    gb.gable(8.6, 2.6, 31.4, 12.4, 12, 3.4, true, rf, st, M8.tile);
    gb.box(15.5, 0, 0.8, 24.5, 0.6, 3, '#bdb8ac', M8.concrete);
    for (let k = 0; k < 6; k++) gb.cyl(16.2 + k * 1.52, 0.6, 1.4, 0.32, 7.8, 12, trim, M8.concrete);
    gb.box(15.3, 8.4, 0.9, 24.7, 9.2, 3, trim, M8.concrete);
    gb.tri([15.3, 9.2, 0.9], [24.7, 9.2, 0.9], [20, 11.4, 0.9], trim); gb.tri([24.7, 9.2, 0.9], [15.3, 9.2, 0.9], [20, 11.4, 0.9], trim);
    gb.cyl(20, 12, 7.5, 3.6, 3, 16, st, M8.concrete);
    gb.addThree(new THREE.SphereGeometry(3.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.Matrix4().setPosition(20, 15, 7.5), '#6f9a8a');
    gb.cyl(20, 18.3, 7.5, 0.5, 1.6, 8, trim);
    glassDoor(gb, 20, 3, 2.4);
    // side wings and library
    for (const [x0, x1] of [[2, 10], [30, 38]]) {
      gb.box(x0, 0, 15, x1, 9, 34, '#bba27c', M8.brick);
      for (let f = 0; f < 2; f++) for (let z = 16.5; z < 33; z += 2.2) win(gb, x0 < 20 ? 3 : 2, z, 1.0 + f * 3.8, x0 < 20 ? x1 : x0, 1.2, 2.2, { trim: '#e8e0cc' });
      gb.gable(x0 - 0.4, 14.6, x1 + 0.4, 34.4, 9, 2.6, false, rf, '#bba27c', M8.tile);
    }
    gb.box(13, 0, 31, 27, 8, 37, st, M8.concrete);
    for (let x = 14; x < 26.5; x += 1.8) win(gb, 1, x, 1.2, 37, 1.0, 5.0, { trim: '#e8e0cc' });
    gb.gable(12.6, 30.6, 27.4, 37.4, 8, 2.4, true, rf, st, M8.tile);
    // quad paths, lawns, trees, statue and benches
    gb.flat(19, 12, 21, 31, 0.12, '#cfc6b0', M8.paving);
    gb.flat(10, 20.5, 30, 22.5, 0.12, '#cfc6b0', M8.paving);
    statue(gb, 20, 21.5, 0.9, '#6f8a7a');
    for (let k = 0; k < 8; k++) yardTree(gb, 12.5 + (k % 4) * 5, 15.5 + Math.floor(k / 4) * 11, r);
    for (const [x, z] of [[17, 18], [23, 18], [17, 25], [23, 25]]) bench(gb, x, z, true);
  };
  SGEN.recycle = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#8f8d87', M8.concrete);
    gb.flat(0.6, 0.6, LW - 0.6, LD - 0.6, 0.11, '#7d7b75', M8.concrete);
    // sorting hall
    const x0 = 1.5, x1 = 19.5, z0 = 7, z1 = LD - 1.5, H = 10;
    gb.box(x0, 0, z0, x1, 1.2, z1, '#8a8780', M8.concrete);
    gb.box(x0, 1.2, z0, x1, H, z1, '#3f7a6a', M8.metal);
    gb.gable(x0 - 0.4, z0 - 0.4, x1 + 0.4, z1 + 0.4, H, 2.0, true, '#56605c', '#3f7a6a', M8.seam, M8.metal);
    for (let k = 0; k < 3; k++) rollDoor(gb, x0 + 1.2 + k * 5.8, x0 + 5.6 + k * 5.8, 5.6, z0, '#b8bcc0');
    signBoard(gb, x0 + 4, x1 - 4, 6.6, 7.8, z0, '#3aa36a', '#ffffff');
    // conveyor into the hall
    gb.quad([x1 - 1, 1, z0 - 4], [x1 + 1, 1, z0 - 4], [x1 + 1, 7, z0 + 1], [x1 - 1, 7, z0 + 1], '#2a2d31');
    gb.quad([x1 + 1, 1, z0 - 4], [x1 - 1, 1, z0 - 4], [x1 - 1, 7, z0 + 1], [x1 + 1, 7, z0 + 1], '#2a2d31');
    for (let t = 0; t < 1; t += 0.25) { const z = z0 - 4 + 5 * t, y = 1 + 6 * t; gb.box(x1 - 0.05, 0, z - 0.1, x1 + 0.05, y, z + 0.1, '#5a5e64'); }
    // bales of sorted material
    const cols = ['#2f86c9', '#e3a02b', '#3aa36a', '#c8c4b8', '#b5502f', '#8a9aa8'];
    for (let k = 0; k < 12; k++) { const bx = 21.5 + (k % 3) * 1.6, bz = 8 + Math.floor(k / 3) * 1.6, by = (k % 2) * 1.2; gb.box(bx, by, bz, bx + 1.4, by + 1.2, bz + 1.4, U.pick(cols, r)); }
    // collection bins and trucks
    for (let k = 0; k < 4; k++) gb.box(2.5 + k * 3.2, 0, 1.5, 5 + k * 3.2, 1.8, 4, U.pick(['#2f86c9', '#3aa36a', '#e3a02b', '#9aa3a8'], r), M8.metal);
    parkedVeh(gb, 'garbage', 23.5, 3.2, false, null, true);
    chainFence(gb, 0.4, 0.4, LW - 0.4, LD - 0.4, 15, 21);
    lampPost(gb, 20.5, 5.5);
  };
  // ---- parks ----
  const grass = (gb: any, b: any, LW: number, LD: number, c?: any) => foundation(gb, LW, LD, b, c || '#5f9a40');
  SGEN.playground = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD); gb.flat(1, 1, 9, 9, 0.11, '#c9a87a');
    swing(gb, 3.4, 2.6); slide(gb, 6.8, 4.5, U.pick(['#2f86c9', '#d9473c', '#3aa36a'], r));
    gb.cyl(3, 0.1, 7, 1.0, 0.4, 10, '#e3a02b', 0, '#d8c4a0'); bench(gb, 8.4, 8.6, false); yardTree(gb, 1.2, 8.8, r);
  };
  SGEN.grove = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD, '#557f38');
    windingPath(gb, [[0, 3], [3, 4.5], [6, 4], [10, 6.5]], 1.1, '#a8916a');
    grove(gb, 0.5, 0.5, 9.5, 2.8, 3, r); grove(gb, 0.5, 6, 9.5, 9.5, 3, r); bench(gb, 5, 5.4, false);
  };
  SGEN.miniplaza = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#c9c0ae');
    gb.flat(0.6, 0.6, 9.4, 9.4, 0.11, '#b8ad98');
    statue(gb, 5, 5, 1.1, U.pick(['#6f8a7a', '#8a7a5a', '#5a6a8a'], r));
    for (const [x, z] of [[1.5, 1.5], [8.5, 1.5], [1.5, 8.5], [8.5, 8.5]]) { gb.box(x - 0.8, 0, z - 0.8, x + 0.8, 0.6, z + 0.8, '#8f877a', 0, { top: '#4f7d34' }); bush(gb, x, z, 0.7); }
    bench(gb, 5, 1.6, false); bench(gb, 5, 8.4, false); lampPost(gb, 2.5, 5); lampPost(gb, 7.5, 5);
  };
  SGEN.garden = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD);
    for (let k = 0; k < 5; k++) for (let j = 0; j < 2; j++) gb.box(1 + j * 4.4, 0, 1.5 + k * 3.4, 4.4 + j * 4.4, 0.35, 3.6 + k * 3.4, '#6a4a32', 0, { top: U.pick(['#4a7a36', '#5c8a3a', '#7a9a3a', '#3f6b30'], r) });
    gb.box(1, 0, LD - 3, 3.5, 2.2, LD - 1, '#8a6a4a', 0, { top: '#6b3e2e' });
    fence(gb, 0.2, 0.2, LW - 0.2, 0.35, '#b49a78');
    gb.cyl(7, 0.05, LD - 2, 0.6, 0.9, 8, '#2f6f9a');
  };
  SGEN.court = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD); court(gb, 1, 2, 9, 18, '#c0603a');
    hoop(gb, 5, 1.6, 1); hoop(gb, 5, 18.4, -1);
    fence(gb, 0.6, 1.6, 0.7, 18.4, '#7a8a90'); fence(gb, 9.3, 1.6, 9.4, 18.4, '#7a8a90'); bench(gb, 0.4, 10, true);
  };
  SGEN.dogpark = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD, '#6a9a44');
    fence(gb, 0.4, 0.4, LW - 0.4, 0.5, '#7a8a90'); fence(gb, 0.4, LD - 0.5, LW - 0.4, LD - 0.4, '#7a8a90'); fence(gb, 0.4, 0.4, 0.5, LD - 0.4, '#7a8a90'); fence(gb, LW - 0.5, 0.4, LW - 0.4, LD - 0.4, '#7a8a90');
    for (let k = 0; k < 4; k++) gb.box(4 + k * 3, 0, 4.6, 4.3 + k * 3, 0.6 + (k % 2) * 0.4, 5.4, '#e3a02b');
    gb.cyl(14, 0, 3, 0.9, 0.5, 10, '#3a7a9a'); yardTree(gb, 2, 2, r); yardTree(gb, LW - 2, LD - 2.5, r); bench(gb, 16, 7.8, false);
  };
  SGEN.benches = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD); pathStrip(gb, 0, 4.2, LW, 5.8, '#cdbf9a');
    for (let k = 0; k < 4; k++) { yardTree(gb, 2.5 + k * 5, 2, r); bench(gb, 2.5 + k * 5, 3.6, false); }
    for (let k = 0; k < 3; k++) { bush(gb, 5 + k * 5, 7.6, 0.9); } lampPost(gb, 5, 6.4); lampPost(gb, 15, 6.4);
  };
  SGEN.park = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD);
    windingPath(gb, [[0.5, 9.5], [4, 6], [6, 4.5], [9.5, 0.5]], 1.3);
    yardTree(gb, 2.5, 3, r); yardTree(gb, 7.2, 7.4, r); if (r() < 0.6) yardTree(gb, 2.6, 7.6, r);
    bench(gb, 6.6, 2.4, false); flowerBed(gb, 6.5, 5.6, 8.5, 6.6, r);
  };
  SGEN.trail = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD, '#4f7a34');
    windingPath(gb, [[0, 4], [5, 6], [9, 12], [14, 13], [17, 8], [20, 10]], 1.3, '#a8916a');
    windingPath(gb, [[9, 12], [8, 17], [11, 20]], 1.1, '#a8916a');
    grove(gb, 1, 9, 7, 19, 6, r, true); grove(gb, 12, 1, 19, 7, 6, r); grove(gb, 14, 15, 19, 19, 3, r);
    bench(gb, 14, 11.6, false); gb.box(3, 0, 1.5, 4.5, 0.4, 2, '#6a5a4a');
  };
  SGEN.bigplay = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD); gb.flat(1, 1, 19, 19, 0.11, '#c9a87a');
    // play tower
    gb.box(8, 0, 8, 12, 3, 12, '#d9473c'); gb.box(7.6, 3, 7.6, 12.4, 3.3, 12.4, '#2f86c9'); gb.pyr(7.6, 7.6, 12.4, 12.4, 3.3, 2.4, '#e3a02b');
    slide(gb, 10, 12.2, '#3aa36a'); swing(gb, 4, 3); swing(gb, 16, 3);
    gb.cyl(4, 0.1, 15, 1.6, 0.5, 12, '#2f86c9', 0, '#d8c4a0'); gb.cyl(16, 0.1, 15, 1.2, 0.9, 6, '#8c4fc0');
    for (let k = 0; k < 5; k++) gb.box(13 + k * 1.1, 0, 7.5, 13.5 + k * 1.1, 0.4 + k * 0.4, 8.5, '#e3a02b');
    bench(gb, 2, 9, true); bench(gb, 18, 9, true); yardTree(gb, 1.5, 18.5, r); yardTree(gb, 18.5, 18.5, r);
  };
  SGEN.skate = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#b8b4ab');
    gb.flat(1, 1, 19, 19, 0.11, '#a9a69f');
    // half pipe
    for (let k = 0; k < 6; k++) { const a0 = k / 6 * Math.PI / 2, a1 = (k + 1) / 6 * Math.PI / 2; for (const sgn of [1, -1]) { const z0 = 10 + sgn * (6 - Math.cos(a0) * 4), z1 = 10 + sgn * (6 - Math.cos(a1) * 4); gb.quad([4, 0.1 + Math.sin(a0) * 2.6 * 0 + (1 - Math.cos(a0)) * 2.6, z0], [16, (1 - Math.cos(a0)) * 2.6 + 0.1, z0], [16, (1 - Math.cos(a1)) * 2.6 + 0.1, z1], [4, (1 - Math.cos(a1)) * 2.6 + 0.1, z1], '#c9c5bb'); } }
    gb.box(4, 0, 2, 16, 2.7, 4, '#9a968e'); gb.box(4, 0, 16, 16, 2.7, 18, '#9a968e');
    gb.box(1.5, 0, 8, 3, 0.6, 12, '#7a7d80'); gb.box(17, 0, 9, 18.5, 0.9, 11, '#7a7d80');
    gb.box(2, 0, 1.5, 2.2, 2.4, 1.7, '#3a3d42'); lampPost(gb, 18.5, 1.5); lampPost(gb, 1.5, 18.5);
  };
  SGEN.meadow = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD, '#6fa044');
    windingPath(gb, [[10, 0], [9, 8], [12, 16], [10, 30]], 1.4);
    for (let k = 0; k < 5; k++) { const x = 2 + r() * 5, z = 3 + k * 5.5; gb.box(x - 1, 0, z - 0.7, x + 1, 0.75, z + 0.7, '#8a6a4a'); }
    for (let k = 0; k < 4; k++) { const x = 14 + r() * 4, z = 4 + k * 6.5; gb.flat(x - 1, z - 1, x + 1, z + 1, 0.12, U.pick(['#d9473c', '#2f86c9', '#e3a02b'], r)); }
    grove(gb, 1, 24, 8, 29, 4, r); grove(gb, 14, 25, 19, 29, 3, r); pond(gb, 15, 12, 2.2);
  };
  SGEN.soccer = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD); field(gb, 1.5, 2, 18.5, 28);
    for (const z of [2.3, 27.7]) { gb.box(7.5, 0, z - 0.1, 7.7, 2.2, z + 0.1, '#fff'); gb.box(12.3, 0, z - 0.1, 12.5, 2.2, z + 0.1, '#fff'); gb.box(7.5, 2.2, z - 0.1, 12.5, 2.4, z + 0.1, '#fff'); }
    for (const z of [8, 15, 22]) gb.box(18.8, 0, z - 2, 19.8, 1.2, z + 2, '#7a8a90');
    for (const [x, z] of [[0.6, 0.6], [19.4, 0.6], [0.6, 29.4], [19.4, 29.4]]) { gb.box(x - 0.15, 0, z - 0.15, x + 0.15, 9, z + 0.15, '#9a9a9a'); gb.box(x - 0.7, 9, z - 0.7, x + 0.7, 9.6, z + 0.7, '#fff', 8); }
  };
  SGEN.flowers = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD, '#649a44');
    pathStrip(gb, 9.2, 0, 10.8, 20); pathStrip(gb, 0, 9.2, 20, 10.8);
    for (const [x0, z0] of [[1.5, 1.5], [12, 1.5], [1.5, 12], [12, 12]]) { flowerBed(gb, x0, z0, x0 + 6.5, z0 + 2.4, r); flowerBed(gb, x0, z0 + 3.6, x0 + 6.5, z0 + 6, r); }
    gb.box(8.5, 0, 8.5, 11.5, 3.5, 11.5, '#e8e4dc'); gb.pyr(8.2, 8.2, 11.8, 11.8, 3.5, 2.2, '#3f8a6a');
  };
  SGEN.woods = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD, '#4a7230');
    windingPath(gb, [[0, 20], [8, 17], [15, 22], [22, 18], [30, 24], [40, 21]], 1.4, '#a8916a');
    windingPath(gb, [[15, 22], [17, 30], [13, 40]], 1.2, '#a8916a'); windingPath(gb, [[22, 18], [25, 8], [21, 0]], 1.2, '#a8916a');
    pond(gb, 31, 33, 3.5);
    for (let k = 0; k < 45; k++) { const x = 1 + r() * 38, z = 1 + r() * 38; if (Math.abs(z - 20 - Math.sin(x * 0.2) * 2.5) < 2.5 || Math.hypot(x - 31, z - 33) < 5) continue; gb.tree(x, 0, z, 0.75 + r() * 0.55, U.pick(['#2c5a2f', '#36663a', '#3f6b30', '#4f7d34'], r), r() < 0.55); }
    gb.box(8, 0, 17.6, 9.6, 0.5, 18.1, '#6a5a4a'); gb.box(34, 0, 28, 37, 2.6, 30.5, '#7a5a3c', 0, { top: '#5a3d28' });
  };
  SGEN.grandplaza = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#cfc6b2');
    for (let k = 0; k < 6; k++) gb.flat(1 + k * 4.7, 1, 1.3 + k * 4.7, 29, 0.115, '#b8ad98');
    fountain(gb, 15, 15, 1.6);
    for (const [x, z] of [[4, 4], [26, 4], [4, 26], [26, 26]]) { statue(gb, x, z, 1, '#8a7a5a'); }
    for (let k = 0; k < 6; k++) { yardTree(gb, 2 + k * 5.2, 9.5, r); yardTree(gb, 2 + k * 5.2, 20.5, r); }
    for (let k = 0; k < 4; k++) { bench(gb, 6 + k * 6, 11.4, false); bench(gb, 6 + k * 6, 18.6, false); lampPost(gb, 3 + k * 8, 15); }
  };
  SGEN.lakepark = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD);
    gb.cyl(22, 0, 15, 11, 0.16, 20, '#1d6f8a', 13, '#1d6f8a');
    gb.cyl(22, 0, 15, 11.6, 0.12, 20, '#a9a28c', 0, '#a9a28c');
    gb.box(10, 0.1, 14, 16, 0.5, 16, '#8a6a4a'); gb.box(8, 0, 12.5, 11, 2.6, 17.5, '#7a5a3c', 0, { top: '#6b3e2e' });
    windingPath(gb, [[0, 3], [10, 2.5], [22, 2.5], [36, 4], [40, 10]], 1.3); windingPath(gb, [[0, 27], [14, 28], [30, 28], [40, 22]], 1.3);
    grove(gb, 1, 6, 8, 25, 7, r); grove(gb, 35, 14, 39, 27, 5, r);
    gb.box(25, 0.1, 18, 27, 0.9, 19, '#f2f2f2'); gb.box(19, 0.1, 10, 21, 0.9, 11, '#e3a02b');
  };
  SGEN.zen = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#d9d2c0');
    for (let k = 0; k < 12; k++) gb.flat(2, 2 + k * 1.1, 17, 2.4 + k * 1.1, 0.115, '#c9c1ad');
    for (const [x, z, sc] of [[6, 6, 1.4], [11, 9, 1], [14, 5, 0.8]]) gb.cone(x, 0, z, 1.1 * sc, 1.3 * sc, 6, '#7a7d80');
    pond(gb, 22, 22, 4);
    gb.box(18, 0.6, 21.5, 26, 0.9, 22.5, '#b0382c');
    gb.box(3, 0, 20, 9, 3, 26, '#6a4a32'); gb.gable(2.4, 19.4, 9.6, 26.6, 3, 2.4, true, '#2f3640', '#6a4a32');
    for (const x of [24, 27]) gb.box(x, 0, 3, x + 0.4, 4, 3.4, '#b0382c'); gb.box(23.5, 4, 2.8, 28, 4.5, 3.6, '#b0382c');
    for (let k = 0; k < 6; k++) gb.tree(13 + r() * 14, 0, 8 + r() * 8, 0.65, U.pick(['#b04a6a', '#c96a8a', '#4f7d34'], r), false);
  };
  SGEN.sports = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD);
    field(gb, 2, 2, 24, 38);
    court(gb, 27, 2, 38, 13, '#3a7aa0'); court(gb, 27, 15, 38, 26, '#3a8a5a');
    hoop(gb, 27.4, 7.5, 1, true); hoop(gb, 37.6, 7.5, -1, true); hoop(gb, 27.4, 20.5, 1, true); hoop(gb, 37.6, 20.5, -1, true);
    gb.cyl(32.5, 0.1, 33, 5, 0.2, 16, '#c0603a', 0, '#c0603a'); gb.cyl(32.5, 0.15, 33, 3.6, 0.2, 16, '#5f9a40', 0, '#5f9a40');
    gb.box(0.5, 0, 12, 1.8, 2.5, 28, '#c9c5bb'); gb.box(24.5, 0, 14, 26, 3.4, 26, '#e0ddd5', 1);
    for (const [x, z] of [[1, 1], [25, 1], [1, 39], [25, 39]]) { gb.box(x - 0.2, 0, z - 0.2, x + 0.2, 12, z + 0.2, '#9a9a9a'); gb.box(x - 1, 12, z - 1, x + 1, 12.8, z + 1, '#fff', 8); }
  };
  SGEN.amphi = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD);
    const cx = 15, cz = 26;
    for (let k = 0; k < 6; k++) { const rr = 6 + k * 2; for (let s = 0; s < 10; s++) { const a0 = Math.PI + s / 10 * Math.PI, a1 = Math.PI + (s + 1) / 10 * Math.PI; gb.quad([cx + Math.cos(a1) * rr, k * 0.6 + 0.6, cz + Math.sin(a1) * rr], [cx + Math.cos(a0) * rr, k * 0.6 + 0.6, cz + Math.sin(a0) * rr], [cx + Math.cos(a0) * (rr + 2), k * 0.6 + 0.6, cz + Math.sin(a0) * (rr + 2)], [cx + Math.cos(a1) * (rr + 2), k * 0.6 + 0.6, cz + Math.sin(a1) * (rr + 2)], '#cfc8b8'); } }
    gb.box(cx - 7, 0, cz + 1, cx + 7, 1.2, cz + 7, '#a59b8a');
    gb.box(cx - 7, 1.2, cz + 6, cx + 7, 7, cz + 7, '#e8e4dc'); gb.box(cx - 7.4, 7, cz + 1, cx + 7.4, 7.5, cz + 7.5, '#3c5060');
    grove(gb, 1, 1, 29, 6, 8, r); windingPath(gb, [[0, 9], [15, 7.5], [30, 9]], 1.4);
  };
  // ---- landmarks (code & AI themed) ----
  SGEN.claude = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#e8dccb');
    const st = '#d97757', cr = '#f0e6d8';
    // arch made of segments
    const cx = 15, cz = 15, R0 = 9, R1 = 12.5, seg = 14;
    for (let k = 0; k < seg; k++) {
      const a0 = Math.PI * k / seg, a1 = Math.PI * (k + 1) / seg;
      const p = (a, rr, z) => [cx + Math.cos(a) * rr, Math.sin(a) * rr * 2.1 + 0.4, z];
      for (const z of [cz - 2.5, cz + 2.5]) { gb.quad(p(a0, R0, z), p(a1, R0, z), p(a1, R1, z), p(a0, R1, z), st); gb.quad(p(a1, R0, z), p(a0, R0, z), p(a0, R1, z), p(a1, R1, z), st); }
      gb.quad(p(a0, R1, cz - 2.5), p(a1, R1, cz - 2.5), p(a1, R1, cz + 2.5), p(a0, R1, cz + 2.5), st);
      gb.quad(p(a1, R0, cz - 2.5), p(a0, R0, cz - 2.5), p(a0, R0, cz + 2.5), p(a1, R0, cz + 2.5), cr);
    }
    // the spark on top: eight rays
    const sy = R1 * 2.1 + 4;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, L = k % 2 ? 2.6 : 4; gb.box(cx - 0.35, sy - 0.35, cz - 0.35, cx + 0.35, sy + 0.35, cz + 0.35, st, 5); gb.quad([cx, sy, cz - 0.4], [cx, sy, cz + 0.4], [cx + Math.cos(a) * L, sy + Math.sin(a) * L, cz + 0.05], [cx + Math.cos(a) * L, sy + Math.sin(a) * L, cz - 0.05], st, 5); gb.quad([cx, sy, cz + 0.4], [cx, sy, cz - 0.4], [cx + Math.cos(a) * L, sy + Math.sin(a) * L, cz - 0.05], [cx + Math.cos(a) * L, sy + Math.sin(a) * L, cz + 0.05], st, 5); }
    gb.flat(13, 0.5, 17, 29.5, 0.11, '#c9b9a0');
    for (const x of [4, 26]) { yardTree(gb, x, 4, r); yardTree(gb, x, 26, r); }
  };
  SGEN.vscode = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, PAL.paved);
    const blue = '#1f8ad2', dark = '#0e5c99', H = 70;
    // the logo seen from above: a folded ribbon. Built as three extruded slabs.
    gb.box(19, 0, 4, 25, H, 26, blue, 2, { vb: 0 });                    // right bar (tall)
    const slant = (x0, z0, x1, z1, w, h, col) => { const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz), nx = -dz / l * w / 2, nz = dx / l * w / 2; const A = [x0 + nx, 0, z0 + nz], B = [x1 + nx, 0, z1 + nz], Cc = [x1 - nx, 0, z1 - nz], D = [x0 - nx, 0, z0 - nz]; const up = p => [p[0], h, p[2]]; gb.quad(A, B, up(B), up(A), col, 2); gb.quad(Cc, D, up(D), up(Cc), col, 2); gb.quad(B, Cc, up(Cc), up(B), col, 2); gb.quad(D, A, up(A), up(D), col, 2); gb.quad(up(A), up(B), up(Cc), up(D), col); };
    slant(20, 6, 6, 18, 4.5, H * 0.72, dark);
    slant(20, 24, 6, 12, 4.5, H * 0.72, blue);
    gb.box(4, 0, 12, 8, H * 0.5, 18, dark, 2);
    gb.box(18.8, H, 3.8, 25.2, H + 1, 26.2, '#16486e');
    gb.box(21.5, H + 1, 14, 22.5, H + 9, 15, '#ccc'); gb.box(21.6, H + 9, 14.1, 22.4, H + 9.6, 14.9, '#f22', 7);
  };
  SGEN.octocat = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#c9c0ae');
    const k = '#24292f', cx = 10, cz = 10;
    gb.cyl(cx, 0, cz, 6, 1.2, 16, '#8f877a', 0, '#b8ad98');
    gb.cyl(cx, 1.2, cz, 2.6, 6, 12, k, 0, k, 2.2);            // body
    gb.cyl(cx, 7.2, cz, 3.6, 4.5, 14, k, 0, k, 3.2);          // head
    gb.cone(cx - 2.3, 11.4, cz, 1.3, 2.6, 6, k); gb.cone(cx + 2.3, 11.4, cz, 1.3, 2.6, 6, k); // ears
    gb.box(cx - 2.4, 8.2, cz - 3.5, cx + 2.4, 10.6, cz - 3.0, '#f4c7a8');                    // face
    gb.box(cx - 1.4, 9.2, cz - 3.6, cx - 0.8, 10, cz - 3.45, k); gb.box(cx + 0.8, 9.2, cz - 3.6, cx + 1.4, 10, cz - 3.45, k);
    for (let t = 0; t < 5; t++) { const a = Math.PI * 0.15 + t / 4 * Math.PI * 0.7; const x1 = cx + Math.cos(a) * 4.8, z1 = cz + Math.sin(a) * 4.8 * -1; gb.box(Math.min(cx, x1) - 0.4, 1.2, Math.min(cz, z1) - 0.4, Math.max(cx, x1) + 0.4, 2.0, Math.max(cz, z1) + 0.4, k); }
    for (let t = 0; t < 6; t++) bench(gb, 3 + t * 2.8, 18, false);
  };
  SGEN.duck = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#c9c0ae');
    pond(gb, 15, 15, 12);
    const y = '#f5c518', cx = 15, cz = 15;
    gb.addThree(new THREE.SphereGeometry(7, 14, 10), new THREE.Matrix4().makeScale(1.35, 0.8, 1).setPosition(cx, 4.5, cz), y);
    gb.addThree(new THREE.SphereGeometry(4.2, 12, 10), new THREE.Matrix4().setPosition(cx - 6, 12, cz), y);
    gb.addThree(new THREE.ConeGeometry(2, 3.4, 8), new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(cx - 11, 11.4, cz), '#f08a1c');
    gb.addThree(new THREE.SphereGeometry(0.6, 6, 6), new THREE.Matrix4().setPosition(cx - 9, 13.4, cz - 2.4), '#111');
    gb.addThree(new THREE.SphereGeometry(0.6, 6, 6), new THREE.Matrix4().setPosition(cx - 9, 13.4, cz + 2.4), '#111');
    gb.addThree(new THREE.ConeGeometry(2.6, 4, 6), new THREE.Matrix4().makeRotationZ(-Math.PI / 2.6).setPosition(cx + 9.5, 7, cz), y);
  };
  SGEN.terminal = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#3a3d42');
    gb.box(4, 0, 8, 16, 52, 12, '#0d0f12');
    gb.box(5.2, 30, 7.94, 7.2, 31.6, 8, '#3cff6a', 5); gb.box(7.4, 29.6, 7.94, 8.9, 32, 8, '#3cff6a', 5); // >
    gb.box(9.6, 29.6, 7.94, 12.6, 30.2, 8, '#3cff6a', 5); // _
    for (let k = 0; k < 8; k++) gb.box(5, 36 + k * 1.6, 7.94, 5 + 2 + r() * 8, 36.6 + k * 1.6, 8, '#2ad15a', 5);
    gb.box(3.6, 52, 7.6, 16.4, 52.6, 12.4, '#2b2f36');
  };
  SGEN.stack = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, PAL.paved);
    const cols = ['#f48024', '#bcbbbb', '#f48024', '#e0e0e0', '#f48024'];
    let y = 0;
    for (let k = 0; k < 14; k++) { const ox = Math.sin(k * 0.9) * 2.2, oz = Math.cos(k * 1.3) * 1.6, h = 5 + (k % 3); gb.box(4 + ox, y, 4 + oz, 16 + ox, y + h - 0.6, 16 + oz, k % 2 ? '#e8e6e0' : '#f48024', 2); gb.box(4.2 + ox, y + h - 0.6, 4.2 + oz, 15.8 + ox, y + h, 15.8 + oz, '#3a3d42'); y += h; }
    gb.box(9.5, y, 9.5, 10.5, y + 10, 10.5, '#ccc'); gb.box(9.6, y + 10, 9.6, 10.4, y + 10.6, 10.4, '#f22', 7);
  };
  SGEN.neural = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#c9c0ae');
    const cx = 15, cz = 15, cy = 22, R0 = 13;
    gb.cyl(cx, 0, cz, 3, 9, 10, '#d8d4cb', 0, null, 1.6);
    const pts = [];
    for (let k = 0; k < 26; k++) { const yy = 1 - (k + 0.5) / 26 * 2, rr = Math.sqrt(1 - yy * yy), a = k * 2.399; pts.push([cx + Math.cos(a) * rr * R0, cy + yy * R0, cz + Math.sin(a) * rr * R0]); }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const p = pts[i], q = pts[j], d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      if (d > 9.5) continue;
      const m = new THREE.Matrix4(), dir = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      m.compose(new THREE.Vector3((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2), quat, new THREE.Vector3(1, d, 1));
      gb.addThree(new THREE.CylinderGeometry(0.12, 0.12, 1, 4), m, '#8fa3b5');
    }
    for (const p of pts) gb.box(p[0] - 0.7, p[1] - 0.7, p[2] - 0.7, p[0] + 0.7, p[1] + 0.7, p[2] + 0.7, U.pick(['#9fd3ff', '#d97757', '#b276f2'], r), 5);
  };
  SGEN.python = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, PAL.paved);
    const H = 90;
    for (const [cx, col, ph] of ([[10, '#3776ab', 0], [20, '#ffd43b', Math.PI]] as [number, string, number][])) {
      for (let k = 0; k < 30; k++) { const y = k * H / 30, a = ph + k * 0.42, ox = Math.cos(a) * 1.8, oz = Math.sin(a) * 1.8; gb.box(cx - 3.2 + ox, y, 15 - 3.2 + oz, cx + 3.2 + ox, y + H / 30 + 0.05, 15 + 3.2 + oz, col, 2); }
      gb.cone(cx, H, 15, 3.6, 7, 8, col);
    }
    gb.box(10, 36, 13.5, 20, 38, 16.5, '#d8d4cb'); gb.box(10, 62, 13.5, 20, 64, 16.5, '#d8d4cb');
  };
  SGEN.tux = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#d9d4c6');
    const cx = 15, cz = 15, k = '#1a1a1a', w = '#f6f6f2', o = '#f2a81d';
    gb.cyl(cx, 0, cz, 8, 0.8, 16, '#b8ad98', 0, '#cfc6b2');
    gb.addThree(new THREE.SphereGeometry(5.5, 14, 10), new THREE.Matrix4().makeScale(1, 1.35, 0.9).setPosition(cx, 8, cz), k);
    gb.addThree(new THREE.SphereGeometry(4.4, 12, 10), new THREE.Matrix4().makeScale(1, 1.25, 0.6).setPosition(cx, 7.5, cz - 2.3), w);
    gb.addThree(new THREE.SphereGeometry(3.6, 12, 10), new THREE.Matrix4().setPosition(cx, 16.5, cz), k);
    gb.addThree(new THREE.SphereGeometry(0.8, 8, 6), new THREE.Matrix4().setPosition(cx - 1.3, 17.2, cz - 3.1), w);
    gb.addThree(new THREE.SphereGeometry(0.8, 8, 6), new THREE.Matrix4().setPosition(cx + 1.3, 17.2, cz - 3.1), w);
    gb.addThree(new THREE.ConeGeometry(1.0, 2.2, 6), new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(cx, 15.6, cz - 4), o);
    gb.box(cx - 3.6, 0.8, cz - 3.4, cx - 0.6, 1.6, cz - 0.6, o); gb.box(cx + 0.6, 0.8, cz - 3.4, cx + 3.6, 1.6, cz - 0.6, o);
    for (let t = 0; t < 8; t++) { const a = t / 8 * Math.PI * 2; yardTree(gb, cx + Math.cos(a) * 12, cz + Math.sin(a) * 12, r); }
  };
  SGEN.whale = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#2a6f9a');
    gb.flat(1, 1, LW - 1, LD - 1, 0.12, '#1d6f8a');
    const cx = 20, cz = 15, bl = '#2496ed';
    gb.addThree(new THREE.SphereGeometry(8, 16, 10), new THREE.Matrix4().makeScale(2, 0.7, 1).setPosition(cx, 3, cz), bl);
    gb.addThree(new THREE.ConeGeometry(4, 6, 6), new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(cx + 18, 4, cz), bl);
    gb.box(cx - 8, 6, cz - 5, cx + 8, 7, cz + 5, '#1a74c0');
    const cc = ['#d9473c', '#2f86c9', '#3aa36a', '#e3a02b', '#8c4fc0', '#f2f2f2'];
    for (let lx = 0; lx < 4; lx++) for (let lz = 0; lz < 2; lz++) for (let ly = 0; ly < 1 + ((lx + lz) % 3); ly++) gb.box(cx - 7.6 + lx * 3.9, 7 + ly * 2.6, cz - 4.6 + lz * 4.6, cx - 4.0 + lx * 3.9, 9.5 + ly * 2.6, cz - 0.4 + lz * 4.6, U.pick(cc, r));
    gb.box(cx - 14.6, 5, cz - 3.2, cx - 14, 6, cz - 2.4, '#111'); gb.box(cx - 14.6, 5, cz + 2.4, cx - 14, 6, cz + 3.2, '#111');
  };
export function genBuilding(gb: GB, b: Building) {
    const r = U.rng(b.seed + b.level * 977);
    lotFrame(gb, b);
    gb.tint = b.state === 'aband' ? 0.55 : null;
    gb.noLit = b.state === 'aband';
    gb.autoMat = true;
    gb.drive = false; gb.wear = b.kind === 'zone' ? ([0, 0.85, 0.45, 0.12, 0, 0][b.level] || 0) * (b.zone === 1 ? 0.55 : 1) : 0;
    const LW = b.w * T, LD = b.d * T;
    if (b.kind === 'zone') GEN[C.ZONES[b.zone].key](gb, b, r, LW, LD);
    else SGEN[b.svc](gb, b, r, LW, LD);
    gb.tint = null; gb.noLit = false; gb.autoMat = false; gb.wear = 0;
  };
