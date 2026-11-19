// ============================================================================
// Vira City — Park & Landmark Activity Spots
// ============================================================================

import { C } from '../../core/constants';
import { U } from '../../core/utils';
import { FR } from '../geometryBuilder';
import { Building, ParkData, ParkSpot } from '../../types';

const T = C.TILE;

export const benchSpots = (x: number, z: number, rot: boolean = false): Partial<ParkSpot>[] =>
  rot
    ? [
        { a: 'sit', x: x - 0.05, z: z - 0.4, fx: -1, fz: 0 },
        { a: 'sit', x: x - 0.05, z: z + 0.4, fx: -1, fz: 0 },
      ]
    : [
        { a: 'sit', x: x - 0.4, z: z - 0.05, fx: 0, fz: -1 },
        { a: 'sit', x: x + 0.4, z: z - 0.05, fx: 0, fz: -1 },
      ];

export const swingSpots = (x: number, z: number): Partial<ParkSpot>[] => [
  { a: 'swing', x: x - 0.7, z, fx: 0, fz: 1, kid: true },
  { a: 'swing', x: x + 0.7, z, fx: 0, fz: 1, kid: true },
];

export const lookAt = (tx: number, tz: number, rad: number, n: number): Partial<ParkSpot>[] => {
  const o: Partial<ParkSpot>[] = [];
  for (let k = 0; k < n; k++) {
    const t = (k / n) * Math.PI * 2 + 0.4;
    o.push({
      a: 'look',
      x: tx + Math.cos(t) * rad,
      z: tz + Math.sin(t) * rad,
      fx: -Math.cos(t),
      fz: -Math.sin(t),
    });
  }
  return o;
};

export const hoopSpots = (
  hx: number,
  hz: number,
  dir: number,
  alongX: boolean = false
): Partial<ParkSpot>[] => {
  const o: Partial<ParkSpot>[] = [];
  for (const d of [3.2, 4.6])
    for (const l of [-1.6, 0, 1.6]) {
      const x = alongX ? hx + dir * (1.15 + d) : hx + l,
        z = alongX ? hz + l : hz + dir * (1.15 + d);
      o.push({
        a: 'hoop',
        x,
        z,
        rx: alongX ? hx + dir * 1.15 : hx,
        rz: alongX ? hz : hz + dir * 1.15,
        fx: alongX ? -dir : 0,
        fz: alongX ? 0 : -dir,
      });
    }
  return o;
};

