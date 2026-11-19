import { C } from './constants';

const W = C.W;

export class Heap {
  ids: number[];
  pr: number[];

  constructor() {
    this.ids = [];
    this.pr = [];
  }

  get size(): number {
    return this.ids.length;
  }

  clear(): void {
    this.ids.length = 0;
    this.pr.length = 0;
  }

  push(id: number, p: number): void {
    const a = this.ids;
    const b = this.pr;
    let i = a.length;
    a.push(id);
    b.push(p);
    while (i > 0) {
      const q = (i - 1) >> 1;
      if (b[q] <= p) break;
      a[i] = a[q];
      b[i] = b[q];
      i = q;
    }
    a[i] = id;
    b[i] = p;
  }

  pop(): number {
    const a = this.ids;
    const b = this.pr;
    const top = a[0];
    const lid = a.pop()!;
    const lp = b.pop()!;
    const n = a.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const m = r < n && b[r] < b[l] ? r : l;
        if (b[m] >= lp) break;
        a[i] = a[m];
        b[i] = b[m];
        i = m;
      }
      a[i] = lid;
      b[i] = lp;
    }
    return top;
  }
}

export const U = {
  idx: (x: number, y: number): number => y * W + x,
  tx: (i: number): number => i % W,
  ty: (i: number): number => (i / W) | 0,
  inWorld: (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < W,
  inPlay: (x: number, y: number): boolean => x >= C.P0 && y >= C.P0 && x < C.P1 && y < C.P1,
  clamp: (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v),
  lerp: (a: number, b: number, t: number): number => a + (b - a) * t,
  smooth: (e0: number, e1: number, x: number): number => {
    const t = U.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  },
  rng: (seed: number): (() => number) => {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  hash: (x: number, y: number, s?: number): number => {
    let h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  },
  lin: (v: number): number => Math.pow(v, 2.2),
  hex: (h: string): [number, number, number] => {
    if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    const n = parseInt(h.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  },
  money: (n: number): string => {
    const s = Math.round(Math.abs(n)).toLocaleString('en-US');
    return (n < 0 ? '-$' : '$') + s;
  },
  num: (n: number): string => Math.round(n).toLocaleString('en-US'),
  dist: (a: number, b: number): number => Math.abs(U.tx(a) - U.tx(b)) + Math.abs(U.ty(a) - U.ty(b)),
  pick: <T>(arr: T[], r?: () => number): T => arr[Math.floor((r ? r() : Math.random()) * arr.length)],

  makeNoise: (seed: number): ((xin: number, yin: number) => number) => {
    const rnd = U.rng(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const g = [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;

    return function (xin: number, yin: number): number {
      let n0 = 0,
        n1 = 0,
        n2 = 0;
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s);
      const j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const x0 = xin - (i - t);
      const y0 = yin - (j - t);
      const i1 = x0 > y0 ? 1 : 0;
      const j1 = x0 > y0 ? 0 : 1;
      const x1 = x0 - i1 + G2;
      const y1 = y0 - j1 + G2;
      const x2 = x0 - 1 + 2 * G2;
      const y2 = y0 - 1 + 2 * G2;
      const ii = i & 255;
      const jj = j & 255;

      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 > 0) {
        const q = g[perm[ii + perm[jj]] & 7];
        t0 *= t0;
        n0 = t0 * t0 * (q[0] * x0 + q[1] * y0);
      }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 > 0) {
        const q = g[perm[ii + i1 + perm[jj + j1]] & 7];
        t1 *= t1;
        n1 = t1 * t1 * (q[0] * x1 + q[1] * y1);
      }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 > 0) {
        const q = g[perm[ii + 1 + perm[jj + 1]] & 7];
        t2 *= t2;
        n2 = t2 * t2 * (q[0] * x2 + q[1] * y2);
      }
      return 70 * (n0 + n1 + n2);
    };
  },

  fbm: (nf: (x: number, y: number) => number, x: number, y: number, oct: number): number => {
    let a = 1,
      f = 1,
      s = 0,
      n = 0;
    for (let o = 0; o < oct; o++) {
      s += nf(x * f, y * f) * a;
      n += a;
      a *= 0.5;
      f *= 2.03;
    }
    return s / n;
  },

  Heap,

  encodeRLE: (arr: ArrayLike<number>): string => {
    const out: number[] = [];
    for (let i = 0; i < arr.length; ) {
      const v = arr[i];
      let n = 1;
      while (i + n < arr.length && arr[i + n] === v && n < 65535) n++;
      out.push(v, n);
      i += n;
    }
    return out.join(',');
  },

  decodeRLE: <T extends { [index: number]: number; length: number }>(
    str: string,
    Type: new (len: number) => T,
    len: number
  ): T => {
    const a = new Type(len);
    const parts = str.split(',');
    let k = 0;
    for (let i = 0; i < parts.length; i += 2) {
      const v = +parts[i];
      const n = +parts[i + 1];
      for (let j = 0; j < n && k < len; j++) a[k++] = v;
    }
    return a;
  },
};
