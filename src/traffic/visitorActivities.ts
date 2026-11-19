/**
 * Vira City — Park Visitor & Landmark Activities (`src/traffic/visitorActivities.ts`)
 *
 * Implements park pedestrian behaviors: strolling along procedural paths, sitting on
 * benches, swinging, sliding, skating in skateparks, playing basketball, and ball physics.
 */

import { C } from '@/core/constants';
import { U } from '@/core/utils';
import { SoftAgent, Building, ParkSpot, ParkData } from '@/types';
import { curve, evalCurve } from '@/traffic/trajectories';

const T = C.TILE;
const tmp = [0, 0, 0, 0];

export const BALL_COL = [0.78, 0.18, 0.04];

export function walkTo(a: SoftAgent, tx: number, tz: number, pause?: number): void {
  a.ph = {
    c: curve(a.x, a.z, (a.x + tx) / 2, (a.z + tz) / 2, tx, tz),
    t: 0,
    out: false,
    wander: true,
    pause: pause || 0,
  };
}

export function startVisit(a: SoftAgent, b: Building, secs: number, time: number): void {
  a.visit = { b, until: time + secs };
  const CB = (window as any).CB;
  const P: ParkData = CB?.Meshes?.parkSpots(b) || { spots: [], paths: [], area: null, play: false };
  a.kid = P.spots.some(q => q.kid) && Math.random() < 0.4;
  nextWander(a, time);
}

export function nextWander(a: SoftAgent, time: number): void {
  if (!a.visit) return;
  const b = a.visit.b;
  const CB = (window as any).CB;
  const P: ParkData = CB?.Meshes?.parkSpots(b) || { spots: [], paths: [], area: null, play: false };
  a.pose = null;
  a.yo = 0;
  if (a.walk) {
    const w = a.walk;
    w.k += w.dir;
    if (w.k >= 0 && w.k < w.pts.length) {
      const p = w.pts[w.k];
      walkTo(a, p[0] + w.ox, p[1] + w.oz, 0);
      return;
    }
    a.walk = null;
  }
  const r = Math.random();
  const free = P.spots.filter(q => !q.busy && (a.kid ? q.kid : !q.kid || q.a === 'watch'));
  if (free.length && (r < 0.62 || !P.paths.length)) {
    const q: ParkSpot = U.pick(free);
    q.busy = a;
    a.target = q;
    const ap = q.a === 'slide' ? [q.x - (q.ax || 0) * 1.1, q.z - (q.az || 0) * 1.1] : [q.x, q.z];
    walkTo(a, ap[0], ap[1], 0);
    return;
  }
  if (P.paths.length && r < 0.92) {
    const pts: [number, number][] = U.pick(P.paths);
    let k = 0,
      bd = Infinity;
    pts.forEach((p, j) => {
      const d = (p[0] - a.x) ** 2 + (p[1] - a.z) ** 2;
      if (d < bd) {
        bd = d;
        k = j;
      }
    });
    const dir = k === 0 ? 1 : k === pts.length - 1 ? -1 : Math.random() < 0.5 ? 1 : -1;
    const side = (Math.random() - 0.5) * 0.9;
    a.walk = { pts, k, dir, ox: side, oz: side * 0.7 };
    walkTo(a, pts[k][0] + side, pts[k][1] + side * 0.7, 0);
    return;
  }
  if (P.play && P.area) {
    a.doing = { type: 'play', until: time + 15 + Math.random() * 20, t0: time };
    return;
  }
  const ar = P.area || [
    b.x * T + 1.5,
    b.y * T + 1.5,
    (b.x + (b.w || 1)) * T - 1.5,
    (b.y + (b.d || 1)) * T - 1.5,
  ];
  walkTo(
    a,
    ar[0] + Math.random() * (ar[2] - ar[0]),
    ar[1] + Math.random() * (ar[3] - ar[1]),
    1 + Math.random() * 3
  );
}