export const PARK_SPOTS: Record<string, (b: Building) => any> = {
  park: () => ({
    spots: benchSpots(6.6, 2.4),
    paths: [
      [
        [0.5, 9.5],
        [4, 6],
        [6, 4.5],
        [9.5, 0.5],
      ],
    ],
  }),
  playground: () => ({
    spots: [
      ...swingSpots(3.4, 2.6),
      { a: 'slide', x: 6.8, z: 4.5, kid: true },
      { a: 'sand', x: 2.6, z: 6.8, kid: true },
      { a: 'sand', x: 3.4, z: 7.2, kid: true },
      ...benchSpots(8.4, 8.6),
      { a: 'watch', x: 5.2, z: 8.2, fx: -0.3, fz: -1 },
      { a: 'watch', x: 1.8, z: 4.6, fx: 1, fz: -0.5 },
    ],
  }),
  grove: () => ({
    spots: benchSpots(5, 5.4),
    paths: [
      [
        [0, 3],
        [3, 4.5],
        [6, 4],
        [10, 6.5],
      ],
    ],
  }),
  miniplaza: () => ({
    spots: [...benchSpots(5, 1.6), ...benchSpots(5, 8.4), ...lookAt(5, 5, 2.6, 4)],
  }),
  garden: () => {
    const o: Partial<ParkSpot>[] = [];
    for (let k = 0; k < 5; k++)
      for (let j = 0; j < 2; j++)
        o.push({ a: 'tend', x: 2.7 + j * 4.4, z: 1.2 + k * 3.4, fx: 0, fz: 1 });
    return { spots: o };
  },
  court: () => ({
    spots: [...hoopSpots(5, 1.6, 1), ...hoopSpots(5, 18.4, -1), ...benchSpots(0.4, 10, true)],
  }),
  dogpark: () => ({
    spots: [...benchSpots(16, 7.8), { a: 'watch', x: 8, z: 7, fx: 0, fz: -1 }],
    area: [1.5, 1.5, 18.5, 8.5],
  }),
  benches: () => {
    const o: Partial<ParkSpot>[] = [];
    for (let k = 0; k < 4; k++) o.push(...benchSpots(2.5 + k * 5, 3.6));
    return {
      spots: o,
      paths: [
        [
          [0, 5],
          [10, 5],
          [20, 5],
        ],
      ],
    };
  },
  plaza: () => ({
    spots: [
      ...lookAt(10, 10, 4.8, 6),
      { a: 'sit', x: 2.5, z: 7.6, fx: 1, fz: 0 },
      { a: 'sit', x: 17.5, z: 7.6, fx: -1, fz: 0 },
      { a: 'sit', x: 2.5, z: 13.6, fx: 1, fz: 0 },
      { a: 'sit', x: 17.5, z: 13.6, fx: -1, fz: 0 },
    ],
  }),
  trail: () => ({
    spots: benchSpots(14, 11.6),
    paths: [
      [
        [0, 4],
        [5, 6],
        [9, 12],
        [14, 13],
        [17, 8],
        [20, 10],
      ],
      [
        [9, 12],
        [8, 17],
        [11, 20],
      ],
    ],
  }),
  bigplay: () => ({
    spots: [
      ...swingSpots(4, 3),
      ...swingSpots(16, 3),
      { a: 'slide', x: 10, z: 12.2, kid: true },
      { a: 'sand', x: 4, z: 15, kid: true },
      { a: 'sand', x: 4.8, z: 14.4, kid: true },
      { a: 'sand', x: 16, z: 15.6, kid: true },
      ...benchSpots(2, 9, true),
      ...benchSpots(18, 9, true),
      { a: 'watch', x: 7, z: 5.5, fx: 0, fz: -1 },
      { a: 'watch', x: 13, z: 14, fx: -1, fz: 0 },
    ],
  }),
  skate: () => ({
    spots: [
      { a: 'skate', x: 6.5, z: 10 },
      { a: 'skate', x: 10, z: 10 },
      { a: 'skate', x: 13.5, z: 10 },
      { a: 'watch', x: 18, z: 10, fx: -1, fz: 0 },
      { a: 'watch', x: 2.2, z: 10, fx: 1, fz: 0 },
    ],
  }),
  meadow: () => {
    const o: Partial<ParkSpot>[] = [];
    for (let k = 0; k < 4; k++) {
      o.push({ a: 'ground', x: 15 + (k % 2), z: 4 + k * 6.5, fx: -1, fz: 0.3 });
      o.push({ a: 'ground', x: 16.4, z: 4.8 + k * 6.5, fx: -1, fz: -0.4 });
    }
    for (let k = 0; k < 5; k++) o.push({ a: 'sit', x: 4.5, z: 2.2 + k * 5.5, fx: 0, fz: 1 });
    return {
      spots: o,
      paths: [
        [
          [10, 0],
          [9, 8],
          [12, 16],
          [10, 30],
        ],
      ],
    };
  },
  soccer: () => {
    const o: Partial<ParkSpot>[] = [];
    for (const z of [8, 15, 22])
      for (const dz of [-1.2, 0, 1.2])
        o.push({ a: 'sit', x: 19.3, z: z + dz, fx: -1, fz: 0 });
    return { spots: o, area: [2.5, 3, 17.5, 27], play: true };
  },
  flowers: () => {
    const o: Partial<ParkSpot>[] = [];
    for (const [x0, z0] of [
      [1.5, 1.5],
      [12, 1.5],
      [1.5, 12],
      [12, 12],
    ])
      o.push({ a: 'look', x: x0 + 3.2, z: z0 + 3, fx: 0, fz: -1 });
    return {
      spots: o,
      paths: [
        [
          [10, 0],
          [10, 20],
        ],
        [
          [0, 10],
          [20, 10],
        ],
      ],
    };
  },
  bigpark: () => ({
    spots: [
      ...lookAt(26, 26, 9, 6),
      { a: 'sit', x: 9, z: 28.4, fx: 0, fz: 1 },
      { a: 'sit', x: 9, z: 31.6, fx: 0, fz: -1 },
    ],
    paths: [
      [
        [20, 0.5],
        [20, 14],
        [20, 39.5],
      ],
      [
        [0.5, 14],
        [20, 14],
        [39.5, 14],
      ],
    ],
  }),
  woods: () => ({
    spots: [{ a: 'sit', x: 8.8, z: 17.5, fx: 0, fz: -1 }, ...lookAt(31, 33, 4.4, 4)],
    paths: [
      [
        [0, 20],
        [8, 17],
        [15, 22],
        [22, 18],
        [30, 24],
        [40, 21],
      ],
      [
        [15, 22],
        [17, 30],
        [13, 40],
      ],
      [
        [22, 18],
        [25, 8],
        [21, 0],
      ],
    ],
  }),
  grandplaza: () => {
    const o: Partial<ParkSpot>[] = [...lookAt(15, 15, 5.6, 8)];
    for (let k = 0; k < 4; k++)
      o.push(...benchSpots(6 + k * 6, 11.4), ...benchSpots(6 + k * 6, 18.6));
    for (const [x, z] of [
      [4, 4],
      [26, 4],
      [4, 26],
      [26, 26],
    ])
      o.push(...lookAt(x, z, 2.2, 2));
    return { spots: o };
  },
  lakepark: () => ({
    spots: [
      { a: 'fish', x: 15.6, z: 14.6, fx: 1, fz: 0 },
      { a: 'fish', x: 15.6, z: 15.5, fx: 1, fz: 0 },
      ...lookAt(22, 15, 12.4, 8),
    ],
    paths: [
      [
        [0, 3],
        [10, 2.5],
        [22, 2.5],
        [36, 4],
        [40, 10],
      ],
      [
        [0, 27],
        [14, 28],
        [30, 28],
        [40, 22],
      ],
    ],
  }),
  zen: () => ({
    spots: [
      ...lookAt(10, 7, 4.5, 4),
      { a: 'look', x: 22, z: 21.2, fx: 0, fz: 1 },
      { a: 'look', x: 24, z: 22, fx: 0, fz: -1 },
      { a: 'sit', x: 6, z: 19.2, fx: 0, fz: -1 },
    ],
    paths: [
      [
        [1, 15],
        [12, 15],
        [17, 22],
        [27, 22],
      ],
    ],
  }),
  sports: () => ({
    spots: [
      ...hoopSpots(27.4, 7.5, 1, true),
      ...hoopSpots(37.6, 7.5, -1, true),
      ...hoopSpots(27.4, 20.5, 1, true),
      ...hoopSpots(37.6, 20.5, -1, true),
      { a: 'sit', x: 1.2, z: 16, fx: 1, fz: 0 },
      { a: 'sit', x: 1.2, z: 20, fx: 1, fz: 0 },
      { a: 'sit', x: 1.2, z: 24, fx: 1, fz: 0 },
    ],
    area: [3, 3, 23, 37],
    play: true,
  }),
  amphi: () => {
    const o: Partial<ParkSpot>[] = [];
    for (let k = 0; k < 4; k++)
      for (let s2 = 1; s2 < 9; s2 += 2) {
        const rr = 7 + k * 2,
          t = Math.PI + (s2 / 10) * Math.PI;
        o.push({
          a: 'sit',
          x: 15 + Math.cos(t) * rr,
          z: 26 + Math.sin(t) * rr,
          y: k * 0.6 + 0.6,
          fx: -Math.cos(t),
          fz: -Math.sin(t),
        });
      }
    return {
      spots: o,
      paths: [
        [
          [0, 9],
          [15, 7.5],
          [30, 9],
        ],
      ],
    };
  },
};

