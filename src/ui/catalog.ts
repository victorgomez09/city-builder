/**
 * Vira City — UI Catalog & Toolbar Definitions (`src/ui/catalog.ts`)
 *
 * Defines categories, menu items, unlocks, and icon badges for the main toolbar
 * and tool palette.
 */

import { C } from '@/core/constants';
import { U } from '@/core/utils';
import { World } from '@/world/world';
import { Meshes } from '@/render/meshes';
import { Sim } from '@/sim/sim';
import { Tools } from '@/tools/tools';
import { roadSvg, pathSvg } from '@/ui/roadSvg';
import { ToolState } from '@/types';
import { $, $$ } from '@/ui/dom';

export interface MenuItem {
  name: string;
  cost: string;
  unlock: number;
  tool: ToolState | Record<string, unknown>;
  thumb?: string;
  desc?: string;
  icon?: string;
  col?: string;
  tint?: string;
  cat?: string;
  tab?: string | null;
}

export interface CategoryDef {
  key: string;
  name: string;
  icon: string;
  tabs?: [string | null, string][] | undefined;
}

const roadItem = (r: number): MenuItem => {
  const R = C.ROADS[r];
  return {
    name: R.name,
    cost: U.money(R.cost) + '/tile',
    unlock: R.unlock,
    tool: { type: 'road', rt: r },
    thumb: roadSvg(R),
    desc: R.desc + (R.w === 2 ? ' Two tiles wide.' : ''),
  };
};

const img = (u: string) => (u ? `<img src="${u}" alt="">` : '');
const svcThumb = (k: string) => {
  const sv = C.SERVICES[k];
  return img(Meshes.thumb('svc:' + k, { kind: 'svc', svc: k, w: sv.size[0], d: sv.size[1] }));
};

const ZONE_SAMPLE: Record<number, [number, number, number]> = {
  1: [1, 2, 3],
  2: [2, 2, 3],
  3: [2, 2, 4],
  4: [1, 2, 3],
  5: [2, 2, 3],
  6: [2, 3, 3],
  7: [2, 2, 3],
  8: [2, 2, 4],
  9: [2, 2, 5],
};

const zoneThumb = (z: number) => {
  const s = ZONE_SAMPLE[z];
  if (!s) return '';
  return img(Meshes.thumb('z:' + z, { kind: 'zone', zone: z, w: s[0], d: s[1], h: s[2] }));
};

const svcItem = (k: string): MenuItem => {
  const sv = C.SERVICES[k];
  return {
    name: sv.name,
    cost: U.money(sv.cost) + ' · ' + U.money(sv.upkeep) + '/mo',
    unlock: sv.unlock,
    tool: { type: 'svc', svc: k },
    thumb: svcThumb(k),
    desc: sv.desc,
  };
};

export const CATS: CategoryDef[] = [
  { key: 'roads', name: 'Roads', icon: 'avenue', tabs: C.ROAD_GROUPS.concat([['junction', 'Intersections']]) },
  {
    key: 'zones',
    name: 'Zoning',
    icon: 'zones',
    tabs: [
      ['res', 'Residential'],
      ['com', 'Commercial'],
      ['work', 'Industry & Office'],
    ],
  },
  { key: 'services', name: 'Services', icon: 'police', tabs: C.SVC_TABS },
  { key: 'parks', name: 'Parks', icon: 'park', tabs: C.PARK_TABS },
  {
    key: 'transit',
    name: 'Transit',
    icon: 'busline',
    tabs: [
      ['bus', 'Bus'],
      ['tram', 'Streetcar'],
      ['train', 'Train'],
      ['metro', 'Metro'],
    ],
  },
  { key: 'landmarks', name: 'Landmarks', icon: 'landmark', tabs: undefined },
  {
    key: 'districts',
    name: 'Districts',
    icon: 'district',
    tabs: [
      ['paint', 'Paint Brush'],
      ['edit', 'Policies'],
    ],
  },
];

