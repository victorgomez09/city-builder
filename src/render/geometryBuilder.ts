/**
 * Open Skylines — Procedural 3D Geometry Builder (`src/render/geometryBuilder.ts`)
 *
 * Fast CPU vertex buffer assembler with transformation framing, material tagging,
 * and direct translation into non-indexed Three.js BufferGeometry.
 */
import * as THREE from 'three';
import { U } from '@/core/utils';
import { Gfx } from '@/render/gfx';

export const FR = [
  [1, 0, 0, 1],
  [0, -1, 1, 0],
  [-1, 0, 0, -1],
  [0, 1, -1, 0],
] as const;

const linCache = new Map<string | number[], [number, number, number]>();

export function lc(c: string | number[]): [number, number, number] {
  let v = linCache.get(c);
  if (!v) {
    const a = typeof c === 'string' ? U.hex(c) : c;
    v = [U.lin(a[0]), U.lin(a[1]), U.lin(a[2])];
    if (typeof c === 'string') linCache.set(c, v);
  }
  return v;
}

const TRUNK = new THREE.CylinderGeometry(0.13, 0.22, 3.0, 6).translate(0, 1.5, 0);
const BLOB = new THREE.IcosahedronGeometry(1, 0);
const BLOB_TOP = new THREE.IcosahedronGeometry(1, 1);

export interface BoxOptions {
  vb?: number;
  skip?: number;
  top?: string | number[];
  topSt?: number;
  bottom?: boolean;
}

export class GB {
  p: number[];
  n: number[];
  c: number[];
  u: number[];
  s: number[];
  ox: number = 0;
  oy: number = 0;
  oz: number = 0;
  ma: number = 1;
  mb: number = 0;
  mc: number = 0;
  md: number = 1;
  tint: number | null = null;
  tintCol: number[] | null = null;
  noLit: boolean = false;
  autoMat: boolean = false;
  wear: number = 0;
  drive: boolean = false;

  constructor() {
    this.p = [];
    this.n = [];
    this.c = [];
    this.u = [];
    this.s = [];
    this.frame(0, 0, 0, 0);
    this.tint = null;
    this.noLit = false;
  }

  frame(ox: number, oy: number, oz: number, f: number): void {
    this.ox = ox;
    this.oy = oy;
    this.oz = oz;
    const m = FR[f % 4];
    this.ma = m[0];
    this.mb = m[1];
    this.mc = m[2];
    this.md = m[3];
  }

  _push(
    P: [number[], number[], number[]],
    N: [number, number, number],
    col: [number, number, number],
    st: number,
    uv: number[]
  ): void {
    let r = col[0],
      g = col[1],
      b = col[2];

    if (this.tint) {
      const l = (r + g + b) / 3;
      r = (l * 0.6 + r * 0.4) * this.tint;
      g = (l * 0.6 + g * 0.4) * this.tint;
      b = (l * 0.6 + b * 0.4) * this.tint;
    }

    if (this.autoMat && st > 0 && st < 5) {
      const mx = Math.max(r, g, b),
        mn = Math.min(r, g, b),
        sat = mx > 0 ? (mx - mn) / mx : 0;
      if (r > g * 1.35 && r > b * 1.5 && mx < 0.6) st += 32;
      else if (st === 4) st += sat < 0.25 ? 224 : 192;
      else if (sat < 0.3 && mx > 0.25) st += st === 1 ? 96 : b > r * 1.15 ? 0 : 192;
    }

    if (this.wear && !(st >= 5 && st <= 10) && st !== 15 && st !== 16 && st !== 17) {
      const w = this.wear,
        l = (r + g + b) / 3,
        k = 1 - w * 0.22;
      r = (r * (1 - w * 0.45) + l * w * 0.45) * k;
      g = (g * (1 - w * 0.45) + l * w * 0.45) * k;
      b = (b * (1 - w * 0.4) + l * w * 0.4) * k * 0.96;
    }

    if (this.tintCol) {
      const t = this.tintCol,
        k = t[3];
      r = r * (1 - k) + t[0] * k;
      g = g * (1 - k) + t[1] * k;
      b = b * (1 - k) + t[2] * k;
    }

    if (this.autoMat && st === 9 && !this.noLit) st = 10;
    if (this.noLit) {
      const b0 = st % 32;
      if (b0 >= 1 && b0 <= 5) st -= b0;
    }

    const nx = this.ma * N[0] + this.mb * N[2];
    const nz = this.mc * N[0] + this.md * N[2];

    for (let k = 0; k < 3; k++) {
      const v = P[k];
      this.p.push(
        this.ox + this.ma * v[0] + this.mb * v[2],
        this.oy + v[1],
        this.oz + this.mc * v[0] + this.md * v[2]
      );
      this.n.push(nx, N[1], nz);
      this.c.push(r, g, b);
      this.u.push(uv[k * 2], uv[k * 2 + 1]);
      this.s.push(st);
    }
  }