export function beginActivity(a: SoftAgent, q: ParkSpot, time: number): void {
  const dur =
    q.a === 'sit' || q.a === 'ground' || q.a === 'fish'
      ? 20 + Math.random() * 30
      : 12 + Math.random() * 18;
  a.doing = { type: q.a, spot: q, t0: time, until: time + dur, ph: Math.random() * 6 };
  a.target = null;
}

export function stepActivity(a: SoftAgent, dt: number, time: number, ballPos: number[]): void {
  const d = a.doing;
  if (!d) return;
  const q = d.spot as ParkSpot,
    t = time - (d.t0 || 0);
  a.pose = 'ped';
  a.yo = 0;
  switch (d.type) {
    case 'sit':
      a.x = q.x;
      a.z = q.z;
      a.hx = q.fx;
      a.hz = q.fz;
      a.pose = 'sit';
      a.yo = q.y || 0;
      break;
    case 'ground':
      a.x = q.x;
      a.z = q.z;
      a.hx = q.fx;
      a.hz = q.fz;
      a.pose = 'sit';
      a.yo = -0.4;
      break;
    case 'fish':
      a.x = q.x;
      a.z = q.z;
      a.hx = q.fx;
      a.hz = q.fz;
      a.pose = 'sit';
      a.yo = 0.05;
      break;
    case 'look':
    case 'watch':
    case 'tend': {
      const sway = Math.sin(t * 0.5 + (d.ph || 0)) * 0.35;
      a.x = q.x;
      a.z = q.z;
      const fx = q.fx || 1,
        fz = q.fz || 0;
      a.hx = fx * Math.cos(sway) - fz * Math.sin(sway);
      a.hz = fz * Math.cos(sway) + fx * Math.sin(sway);
      if (d.type === 'tend') a.yo = -0.25 + 0.12 * Math.sin(t * 1.3 + (d.ph || 0));
      break;
    }
    case 'swing': {
      const th = 0.75 * Math.sin(t * 2.3 + (d.ph || 0)),
        L = 1.85;
      const fx = q.fx || 1,
        fz = q.fz || 0;
      a.x = q.x + fx * Math.sin(th) * L;
      a.z = q.z + fz * Math.sin(th) * L;
      a.hx = fx;
      a.hz = fz;
      a.pose = 'sit';
      a.yo = 0.6 + (1 - Math.cos(th)) * L - 0.47;
      break;
    }
    case 'slide': {
      const ax = q.ax || 1,
        az = q.az || 0;
      const c = (t + (d.ph || 0)) % 6.5,
        lx = q.x - ax * 0.85,
        lz = q.z - az * 0.85;
      if (c < 1.8) {
        const u = c / 1.8;
        a.x = lx;
        a.z = lz;
        a.yo = u * 1.7;
        a.hx = ax;
        a.hz = az;
      } else if (c < 2.4) {
        a.x = q.x;
        a.z = q.z;
        a.yo = 1.7 - 0.47 + 0.05;
        a.pose = 'sit';
        a.hx = ax;
        a.hz = az;
      } else if (c < 3.5) {
        const u = (c - 2.4) / 1.1;
        a.x = q.x + ax * (0.8 + 2.5 * u);
        a.z = q.z + az * (0.8 + 2.5 * u);
        a.yo = 1.66 - 1.41 * u - 0.42;
        a.pose = 'sit';
        a.hx = ax;
        a.hz = az;
      } else {
        const u = (c - 3.5) / 3.0,
          sx = -az,
          sz = ax;
        const px = q.x + ax * 3.6,
          pz = q.z + az * 3.6;
        const w = u < 0.5 ? u * 2 : 1,
          v = u < 0.5 ? 0 : (u - 0.5) * 2;
        a.x = px + sx * 1.3 * w - ax * 4.5 * v;
        a.z = pz + sz * 1.3 * w - az * 4.5 * v;
        a.hx = u < 0.5 ? sx : -ax;
        a.hz = u < 0.5 ? sz : -az;
        a.pose = ((c * 3) | 0) % 2 ? 'ped' : 'ped2';
      }
      break;
    }
    case 'sand':
      a.x = q.x;
      a.z = q.z;
      a.hx = Math.cos((d.ph || 0) + t * 0.2);
      a.hz = Math.sin((d.ph || 0) + t * 0.2);
      a.pose = 'sit';
      a.yo = -0.38;
      break;
    case 'skate': {
      const u = Math.sin(t * 0.9 + (d.ph || 0)),
        off = u * 5.4,
        h = Math.max(0, Math.abs(off) - 2) / 4;
      const ax = q.ax || 1,
        az = q.az || 0;
      a.x = (q.cx || q.x) + ax * off;
      a.z = (q.cz || q.z) + az * off;
      const dir = Math.cos(t * 0.9 + (d.ph || 0)) >= 0 ? 1 : -1;
      a.hx = ax * dir;
      a.hz = az * dir;
      a.yo = (1 - Math.cos((Math.min(1, h) * Math.PI) / 2)) * 2.6 + 0.1;
      break;
    }
    case 'hoop': {
      const c = (t + (d.ph || 0)) % 3.6,
        rx = q.rx || q.x + 3,
        rz = q.rz || q.z,
        dx = rx - q.x,
        dz = rz - q.z,
        dl = Math.hypot(dx, dz) || 1;
      a.x = q.x;
      a.z = q.z;
      a.hx = dx / dl;
      a.hz = dz / dl;
      if (c > 0.7 && c < 1.1) a.yo = Math.sin(((c - 0.7) / 0.4) * Math.PI) * 0.35;
      let bx: number, by: number, bz: number;
      if (c < 0.85) {
        bx = q.x + (a.hx || 0) * 0.45;
        bz = q.z + (a.hz || 0) * 0.45;
        by = 0.15 + Math.abs(Math.sin(c * 9)) * 0.85;
        if (c > 0.7) by = 1.9 + (a.yo || 0);
      } else if (c < 1.8) {
        const u = (c - 0.85) / 0.95;
        bx = q.x + dx * u;
        bz = q.z + dz * u;
        by = 2.2 + (3.15 - 2.2) * u + Math.sin(u * Math.PI) * 1.8;
      } else if (c < 2.3) {
        const u = (c - 1.8) / 0.5;
        bx = rx;
        bz = rz;
        by = 3.15 - u * u * 3.0;
      } else {
        const u = (c - 2.3) / 1.3;
        bx = rx - dx * u;
        bz = rz - dz * u;
        by = 0.15 + Math.abs(Math.sin(u * Math.PI * 2)) * 0.5 * (1 - u);
      }
      if (a.visit && a.visit.b) {
        ballPos.push(bx, by, bz, (a.visit.b.baseY || 0) + 0.1);
      }
      break;
    }
    case 'play': {
      if (!a.visit) break;
      const CB = (window as any).CB;
      const P: ParkData = CB?.Meshes?.parkSpots(a.visit.b) || { spots: [], paths: [], area: [0, 0, 10, 10], play: true };
      const ar = P.area || [0, 0, 10, 10];
      if (!d.go || d.go.t >= 1) {
        const tx = ar[0] + Math.random() * (ar[2] - ar[0]),
          tz = ar[1] + Math.random() * (ar[3] - ar[1]);
        d.go = {
          c: curve(a.x, a.z, (a.x + tx) / 2, (a.z + tz) / 2, tx, tz),
          t: 0,
        };
      }
      d.go.t = Math.min(1, d.go.t + (4.2 * dt) / d.go.c.len);
      evalCurve(d.go.c, d.go.t, tmp);
      a.x = tmp[0];
      a.z = tmp[1];
      a.hx = tmp[2];
      a.hz = tmp[3];
      a.pose = ((t * 4) | 0) % 2 ? 'ped' : 'ped2';
      if (d.ball === undefined) d.ball = Math.random() < 0.35;
      if (d.ball && a.visit && a.visit.b) {
        ballPos.push(
          a.x + (a.hx || 0) * 0.55,
          0.13 + Math.abs(Math.sin(t * 6)) * 0.05,
          a.z + (a.hz || 0) * 0.55,
          (a.visit.b.baseY || 0) + 0.1
        );
      }
      break;
    }
    default:
      a.x = q.x;
      a.z = q.z;
  }
}
