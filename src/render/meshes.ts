/**
 * Vira City — 3D City Rendering, Mesh Generation & Materials (`src/render/meshes.ts`)
 */
import * as THREE from 'three';
import { C } from '@/core/constants';
import { U } from '@/core/utils';
import { World } from '@/world/world';
import { Gfx } from '@/render/gfx';
import { Sim } from '@/sim/sim';
import { Traffic } from '@/traffic/traffic';
import { Transit } from '@/transit/transit';


import { GB, lc, FR } from '@/render/geometryBuilder';

import {
  PAL,
  M8,
  GEN,
  SGEN,
  genBuilding,
  foundation,
  yardTree,
  parkedVeh,
  parkedCar,
  hip,
} from '@/render/generators/buildingGenerators';
import { getParkSpots } from '@/render/generators/parkSpots';
import {
  vehGeom,
  vehGeomHQ,
  vehModel,
  clearVehModels,
  VEH_KINDS,
  CAR_COLORS,
  wheelLite,
  setWheelLite,
} from '@/render/generators/vehicleGenerators';

export const Meshes: any = {};
const M = Meshes;
M.GB = GB;

const T = C.TILE, W = C.W;


M.MAT = M8;
M.parkSpots = getParkSpots;
M.genBuilding = genBuilding;
M.clearVehModels = clearVehModels;
M._vehGeomHQ = vehGeomHQ;
M.VEH_KINDS = VEH_KINDS;
M.CAR_COLORS = CAR_COLORS;
  // ---- 3D thumbnails for menus (rendered once, cached as images) ----
  const thumbCache = new Map();
  let TR = null;
  M.thumb = function (key, spec) {
    if (thumbCache.has(key)) return thumbCache.get(key);
    let url = '';
    try {
      if (!TR) {
        const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        r.setPixelRatio(1); r.setSize(176, 128);
        r.outputColorSpace = Gfx.renderer.outputColorSpace; r.toneMapping = Gfx.renderer.toneMapping; r.toneMappingExposure = Gfx.renderer.toneMappingExposure;
        const sc = new THREE.Scene();
        sc.add(new THREE.HemisphereLight(0xdfeeff, 0x6a5a40, 1.4));
        const sun = new THREE.DirectionalLight(0xfff1dc, 2.6); sun.position.set(-0.6, 1, 0.45); sc.add(sun);
        TR = { r, sc, cam: new THREE.PerspectiveCamera(28, 176 / 128, 1, 4000) };
      }
      const b = Object.assign({ x: 0, y: 0, dir: 2, baseY: 0, minY: -0.5, seed: 1234, level: 3, state: 'live' }, spec);
      b.fw = b.w; b.fh = b.d;
      const gb = new GB(); M.genBuilding(gb, b);
      const geo = gb.geometry(); geo.computeBoundingBox();
      const mesh = new THREE.Mesh(geo, Gfx.mats.city);
      TR.sc.add(mesh);
      const bb = geo.boundingBox, c = new THREE.Vector3(), sz = new THREE.Vector3(); bb.getCenter(c); bb.getSize(sz);
      const rad = Math.max(sz.x, sz.z, sz.y * 0.9) * 0.62 + 4;
      const dist = rad / Math.tan(THREE.MathUtils.degToRad(14));
      TR.cam.position.set(c.x - dist * 0.55, c.y + dist * 0.62, c.z + dist * 0.56);
      TR.cam.lookAt(c.x, c.y - sz.y * 0.05, c.z);
      TR.cam.near = dist * 0.2; TR.cam.far = dist * 3; TR.cam.updateProjectionMatrix();
      TR.r.render(TR.sc, TR.cam);
      url = TR.r.domElement.toDataURL('image/png');
      TR.sc.remove(mesh); geo.dispose();
    } catch (e) { url = ''; }
    thumbCache.set(key, url);
    return url;
  };
  M.buildingHeight = function (b) {
    const gb = new GB(); M.genBuilding(gb, b);
    let mx = 0; for (let i = 1; i < gb.p.length; i += 3) mx = Math.max(mx, gb.p[i] - b.baseY);
    return mx;
  };

  // ======================================================================
  // Roads, rail, stops (infrastructure chunks)
  // ======================================================================
  const COL = {
    asph: '#3c3f44', asphHw: '#35383c', walk: '#aeada6', curb: '#8e8d87', white: '#e6e6df', yellow: '#dfb33a',
    barrier: '#b9b6ad', deck: '#a9a69e', dirt: '#8a7458', bike: '#3f7a4e', ballast: '#5a5650', rail: '#9095a0', sleeper: '#6a5f55',
  };
  function genRoadTile(gb, i) {
    const Wd = World;
    const x = U.tx(i), y = U.ty(i), rt = Wd.road[i], R = C.ROADS[rt], m = Wd.roadMask(i);
    const X0 = x * T, Z0 = y * T;
    const bridge = Wd.isWater(i);
    const base = (lx: number, lz: number) => bridge ? Wd.BRIDGE_H : Math.max(Wd.groundH(X0 + lx, Z0 + lz), C.WATER + 0.3);
    const P = (lx: number, dy: number, lz: number) => [X0 + lx, base(lx, lz) + dy, Z0 + lz];
    const flatQ = (x0: number, z0: number, x1: number, z1: number, dy: number, col: any, st: number = 14) => gb.quad(P(x0, dy, z1), P(x1, dy, z1), P(x1, dy, z0), P(x0, dy, z0), col, st || 14);
    const WALK = 14 + M8.walk, ASPH = 14 + M8.asph;
    const slab = (x0: number, z0: number, x1: number, z1: number, top: number, col: any, sideCol?: any) => {
      if (x1 < x0) [x0, x1] = [x1, x0]; if (z1 < z0) [z0, z1] = [z1, z0];
      flatQ(x0, z0, x1, z1, top, col, col === COL.walk ? WALK : col === '#5d8c3c' ? 14 + M8.lawn : 14);
      const sc = sideCol || COL.curb, lo = -0.4;
      gb.quad(P(x1, lo, z0), P(x0, lo, z0), P(x0, top, z0), P(x1, top, z0), sc);
      gb.quad(P(x0, lo, z1), P(x1, lo, z1), P(x1, top, z1), P(x0, top, z1), sc);
      gb.quad(P(x0, lo, z0), P(x0, lo, z1), P(x0, top, z1), P(x0, top, z0), sc);
      gb.quad(P(x1, lo, z1), P(x1, lo, z0), P(x1, top, z0), P(x1, top, z1), sc);
    };
    // strip frame: u across (0 = left when facing direction f), v along (0 = behind, 10 = ahead)
    const FU = (f: number, u: number, v: number) => f === 0 ? [u, T - v] : f === 1 ? [v, u] : f === 2 ? [T - u, v] : [T - v, T - u];
    const fq = (f: number, u0: number, v0: number, u1: number, v1: number, dy: number, col: any, st: number = 14) => { const a = FU(f, u0, v0), b = FU(f, u1, v1); flatQ(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), dy, col, st); };
    const fs = (f: number, u0: number, v0: number, u1: number, v1: number, top: number, col: any, side?: any) => { const a = FU(f, u0, v0), b = FU(f, u1, v1); slab(a[0], a[1], b[0], b[1], top, col, side); };
    const con = d => (m & (1 << d)) !== 0;
    const h = U.hash(x, y, 3) * 0.04 - 0.02;
    const surf = R.surf === 'dirt' ? COL.dirt : R.grp === 'highway' ? COL.asphHw : COL.asph;
    const ac = lc(surf); const asphC = [ac[0] * (1 + h), ac[1] * (1 + h), ac[2] * (1 + h)].map(v => Math.pow(Math.max(0, v), 1 / 2.2));
    const mk = 0.19;
    const jc = Wd.jcl[i];
    let deg = 0; for (let d = 0; d < 4; d++) if (con(d)) deg++;
    const ns = con(0) || con(2), ew = con(1) || con(3);
    if (!R.car) {
      // bike / foot path: grass verge with a paved ribbon along each connection
      flatQ(0, 0, T, T, 0.12, '#6b9444');
      const pc = R.key === 'bikepath' ? '#7a4a3c' : '#c9c1ad', hw = R.key === 'bikepath' ? 1.6 : 1.3;
      const c = T / 2;
      flatQ(c - hw, c - hw, c + hw, c + hw, 0.18, pc);
      if (con(0)) flatQ(c - hw, 0, c + hw, c, 0.18, pc);
      if (con(2)) flatQ(c - hw, c, c + hw, T, 0.18, pc);
      if (con(1)) flatQ(c, c - hw, T, c + hw, 0.18, pc);
      if (con(3)) flatQ(0, c - hw, c, c + hw, 0.18, pc);
      if (!deg) flatQ(c - hw, 1, c + hw, T - 1, 0.18, pc);
      if (R.key === 'bikepath') { if (con(0) || con(2)) flatQ(c - 0.06, 1, c + 0.06, 4, 0.2, COL.white); if (con(1) || con(3)) flatQ(1, c - 0.06, 4, c + 0.06, 0.2, COL.white); }
      else if (U.hash(x, y, 9) < 0.5) gb.tree(X0 + 1.4, base(1.4, 1.4), Z0 + 1.4, 0.7, '#4f7d34', false);
      addBridge();
      return;
    }
    const SURF = R.surf === 'dirt' ? 14 + M8.dirt : ASPH;
    const corner = jc < 0 && Wd.isBent(i) && Wd.links2(i);
    const straight = deg <= 2 && !(ns && ew) && !corner;
    if (!corner) flatQ(0, 0, T, T, 0.16, asphC, SURF);
    if (jc >= 0) {
      // junction tile: sidewalks on closed edges and corners, crosswalks where traffic enters
      const sw = Math.max(1.2, R.side);
      for (let d = 0; d < 4; d++) {
        if (con(d)) continue;
        if (d === 0) slab(0, 0, T, sw, 0.32, COL.walk); else if (d === 2) slab(0, T - sw, T, T, 0.32, COL.walk);
        else if (d === 1) slab(T - sw, 0, T, T, 0.32, COL.walk); else slab(0, 0, sw, T, 0.32, COL.walk);
      }
      // corner kerbs only on the outside corners of the whole junction (not in the middle of a 2x2 crossing)
      const cs = 1.1, outer = d => { const o = Wd.neighbor(i, d); return o < 0 || Wd.jcl[o] !== jc; };
      const corner = (a, b) => con(a) && con(b) && outer(a) && outer(b);
      if (corner(0, 1)) slab(T - cs, 0, T, cs, 0.32, COL.walk);
      if (corner(1, 2)) slab(T - cs, T - cs, T, T, 0.32, COL.walk);
      if (corner(2, 3)) slab(0, T - cs, cs, T, 0.32, COL.walk);
      if (corner(3, 0)) slab(0, 0, cs, cs, 0.32, COL.walk);
      for (let d = 0; d < 4; d++) {
        if (!con(d)) continue;
        const o = Wd.neighbor(i, d); if (o < 0 || Wd.jcl[o] === jc) continue;
        if (C.ROADS[Wd.road[o]].grp === 'highway') continue;
        for (let s = 1.4; s < T - 1.6; s += 1.0) {
          if (d === 0) flatQ(s, 0.3, s + 0.5, 2.1, mk, COL.white); else if (d === 2) flatQ(s, T - 2.1, s + 0.5, T - 0.3, mk, COL.white);
          else if (d === 1) flatQ(T - 2.1, s, T - 0.3, s + 0.5, mk, COL.white); else flatQ(0.3, s, 2.1, s + 0.5, mk, COL.white);
        }
      }
      const cl = Wd.clusters[jc];
      if (cl && cl.ctrl === 'round' && cl.tiles[0] === i) {
        const cx = (cl.cx - x) * T, cz = (cl.cy - y) * T, rr = cl.tiles.length > 1 ? 4.2 : 2.1;
        const yb = base(Math.min(T, Math.max(0, cx)), Math.min(T, Math.max(0, cz)));
        gb.cyl(X0 + cx, yb + 0.1, Z0 + cz, rr + 0.3, 0.3, 16, COL.curb, 0, COL.curb);
        gb.cyl(X0 + cx, yb + 0.1, Z0 + cz, rr, 0.32, 16, '#5d8c3c', 0, '#5d8c3c');
        gb.tree(X0 + cx, yb + 0.4, Z0 + cz, cl.tiles.length > 1 ? 1 : 0.6, '#4f7d34', false);
      }
    } else {
      // regular strip
      let f = Wd.rdir[i];
      if (straight) { if (ns && (f % 2 !== 0)) f = con(0) ? 0 : 2; if (ew && (f % 2 !== 1)) f = con(1) ? 1 : 3; }
      if (!straight) {
        if (corner) curvedTile(corner);
        else if (R.side > 0) { // plain square corner: sidewalks on the closed sides and a kerb on the inner corner
          const sw = R.side;
          if (!con(0)) slab(0, 0, T, sw, 0.32, COL.walk);
          if (!con(1)) slab(T - sw, 0, T, T, 0.32, COL.walk);
          if (!con(2)) slab(0, T - sw, T, T, 0.32, COL.walk);
          if (!con(3)) slab(0, 0, sw, T, 0.32, COL.walk);
          const cs = Math.min(sw, 1.6);
          if (con(0) && con(1)) slab(T - cs, 0, T, cs, 0.32, COL.walk);
          if (con(1) && con(2)) slab(T - cs, T - cs, T, T, 0.32, COL.walk);
          if (con(2) && con(3)) slab(0, T - cs, cs, T, 0.32, COL.walk);
          if (con(3) && con(0)) slab(0, 0, cs, cs, 0.32, COL.walk);
        }
      } else {
        const L = R.L, sw = R.side, bw = L.bw;
        const pair = R.w === 2, one = R.oneway;
        const endA = !con((f + 2) % 4), endB = !con(f); // closed behind / ahead
        // outer right side (and left too for single strips)
        const sides = pair ? [1] : [0, 1];
        for (const sd of sides) {
          const u0 = sd ? T - sw : 0, u1 = sd ? T : sw;
          if (sw > 0) {
            if (R.grp === 'highway') { fq(f, u0, 0, u1, T, 0.2, '#6b6b66'); fs(f, sd ? T - 0.35 : 0.1, 0, sd ? T - 0.1 : 0.35, T, 0.9, COL.barrier); }
            else {
              fs(f, u0, 0, u1, T, 0.32, COL.walk);
              if (R.trees) { const p = FU(f, sd ? T - sw / 2 : sw / 2, 5); gb.tree(X0 + p[0], base(p[0], p[1]) + 0.3, Z0 + p[1], 0.62, U.pick(['#4f7d34', '#5c8a3a', '#3f6b30'], () => U.hash(x, y, sd)), false); }
            }
          }
          if (bw > 0) {
            const b0 = sd ? T - sw - bw : sw, b1 = b0 + bw;
            fq(f, b0, 0, b1, T, mk - 0.01, COL.bike, ASPH);
            if (R.bike === 2) fs(f, sd ? b0 : b1 - 0.35, 0, sd ? b0 + 0.35 : b1, T, 0.3, COL.walk);
            else fq(f, sd ? b0 - 0.05 : b1 - 0.1, 0, sd ? b0 + 0.1 : b1 + 0.05, T, mk, COL.white);
            const p = FU(f, (b0 + b1) / 2, 5); // bike symbol dot
            flatQ(p[0] - 0.25, p[1] - 0.25, p[0] + 0.25, p[1] + 0.25, mk + 0.005, COL.white);
          }
        }
        if (pair) {
          // inner half of the median
          const m0 = 0, m1 = L.med;
          if (R.med === 'paint') fq(f, 0, 0, 0.14, T, mk, COL.yellow);
          else if (R.med === 'barrier') fs(f, 0, 0, Math.max(0.3, m1), T, 0.95, COL.barrier);
          else if (R.med === 'curb') fs(f, m0, 0, m1, T, 0.3, COL.walk);
          else { fs(f, m0, 0, m1, T, 0.3, '#5d8c3c', COL.curb); if (R.med === 'trees' && (x + y) % 2 === 0) { const p = FU(f, 0.2, 5); gb.tree(X0 + p[0], base(p[0], p[1]) + 0.3, Z0 + p[1], 0.7, '#4f7d34', false); } }
          // lane dividers
          const ls = L.fwd.length;
          for (let j = 0; j < ls - 1; j++) { const u = T / 2 + (L.fwd[j] + L.fwd[j + 1]) / 2; dash(f, u); }
          if (R.grp !== 'highway' && ls) { const u = T - sw - bw - 0.1; fq(f, u - 0.06, 0, u + 0.06, T, mk, COL.white); }
          if (R.tram) for (const o of L.fwd.slice(-1)) tramRails(f, T / 2 + o);
        } else if (R.surf !== 'dirt') {
          if (one) {
            for (let j = 0; j < L.fwd.length - 1; j++) dash(f, T / 2 + (L.fwd[j] + L.fwd[j + 1]) / 2);
          } else {
            const mx = L.medX;
            if (R.med === 'curb') fs(f, mx - L.med / 2, 0.6, mx + L.med / 2, T - 0.6, 0.3, COL.walk);
            else if (R.grp === 'highway') { dash(f, mx); }
            else { fq(f, mx - 0.2, 0, mx - 0.07, T, mk, COL.yellow); fq(f, mx + 0.07, 0, mx + 0.2, T, mk, COL.yellow); }
            for (let j = 0; j < L.fwd.length - 1; j++) dash(f, T / 2 + (L.fwd[j] + L.fwd[j + 1]) / 2);
            for (let j = 0; j < L.back.length - 1; j++) dash(f, T / 2 - (L.back[j] + L.back[j + 1]) / 2);
            if (R.tram) { tramRails(f, T / 2 + L.fwd[0]); tramRails(f, T / 2 - L.back[0]); }
          }
        }
        // closed ends get a sidewalk cap
        if (sw > 0 && R.grp !== 'highway') { if (endA) fs(f, 0, 0, T, sw, 0.32, COL.walk); if (endB) fs(f, 0, T - sw, T, T, 0.32, COL.walk); }
        if (one && !pair && ((x + y) % 3 === 0)) flowArrow(f, T / 2 + L.fwd[0], 4);
      }
      // lane arrows & stop lines on junction approaches
      const aps = M.apInfo && M.apInfo.get(i);
      if (aps) for (const ap of aps) approachMarks(ap);
    }
    addBridge();

    function dash(f, u) { fq(f, u - 0.07, 0.8, u + 0.07, 3.8, mk, COL.white); fq(f, u - 0.07, 5.8, u + 0.07, 8.8, mk, COL.white); }
    // a plain corner: the whole cross-section follows a curve (or a straight 45 degree diagonal on a staircase)
    function curvedTile(links) {
      const dout = links.includes(Wd.rdir[i]) ? Wd.rdir[i] : links[1];
      const din = ((links[0] === dout ? links[1] : links[0]) + 2) % 4;
      const c = T / 2, DX = C.DX, DZ = C.DY;
      const segs = new Map();
      const Q = (u, t) => {
        let q = segs.get(u); if (!q) { q = Wd.bendSeg(i, din, dout, u, u).map((v, k) => v - (k % 2 ? Z0 : X0)); segs.set(u, q); }
        const w = 1 - t; return [w * w * q[0] + 2 * w * t * q[2] + t * t * q[4], w * w * q[1] + 2 * w * t * q[3] + t * t * q[5]];
      };
      const NS = 10;
      const upQuad = (a, b, cc, d, col, st) => {
        const ny = (cc[2] - a[2]) * (d[0] - b[0]) - (cc[0] - a[0]) * (d[2] - b[2]);
        if (ny >= 0) gb.quad(a, b, cc, d, col, st); else gb.quad(d, cc, b, a, col, st);
      };
      const band = (u0: number, u1: number, dy: number, col: any, st: number = 14, dashed: boolean = false) => {
        for (let k = 0; k < NS; k++) {
          if (dashed && k % 2) continue;
          const ta = k / NS, tb = (k + 1) / NS;
          const a = Q(u0, ta), b = Q(u0, tb), cc = Q(u1, tb), d = Q(u1, ta);
          upQuad(P(a[0], dy, a[1]), P(b[0], dy, b[1]), P(cc[0], dy, cc[1]), P(d[0], dy, d[1]), col, st || 14);
        }
      };
      const kerb = (u: number, y0: number, y1: number, col: any) => {
        for (let k = 0; k < NS; k++) {
          const a = Q(u, k / NS), b = Q(u, (k + 1) / NS);
          gb.quad(P(a[0], y0, a[1]), P(b[0], y0, b[1]), P(b[0], y1, b[1]), P(a[0], y1, a[1]), col);
          gb.quad(P(b[0], y0, b[1]), P(a[0], y0, a[1]), P(a[0], y1, a[1]), P(b[0], y1, b[1]), col);
        }
      };
      const raised = (u0: number, u1: number, top: number, col: any, st: number = 14) => { band(u0, u1, top, col, st); kerb(u0, 0.1, top, COL.curb); kerb(u1, 0.1, top, COL.curb); };
      const L = R.L, sw = R.side, bw = L.bw, pair = R.w === 2, h = T / 2;
      band(-h, h, 0.16, asphC, SURF);
      const dashLine = (u: number, col?: any) => band(u - 0.07, u + 0.07, mk, col || COL.white, 14, true);
      const solid = (u: number, col?: any) => band(u - 0.07, u + 0.07, mk, col || COL.white);
      // outer sidewalks (both sides for single strips)
      for (const sd of pair ? [1] : [1, -1]) {
        const o = sd > 0 ? h - sw : -h, e = o + sw;
        if (sw > 0) {
          if (R.grp === 'highway') { band(o, e, 0.2, '#6b6b66'); raised(sd > 0 ? h - 0.35 : -h + 0.1, sd > 0 ? h - 0.1 : -h + 0.35, 0.9, COL.barrier); }
          else raised(o, e, 0.32, COL.walk, WALK);
        }
        if (bw > 0) {
          const b0 = sd > 0 ? h - sw - bw : -h + sw, b1 = b0 + bw;
          band(b0, b1, mk - 0.01, COL.bike, ASPH);
          if (R.bike === 2) raised(sd > 0 ? b0 : b1 - 0.35, sd > 0 ? b0 + 0.35 : b1, 0.3, COL.walk, WALK);
          else solid(sd > 0 ? b0 + 0.02 : b1 - 0.02);
        }
      }
      if (pair) {
        const m1 = -h + L.med;
        if (R.med === 'paint') band(-h, -h + 0.14, mk, COL.yellow);
        else if (R.med === 'barrier') raised(-h, -h + Math.max(0.3, L.med), 0.95, COL.barrier);
        else if (R.med === 'curb') raised(-h, m1, 0.3, COL.walk, WALK);
        else raised(-h, m1, 0.3, '#5d8c3c', 14 + M8.lawn);
        for (let j = 0; j < L.fwd.length - 1; j++) dashLine((L.fwd[j] + L.fwd[j + 1]) / 2);
        if (R.grp !== 'highway' && L.fwd.length) solid(h - sw - bw - 0.1);
        if (R.tram) for (const o of L.fwd.slice(-1)) for (const r2 of [-0.72, 0.72]) band(o + r2 - 0.06, o + r2 + 0.06, mk + 0.02, COL.rail);
      } else if (R.surf !== 'dirt') {
        if (R.oneway) for (let j = 0; j < L.fwd.length - 1; j++) dashLine((L.fwd[j] + L.fwd[j + 1]) / 2);
        else {
          const mx = L.medX - h;
          if (R.med === 'curb') raised(mx - L.med / 2, mx + L.med / 2, 0.3, COL.walk, WALK);
          else if (R.grp === 'highway') dashLine(mx);
          else { band(mx - 0.2, mx - 0.07, mk, COL.yellow); band(mx + 0.07, mx + 0.2, mk, COL.yellow); }
          for (let j = 0; j < L.fwd.length - 1; j++) dashLine((L.fwd[j] + L.fwd[j + 1]) / 2);
          for (let j = 0; j < L.back.length - 1; j++) dashLine(-(L.back[j] + L.back[j + 1]) / 2);
          if (R.tram) for (const o of [L.fwd[0], -L.back[0]]) for (const r2 of [-0.72, 0.72]) band(o + r2 - 0.06, o + r2 + 0.06, mk + 0.02, COL.rail);
        }
      }
    }
    function tramRails(f, u) { for (const o of [-0.72, 0.72]) fq(f, u + o - 0.06, 0, u + o + 0.06, T, mk + 0.02, COL.rail); }
    function flowArrow(f, u, v) {
      fq(f, u - 0.12, v, u + 0.12, v + 1.6, mk, COL.white);
      const a = FU(f, u - 0.55, v + 1.6), b = FU(f, u + 0.55, v + 1.6), c = FU(f, u, v + 2.5);
      gb.tri(P(a[0], mk, a[1]), P(b[0], mk, b[1]), P(c[0], mk, c[1]), COL.white, 14);
      gb.tri(P(b[0], mk, b[1]), P(a[0], mk, a[1]), P(c[0], mk, c[1]), COL.white, 14);
    }
    function approachMarks(ap) {
      const f = ap.d, lanes = Wd.lanesToward(i, f);
      const cl = Wd.clusters[ap.cl], cfg = cl.cfg, masks = cfg.lanes[ap.key] || [];
      // stop line
      const L = R.L, uR = T - R.side - L.bw, uL = R.w === 2 ? L.med : (R.oneway ? R.side + L.bw : L.medX);
      fq(f, Math.min(uL, uR), 9.0, Math.max(uL, uR), 9.45, mk + 0.01, COL.white);
      for (let k = 0; k < lanes.length; k++) {
        const u = T / 2 + lanes[k], mm = masks[k] || 0, v0 = 5.4, v1 = 7.4;
        const W2 = (a0, b0, a1, b1) => fq(f, a0, b0, a1, b1, mk + 0.01, COL.white);
        const tri = (pa, pb, pc) => { const A = FU(f, pa[0], pa[1]), B = FU(f, pb[0], pb[1]), Cc = FU(f, pc[0], pc[1]); gb.tri(P(A[0], mk + 0.01, A[1]), P(B[0], mk + 0.01, B[1]), P(Cc[0], mk + 0.01, Cc[1]), COL.white, 14); gb.tri(P(B[0], mk + 0.01, B[1]), P(A[0], mk + 0.01, A[1]), P(Cc[0], mk + 0.01, Cc[1]), COL.white, 14); };
        W2(u - 0.09, v0, u + 0.09, v1);
        if (mm & 1) { W2(u - 0.09, v1, u + 0.09, 8.0); tri([u - 0.42, 8.0], [u + 0.42, 8.0], [u, 8.7]); }
        if (mm & 2) { W2(u, v1 - 0.18, u + 0.75, v1); tri([u + 0.75, v1 - 0.45], [u + 0.75, v1 + 0.27], [u + 1.25, v1 - 0.09]); }
        if (mm & 4) { W2(u - 0.75, v1 - 0.18, u, v1); tri([u - 0.75, v1 - 0.45], [u - 0.75, v1 + 0.27], [u - 1.25, v1 - 0.09]); }
        if (mm & 8) { W2(u - 0.6, v1 - 0.18, u, v1); W2(u - 0.69, v0 + 0.4, u - 0.51, v1); }
      }
      // signal pole / stop sign at the right-hand corner
      const pc = FU(f, T - 0.45, 9.4), px = X0 + pc[0], pz = Z0 + pc[1], py = base(pc[0], pc[1]) + 0.3;
      const fx = -C.DX[f], fz = -C.DY[f], sx = -fz, sz = fx; // a: towards approaching drivers, s: sideways
      const B = (c: any, a0: number, a1: number, s0: number, s1: number, y0: number, y1: number, col: any, st: number = 0) => {
        const xA = c[0] + fx * a0 + sx * s0, zA = c[2] + fz * a0 + sz * s0, xB = c[0] + fx * a1 + sx * s1, zB = c[2] + fz * a1 + sz * s1;
        gb.box(Math.min(xA, xB), y0, Math.min(zA, zB), Math.max(xA, xB), y1, Math.max(zA, zB), col, st);
      };
      // flat polygon sign facing the drivers: n corners, radius rad, centred at height y on point c (offset a)
      const sign = (c: any, a: number, y: number, rad: number, n: number, col: any, st: number = 0, rot: number = 0) => {
        const P2 = (k: number) => { const t = (k + (rot || 0)) / n * Math.PI * 2; return [c[0] + fx * a + sx * Math.cos(t) * rad, y + Math.sin(t) * rad, c[2] + fz * a + sz * Math.cos(t) * rad]; };
        const ctr = [c[0] + fx * a, y, c[2] + fz * a], back = [c[0] + fx * (a - 0.03), y, c[2] + fz * (a - 0.03)];
        for (let k = 0; k < n; k++) {
          const p0 = P2(k), p1 = P2(k + 1);
          gb.tri(ctr, p0, p1, col, st); gb.tri(ctr, p1, p0, col, st);
          gb.tri(back, [p0[0] - fx * 0.03, p0[1], p0[2] - fz * 0.03], [p1[0] - fx * 0.03, p1[1], p1[2] - fz * 0.03], '#9a9a96'); gb.tri(back, [p1[0] - fx * 0.03, p1[1], p1[2] - fz * 0.03], [p0[0] - fx * 0.03, p0[1], p0[2] - fz * 0.03], '#9a9a96');
        }
      };
      const pole = [px, py, pz];
      if (cl.ctrl === 'lights') {
        const hp = M.signalPos(ap), top = hp[1] + 1.25;
        gb.box(px - 0.32, py - 0.1, pz - 0.32, px + 0.32, py + 0.35, pz + 0.32, '#9a978f', M8.concrete);
        gb.cyl(px, py + 0.35, pz, 0.15, top - py - 0.2, 10, '#4a4f55', 0, '#4a4f55', 0.11);
        gb.cyl(px, top - 0.1, pz, 0.13, 0.3, 10, '#4a4f55', 0, '#4a4f55');
        // tapered mast arm out over the lanes, with a brace
        const ax0 = Math.min(px, hp[0]), ax1 = Math.max(px, hp[0]), az0 = Math.min(pz, hp[2]), az1 = Math.max(pz, hp[2]);
        gb.box(ax0 - 0.07, top - 0.06, az0 - 0.07, ax1 + 0.07, top + 0.1, az1 + 0.07, '#4a4f55');
        const mx = px + (hp[0] - px) * 0.45, mz = pz + (hp[2] - pz) * 0.45;
        gb.quad([px, top - 1.0, pz], [mx, top - 0.04, mz], [mx, top + 0.0, mz], [px, top - 0.94, pz], '#4a4f55');
        gb.quad([px, top - 0.94, pz], [mx, top + 0.0, mz], [mx, top - 0.04, mz], [px, top - 1.0, pz], '#4a4f55');
        // street name sign on the arm
        const sgx = px + (hp[0] - px) * 0.28, sgz = pz + (hp[2] - pz) * 0.28;
        B([sgx, 0, sgz], -0.02, 0.02, -0.75, 0.75, top - 0.5, top - 0.1, '#2b6e3c'); B([sgx, 0, sgz], 0.02, 0.025, -0.6, 0.6, top - 0.34, top - 0.26, '#e8ece4');
        // signal head: housing, yellow-rimmed backplate, visors, dark lenses (the lit lamp is instanced)
        gb.box(hp[0] - 0.04, hp[1] + 0.85, hp[2] - 0.04, hp[0] + 0.04, top, hp[2] + 0.04, '#2a2d31');
        B(hp, -0.18, 0.18, -0.22, 0.22, hp[1] - 0.85, hp[1] + 0.85, '#1b1e22');
        B(hp, -0.27, -0.25, -0.47, 0.47, hp[1] - 1.02, hp[1] + 1.02, '#e3bd1c');
        B(hp, -0.25, -0.2, -0.42, 0.42, hp[1] - 0.97, hp[1] + 0.97, '#141618');
        for (const ly of [hp[1] + 0.55, hp[1], hp[1] - 0.55]) {
          B(hp, 0.18, 0.2, -0.16, 0.16, ly - 0.16, ly + 0.16, '#2a2c2f', 17);
          B(hp, 0.18, 0.48, -0.2, 0.2, ly + 0.19, ly + 0.23, '#1b1e22');
          B(hp, 0.18, 0.4, -0.2, -0.17, ly - 0.05, ly + 0.23, '#1b1e22'); B(hp, 0.18, 0.4, 0.17, 0.2, ly - 0.05, ly + 0.23, '#1b1e22');
        }
        // pedestrian signal on the pole
        B(pole, 0.15, 0.45, -0.17, 0.17, py + 2.2, py + 2.75, '#1b1e22'); B(pole, 0.45, 0.47, -0.12, 0.12, py + 2.3, py + 2.65, '#ff7a1a', 5);
      } else if ((cl.ctrl === 'stop' || cl.ctrl === 'allstop') && Traffic.isStopFor(cl, ap.key)) {
        gb.cyl(px, py, pz, 0.045, 2.6, 6, '#9a9a96');
        sign(pole, 0.06, py + 2.45, 0.42, 8, '#ffffff', 5, 0.5);
        sign(pole, 0.075, py + 2.45, 0.37, 8, '#c8231c', 5, 0.5);
        B(pole, 0.08, 0.085, -0.22, 0.22, py + 2.41, py + 2.49, '#ffffff', 5);
      } else if (cl.ctrl === 'round') {
        gb.cyl(px, py, pz, 0.045, 2.5, 6, '#9a9a96');
        sign(pole, 0.06, py + 2.3, 0.36, 16, '#ffffff', 5);
        sign(pole, 0.075, py + 2.3, 0.32, 16, '#2a66c8', 5);
        B(pole, 0.08, 0.085, -0.16, 0.16, py + 2.27, py + 2.33, '#ffffff', 5);
      }
    }
    function addBridge() {
      if (!bridge) return;
      const y0 = Wd.BRIDGE_H;
      gb.box(X0, y0 - 1.3, Z0, X0 + T, y0 + 0.1, Z0 + T, COL.deck, 0, { skip: 16, bottom: true });
      const g = Math.min(Wd.groundH(X0 + 5, Z0 + 5), -0.5);
      if ((x + y) % 2 === 0) gb.box(X0 + 4.1, g - 1, Z0 + 4.1, X0 + 5.9, y0 - 1.3, Z0 + 5.9, COL.deck);
    }
  }
  M.genRoadTile = (gb, i) => genRoadTile(gb, i);
  // half-tile paths: a paved ribbon through each cell, joined to neighbouring cells and to road sidewalks
  function genPathTile(gb, i) {
    const Wd = World, FW = C.FW, H = T / 2;
    for (let q = 0; q < 4; q++) {
      const f = Wd.cellOf(i, q), k = Wd.pcell[f]; if (!k) continue;
      const P = C.PATHS[k], fx = f % FW, fy = (f / FW) | 0;
      const shared = k === 3;
      const x0 = fx * H, z0 = fy * H, cx = x0 + H / 2, cz = z0 + H / 2, w = shared ? 1.85 : k === 2 ? 1.25 : 1.05;
      const y = (lx, lz) => Math.max(Wd.groundH(lx, lz), C.WATER + 0.3) + 0.2;
      const pst = k >= 2 ? 14 + M8.asph : 14 + M8.paving;
      const quad = (ax: number, az: number, bx: number, bz: number, col: any, dy: number = 0) => gb.quad([ax, y(ax, bz) + (dy || 0), bz], [bx, y(bx, bz) + (dy || 0), bz], [bx, y(bx, az) + (dy || 0), az], [ax, y(ax, az) + (dy || 0), az], col, col === COL.white || col === COL.yellow ? 14 : pst);
      quad(cx - w, cz - w, cx + w, cz + w, P.col);
      for (let d = 0; d < 4; d++) {
        const nx = fx + C.DX[d], ny = fy + C.DY[d];
        if (nx < 0 || ny < 0 || nx >= FW || ny >= FW) continue;
        const nf = ny * FW + nx, nt = U.idx(nx >> 1, ny >> 1);
        const toRoad = nt !== i && Wd.walkRoad(nt);
        if (!Wd.pcell[nf] && !toRoad) continue;
        if (d === 0) quad(cx - w, z0, cx + w, cz, P.col); else if (d === 2) quad(cx - w, cz, cx + w, z0 + H, P.col);
        else if (d === 1) quad(cx, cz - w, x0 + H, cz + w, P.col); else quad(x0, cz - w, cx, cz + w, P.col);
        if (shared) { // dashed yellow centre line: walkers keep to one side, bikes to the other
          for (let t = 0; t < 2; t++) {
            const a = 0.35 + t * 1.25, b = a + 0.75;
            if (d === 0) quad(cx - 0.07, cz - b, cx + 0.07, cz - a, COL.yellow, 0.01); else if (d === 2) quad(cx - 0.07, cz + a, cx + 0.07, cz + b, COL.yellow, 0.01);
            else if (d === 1) quad(cx + a, cz - 0.07, cx + b, cz + 0.07, COL.yellow, 0.01); else quad(cx - b, cz - 0.07, cx - a, cz + 0.07, COL.yellow, 0.01);
          }
        }
        if (k === 2) { if (d % 2 === 0) quad(cx - 0.06, d === 0 ? z0 + 0.6 : cz + 0.6, cx + 0.06, d === 0 ? cz - 0.6 : z0 + H - 0.6, COL.white, 0.01); else quad(d === 3 ? x0 + 0.6 : cx + 0.6, cz - 0.06, d === 3 ? cx - 0.6 : x0 + H - 0.6, cz + 0.06, COL.white, 0.01); }
      }
    }
  }
  // world position of the signal head for a junction approach
  M.signalPos = function (ap) {
    const Wd = World, i = ap.tile, f = ap.d;
    const FU = (u, v) => f === 0 ? [u, T - v] : f === 1 ? [v, u] : f === 2 ? [T - u, v] : [T - v, T - u];
    const ln = Wd.lanesToward(i, f), mid = ln.length ? (ln[0] + ln[ln.length - 1]) / 2 : 1.5;
    const p = FU(T / 2 + mid, 9.4), x = U.tx(i) * T + p[0], z = U.ty(i) * T + p[1];
    return [x, Wd.roadH(x, z) + 5.2, z];
  };
  // the lit lamp sits on the face of the housing pointing at oncoming drivers
  M.signalLampPos = function (ap) {
    const p = M.signalPos(ap);
    return [p[0] - C.DX[ap.d] * 0.21, p[1], p[2] - C.DY[ap.d] * 0.21];
  };
  M.junctionsChanged = function () {
    const Wd = World;
    const old = M.apInfo || new Map();
    M.apInfo = new Map();
    for (const cl of Wd.clusters) for (const ap of cl.aps) {
      ap.cl = cl.id;
      if (!M.apInfo.has(ap.tile)) M.apInfo.set(ap.tile, []);
      M.apInfo.get(ap.tile).push(ap);
    }
    for (const t of new Set([...old.keys(), ...M.apInfo.keys()])) M.markInfra(t);
    for (const cl of Wd.clusters) for (const t of cl.tiles) M.markInfra(t);
  };

  function genRailTile(gb, i) {
    const Wd = World;
    const x = U.tx(i), y = U.ty(i), m = Wd.railMask(i);
    const X0 = x * T, Z0 = y * T;
    if (Wd.rail[i] !== 1) return;
    const D = (lx, lz) => Wd.deckH(X0 + lx, Z0 + lz);
    const P = (lx, dy, lz) => [X0 + lx, D(lx, lz) + dy, Z0 + lz];
    const slab = (x0: number, z0: number, x1: number, z1: number, lo: number, top: number, col: any, side?: any) => {
      gb.quad(P(x0, top, z1), P(x1, top, z1), P(x1, top, z0), P(x0, top, z0), col);
      const sc = side || col;
      gb.quad(P(x1, lo, z0), P(x0, lo, z0), P(x0, top, z0), P(x1, top, z0), sc);
      gb.quad(P(x0, lo, z1), P(x1, lo, z1), P(x1, top, z1), P(x0, top, z1), sc);
      gb.quad(P(x0, lo, z0), P(x0, lo, z1), P(x0, top, z1), P(x0, top, z0), sc);
      gb.quad(P(x1, lo, z1), P(x1, lo, z0), P(x1, top, z0), P(x1, top, z1), sc);
      if (lo < 0) gb.quad(P(x0, lo, z0), P(x1, lo, z0), P(x1, lo, z1), P(x0, lo, z1), sc);
    };
    const a = 1.2, bb = T - 1.2;
    const con = d => (m & (1 << d)) !== 0;
    slab(a, a, bb, bb, -1.1, 0, COL.deck);
    if (con(0)) slab(a, 0, bb, a, -1.1, 0, COL.deck);
    if (con(2)) slab(a, bb, bb, T, -1.1, 0, COL.deck);
    if (con(1)) slab(bb, a, T, bb, -1.1, 0, COL.deck);
    if (con(3)) slab(0, a, a, bb, -1.1, 0, COL.deck);
    // tracks
    const c = T / 2;
    const arms = [];
    for (let d = 0; d < 4; d++) if (con(d)) arms.push(d);
    if (!arms.length) arms.push(0, 2);
    for (const d of arms) {
      for (const o of [-1.75, 1.75]) {
        for (const ro of [-0.72, 0.72]) {
          const q = o + ro;
          if (d === 0) slab(c + q - 0.07, 0, c + q + 0.07, c + 0.9, 0, 0.32, COL.rail);
          else if (d === 2) slab(c + q - 0.07, c - 0.9, c + q + 0.07, T, 0, 0.32, COL.rail);
          else if (d === 1) slab(c - 0.9, c + q - 0.07, T, c + q + 0.07, 0, 0.32, COL.rail);
          else slab(0, c + q - 0.07, c + 0.9, c + q + 0.07, 0, 0.32, COL.rail);
        }
        const q = o;
        if (d === 0) gb.quad(P(c + q - 1.2, 0.08, c + 1.2), P(c + q + 1.2, 0.08, c + 1.2), P(c + q + 1.2, 0.08, 0), P(c + q - 1.2, 0.08, 0), COL.ballast);
        else if (d === 2) gb.quad(P(c + q - 1.2, 0.08, T), P(c + q + 1.2, 0.08, T), P(c + q + 1.2, 0.08, c - 1.2), P(c + q - 1.2, 0.08, c - 1.2), COL.ballast);
        else if (d === 1) gb.quad(P(c - 1.2, 0.08, c + q + 1.2), P(T, 0.08, c + q + 1.2), P(T, 0.08, c + q - 1.2), P(c - 1.2, 0.08, c + q - 1.2), COL.ballast);
        else gb.quad(P(0, 0.08, c + q + 1.2), P(c + 1.2, 0.08, c + q + 1.2), P(c + 1.2, 0.08, c + q - 1.2), P(0, 0.08, c + q - 1.2), COL.ballast);
      }
    }
    // parapets on open sides
    if (!con(0)) slab(a, a, bb, a + 0.25, 0, 0.8, COL.deck);
    if (!con(2)) slab(a, bb - 0.25, bb, bb, 0, 0.8, COL.deck);
    if (!con(1)) slab(bb - 0.25, a, bb, bb, 0, 0.8, COL.deck);
    if (!con(3)) slab(a, a, a + 0.25, bb, 0, 0.8, COL.deck);
    // pillar
    if (!Wd.road[i]) {
      const g = Wd.groundH(X0 + c, Z0 + c) - 1;
      const top = D(c, c) - 1.1;
      gb.box(X0 + c - 0.8, g, Z0 + c - 0.8, X0 + c + 0.8, top, Z0 + c + 0.8, '#9d9a92');
      gb.box(X0 + c - 1.6, top - 0.8, Z0 + c - 1.6, X0 + c + 1.6, top, Z0 + c + 1.6, '#9d9a92');
    }
  }

  function genStop(gb, stop) {
    const Wd = World;
    const i = stop.tile, x = U.tx(i), y = U.ty(i), X0 = x * T, Z0 = y * T;
    if (stop.type === 'bus' || stop.type === 'tram') {
      // shelter on the sidewalk at the kerb side of the tile; local z runs from the tile edge towards the road
      const f = stop.side !== undefined ? stop.side : 2;
      const sw = Wd.road[i] ? Math.max(1.3, C.ROADS[Wd.road[i]].side) : 1.8;
      const o = [[X0, Z0], [X0 + T, Z0], [X0 + T, Z0 + T], [X0, Z0 + T]][f];
      const yb = Wd.roadH(X0 + 5, Z0 + 5) + 0.2;
      gb.frame(o[0], yb, o[1], f);
      const col = stop.color || '#2b8fe0', dk = '#2b3036', z0 = 0.12, z1 = Math.min(1.55, sw - 0.2);
      gb.box(3.0, -0.02, z0, 7.0, 0.03, z1 + 0.1, '#9a9a96', M8.concrete);
      gb.box(3.2, 0.03, z0, 6.8, 2.35, z0 + 0.04, '#fff', 9);                         // back glass
      for (const x of [3.2, 6.8]) { gb.box(x - 0.05, 0, z0, x + 0.05, 2.45, z1, dk); gb.box(x - 0.02, 0.1, z0 + 0.05, x + 0.02, 2.3, z1 - 0.3, '#fff', 9); }
      for (const x of [4.4, 5.6]) gb.box(x - 0.03, 0, z0, x + 0.03, 2.4, z0 + 0.07, dk);
      gb.box(3.2, 1.0, z0, 6.8, 1.06, z0 + 0.07, dk);
      gb.quad([3.0, 2.45, z0 - 0.15], [7.0, 2.45, z0 - 0.15], [7.0, 2.62, z1 + 0.35], [3.0, 2.62, z1 + 0.35], dk);
      gb.quad([7.0, 2.45, z0 - 0.15], [3.0, 2.45, z0 - 0.15], [3.0, 2.62, z1 + 0.35], [7.0, 2.62, z1 + 0.35], dk);
      gb.box(3.4, 2.38, z0 + 0.3, 6.6, 2.44, z0 + 0.5, '#fff', 8);                    // downlight
      gb.box(3.5, 0.42, z0 + 0.05, 6.5, 0.48, z0 + 0.45, '#8a6440', M8.wood);         // bench
      for (const x of [3.7, 6.3]) gb.box(x - 0.04, 0, z0 + 0.1, x + 0.04, 0.44, z0 + 0.4, dk);
      gb.box(2.55, 0.15, z0 + 0.05, 2.95, 2.1, z0 + 0.25, dk); gb.box(2.6, 0.3, z0 + 0.02, 2.9, 1.95, z0 + 0.28, '#f2f6ff', 5); // lit advert
      // stop sign with the line colour and a timetable
      gb.cyl(7.7, 0, z1 - 0.1, 0.05, 2.9, 6, '#6a6e72');
      gb.box(7.4, 2.4, z1 - 0.13, 8.0, 3.05, z1 - 0.07, col, 5);
      gb.box(7.55, 2.62, z1 - 0.15, 7.85, 2.88, z1 - 0.13, '#ffffff', 5);
      gb.box(7.55, 1.2, z1 - 0.16, 7.85, 1.7, z1 - 0.04, '#f2f2ec');
      gb.cyl(2.2, 0, z1 - 0.2, 0.22, 0.8, 8, '#2f4a3a', 0, '#1c1d20');
      // kerb paint and lettering in the lane
      const ly = -0.12, lz = sw + 0.15;
      for (let x = 0.6; x < 9.4; x += 1.2) gb.box(x, ly, lz - 0.08, x + 0.7, ly + 0.01, lz + 0.08, '#e3c23a');
      gb.box(0.4, ly, sw - 0.02, 9.6, ly + 0.25, sw + 0.03, '#e3c23a');
      const wl = stop.type === 'tram' ? 1 : 3, lx = 5 - wl * 0.45;
      for (let k = 0; k < wl; k++) gb.box(lx + k * 0.9, ly, lz + 0.9, lx + k * 0.9 + 0.6, ly + 0.012, lz + 2.0, '#e8e8e0');
      gb.frame(0, 0, 0, 0);
    } else {
      if (Wd.rail[i] === 1) {
        const m = Wd.railMask(i);
        const nsDir = (m & 5) || !(m & 10);
        const D = Wd.deckH(X0 + 5, Z0 + 5);
        gb.frame(X0, D, Z0, nsDir ? 0 : 1);
        if (!nsDir) gb.frame(X0 + T, D, Z0, 1);
        gb.box(-1.2, -1.1, 0, 1.2, 1.0, T, '#c8c4bb');
        gb.box(T - 1.2, -1.1, 0, T + 1.2, 1.0, T, '#c8c4bb');
        for (const xx of [-0.6, T + 0.6]) for (const zz of [1, T - 1]) gb.box(xx - 0.12, 1.0, zz - 0.12, xx + 0.12, 4.4, zz + 0.12, '#666');
        gb.box(-1.6, 4.4, -0.2, T + 1.6, 4.7, T + 0.2, '#e8e4dc', 0, { top: '#3d6b9a' });
        gb.box(-1.25, 1.0, 4.2, -1.15, 1.9, 5.8, stop.color || '#e85d2a', 5);
        // stair tower to the ground
        const g = Wd.groundH(X0 + 5, Z0 + 5);
        gb.box(-4.5, g - D - 0.5, 3, -1.2, 1.0, 7, '#bdb8ae', 3, { vb: g - D });
        gb.frame(0, 0, 0, 0);
      } else {
        const yb = Wd.road[i] ? Wd.roadH(X0 + 1, Z0 + 1) + 0.2 : Wd.groundH(X0 + 5, Z0 + 5);
        const ox = Wd.road[i] ? 0.2 : 3.5, oz = Wd.road[i] ? 0.2 : 3.5;
        gb.frame(X0 + ox, yb, Z0 + oz, 0);
        const s = Wd.road[i] ? 1.6 : 3;
        gb.box(0, 0, 0, s, 2.6, s, '#c9d1d6', 3);
        gb.box(-0.15, 2.6, -0.15, s + 0.15, 2.9, s + 0.15, '#2b3036');
        gb.box(s * 0.5 - 0.4, 2.9, s * 0.5 - 0.4, s * 0.5 + 0.4, 3.8, s * 0.5 + 0.4, stop.color || '#e85d2a', 5);
        gb.frame(0, 0, 0, 0);
      }
    }
  }

  // ======================================================================
  // Chunks
  // ======================================================================
  const CS = C.CHUNK, CW = Math.ceil(W / CS);
  M.chunks = [];
  M.init = function () {
    const G = Gfx;
    M.root = new THREE.Group(); G.scene.add(M.root);
    for (let cy = 0; cy < CW; cy++) for (let cx = 0; cx < CW; cx++) {
      M.chunks.push({ cx, cy, infra: null, bld: null, infraDirty: true, bldDirty: true, ids: new Set() });
    }
    M.cons = new Map();
    initTrees(); initLamps(); initVehicles(); initGhosts(); initIcons(); initSignals();
    M.lineGroup = new THREE.Group(); G.scene.add(M.lineGroup);
    M.flowGroup = new THREE.Group(); G.scene.add(M.flowGroup);
    M.junctionsChanged();
    Traffic.setColors(['#2f86c9', '#d9473c', '#2b2b30', '#e3a02b', '#3aa36a', '#eeeeee'].map(lc), ['#d9473c', '#2f86c9', '#e3a02b', '#3aa36a', '#8c4fc0', '#f2f2f2', '#2b2b30', '#c45a1c'].map(lc));
  };
  M.chunkAt = (x, y) => M.chunks[Math.floor(y / CS) * CW + Math.floor(x / CS)];
  M.markInfra = function (i) {
    const x = U.tx(i), y = U.ty(i);
    for (let d = -1; d <= 1; d++) for (let e = -1; e <= 1; e++) {
      const nx = x + d, ny = y + e;
      if (U.inWorld(nx, ny)) M.chunkAt(nx, ny).infraDirty = true;
    }
    M.lampsDirty = true;
  };
  M.chunkOfB = b => M.chunkAt(b.x + (b.fw >> 1), b.y + (b.fh >> 1));
  M.addBuilding = function (b) {
    if (b.state === 'build') { addCons(b); return; }
    const ch = M.chunkOfB(b); ch.ids.add(b.id); ch.bldDirty = true;
  };
  M.removeBuilding = function (b) {
    removeCons(b.id);
    const ch = M.chunkOfB(b); if (ch.ids.delete(b.id)) ch.bldDirty = true;
  };
  M.refreshBuilding = function (b) { M.removeBuilding(b); M.addBuilding(b); };

  // ---- construction sites: fence, scaffolding that climbs with the building, a slewing tower crane ----
  M.sites = new Map();
  function siteMesh(gb) { const m = new THREE.Mesh(gb.geometry(), Gfx.mats.city); m.castShadow = true; m.receiveShadow = true; return m; }
  function createSite(b: any, kind: any, dur?: number) {
    removeSite(b.id);
    const G = Gfx, X0 = b.x * T, Z0 = b.y * T, X1 = (b.x + b.fw) * T, Z1 = (b.y + b.fh) * T, y0 = b.baseY;
    const H = Math.max(4, M.buildingHeight(b)), group = new THREE.Group();
    // fence and site cabin (static)
    const gf = new GB();
    const panel = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 2.5)); for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, xa = ax + (bx - ax) * t0, za = az + (bz - az) * t0, xb = ax + (bx - ax) * t1, zb = az + (bz - az) * t1; gf.box(Math.min(xa, xb) - 0.03, y0, Math.min(za, zb) - 0.03, Math.max(xa, xb) + 0.03, y0 + 1.9, Math.max(za, zb) + 0.03, k % 2 ? '#e8e4d8' : '#d8d4c4'); gf.box(xa - 0.06, y0, za - 0.06, xa + 0.06, y0 + 2.0, za + 0.06, '#5a5e64'); } };
    if (kind === 'build') { panel(X0 + 0.3, Z0 + 0.3, X1 - 0.3, Z0 + 0.3); panel(X1 - 0.3, Z0 + 0.3, X1 - 0.3, Z1 - 0.3); panel(X1 - 0.3, Z1 - 0.3, X0 + 0.3, Z1 - 0.3); panel(X0 + 0.3, Z1 - 0.3, X0 + 0.3, Z0 + 0.3); }
    gf.box(X0 + 0.8, y0, Z1 - 3.2, X0 + 3.4, y0 + 2.5, Z1 - 0.9, '#e8a21a', M8.metal);
    gf.box(X0 + 0.9, y0 + 1.2, Z1 - 3.25, X0 + 2.2, y0 + 2.0, Z1 - 3.2, '#fff', 9);
    for (let k = 0; k < 3; k++) gf.box(X1 - 2.6 + (k % 2) * 0.9, y0, Z1 - 2.4 + k * 0.5, X1 - 1.6 + (k % 2) * 0.9, y0 + 0.5 + k * 0.1, Z1 - 1.9 + k * 0.5, '#a8875a', M8.wood);
    group.add(siteMesh(gf));
    // scaffolding around the footprint, scaled up as work goes on
    const gs = new GB(), ix0 = X0 + 1.1, ix1 = X1 - 1.1, iz0 = Z0 + 1.1, iz1 = Z1 - 1.1;
    for (let y = 0; y < H; y += 2) for (const [ax, az, bx, bz] of [[ix0, iz0, ix1, iz0], [ix0, iz1, ix1, iz1], [ix0, iz0, ix0, iz1], [ix1, iz0, ix1, iz1]]) gs.box(Math.min(ax, bx) - 0.04, y + 1.95, Math.min(az, bz) - 0.04, Math.max(ax, bx) + 0.04, y + 2.05, Math.max(az, bz) + 0.04, y % 4 ? '#c8a03a' : '#8a6a3a', M8.wood);
    for (let x = ix0; x <= ix1 + 0.01; x += 2.5) for (const z of [iz0, iz1]) gs.box(x - 0.04, 0, z - 0.04, x + 0.04, H + 1, z + 0.04, '#9aa0a6');
    for (let z = iz0; z <= iz1 + 0.01; z += 2.5) for (const x of [ix0, ix1]) gs.box(x - 0.04, 0, z - 0.04, x + 0.04, H + 1, z + 0.04, '#9aa0a6');
    gs.box(ix0, H * 0.5, iz0 - 0.02, ix1, H + 1, iz0 + 0.02, '#4a7a9a'); // safety net on the street side
    const scaf = siteMesh(gs); scaf.position.y = y0; group.add(scaf);
    // tower crane for anything big
    let jib = null, hook = null;
    if (H > 7 || b.fw * b.fh >= 4) {
      const cx = X1 - 1.6, cz = Z0 + 1.6, ch = H + 7, gm = new GB();
      gm.box(cx - 0.6, y0, cz - 0.6, cx + 0.6, y0 + 0.6, cz + 0.6, '#8f8d87', M8.concrete);
      for (let y = 0.6; y < ch; y += 1.6) { gm.box(cx - 0.45, y0 + y, cz - 0.45, cx + 0.45, y0 + y + 0.12, cz + 0.45, '#e3b81c'); }
      for (const [dx, dz] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) gm.box(cx + dx - 0.06, y0, cz + dz - 0.06, cx + dx + 0.06, y0 + ch, cz + dz + 0.06, '#e3b81c');
      group.add(siteMesh(gm));
      const gj = new GB(), L = Math.max(14, (b.fw + b.fh) * T * 0.6);
      gj.box(-0.6, 0, -0.6, 0.6, 1.4, 0.6, '#e3b81c'); gj.box(0.4, 0.2, -0.5, 1.4, 1.2, 0.5, '#f2f2f2'); gj.box(1.38, 0.5, -0.4, 1.42, 1.0, 0.4, '#fff', 9);
      gj.box(-0.3, 1.4, -0.3, 0.3, 4.0, 0.3, '#e3b81c');
      gj.box(0, 1.2, -0.35, L, 1.9, 0.35, '#e3b81c'); gj.box(-6, 1.2, -0.35, 0, 1.9, 0.35, '#e3b81c');
      gj.box(-6, 0.2, -0.6, -4.4, 1.2, 0.6, '#8f8d87', M8.concrete);
      for (const sx of [L * 0.5, -5]) gj.quad([0, 4, 0], [sx, 1.9, 0.02], [sx, 1.9, -0.02], [0, 4, 0.02], '#5a5e64'), gj.quad([0, 4, 0.02], [sx, 1.9, -0.02], [sx, 1.9, 0.02], [0, 4, 0], '#5a5e64');
      jib = siteMesh(gj); jib.position.set(cx, y0 + ch, cz); group.add(jib);
      const gc = new GB(); gc.box(-0.025, -1, -0.025, 0.025, 0, 0.025, '#2a2d31');
      const cable = siteMesh(gc); cable.castShadow = false; jib.add(cable);
      const gh = new GB(); gh.box(-0.15, -0.3, -0.15, 0.15, 0, 0.15, '#3a3d42'); gh.box(-0.9, -1.1, -0.9, 0.9, -0.3, 0.9, U.pick(['#a8875a', '#9aa0a6', '#5a7a9a'], Math.random), M8.wood);
      hook = siteMesh(gh); hook.userData.L = L * 0.7; hook.userData.cable = cable; jib.add(hook); hook.position.set(L * 0.7, 1.2, 0);
    }
    G.scene.add(group);
    M.sites.set(b.id, { group, scaf, jib, hook, kind, t0: performance.now(), dur: dur || 0, H, ch: H + 7, phase: Math.random() * 6 });
  }
  function removeSite(id) {
    const s = M.sites.get(id); if (!s) return;
    Gfx.scene.remove(s.group); s.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    M.sites.delete(id);
  }
  // a level up: scaffolding and a crane go up around the building for a little while
  M.upgradeSite = function (b) { if (M.sites.size < 30) createSite(b, 'upgrade', 9000); };
  function addCons(b) {
    const gb = new GB(); M.genBuilding(gb, b);
    const mesh = new THREE.Mesh(gb.geometry(), Gfx.mats.city);
    mesh.castShadow = true; mesh.receiveShadow = true;
    // scale from the base
    mesh.geometry.translate(0, -b.baseY, 0);
    mesh.position.y = b.baseY;
    mesh.scale.y = 0.02;
    Gfx.cityMeshes.add(mesh);
    M.root.add(mesh);
    M.cons.set(b.id, mesh);
    createSite(b, 'build');
  }
  function removeCons(id) {
    const m = M.cons.get(id);
    if (m) { M.root.remove(m); m.geometry.dispose(); Gfx.cityMeshes.delete(m); M.cons.delete(id); }
    const s = M.sites.get(id); if (s && s.kind === 'build') removeSite(id);
  }
  M.updateConstruction = function () {
    const now = performance.now(), t = now / 1000;
    M.cons.forEach((mesh, id) => {
      const b = Sim.buildings.get(id);
      if (!b) return;
      const p = U.clamp(b.st / b.buildT, 0, 1);
      // groundwork first, then the building climbs floor by floor inside the scaffolding
      mesh.scale.y = p < 0.15 ? 0.02 : 0.02 + 0.98 * U.smooth(0.15, 1, p);
      const s = M.sites.get(id); if (s) s.scaf.scale.y = U.clamp(0.08 + p * 1.1, 0.08, 1);
    });
    M.sites.forEach((s, id) => {
      if (!Sim.buildings.has(id)) { removeSite(id); return; }
      if (s.kind === 'upgrade') {
        const k = (now - s.t0) / s.dur;
        if (k >= 1) { removeSite(id); return; }
        s.scaf.scale.y = k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1;
      }
      if (s.jib) {
        s.jib.rotation.y = Math.sin(t * 0.25 + s.phase) * 1.4 + s.phase;
        const L = s.hook.userData.L * (0.55 + 0.45 * Math.sin(t * 0.17 + s.phase * 2));
        const drop = 2 + (s.ch - 4) * (0.5 + 0.5 * Math.sin(t * 0.4 + s.phase)) * 0.6, c = s.hook.userData.cable;
        s.hook.position.set(L, 1.2 - drop, 0);
        c.position.set(L, 1.2, 0); c.scale.y = drop;
      }
    });
  };

  function setChunkMesh(ch, key, gb, shadow) {
    const G = Gfx;
    const old = ch[key];
    if (old) { M.root.remove(old); old.geometry.dispose(); G.cityMeshes.delete(old); ch[key] = null; }
    if (gb.count === 0) return;
    const mesh = new THREE.Mesh(gb.geometry(), G.mats.city);
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    G.cityMeshes.add(mesh);
    M.root.add(mesh);
    ch[key] = mesh;
  }
  function buildInfra(ch) {
    const Wd = World, gb = new GB();
    const x0 = ch.cx * CS, y0 = ch.cy * CS;
    let elev = false;
    for (let y = y0; y < Math.min(W, y0 + CS); y++) for (let x = x0; x < Math.min(W, x0 + CS); x++) {
      const i = U.idx(x, y);
      if (Wd.road[i]) genRoadTile(gb, i);
      if (Wd.pmask[i]) genPathTile(gb, i);
      if (Wd.rail[i] === 1) { genRailTile(gb, i); elev = true; }
    }
    if (Transit) for (const s of Transit.stops) {
      const sx = U.tx(s.tile), sy = U.ty(s.tile);
      if (sx >= x0 && sx < x0 + CS && sy >= y0 && sy < y0 + CS) { genStop(gb, s); elev = true; }
    }
    setChunkMesh(ch, 'infra', gb, elev);
  }
  function buildBld(ch) {
    const gb = new GB();
    const S = Sim;
    ch.ids.forEach(id => { const b = S.buildings.get(id); if (b && b.state !== 'build') M.genBuilding(gb, b); else ch.ids.delete(id); });
    setChunkMesh(ch, 'bld', gb, true);
  }
  M.update = function (budgetMs) {
    const t0 = performance.now();
    for (const ch of M.chunks) {
      if (ch.infraDirty) { ch.infraDirty = false; buildInfra(ch); }
      if (ch.bldDirty) { ch.bldDirty = false; buildBld(ch); }
      if (performance.now() - t0 > budgetMs) break;
    }
    if (M.treesDirty && performance.now() - (M.treesT || 0) > 400) { M.treesT = performance.now(); M.treesDirty = false; rebuildTrees(); }
    if (M.lampsDirty) { M.lampsDirty = false; rebuildLamps(); }
    M.updateConstruction();
  };
  // flow arrows while previewing a road drag
  M.setFlowArrows = function (strips, rt) {
    const g = M.flowGroup; if (!g) return;
    while (g.children.length) { const c = g.children.pop(); c.geometry.dispose(); }
    if (!strips) return;
    const R = C.ROADS[rt]; if (!R.oneway && R.w !== 2 && R.fwd === R.back) return;
    const Wd = World, gb = new GB();
    for (const st of strips) for (let k = 0; k < st.tiles.length; k += 2) {
      const i = st.tiles[k], d = st.dirs[k], cx = (U.tx(i) + 0.5) * T, cz = (U.ty(i) + 0.5) * T, y = Wd.roadH(cx, cz) + 1.2;
      const fx = C.DX[d], fz = C.DY[d], rx = -fz, rz = fx;
      gb.tri([cx + fx * 3, y, cz + fz * 3], [cx - fx * 1.5 + rx * 2, y, cz - fz * 1.5 + rz * 2], [cx - fx * 1.5 - rx * 2, y, cz - fz * 1.5 - rz * 2], '#ffffff');
      gb.tri([cx + fx * 3, y, cz + fz * 3], [cx - fx * 1.5 - rx * 2, y, cz - fz * 1.5 - rz * 2], [cx - fx * 1.5 + rx * 2, y, cz - fz * 1.5 + rz * 2], '#ffffff');
    }
    const mesh = new THREE.Mesh(gb.geometry(), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9, depthTest: false }));
    mesh.renderOrder = 9; g.add(mesh);
  };
  M.rebuildAll = function () {
    M.junctionsChanged();
    for (const ch of M.chunks) { ch.infraDirty = true; ch.bldDirty = true; }
    M.treesDirty = true; M.lampsDirty = true;
  };

  // ======================================================================
  // Trees
  // ======================================================================
  function treeGeom(conifer) {
    const gb = new GB();
    gb.box(-0.22, 0, -0.22, 0.22, 2.0, 0.22, '#5a3d28', 12);
    if (conifer) {
      gb.cone(0, 1.2, 0, 2.0, 3.6, 7, '#ffffff');
      gb.cone(0, 3.0, 0, 1.55, 3.2, 7, '#ffffff');
      gb.cone(0, 4.8, 0, 1.0, 2.8, 7, '#ffffff');
    } else {
      const ico = new THREE.IcosahedronGeometry(2.5, 0);
      gb.addThree(ico, new THREE.Matrix4().makeScale(1, 0.92, 1).setPosition(0, 4.2, 0), '#ffffff');
    }
    return gb.geometry();
  }
  // World trees are split into square regions, each an instanced mesh that is skipped when it is off screen
  // (and its shadows with it). Drawing every tree on the map every frame was most of the GPU load.
  const TREE_REG = 26, TREE_RW = Math.ceil(W / TREE_REG);
  function initTrees() {
    M.trees = []; M.treeGeoms = [treeGeom(true), treeGeom(false)];
    M.treesDirty = true;
  }
  function rebuildTrees() {
    const Wd = World, G = Gfx;
    const dens = G.settings.trees;
    const NR = TREE_RW * TREE_RW;
    const lists = []; for (let r = 0; r < NR * 2; r++) lists.push([]);
    const n2 = U.makeNoise(Wd.seed + 5);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const i = U.idx(x, y);
      const t = Wd.tree[i];
      if (!t || Wd.bld[i] || Wd.road[i] || Wd.pmask[i] === 15 || Wd.rail[i] === 1) continue;
      const play = U.inPlay(x, y);
      let n = t * dens * (play ? 1 : 0.7);
      const base = Math.floor(n); const frac = n - base;
      n = base + (U.hash(x, y, 77) < frac ? 1 : 0);
      const reg = Math.floor(y / TREE_REG) * TREE_RW + Math.floor(x / TREE_REG);
      for (let k = 0; k < Math.min(n, 4); k++) {
        const jx = U.hash(x, y, k * 3 + 1), jz = U.hash(x, y, k * 3 + 2), js = U.hash(x, y, k * 3 + 9);
        const wx = (x + 0.12 + jx * 0.76) * T, wz = (y + 0.12 + jz * 0.76) * T;
        const gy = Wd.groundH(wx, wz);
        if (gy < C.WATER + 0.3) continue;
        const con = (n2(x * 0.06, y * 0.06) + (gy > 18 ? 0.6 : 0) + (js - 0.5) * 0.5) > 0.05;
        lists[reg * 2 + (con ? 0 : 1)].push(wx, gy, wz, 0.75 + js * 0.6, U.hash(x, y, k + 40));
      }
    }
    for (const m of M.trees) { G.scene.remove(m.mesh); G.cityMeshes.delete(m.mesh); m.mesh.dispose(); }
    M.trees = [];
    const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), yAx = new THREE.Vector3(0, 1, 0);
    const conCols = ['#2c5a2f', '#36663a', '#2a4f2c', '#3d6b3a'], decCols = ['#4f7d34', '#5f8c3b', '#6b9440', '#7a9a3a', '#476f30', '#8a9a3e'];
    for (let r = 0; r < NR * 2; r++) {
      const L = lists[r], n = L.length / 5; if (!n) continue;
      const k = r % 2, reg = r >> 1;
      const mesh = new THREE.InstancedMesh(M.treeGeoms[k], G.mats.city, n);
      mesh.frustumCulled = false; mesh.castShadow = G.settings.shadows > 0; mesh.receiveShadow = true;
      const cols = k === 0 ? conCols : decCols;
      const ca = new Float32Array(n * 3);
      for (let j = 0; j < n; j++) {
        const o = j * 5;
        p.set(L[o], L[o + 1] - 0.2, L[o + 2]);
        q.setFromAxisAngle(yAx, L[o + 4] * 6.28);
        const sc = L[o + 3];
        s.set(sc, sc * (0.9 + L[o + 4] * 0.3), sc);
        mat.compose(p, q, s);
        mesh.setMatrixAt(j, mat);
        const c = lc(cols[Math.floor(L[o + 4] * cols.length) % cols.length]);
        ca[j * 3] = c[0]; ca[j * 3 + 1] = c[1]; ca[j * 3 + 2] = c[2];
      }
      mesh.instanceColor = new THREE.InstancedBufferAttribute(ca, 3);
      mesh.instanceMatrix.needsUpdate = true;
      const rx = (reg % TREE_RW + 0.5) * TREE_REG * T, rz = (Math.floor(reg / TREE_RW) + 0.5) * TREE_REG * T;
      let ymax = 0; for (let j = 0; j < n; j++) ymax = Math.max(ymax, L[j * 5 + 1]);
      const sphere = new THREE.Sphere(new THREE.Vector3(rx, ymax / 2, rz), TREE_REG * T * 0.72 + ymax / 2 + 8);
      G.scene.add(mesh); G.cityMeshes.add(mesh);
      M.trees.push({ mesh, sphere });
    }
  }
  // hide tree regions outside the view; far regions also stop casting shadows
  const frus = new THREE.Frustum(), pv = new THREE.Matrix4();
  M.cullTrees = function (cam) {
    if (!M.trees.length) return;
    pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frus.setFromProjectionMatrix(pv);
    const shadows = Gfx.settings.shadows > 0, sd = (Gfx.cam.dist * 2.2 + 300) ** 2;
    for (const t of M.trees) {
      t.mesh.visible = frus.intersectsSphere(t.sphere);
      if (shadows) t.mesh.castShadow = t.mesh.visible && t.sphere.center.distanceToSquared(cam.position) < sd;
    }
  };

  // ======================================================================
  // Street lamps
  // ======================================================================
  function initLamps() {
    const G = Gfx, gb = new GB();
    gb.box(-0.1, 0, -0.1, 0.1, 6.6, 0.1, '#4a4d52');
    gb.box(-0.1, 6.4, -0.08, 1.7, 6.55, 0.08, '#4a4d52');
    gb.box(1.3, 6.25, -0.18, 1.9, 6.42, 0.18, '#fff', 8);
    M.lampGeom = gb.geometry();
    M.lamps = new THREE.InstancedMesh(M.lampGeom, G.mats.city, 16);
    M.lamps.frustumCulled = false; M.lamps.count = 0;
    G.scene.add(M.lamps); G.cityMeshes.add(M.lamps);
  }
  // Street lamps stand at the kerb edge of the sidewalk (never mid-sidewalk), staggered every other tile.
  // Roads with a raised median get a double-armed lamp down the middle instead. Positions come from the same
  // centre-line curve the road is drawn with, so on curved roads the lamps follow the kerb.
  function rebuildLamps() {
    const Wd = World, G = Gfx, h = T / 2;
    const L = [];
    const stopTiles = new Set(Transit ? Transit.stops.map(s => s.tile) : []);
    for (let i = 0; i < W * W; i++) {
      const rt = Wd.road[i]; if (!rt) continue;
      const R = C.ROADS[rt];
      if (R.grp === 'highway' || !R.car || Wd.jcl[i] >= 0) continue;
      const x = U.tx(i), y = U.ty(i);
      const l2 = Wd.links2(i);
      let din, dout;
      if (l2) {
        if ((l2[0] + l2[1]) % 2 === 1 && !Wd.isBent(i)) continue; // plain square corner: no lamp
        dout = l2.includes(Wd.rdir[i]) ? Wd.rdir[i] : l2[1];
        din = ((l2[0] === dout ? l2[1] : l2[0]) + 2) % 4;
      } else { dout = Wd.rdir[i]; din = dout; }
      const Lr = R.L, pair = R.w === 2;
      const medLamp = pair ? Lr.med >= 0.4 : (!R.oneway && Lr.med >= 0.8);
      const kerb = R.side >= 0.8 ? h - R.side + 0.35 : h - 0.25; // right-hand kerb edge, traveller frame
      let us; // lateral offsets (+ = right of travel) and whether the lamp has two arms
      if (medLamp) {
        if (pair) { if (Wd.rdir[i] > 1 || (x + y) % 2) continue; us = [[-h, true]]; } // one lamp per median, on one strip
        else { if ((x + y) % 2) continue; us = [[Lr.medX - h, true]]; }
      } else if (pair) { if ((x + y) % 2) continue; us = [[kerb, false]]; }
      else { if ((x + y) % 2) continue; us = [[(x + y) % 4 === 0 ? kerb : -kerb, false]]; }
      if (stopTiles.has(i)) continue;
      for (const [u, dbl] of us) {
        let px, pz, tx, tz;
        if (l2 && Wd.isBent(i)) {
          const q = Wd.bendSeg(i, din, dout, u, u);
          px = 0.25 * q[0] + 0.5 * q[2] + 0.25 * q[4]; pz = 0.25 * q[1] + 0.5 * q[3] + 0.25 * q[5];
          tx = q[4] - q[0]; tz = q[5] - q[1]; const ln = Math.hypot(tx, tz) || 1; tx /= ln; tz /= ln;
        } else {
          tx = C.DX[dout]; tz = C.DY[dout];
          px = (x + 0.5) * T - tz * u; pz = (y + 0.5) * T + tx * u;
        }
        const rx = -tz, rz = tx; // right of travel
        const yy = Wd.roadH(px, pz) + 0.3;
        const s = u > 0 ? -1 : 1; // arm reaches over the road
        L.push(px, yy, pz, rx * s, rz * s);
        if (dbl) L.push(px, yy, pz, -rx * s, -rz * s);
      }
    }
    const n = L.length / 5;
    if (M.lamps.instanceMatrix.count < n) {
      G.scene.remove(M.lamps); G.cityMeshes.delete(M.lamps); M.lamps.dispose();
      M.lamps = new THREE.InstancedMesh(M.lampGeom, G.mats.city, Math.ceil(n * 1.3) + 32);
      M.lamps.frustumCulled = false; G.scene.add(M.lamps); G.cityMeshes.add(M.lamps);
    }
    const arr = M.lamps.instanceMatrix.array;
    for (let j = 0; j < n; j++) {
      const o = j * 5, dx = L[o + 3], dz = L[o + 4], e = j * 16;
      arr[e] = dx; arr[e + 1] = 0; arr[e + 2] = dz; arr[e + 3] = 0;
      arr[e + 4] = 0; arr[e + 5] = 1; arr[e + 6] = 0; arr[e + 7] = 0;
      arr[e + 8] = -dz; arr[e + 9] = 0; arr[e + 10] = dx; arr[e + 11] = 0;
      arr[e + 12] = L[o]; arr[e + 13] = L[o + 1]; arr[e + 14] = L[o + 2]; arr[e + 15] = 1;
    }
    M.lamps.count = n;
    M.lamps.instanceMatrix.needsUpdate = true;
  }

  function initVehicles() {
    const G = Gfx;
    M.veh = {};
    const cars = G.settings.cars;
    const caps = { car: cars, suv: Math.ceil(cars * 0.6), van: 80, truck: Math.ceil(cars * 0.5), bus: 200, tram: 120, police: 80, ambulance: 60, fire: 60, garbage: 120, train: 600, bike: Math.ceil(cars * 0.7), bike2: Math.ceil(cars * 0.7), ped: Math.ceil(cars * 0.7), ped2: Math.ceil(cars * 0.7), sit: Math.ceil(cars * 0.5), ball: 300 };
    const detail = G.settings.detail;
    for (const k of M.VEH_KINDS) {
      const g = (detail && vehGeomHQ(k)) || vehGeom(k === 'ped2' ? 'ped' : k === 'bike2' ? 'bike' : k);
      const mesh = new THREE.InstancedMesh(g as THREE.BufferGeometry, G.mats.city, (caps as any)[k]);
      mesh.frustumCulled = false;
      mesh.castShadow = G.settings.shadows >= 2048 && !(k.startsWith('ped') || k.startsWith('bike') || k === 'sit' || k === 'ball') || G.settings.shadows >= 4096;
      mesh.receiveShadow = false;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(caps[k] * 3).fill(1), 3);
      mesh.count = 0;
      G.scene.add(mesh); G.cityMeshes.add(mesh);
      M.veh[k] = { mesh, n: 0, cap: caps[k] };
    }
  }
  M.resizeVehicles = function () {
    const G = Gfx;
    for (const k of M.VEH_KINDS) { const v = M.veh[k]; G.scene.remove(v.mesh); G.cityMeshes.delete(v.mesh); v.mesh.geometry.dispose(); v.mesh.dispose(); }
    initVehicles();
  };
  M.beginVehicles = function () { for (const k of M.VEH_KINDS) M.veh[k].n = 0; M.sigN = 0; };
  // traffic light heads (dynamic)
  const SIG_COLS = [lc('#ff2a1a'), lc('#ffb000'), lc('#28e05a')];
  function initSignals() {
    const G = Gfx, gb = new GB();
    gb.addThree(new THREE.IcosahedronGeometry(0.15, 1), new THREE.Matrix4().makeScale(1, 1, 1), '#fff', 15);
    M.sig = new THREE.InstancedMesh(gb.geometry(), G.mats.city, 4000);
    M.sig.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(4000 * 3), 3);
    M.sig.frustumCulled = false; M.sig.count = 0;
    G.scene.add(M.sig); G.cityMeshes.add(M.sig);
    M.sigN = 0;
  }
  M.pushSignal = function (x, y, z, st) {
    if (M.sigN >= 4000) return;
    const j = M.sigN++, a = M.sig.instanceMatrix.array, e = j * 16;
    const yy = y + (st === 2 ? -0.55 : st === 1 ? 0 : 0.55);
    a.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, yy, z, 1], e);
    const c = SIG_COLS[st], ca = M.sig.instanceColor.array;
    ca[j * 3] = c[0]; ca[j * 3 + 1] = c[1]; ca[j * 3 + 2] = c[2];
  };
  M.pushVehicle = function (kind, x, y, z, dx, dz, col, pitch, ws, sc) {
    const v = M.veh[kind]; if (!v || v.n >= v.cap) return false;
    sc = sc || 1; ws = (ws || 1) * sc;
    const j = v.n++;
    const a = v.mesh.instanceMatrix.array, e = j * 16;
    const p = pitch || 0, cp = Math.cos(p), sp = Math.sin(p);
    // forward (dx, sp, dz) with pitch, up approx
    a[e] = dx * cp * sc; a[e + 1] = sp * sc; a[e + 2] = dz * cp * sc; a[e + 3] = 0;
    a[e + 4] = -dx * sp * sc; a[e + 5] = cp * sc; a[e + 6] = -dz * sp * sc; a[e + 7] = 0;
    a[e + 8] = -dz * ws; a[e + 9] = 0; a[e + 10] = dx * ws; a[e + 11] = 0;
    a[e + 12] = x; a[e + 13] = y; a[e + 14] = z; a[e + 15] = 1;
    const c = v.mesh.instanceColor.array;
    if (col) { c[j * 3] = col[0]; c[j * 3 + 1] = col[1]; c[j * 3 + 2] = col[2]; }
    else { c[j * 3] = 1; c[j * 3 + 1] = 1; c[j * 3 + 2] = 1; }
    return true;
  };
  M.endVehicles = function () {
    M.sig.count = M.sigN; if (M.sigN) { M.sig.instanceMatrix.needsUpdate = true; M.sig.instanceColor.needsUpdate = true; }
    for (const k of M.VEH_KINDS) {
      const v = M.veh[k];
      v.mesh.count = v.n;
      if (v.n) { v.mesh.instanceMatrix.needsUpdate = true; v.mesh.instanceColor.needsUpdate = true; }
    }
  };
  M.CAR_COLORS = ['#d8dadc', '#1e2125', '#8c1c1c', '#f2f2f2', '#25467a', '#5d686e', '#9aa0a4', '#3a5a3a', '#b8862f', '#6e2a4a', '#c45a1c', '#2b2b30'].map(lc);

  // ======================================================================
  // Previews / ghosts
  // ======================================================================
  function initGhosts() {
    const G = Gfx;
    const bg = new THREE.BoxGeometry(T * 0.96, 1.2, T * 0.96); bg.translate(0, 0.6, 0);
    M.ghostTiles = new THREE.InstancedMesh(bg, G.mats.ghostInst, 600);
    M.ghostTiles.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(600 * 3), 3);
    M.ghostTiles.frustumCulled = false; M.ghostTiles.count = 0; M.ghostTiles.renderOrder = 5;
    G.scene.add(M.ghostTiles);
    M.ghostBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0x55ccff, transparent: true, opacity: 0.4, depthWrite: false }));
    M.ghostBox.visible = false; M.ghostBox.renderOrder = 5; G.scene.add(M.ghostBox);
    const rg = new THREE.RingGeometry(0.96, 1, 96); rg.rotateX(-Math.PI / 2);
    M.ring = new THREE.Mesh(rg, G.mats.ring); M.ring.visible = false; M.ring.renderOrder = 6; G.scene.add(M.ring);
    const sel = new THREE.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.35, depthWrite: false });
    M.selMat = sel;
    M.selMesh = null;
  }
  M.setGhostTiles = function (list) { // [{i, ok, h}]
    const Wd = World;
    const g = M.ghostTiles, a = g.instanceMatrix.array, c = g.instanceColor.array;
    const n = Math.min(list.length, 600);
    for (let j = 0; j < n; j++) {
      const t = list[j], half = t.f !== undefined;
      const x = half ? ((t.f % C.FW) + 0.5) * T / 2 : (U.tx(t.i) + 0.5) * T, z = half ? (((t.f / C.FW) | 0) + 0.5) * T / 2 : (U.ty(t.i) + 0.5) * T;
      const y = (t.y !== undefined ? t.y : Math.max(Wd.groundH(x, z), C.WATER)) + 0.05;
      const e = j * 16, hs = t.h || 1, sc = half ? 0.5 : 1;
      a.set([sc, 0, 0, 0, 0, hs, 0, 0, 0, 0, sc, 0, x, y, z, 1], e);
      const col = t.col || (t.ok ? [0.3, 0.9, 0.5] : [1, 0.25, 0.2]);
      c[j * 3] = col[0]; c[j * 3 + 1] = col[1]; c[j * 3 + 2] = col[2];
    }
    g.count = n; g.instanceMatrix.needsUpdate = true; g.instanceColor.needsUpdate = true;
  };
  M.setGhostBox = function (x0, z0, x1, z1, y, h, ok) {
    if (x0 === null) { M.ghostBox.visible = false; return; }
    M.ghostBox.visible = true;
    M.ghostBox.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    M.ghostBox.scale.set(x1 - x0, h, z1 - z0);
    M.ghostBox.material.color.set(ok ? 0x55ccff : 0xff4433);
  };
  // live preview of the real model being placed (service buildings, parks, landmarks, stops)
  M.ghost = null; M.ghostKey = '';
  const ghostBad = new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.45, depthWrite: false });
  M.setGhostModel = function (key, build, x, y, z, ok) {
    const G = Gfx;
    if (!key) { if (M.ghost) M.ghost.visible = false; return; }
    if (key !== M.ghostKey || !M.ghost) {
      if (M.ghost) { G.scene.remove(M.ghost); M.ghost.geometry.dispose(); }
      const gb = new GB(); build(gb);
      M.ghost = new THREE.Mesh(gb.geometry(), G.mats.city); M.ghost.renderOrder = 6;
      M.ghost.castShadow = true;
      G.scene.add(M.ghost); M.ghostKey = key;
    }
    M.ghost.visible = true;
    M.ghost.material = ok ? G.mats.city : ghostBad;
    M.ghost.position.set(x, y, z);
  };
  M.setGhostBuilding = function (key, w, d, dir, x0, z0, y, ok) {
    if (key === null) { M.setGhostModel(null); return; }
    const fw = dir % 2 === 0 ? w : d, fh = dir % 2 === 0 ? d : w;
    const sv = C.SERVICES[key];
    M.setGhostModel('b:' + key + ':' + dir, gb => {
      const b = { x: 0, y: 0, w, d, fw, fh, dir, baseY: 0, minY: -0.4, seed: 4242, level: 3, state: 'live', kind: 'svc', svc: key, name: sv ? sv.name : '' };
      M.genBuilding(gb, b);
    }, x0, y, z0, ok);
  };
  M.setGhostStop = function (stop, ok) {
    if (!stop) { M.setGhostModel(null); return; }
    M.setGhostModel('s:' + stop.type + ':' + stop.tile + ':' + stop.side, gb => genStop(gb, stop), 0, 0, 0, ok);
  };
  // dotted construction lines (road curve direction). segs: [[x0, z0, x1, z1], ...] in world units
  let guideKey = '';
  M.setGuide = function (segs) {
    const G = Gfx, Wd = World;
    const key = segs ? segs.map(q => q.map(v => v.toFixed(1)).join(',')).join('|') : '';
    if (key === guideKey) return;
    guideKey = key;
    if (!M.guide) {
      M.guide = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }));
      M.guide.renderOrder = 9; M.guide.frustumCulled = false; G.scene.add(M.guide);
    }
    if (!segs) { M.guide.visible = false; return; }
    const pos = [], D = 1.8, GAP = 1.2, w = 0.32;
    for (const [x0, z0, x1, z1] of segs) {
      const L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.1) continue;
      const ux = (x1 - x0) / L, uz = (z1 - z0) / L, nx = -uz * w, nz = ux * w;
      for (let t = 0; t < L; t += D + GAP) {
        const t1 = Math.min(L, t + D);
        const ax = x0 + ux * t, az = z0 + uz * t, bx = x0 + ux * t1, bz = z0 + uz * t1;
        const ya = Math.max(Wd.groundH(ax, az), C.WATER) + 0.6, yb = Math.max(Wd.groundH(bx, bz), C.WATER) + 0.6;
        pos.push(ax + nx, ya, az + nz, bx + nx, yb, bz + nz, bx - nx, yb, bz - nz, ax + nx, ya, az + nz, bx - nx, yb, bz - nz, ax - nx, ya, az - nz);
      }
    }
    M.guide.geometry.dispose();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    M.guide.geometry = g; M.guide.visible = true;
  };
  M.setRing = function (x, z, r) {
    if (x === null) { M.ring.visible = false; return; }
    M.ring.visible = true;
    M.ring.position.set(x, Math.max(World.groundH(x, z), C.WATER) + 1.5, z);
    M.ring.scale.set(r, 1, r);
  };
  M.setSelection = function (b) {
    const G = Gfx;
    if (M.selMesh) { G.scene.remove(M.selMesh); M.selMesh.geometry.dispose(); M.selMesh = null; }
    if (!b) return;
    const gb = new GB(); M.genBuilding(gb, b);
    const geo = gb.geometry();
    M.selMesh = new THREE.Mesh(geo, M.selMat);
    M.selMesh.renderOrder = 7;
    const cx = (b.x + b.fw / 2) * T, cz = (b.y + b.fh / 2) * T;
    geo.translate(-cx, -b.baseY, -cz);
    M.selMesh.position.set(cx, b.baseY - 0.05, cz);
    M.selMesh.scale.set(1.04, 1.02, 1.04);
    G.scene.add(M.selMesh);
  };

  // ======================================================================
  // Problem icons
  // ======================================================================
  const ICONS = {
    road: ['#e05a3a', 'R'], noconn: ['#e05a3a', '⛔'], garbage: ['#9a7a3a', '🗑'], fire: ['#ff5a1f', '🔥'],
    aband: ['#6a6a6a', '✕'], workers: ['#e0a03a', '👷'], customers: ['#3a8ae0', '$'], sick: ['#d03a3a', '+'], noroad: ['#e05a3a', '⚠'],
  };
  function initIcons() {
    M.iconTex = {};
    for (const k in ICONS) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const g = cv.getContext('2d');
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(32, 34, 28, 0, 7); g.fill();
      g.fillStyle = ICONS[k][0]; g.beginPath(); g.arc(32, 31, 27, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke();
      g.fillStyle = '#fff'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(ICONS[k][1], 32, 33);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      M.iconTex[k] = new THREE.SpriteMaterial({ map: t, sizeAttenuation: false, depthTest: false, transparent: true });
    }
    M.iconPool = [];
  }
  M.setIcons = function (list) {
    const G = Gfx;
    while (M.iconPool.length < list.length) {
      const s = new THREE.Sprite(M.iconTex.road); s.scale.set(0.035, 0.035, 1); s.renderOrder = 20;
      G.scene.add(s); M.iconPool.push(s);
    }
    for (let k = 0; k < M.iconPool.length; k++) {
      const s = M.iconPool[k];
      if (k < list.length) {
        const it = list[k];
        s.visible = true; s.material = M.iconTex[it.type] || M.iconTex.road;
        s.position.set(it.x, it.y, it.z);
      } else s.visible = false;
    }
  };

  // ======================================================================
  // Ribbons (transit lines)
  // ======================================================================
  M.ribbon = function (pts, width, color, closed) {
    // pts: flat [x,y,z,...]
    const n = pts.length / 3; if (n < 2) return null;
    const pos = [], col = [];
    const c = lc(color);
    const P = k => { k = closed ? (k + n) % n : U.clamp(k, 0, n - 1); return [pts[k * 3], pts[k * 3 + 1], pts[k * 3 + 2]]; };
    const cnt = closed ? n + 1 : n;
    let prevL = null, prevR = null;
    for (let k = 0; k < cnt; k++) {
      const a = P(k - 1), b = P(k), d = P(k + 1);
      let tx = d[0] - a[0], tz = d[2] - a[2]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const L = [b[0] - tz * width / 2, b[1], b[2] + tx * width / 2];
      const R = [b[0] + tz * width / 2, b[1], b[2] - tx * width / 2];
      if (prevL) {
        pos.push(...prevL, ...prevR, ...R, ...prevL, ...R, ...L);
        for (let q = 0; q < 6; q++) col.push(c[0], c[1], c[2]);
      }
      prevL = L; prevR = R;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
    const mesh = new THREE.Mesh(g, Gfx.mats.line);
    mesh.renderOrder = 8; mesh.frustumCulled = false;
    return mesh;
  };

  // ======================================================================
  // Zone & overlay textures
  // ======================================================================
  const ZC = C.ZONES.map(z => z ? U.hex(z.color) : null);
  M.updateZoneTex = function (zoneTool) {
    const Wd = World, d = Gfx.zoneTex.image.data;
    for (let i = 0; i < W * W; i++) {
      const z = Wd.zone[i], o = i * 4;
      if (z && !Wd.bld[i]) {
        const c = ZC[z];
        d[o] = c[0] * 255; d[o + 1] = c[1] * 255; d[o + 2] = c[2] * 255; d[o + 3] = zoneTool ? 170 : 95;
      } else if (zoneTool && Wd.zonable[i] && !Wd.bld[i]) {
        d[o] = 235; d[o + 1] = 240; d[o + 2] = 235; d[o + 3] = 40;
      } else d[o + 3] = 0;
    }
    Gfx.zoneTex.needsUpdate = true;
  };
  M.writeOverlay = function (fn) {
    const d = Gfx.ovTex.image.data;
    for (let i = 0; i < W * W; i++) {
      const c = fn(i), o = i * 4;
      if (c) { d[o] = c[0] * 255; d[o + 1] = c[1] * 255; d[o + 2] = c[2] * 255; d[o + 3] = (c[3] === undefined ? 1 : c[3]) * 255; }
      else d[o + 3] = 0;
    }
    Gfx.ovTex.needsUpdate = true;
  };
if (typeof window !== 'undefined') {
  (window as any).CB = (window as any).CB || {};
  (window as any).Meshes = Meshes;
  (window as any).CB.GB = GB;
}

export { GB };
export default Meshes;
