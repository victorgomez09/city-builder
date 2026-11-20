/**
 * Vira City — City Goals & Milestone Dialogs (`src/ui/goals.ts`)
 *
 * Tracks player tutorial & city development goals and displays the milestone
 * celebration modal dialog when population benchmarks are reached.
 */

import { C } from '@/core/constants';
import { U } from '@/core/utils';
import { World } from '@/world/world';
import { Sim } from '@/sim/sim';
import { Transit } from '@/transit/transit';
import { Milestone, RoadDef } from '@/types';
import { $, q } from '@/ui/dom';
import { svg } from '@/ui/icons';
import { CATS, allItems, idOf, refreshBadges } from '@/ui/catalog';
import { t } from '@/i18n';

let roadCache = { t: 0, set: new Set<number>() };

export function hasRoad(fn: (r: RoadDef) => boolean): boolean {
  const now = performance.now();
  if (now - roadCache.t > 1500) {
    roadCache.t = now;
    roadCache.set = new Set();
    const R = World.road;
    for (let i = 0; i < R.length; i++) if (R[i]) roadCache.set.add(R[i]);
  }
  for (const r of roadCache.set) {
    if (fn(C.ROADS[r])) return true;
  }
  return false;
}

export function hasZone(z: number): boolean {
  const Z = World.zone;
  for (let i = 0; i < Z.length; i += 4) {
    if (Z[i] === z) return true;
  }
  return false;
}

export function hasSvc(k: string): boolean {
  return [...Sim.buildings.values()].some(b => b.kind === 'svc' && b.svc === k);
}

export function countRoads(): number {
  const R = World.road;
  let n = 0;
  for (let i = 0; i < R.length; i++) {
    if (R[i]) {
      n++;
      if (n > 5) break;
    }
  }
  return n;
}

export const GOALS: [string, () => boolean][] = [
  ['Draw a road from the end of the highway', () => countRoads() > 3],
  ['Zone low density housing beside your road', () => hasZone(1)],
  ['Zone some commercial and industry', () => hasZone(4) && hasZone(6)],
  ['Reach 50 residents (Hamlet)', () => Sim.milestone >= 1],
  ['Build a Waste Transfer Station and a Medical Clinic', () => hasSvc('garbage') && hasSvc('clinic')],
  ['Add bike lanes or a bike path', () => hasRoad(r => Boolean(r.bike || !r.car))],
  ['Reach 150 residents (Village)', () => Sim.milestone >= 2],
  ['Build a Police Station and a Fire Station', () => hasSvc('police') && hasSvc('fire')],
  ['Build an Elementary School', () => hasSvc('elem')],
  ['Lay a four-lane avenue', () => hasRoad(r => r.grp === 'medium')],
  ['Change an intersection in the editor', () => World.clusters.some(c => c.cfg.ctrl !== 'auto')],
  ['Reach 300 residents and start a bus line', () => Transit.lines.some(l => l.type === 'bus' && l.stops.length >= 3)],
  ['Grow to a Town (600 residents)', () => Sim.milestone >= 4],
  ['Grow to a Large Town (1,200 residents)', () => Sim.milestone >= 5],
  ['Grow to a Small City (2,500 residents)', () => Sim.milestone >= 6],
  [
    'Build your first landmark',
    () => [...Sim.buildings.values()].some(b => b.kind === 'svc' && C.SERVICES[b.svc].cat === 'landmarks'),
  ],
  ['Reach Metropolis (15,000 residents)', () => Sim.milestone >= 9],
];

export function updGoals(goalsOpen: boolean, onToggle: (open: boolean) => void): void {
  const g = $('goals');
  const ip = $('infoPanel');
  // Avoid collision with building/vehicle inspector
  if (ip && !ip.hidden) {
    g.hidden = true;
    return;
  }
  g.hidden = !goalsOpen;
  if (!goalsOpen) return;

  const st = GOALS.map(qitem => qitem[1]());
  let first = st.findIndex(d => !d);
  if (first < 0) first = GOALS.length;
  const from = Math.max(0, first - 1),
    to = Math.min(GOALS.length, first + 3);
  const html =
    `<div class="goals-head"><h4><span>${t('goals.city_goals', 'City goals')} · ${first}/${GOALS.length}</span></h4><button class="x" id="gtog" title="${t('goals.close_goals', 'Close goals')} (Esc)" aria-label="Close goals">×</button></div>` +
    `<ol start="${from + 1}">${GOALS.slice(from, to)
      .map((qitem, k) => `<li class="${st[from + k] ? 'done' : from + k === first ? 'cur' : ''}">${qitem[0]}</li>`)
      .join('')}</ol>`;

  if (g.dataset.h !== html) {
    g.innerHTML = html;
    g.dataset.h = html;
    const gtog = q<HTMLElement>('#gtog', g);
    if (gtog) {
      gtog.onclick = () => {
        onToggle(false);
      };
    }
  }
}

export function showMilestoneModal(m: Milestone, onDismiss?: () => void): void {
  const idx = C.MILESTONES.indexOf(m);
  const seen = new Set<string>();
  const items = allItems().filter(it => it.unlock === idx && !seen.has(idOf(it)) && (seen.add(idOf(it)), true));
  const S = Sim;
  for (const it of items) if (!S.unseen.includes(idOf(it))) S.unseen.push(idOf(it));
  const catName = (k?: string) => {
    const c = CATS.find(ct => ct.key === k);
    return c ? t('cats.' + c.key, c.name) : '';
  };
  const show = items.slice(0, 18);
  const M = $('modal');
  M.innerHTML = `<div class="glass mbox wide"><div class="eyebrow">${t('goals.milestone_reached', 'Milestone reached')}</div><h2>${m.name}</h2>
    <p>${t('goals.milestone_grant', { city: S.name, pop: m.pop.toLocaleString(), reward: U.money(m.reward) })}</p>
    ${
      show.length
        ? `<div class="lbl" style="text-align:left;margin-bottom:6px">${t('goals.unlocked', 'Unlocked')}</div><div class="unl">${show
            .map(
              it =>
                `<div class="ucard"><div class="sw" style="${
                  it.thumb ? 'background:linear-gradient(#3a4654,#232a33)' : 'background:' + (it.col || '#333')
                }">${it.thumb || (it.icon ? svg(it.icon) : '')}</div><b>${it.name}</b><small>${catName(it.cat)}</small></div>`
            )
            .join('')}</div>${
            items.length > show.length
              ? `<div class="sub" style="margin-top:6px">${t('goals.and_more', { count: items.length - show.length })}</div>`
              : ''
          }`
        : ''
    }
    <button class="btn primary" id="mok" style="margin-top:14px">${t('goals.keep_building', 'Keep building')}</button></div>`;
  M.hidden = false;
  const mok = q<HTMLElement>('#mok', M);
  if (mok) {
    mok.onclick = () => {
      M.hidden = true;
      if (onDismiss) onDismiss();
      refreshBadges();
    };
  }
  refreshBadges();
}