const spotCache = new Map<string, ParkData>();

export function getParkSpots(b: Building): ParkData {
  const key = b.id + ':' + b.dir + ':' + b.x + ':' + b.y;
  if (spotCache.has(key)) return spotCache.get(key)!;
  const X0 = b.x * T,
    Z0 = b.y * T,
    X1 = (b.x + b.fw) * T,
    Z1 = (b.y + b.fh) * T;
  const o = [
    [X0, Z0],
    [X1, Z0],
    [X1, Z1],
    [X0, Z1],
  ][b.dir];
  const m = FR[b.dir];
  const W2 = (x: number, z: number): [number, number] => [
    o[0] + m[0] * x + m[1] * z,
    o[1] + m[2] * x + m[3] * z,
  ];
  const V2 = (x: number, z: number): [number, number] => [
    m[0] * x + m[1] * z,
    m[2] * x + m[3] * z,
  ];
  const LW = (b.w || b.fw) * T,
    LD = (b.d || b.fh) * T;
  let def = b.svc && PARK_SPOTS[b.svc] ? PARK_SPOTS[b.svc](b) : null;
  if (!def) {
    const svcDef = b.svc ? C.SERVICES[b.svc] : null;
    def = {
      spots:
        svcDef && svcDef.cat === 'landmarks'
          ? lookAt(LW / 2, LD / 2, Math.min(LW, LD) * 0.42, 8)
          : [],
    };
  }
  const res: ParkData = { spots: [], paths: [], area: null, play: !!def.play };
  for (const sp of def.spots || []) {
    const p = W2(sp.x, sp.z),
      f = V2(sp.fx || 0, sp.fz || 1);
    const q: ParkSpot = Object.assign({}, sp, {
      x: p[0],
      z: p[1],
      fx: f[0],
      fz: f[1],
      busy: null,
    });
    if (sp.rx !== undefined) {
      const r2 = W2(sp.rx, sp.rz);
      q.rx = r2[0];
      q.rz = r2[1];
    }
    if (sp.a === 'skate') {
      const ax = V2(0, 1);
      q.ax = ax[0];
      q.az = ax[1];
      q.cx = p[0];
      q.cz = p[1];
    }
    if (sp.a === 'slide') {
      const ax = V2(0, 1);
      q.ax = ax[0];
      q.az = ax[1];
    }
    res.spots.push(q);
  }
  for (const pth of def.paths || [])
    res.paths.push(
      pth.map(([x, z]: [number, number]) =>
        W2(U.clamp(x, 0.6, LW - 0.6), U.clamp(z, 0.6, LD - 0.6))
      )
    );
  if (def.area) {
    const a = W2(def.area[0], def.area[1]),
      c = W2(def.area[2], def.area[3]);
    res.area = [
      Math.min(a[0], c[0]),
      Math.min(a[1], c[1]),
      Math.max(a[0], c[0]),
      Math.max(a[1], c[1]),
    ];
  }
  if (spotCache.size > 400) spotCache.clear();
  spotCache.set(key, res);
  return res;
}