export function catItems(key: string, tab?: string | null): MenuItem[] {
  const items: MenuItem[] = [];
  if (key === 'roads') {
    if (tab === 'junction') {
      items.push({
        name: 'Edit Intersection',
        cost: 'Free',
        unlock: 0,
        tool: { type: 'junction' },
        icon: 'junction',
        col: '#3d6b9a',
        desc: 'Click an intersection to change its control and lane arrows.',
      });
      items.push({
        name: 'Traffic Lights',
        cost: 'Free',
        unlock: 0,
        tool: { type: 'junction', apply: 'lights' },
        icon: 'lights',
        col: '#2f6a3a',
        desc: 'Click intersections to add signals.',
      });
      items.push({
        name: 'Stop Signs',
        cost: 'Free',
        unlock: 0,
        tool: { type: 'junction', apply: 'stop' },
        icon: 'stop',
        col: '#a83228',
        desc: 'The smaller road stops. Change which sides in the editor.',
      });
      items.push({
        name: 'All-Way Stop',
        cost: 'Free',
        unlock: 0,
        tool: { type: 'junction', apply: 'allstop' },
        icon: 'stop',
        col: '#7a2a22',
        desc: 'Everyone stops, first come first served.',
      });
      items.push({
        name: 'Roundabout',
        cost: 'Free',
        unlock: 2,
        tool: { type: 'junction', apply: 'round' },
        icon: 'round',
        col: '#2f5a9a',
        desc: 'Yield on entry, keep moving.',
      });
      items.push({
        name: 'No Control',
        cost: 'Free',
        unlock: 0,
        tool: { type: 'junction', apply: 'none' },
        icon: 'free',
        col: '#555c66',
        desc: 'Free-for-all. Fine for quiet streets.',
      });
      items.push({
        name: 'Reset to Auto',
        cost: 'Free',
        unlock: 0,
        tool: { type: 'junction', apply: 'auto' },
        icon: 'junction',
        col: '#444a52',
        desc: 'Lights on medium and larger roads, nothing on small ones.',
      });
    } else if (tab === 'path') {
      for (let k = 1; k < C.PATHS.length; k++) {
        const P = C.PATHS[k];
        items.push({
          name: P.name,
          cost: U.money(P.cost) + '/cell',
          unlock: P.unlock,
          tool: { type: 'path', pk: k },
          thumb: pathSvg(P),
          desc: P.desc,
        });
      }
    } else {
      for (let r = 1; r < C.ROADS.length; r++) {
        if (C.ROADS[r].grp === tab) items.push(roadItem(r));
      }
    }
  } else if (key === 'zones') {
    const ZT: Record<string, number[]> = { res: [1, 2, 8, 3], com: [4, 5], work: [6, 9, 7] };
    for (const z of ZT[tab || 'res'] || ZT.res) {
      const Z = C.ZONES[z];
      if (!Z) continue;
      items.push({
        name: Z.name,
        cost: 'Free',
        unlock: Z.unlock,
        tool: { type: 'zone', z },
        icon: Z.key,
        col: Z.color,
        thumb: zoneThumb(z),
        tint: Z.color,
      });
    }
    items.push({ name: 'Remove Zoning', cost: 'Free', unlock: 0, tool: { type: 'dezone' }, icon: 'dezone', col: '#555c66' });
  } else if (key === 'transit') {
    const TR = C.TRANSIT;
    if (tab === 'bus') {
      items.push({
        name: 'Bus Stop',
        cost: U.money(TR.bus.stopCost),
        unlock: TR.bus.unlock,
        tool: { type: 'stop', st: 'bus' },
        icon: 'busstop',
        col: '#2f86e0',
      });
      items.push({
        name: 'Bus Line',
        cost: U.money(TR.bus.upkeep) + '/bus/mo',
        unlock: TR.bus.unlock,
        tool: { type: 'line', lt: 'bus' },
        icon: 'busline',
        col: '#2f86e0',
        desc: 'Click stops in order, then the first stop again.',
      });
    } else if (tab === 'tram') {
      for (let r = 1; r < C.ROADS.length; r++) {
        if (C.ROADS[r].tram) items.push(roadItem(r));
      }
      items.push({
        name: 'Streetcar Stop',
        cost: U.money(TR.tram.stopCost),
        unlock: TR.tram.unlock,
        tool: { type: 'stop', st: 'tram' },
        icon: 'tramstop',
        col: '#d8642a',
        desc: 'Goes on roads with tram tracks.',
      });
      items.push({
        name: 'Streetcar Line',
        cost: U.money(TR.tram.upkeep) + '/car/mo',
        unlock: TR.tram.unlock,
        tool: { type: 'line', lt: 'tram' },
        icon: 'tramline',
        col: '#d8642a',
        desc: 'Click stops in order, then the first stop again.',
      });
    } else if (tab === 'train') {
      items.push({
        name: C.RAIL[1].name,
        cost: U.money(C.RAIL[1].cost) + '/tile',
        unlock: TR.rail.unlock,
        tool: { type: 'rail', rr: 1 },
        icon: 'elev',
        col: '#7a5a9a',
        desc: C.RAIL[1].desc,
      });
      items.push({
        name: 'Train Station',
        cost: U.money(TR.rail.stopCost),
        unlock: TR.rail.unlock,
        tool: { type: 'stop', st: 'rail' },
        icon: 'station',
        col: '#e85d2a',
      });
      items.push({
        name: 'Train Line',
        cost: U.money(TR.rail.upkeep) + '/train/mo',
        unlock: TR.rail.unlock,
        tool: { type: 'line', lt: 'rail' },
        icon: 'metro',
        col: '#e85d2a',
      });
    } else {
      items.push({
        name: C.RAIL[2].name,
        cost: U.money(C.RAIL[2].cost) + '/tile',
        unlock: TR.rail.unlock,
        tool: { type: 'rail', rr: 2 },
        icon: 'sub',
        col: '#5a4a7a',
        desc: C.RAIL[2].desc,
      });
      items.push({
        name: 'Metro Station',
        cost: U.money(TR.rail.ugStopCost),
        unlock: TR.rail.unlock,
        tool: { type: 'stop', st: 'rail' },
        icon: 'station',
        col: '#c8452a',
      });
      items.push({
        name: 'Metro Line',
        cost: U.money(TR.rail.upkeep) + '/train/mo',
        unlock: TR.rail.unlock,
        tool: { type: 'line', lt: 'rail' },
        icon: 'metro',
        col: '#c8452a',
      });
    }
  } else if (key === 'districts') {
    const Wd = World;
    if (tab === 'paint') {
      const curDist =
        Wd.districts && Wd.districts.size > 0
          ? Tools.tool.districtId && Wd.districts.has(Tools.tool.districtId)
            ? Wd.districts.get(Tools.tool.districtId)
            : [...Wd.districts.values()][0]
          : null;
      const col = curDist ? curDist.color : '#3b82f6';
      items.push({
        name: 'Brush (Small)',
        cost: 'Free',
        unlock: 0,
        tool: { type: 'district', mode: 'paint', radius: 2, districtId: curDist?.id },
        icon: 'zones',
        col,
        desc: 'Paint district zone with a 2-tile radius brush.',
      });
      items.push({
        name: 'Brush (Medium)',
        cost: 'Free',
        unlock: 0,
        tool: { type: 'district', mode: 'paint', radius: 4, districtId: curDist?.id },
        icon: 'zones',
        col,
        desc: 'Paint district zone with a 4-tile radius brush.',
      });
      items.push({
        name: 'Brush (Large)',
        cost: 'Free',
        unlock: 0,
        tool: { type: 'district', mode: 'paint', radius: 7, districtId: curDist?.id },
        icon: 'zones',
        col,
        desc: 'Paint district zone with a 7-tile radius brush.',
      });
      items.push({
        name: 'Erase District',
        cost: 'Free',
        unlock: 0,
        tool: { type: 'district', mode: 'erase', radius: 4 },
        icon: 'dezone',
        col: '#ef4444',
        desc: 'Remove district territory.',
      });
      items.push({
        name: 'Inspect District',
        cost: 'Free',
        unlock: 0,
        tool: { type: 'district', mode: 'select' },
        icon: 'junction',
        col: '#38bdf8',
        desc: 'Click any district to view details and policies.',
      });
    } else {
      items.push({
        name: 'Manage Policies',
        cost: 'Free',
        unlock: 0,
        tool: { type: 'district', mode: 'panel' },
        icon: 'junction',
        col: '#3b82f6',
        desc: 'Open District Policies & Specializations panel.',
      });
    }
  } else {
    for (const k in C.SERVICES) {
      const sv = C.SERVICES[k];
      if (sv.cat !== key || (tab && sv.tab !== tab)) continue;
      items.push(svcItem(k));
    }
  }
  return items;
}

export const idOf = (it: MenuItem): string => JSON.stringify(it.tool);

export function allItems(): (MenuItem & { cat: string; tab: string | null })[] {
  const out: (MenuItem & { cat: string; tab: string | null })[] = [];
  for (const c of CATS) {
    for (const t of c.tabs || [[null, '']]) {
      for (const it of catItems(c.key, t[0])) {
        out.push(Object.assign({ cat: c.key, tab: t[0] }, it));
      }
    }
  }
  return out;
}

export function refreshBadges(activeCat?: string | null): void {
  const un = new Set(Sim.unseen || []);
  const all = allItems().filter(it => un.has(idOf(it)));
  $$<HTMLElement>('#toolbar [data-cat]').forEach(b =>
    b.classList.toggle('new', all.some(it => it.cat === b.dataset.cat))
  );
  $$<HTMLElement>('#palette [data-tab]').forEach(b =>
    b.classList.toggle('new', all.some(it => it.cat === activeCat && it.tab === b.dataset.tab))
  );
}