  tri(
    a: number[],
    b: number[],
    c: number[],
    col: string | number[],
    st: number = 0,
    uv: number[] = [0, 0, 0, 0, 0, 0]
  ): void {
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2];
    const vx = c[0] - a[0],
      vy = c[1] - a[1],
      vz = c[2] - a[2];
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    this._push(
      [a, b, c],
      [nx / l, ny / l, nz / l],
      lc(col),
      st || 0,
      uv || [0, 0, 0, 0, 0, 0]
    );
  }

  quad(
    a: number[],
    b: number[],
    c: number[],
    d: number[],
    col: string | number[],
    st: number = 0,
    u0: number = 0,
    u1: number = 0,
    v0: number = 0,
    v1: number = 0
  ): void {
    st = st || 0;
    u0 = u0 || 0;
    u1 = u1 || 0;
    v0 = v0 || 0;
    v1 = v1 || 0;
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2];
    const vx = c[0] - a[0],
      vy = c[1] - a[1],
      vz = c[2] - a[2];
    let nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    if (Math.hypot(nx, ny, nz) < 1e-6) {
      const px = c[0] - a[0],
        py = c[1] - a[1],
        pz = c[2] - a[2],
        qx = d[0] - b[0],
        qy = d[1] - b[1],
        qz = d[2] - b[2];
      nx = py * qz - pz * qy;
      ny = pz * qx - px * qz;
      nz = px * qy - py * qx;
    }
    const l = Math.hypot(nx, ny, nz) || 1;
    const N: [number, number, number] = [nx / l, ny / l, nz / l];
    const col2 = lc(col);
    this._push([a, b, c], N, col2, st, [u0, v0, u1, v0, u1, v1]);
    this._push([a, c, d], N, col2, st, [u0, v0, u1, v1, u0, v1]);
  }

  box(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    col: string | number[],
    st: number = 0,
    o: BoxOptions = {}
  ): void {
    const vb = o.vb !== undefined ? o.vb : y0;
    const v0 = y0 - vb,
      v1 = y1 - vb,
      w = x1 - x0,
      d = z1 - z0;
    const sk = o.skip || 0;
    st = st || 0;
    if (!(sk & 1)) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], col, st, 0, w, v0, v1);
    if (!(sk & 4)) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col, st, 0, w, v0, v1);
    if (!(sk & 8)) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col, st, 0, d, v0, v1);
    if (!(sk & 2)) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col, st, 0, d, v0, v1);
    if (!(sk & 16)) this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], o.top || col, o.topSt || 0);
    if (o.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], col, 0);
  }

  gable(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    y: number,
    h: number,
    alongX: boolean,
    col: string | number[],
    wall?: string | number[],
    st: number = 0,
    wst: number = 0
  ): void {
    wall = wall || col;
    st = st || 0;
    wst = wst || 0;
    if (alongX) {
      const zm = (z0 + z1) / 2;
      this.quad([x1, y, z0], [x0, y, z0], [x0, y + h, zm], [x1, y + h, zm], col, st);
      this.quad([x0, y, z1], [x1, y, z1], [x1, y + h, zm], [x0, y + h, zm], col, st);
      this.tri([x0, y, z0], [x0, y, z1], [x0, y + h, zm], wall, wst);
      this.tri([x1, y, z1], [x1, y, z0], [x1, y + h, zm], wall, wst);
    } else {
      const xm = (x0 + x1) / 2;
      this.quad([x0, y, z0], [x0, y, z1], [xm, y + h, z1], [xm, y + h, z0], col, st);
      this.quad([x1, y, z1], [x1, y, z0], [xm, y + h, z0], [xm, y + h, z1], col, st);
      this.tri([x1, y, z0], [x0, y, z0], [xm, y + h, z0], wall, wst);
      this.tri([x0, y, z1], [x1, y, z1], [xm, y + h, z1], wall, wst);
    }
  }

  pyr(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    y: number,
    h: number,
    col: string | number[],
    st: number = 0
  ): void {
    const a = [(x0 + x1) / 2, y + h, (z0 + z1) / 2];
    this.tri([x1, y, z0], [x0, y, z0], a, col, st);
    this.tri([x0, y, z1], [x1, y, z1], a, col, st);
    this.tri([x0, y, z0], [x0, y, z1], a, col, st);
    this.tri([x1, y, z1], [x1, y, z0], a, col, st);
  }

  cyl(
    cx: number,
    y0: number,
    cz: number,
    r: number,
    h: number,
    seg: number,
    col: string | number[],
    st: number = 0,
    top?: string | number[] | null | boolean,
    r2?: number
  ): void {
    r2 = r2 === undefined ? r : r2;
    for (let k = 0; k < seg; k++) {
      const a1 = (k / seg) * Math.PI * 2,
        a2 = ((k + 1) / seg) * Math.PI * 2;
      const c1 = Math.cos(a1),
        s1 = Math.sin(a1),
        c2 = Math.cos(a2),
        s2 = Math.sin(a2);
      const u1 = (k / seg) * 6.283 * r,
        u2 = ((k + 1) / seg) * 6.283 * r;
      this.quad(
        [cx + c2 * r, y0, cz + s2 * r],
        [cx + c1 * r, y0, cz + s1 * r],
        [cx + c1 * r2, y0 + h, cz + s1 * r2],
        [cx + c2 * r2, y0 + h, cz + s2 * r2],
        col,
        st || 0,
        u2,
        u1,
        0,
        h
      );
      if (top !== false) {
        this.tri(
          [cx, y0 + h, cz],
          [cx + c2 * r2, y0 + h, cz + s2 * r2],
          [cx + c1 * r2, y0 + h, cz + s1 * r2],
          typeof top === 'boolean' || !top ? col : top
        );
      }
    }
  }

  cone(
    cx: number,
    y0: number,
    cz: number,
    r: number,
    h: number,
    seg: number,
    col: string | number[],
    inv: boolean = false
  ): void {
    for (let k = 0; k < seg; k++) {
      const a1 = (k / seg) * Math.PI * 2,
        a2 = ((k + 1) / seg) * Math.PI * 2;
      const b1 = [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r];
      const b2 = [cx + Math.cos(a2) * r, y0, cz + Math.sin(a2) * r];
      if (inv) this.tri(b1, b2, [cx, y0 - h, cz], col);
      else this.tri(b2, b1, [cx, y0 + h, cz], col);
    }
  }

  flat(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    y: number,
    col: string | number[],
    st: number = 0
  ): void {
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], col, st || 0);
  }

  tree(
    x: number,
    y: number,
    z: number,
    s: number,
    col: string | number[],
    conifer: boolean = false
  ): void {
    if (!conifer && Gfx.settings && Gfx.settings.detail) {
      const h = U.hash(Math.round(x * 7), Math.round(z * 7), 5);
      this.addThree(
        TRUNK,
        new THREE.Matrix4().makeScale(s, s, s).setPosition(x, y, z),
        '#5a3d28',
        12
      );
      const c2 = typeof col === 'string' ? U.hex(col) : [0.3, 0.5, 0.2];
      const lite = [
        Math.min(1, c2[0] * 1.18),
        Math.min(1, c2[1] * 1.15),
        Math.min(1, c2[2] * 1.08),
      ];
      for (let k = 0; k < 4; k++) {
        const a = k * 2.1 + h * 6,
          rr = k === 0 ? 0 : 0.85 * s,
          yy = y + (k === 0 ? 3.6 : 2.9 + (k % 2) * 0.6) * s;
        const sc = (k === 0 ? 1.55 : 1.15 + 0.2 * ((h * (k + 3)) % 1)) * s;
        this.addThree(
          k === 0 ? BLOB_TOP : BLOB,
          new THREE.Matrix4()
            .makeScale(sc, sc * 0.85, sc)
            .setPosition(x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr),
          k === 0 ? lite : col
        );
      }
      return;
    }
    this.box(x - 0.2 * s, y, z - 0.2 * s, x + 0.2 * s, y + 1.8 * s, z + 0.2 * s, '#5a3d28', 12);
    if (conifer) {
      this.cone(x, y + 1.2 * s, z, 1.7 * s, 3.2 * s, 6, col);
      this.cone(x, y + 2.8 * s, z, 1.25 * s, 3.0 * s, 6, col);
    } else {
      this.cone(x, y + 3.0 * s, z, 2.1 * s, 1.4 * s, 6, col, true);
      this.cone(x, y + 3.0 * s, z, 2.1 * s, 2.6 * s, 6, col);
    }
  }

  addThree(
    g: THREE.BufferGeometry,
    mx: THREE.Matrix4,
    col: string | number[],
    st: number = 0
  ): void {
    const ng = g.index ? g.toNonIndexed() : g.clone();
    ng.applyMatrix4(mx);
    ng.computeVertexNormals();
    const p = ng.attributes.position.array as Float32Array;
    const n = ng.attributes.normal.array as Float32Array;
    const cl = lc(col);
    let cr = cl[0],
      cg = cl[1],
      cb = cl[2];
    if (this.tint) {
      const l = (cr + cg + cb) / 3;
      cr = (l * 0.6 + cr * 0.4) * this.tint;
      cg = (l * 0.6 + cg * 0.4) * this.tint;
      cb = (l * 0.6 + cb * 0.4) * this.tint;
    }
    let s2 = st || 0;
    if (this.autoMat && s2 === 9 && !this.noLit) s2 = 10;
    for (let i = 0; i < p.length; i += 3) {
      this.p.push(
        this.ox + this.ma * p[i] + this.mb * p[i + 2],
        this.oy + p[i + 1],
        this.oz + this.mc * p[i] + this.md * p[i + 2]
      );
      this.n.push(
        this.ma * n[i] + this.mb * n[i + 2],
        n[i + 1],
        this.mc * n[i] + this.md * n[i + 2]
      );
      this.c.push(cr, cg, cb);
      this.u.push(0, 0);
      this.s.push(s2);
    }
  }

  merge(
    src: GB,
    x: number,
    y: number,
    z: number,
    rot: number = 0,
    col?: string | number[]
  ): void {
    const c = Math.cos(rot || 0),
      s = Math.sin(rot || 0),
      bc = col ? lc(col) : null;
    for (let k = 0; k < src.p.length; k += 3) {
      const lx = src.p[k],
        lz = src.p[k + 2],
        wx = x + lx * c - lz * s,
        wz = z + lx * s + lz * c;
      this.p.push(
        this.ox + this.ma * wx + this.mb * wz,
        this.oy + y + src.p[k + 1],
        this.oz + this.mc * wx + this.md * wz
      );
      const nx0 = src.n[k],
        nz0 = src.n[k + 2],
        nx = nx0 * c - nz0 * s,
        nz = nx0 * s + nz0 * c;
      this.n.push(
        this.ma * nx + this.mb * nz,
        src.n[k + 1],
        this.mc * nx + this.md * nz
      );
      let st = src.s[k / 3];
      if (this.autoMat && st === 6) st = 16;
      else if (this.autoMat && st === 7) {
        st = 0;
        this.c.push(0.25, 0.01, 0.01);
        this.u.push(0, 0);
        this.s.push(st);
        continue;
      }
      if (bc && st === 0 && src.c[k] > 0.99 && src.c[k + 1] > 0.99 && src.c[k + 2] > 0.99) {
        this.c.push(bc[0], bc[1], bc[2]);
      } else {
        this.c.push(src.c[k], src.c[k + 1], src.c[k + 2]);
      }
      this.u.push(src.u[(k / 3) * 2], src.u[(k / 3) * 2 + 1]);
      this.s.push(st);
    }
  }

  get count(): number {
    return this.p.length / 3;
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.p), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.n), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.c), 3));
    g.setAttribute('uvm', new THREE.BufferAttribute(new Float32Array(this.u), 2));
    g.setAttribute('wstyle', new THREE.BufferAttribute(new Float32Array(this.s), 1));
    g.computeBoundingSphere();
    return g;
  }
}
