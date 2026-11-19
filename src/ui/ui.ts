/**
 * Vira City — User Interface Controller & Management (`src/ui/ui.ts`)
 *
 * Coordinates toolbars, category palettes, intersection editors, side panels,
 * info views, goal progression, and building/vehicle inspector ribbons.
 */

import { C } from '@/core/constants';
import { U } from '@/core/utils';
import { World } from '@/world/world';
import { Gfx } from '@/render/gfx';
import { Meshes } from '@/render/meshes';
import { Sim } from '@/sim/sim';
import { Traffic } from '@/traffic/traffic';
import { Transit } from '@/transit/transit';
import { Tools } from '@/tools/tools';
import { Game } from '@/game';
import * as THREE from 'three';

import { $, $$, q, sv } from '@/ui/dom';
import {
  Building,
  Vehicle,
  TransitStop,
  TransitWaitingPassenger,
  Milestone,
  IntersectionControl,
} from '@/types';
import { svg } from '@/ui/icons';

import { renderViewsPanel, setOverlay, refreshOverlay } from '@/ui/panels/views';
import { renderBudgetPanel, updBudget } from '@/ui/panels/budget';
import { renderTransitPanel, updTransit } from '@/ui/panels/transit';
import { renderStatsPanel, updStats } from '@/ui/panels/stats';
import { renderDistrictsPanel, updDistricts, openDistrict } from '@/ui/panels/districts';
import { renderSettingsPanel } from '@/ui/panels/settings';
import { renderSupplyPanel, updSupply } from '@/ui/panels/supply';

import { CATS, catItems, MenuItem, refreshBadges, idOf } from '@/ui/catalog';
import { openJunction, setJunctionCtrl } from '@/ui/panels/junction';
import { updGoals, showMilestoneModal } from '@/ui/goals';
import {
  selectBuilding,
  selectVehicle,
  selectStop,
  updBuilding,
  updVehicle,
  clearPathRibbon,
} from '@/ui/panels/inspector';

export interface UIState {
  selected: Building | null;
  selVehicle: Vehicle | null;
  selStop: TransitStop | null;
  overlay: string | null;
  panel: string | null;
  lastSpeed: number;
  follow: boolean;
  selectedDistrictId: number | null;
  junctionTile: number;
  goalsOpen: boolean;
  cat: string | null;
  tab: Record<string, string>;
  pathRibbon: THREE.Mesh | null;
  _editing?: boolean;
  openCat: (k: string | null) => void;
  openPanel: (key: string | null) => void;
  closePanels: () => void;
  setOverlay: (k: string | null) => void;
  refreshTransit: () => void;
  openDistrict: (id: number) => void;
  openJunction: (tile: number) => void;
  setJunctionCtrl: (tile: number, ctrl: IntersectionControl) => void;
  select: (b: Building | null) => void;
  selectVehicle: (v: Vehicle | null) => void;
  selectStop: (s: TransitStop | null) => void;
  setSpeed: (s: number) => void;
  toast: (text: string, kind?: string) => void;
  sfx: (kind: string) => void;
  milestone: (m: Milestone) => void;
  update: () => void;
  init: () => void;
  catItems: (key: string, tab?: string | null) => MenuItem[];
  refreshBadges: () => void;
  onRoadMode: () => void;
  onToolChange: () => void;
  [key: string]: unknown;
}

export const UI: UIState = {
  selected: null,
  selVehicle: null,
  selStop: null,
  overlay: null,
  panel: null,
  lastSpeed: 1,
  follow: false,
  selectedDistrictId: null,
  junctionTile: -1,
  goalsOpen: true,
  cat: null,
  tab: {},
  pathRibbon: null,
  openCat: () => {},
  openPanel: () => {},
  closePanels: () => {},
  setOverlay,
  refreshTransit: () => {},
  openDistrict,
  openJunction,
  setJunctionCtrl,
  select: selectBuilding,
  selectVehicle,
  selectStop,
  setSpeed: () => {},
  toast: () => {},
  sfx: () => {},
  milestone: () => {},
  update: () => {},
  init: () => {},
  catItems,
  refreshBadges,
  onRoadMode: () => {},
  onToolChange: () => {},
};

// ---------------- init ----------------
UI.init = function () {
  if (typeof window !== 'undefined') {
    const CB: Record<string, unknown> = (window as any).CB || {};
    CB.UI = UI;
    CB.Tools = Tools;
    (window as any).CB = CB;
  }
  const tb = $('toolbar');
  tb.innerHTML =
    CATS.map(
      c => `<button class="tbtn" data-cat="${c.key}" title="${c.name}">${svg(c.icon)}<span>${c.name}</span></button>`
    ).join('') +
    '<div class="sep"></div><button class="tbtn danger" id="bdz" title="Bulldoze (B)">' +
    svg('bulldoze') +
    '<span>Bulldoze</span></button>';

  $$<HTMLElement>('[data-cat]', tb).forEach(b =>
    b.addEventListener('click', () => UI.openCat(b.dataset.cat === UI.cat ? null : b.dataset.cat || null))
  );

  $('bdz').addEventListener('click', () => {
    const on = Tools.tool.type === 'bulldoze';
    UI.openCat(null);
    Tools.setTool(on ? null : { type: 'bulldoze' });
  });

  for (const s of [0, 1, 2, 4]) {
    $('sp' + s).addEventListener('click', () => UI.setSpeed(s));
  }

  $$<HTMLElement>('#menu [data-panel]').forEach(b =>
    b.addEventListener('click', () => UI.openPanel(UI.panel === b.dataset.panel ? null : b.dataset.panel || null))
  );

  const D = [
    ['rlow', 'L', '#5fcf5a'],
    ['rmed', 'M', '#2f9e48'],
    ['rhigh', 'H', '#167a3a'],
    ['com', 'C', '#59a6f5'],
    ['ind', 'I', '#f0c43a'],
    ['off', 'O', '#b276f2'],
  ];
  $('demand').innerHTML = D.map(
    d =>
      `<div class="dbar" id="dm_${d[0]}" title="${d[0]}"><div class="track"><i style="background:${d[2]}"></i></div><span>${d[1]}</span></div>`
  ).join('');

  const titles: Record<string, string> = {
    rlow: 'Residential · low density',
    rmed: 'Residential · medium density',
    rhigh: 'Residential · high density',
    com: 'Commercial',
    ind: 'Industrial',
    off: 'Office',
  };
  for (const d of D) {
    const el = $('dm_' + d[0]);
    if (el) el.title = titles[d[0]] + ' demand';
  }

  // Clickable vital stats in topbar
  const statMoney = $('statMoney');
  if (statMoney) statMoney.addEventListener('click', () => UI.openPanel(UI.panel === 'budget' ? null : 'budget'));
  const statPop = $('statPop');
  if (statPop) statPop.addEventListener('click', () => UI.openPanel(UI.panel === 'stats' ? null : 'stats'));
  const statHappy = $('statHappy');
  if (statHappy) statHappy.addEventListener('click', () => UI.openPanel(UI.panel === 'views' ? null : 'views'));
  const demandEl = $('demand');
  if (demandEl) demandEl.addEventListener('click', () => UI.openCat(UI.cat === 'zones' ? null : 'zones'));
  const mileBtn = $('mileBtn');
  if (mileBtn) {
    mileBtn.addEventListener('click', () => {
      UI.goalsOpen = !UI.goalsOpen;
      updGoals(UI.goalsOpen, (open: boolean) => {
        UI.goalsOpen = open;
        updGoals(UI.goalsOpen, () => {});
      });
    });
  }

  // Keyboard shortcut: Escape closes modal, palette, inspector, or side panel cleanly
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const modal = $('modal');
      if (modal && !modal.hidden) {
        modal.hidden = true;
        return;
      }
      if (UI.cat) {
        UI.openCat(null);
        return;
      }
      if (Tools.tool.type && Tools.tool.type !== 'select') {
        Tools.setTool(null);
        return;
      }
      if (UI.selected || UI.selVehicle || UI.selStop || UI.junctionTile >= 0) {
        UI.select(null);
        UI.selVehicle = null;
        UI.selStop = null;
        UI.junctionTile = -1;
        $('infoPanel').hidden = true;
        return;
      }
      if (UI.panel) {
        UI.openPanel(null);
        return;
      }
      if (UI.goalsOpen) {
        UI.goalsOpen = false;
        updGoals(false, () => {});
      }
    }
  });

  setTimeout(() => refreshBadges(UI.cat), 0);
  document.addEventListener('pointermove', e => {
    const t = $('tip');
    t.style.left = e.clientX + 'px';
    t.style.top = e.clientY + 'px';
  });
  UI.goalsOpen = true;
  setInterval(UI.update, 250);
};

UI.openCat = function (key: string | null) {
  if (key && UI.panel) {
    UI.openPanel(null);
  }
  UI.cat = key;
  $$<HTMLElement>('#toolbar [data-cat]').forEach(b => b.classList.toggle('on', b.dataset.cat === key));
  const p = $('palette');
  if (!key) {
    p.hidden = true;
    p.innerHTML = '';
    if (Tools.tool.type !== 'bulldoze') Tools.setTool(null);
    return;
  }
  const cat = CATS.find(c => c.key === key);
  if (cat && cat.tabs && !UI.tab[key]) UI.tab[key] = cat.tabs[0][0] || '';
  if (Tools.tool.type !== 'select') Tools.setTool(null);
  renderPalette();
  p.hidden = false;
};

function tabLocked(cat: { key: string }, tab: string | null) {
  return catItems(cat.key, tab).every(it => !Sim.unlocked(it.unlock));
}

function renderPalette() {
  const key = UI.cat;
  if (!key) return;
  const S = Sim,
    cat = CATS.find(c => c.key === key);
  if (!cat) return;
  const tab = cat.tabs ? UI.tab[key] : null;
  const items = catItems(key, tab);
  const p = $('palette');
  const roadMode = (key === 'roads' && tab !== 'junction' && tab !== 'path') || (key === 'transit' && tab === 'tram');
  const MODES = [
    [
      'straight',
      'Straight (C cycles modes)',
      '<path d="M4 20L20 4"/><circle cx="4" cy="20" r="1.6"/><circle cx="20" cy="4" r="1.6"/>',
    ],
    [
      'curve',
      'Curve: start, bend point, end',
      '<path d="M4 20Q4 4 20 4"/><path d="M4 20L4 4L20 4" stroke-dasharray="2 2.5" opacity=".55"/>',
    ],
    ['sbend', 'S-bend: each piece carries on from the last one', '<path d="M4 20C4 12 20 12 20 4"/>'],
    ['grid', 'Grid: two corners fill an area with streets', '<path d="M3 3h18v18H3zM3 10h18M3 17h18M10 3v18M17 3v18"/>'],
  ];
  const modeSw = roadMode
    ? `<div class="pmode">${MODES.filter(m => key === 'roads' || m[0] !== 'grid')
        .map(
          m =>
            `<button data-mode="${m[0]}" title="${m[1]}" aria-label="${m[1]}" class="${
              Tools.roadMode === m[0] ? 'on' : ''
            }"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${
              m[2]
            }</svg></button>`
        )
        .join('')}</div>`
    : '';

  const tabs = cat.tabs
    ? `<div class="ptabs" role="tablist">${cat.tabs
        .map(
          t =>
            `<button role="tab" class="ptab ${t[0] === tab ? 'on' : ''} ${
              tabLocked(cat, t[0]) ? 'dim' : ''
            }" data-tab="${t[0]}">${t[1]}</button>`
        )
        .join('')}</div>`
    : '';

  p.innerHTML =
    `<div class="phead-bar">` +
      `<div class="pcat-title">${svg(cat.icon)}<span>${cat.name}</span></div>` +
      tabs +
      modeSw +
      `<button class="x pclose" id="pclose" title="Close shelf (Esc)" aria-label="Close">×</button>` +
    `</div>` +
    `<div class="cards">` +
    items
      .map((it, k) => {
        const locked = !S.unlocked(it.unlock);
        return `<button class="card ${locked ? 'locked' : ''}" data-k="${k}" title="${(
          it.name + (it.desc ? ' — ' + it.desc : '')
        ).replace(/"/g, '&quot;')}">
        ${
          locked
            ? `<span class="lock">${C.MILESTONES[it.unlock].pop.toLocaleString()} pop</span>`
            : (Sim.unseen || []).includes(idOf(it))
            ? '<span class="lock newb">New</span>'
            : ''
        }
        <div class="sw" style="${
          it.thumb ? 'background:linear-gradient(#3a4654,#232a33)' : 'background:' + (it.col || '#333')
        }${it.tint ? ';box-shadow:inset 0 -3px 0 ' + it.tint : ''}">${it.thumb || (it.icon ? svg(it.icon) : '')}</div>
        <b>${it.name}</b><small>${locked ? C.MILESTONES[it.unlock].name : it.cost}</small></button>`;
      })
      .join('') +
    `</div>`;

  p.dataset.cat = key;
  p.dataset.tab = tab || '';

  const pclose = q<HTMLElement>('#pclose', p);
  if (pclose) pclose.onclick = () => UI.openCat(null);

  $$<HTMLElement>('[data-tab]', p).forEach(el =>
    el.addEventListener('click', () => {
      UI.tab[key] = el.dataset.tab || '';
      Tools.setTool(null);
      renderPalette();
    })
  );

  $$<HTMLElement>('[data-mode]', p).forEach(el =>
    el.addEventListener('click', () => Tools.setRoadMode(el.dataset.mode as any))
  );

  $$<HTMLElement>('.card', p).forEach(el =>
    el.addEventListener('click', () => {
      const it = items[+el.dataset.k!];
      if (!it) return;
      if (!S.unlocked(it.unlock)) {
        UI.toast(
          'Unlocks at ' +
            C.MILESTONES[it.unlock].name +
            ' (' +
            C.MILESTONES[it.unlock].pop.toLocaleString() +
            ' residents)',
          'bad'
        );
        return;
      }
      if ((Sim.unseen || []).includes(idOf(it))) {
        Sim.unseen = Sim.unseen.filter(x => x !== idOf(it));
        const nb = q('.newb', el);
        if (nb) nb.remove();
        refreshBadges(UI.cat);
      }
      if (it.tool && (it.tool as Record<string, unknown>).mode === 'panel') {
        UI.openPanel('districts');
        return;
      }
      const same = JSON.stringify(Tools.tool) === JSON.stringify(it.tool);
      Tools.setTool(same ? null : (it.tool as any));
    })
  );

  markPalette();
  refreshBadges(UI.cat);
}

UI.onRoadMode = function () {
  $$<HTMLElement>('#palette [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === Tools.roadMode));
};

function markPalette() {
  const p = $('palette');
  if (!UI.cat || (p.hidden && !p.children.length)) return;
  const cat = CATS.find(c => c.key === UI.cat);
  const items = catItems(UI.cat, cat && cat.tabs ? UI.tab[UI.cat] : null);
  const t = JSON.stringify(Tools.tool);
  $$<HTMLElement>('.card', p).forEach(el => {
    const it = items[+el.dataset.k!];
    el.classList.toggle('on', !!it && JSON.stringify(it.tool) === t);
  });
}

UI.onToolChange = function () {
  if (UI.panel === 'transit' && (Tools.tool.type === 'lineEdit') !== !!UI._editing) {
    UI._editing = Tools.tool.type === 'lineEdit';
    UI.refreshTransit();
  }
  markPalette();
  $('bdz').classList.toggle('on', Tools.tool.type === 'bulldoze');
  if (Tools.tool.type === 'bulldoze' && UI.cat) {
    UI.cat = null;
    $('palette').hidden = true;
    $('palette').innerHTML = '';
    $$<HTMLElement>('#toolbar [data-cat]').forEach(b => b.classList.remove('on'));
  }
};

UI.setSpeed = function (s: number) {
  if (s > 0) UI.lastSpeed = s;
  Sim.speed = s;
  for (const k of [0, 1, 2, 4]) $('sp' + k).classList.toggle('on', k === s);
};

UI.toast = function (text: string, kind?: string) {
  const container = $('toasts');
  if (container) {
    const t = document.createElement('div');
    t.className = 'glass toast' + (kind ? ' ' + kind : '');
    t.textContent = text;
    container.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateY(8px)';
      t.style.transition = 'opacity 0.25s ease-out, transform 0.25s ease-out';
      setTimeout(() => t.remove(), 260);
    }, 3200);
    return;
  }
  const t = $('toast');
  if (t) {
    t.textContent = text;
    t.className = 'glass' + (kind ? ' ' + kind : '');
    t.hidden = false;
    clearTimeout((UI as any)._tto);
    (UI as any)._tto = setTimeout(() => (t.hidden = true), 3200);
  }
};

UI.sfx = function (kind: string) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ac = (UI as any)._ac || ((UI as any)._ac = new Ctx());
    if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(),
      g = ac.createGain();
    o.connect(g);
    g.connect(ac.destination);
    const now = ac.currentTime;
    if (kind === 'build') {
      o.frequency.setValueAtTime(320, now);
      o.frequency.exponentialRampToValueAtTime(640, now + 0.12);
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      o.start(now);
      o.stop(now + 0.16);
    } else if (kind === 'demolish') {
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(140, now);
      o.frequency.exponentialRampToValueAtTime(40, now + 0.2);
      g.gain.setValueAtTime(0.18, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      o.start(now);
      o.stop(now + 0.22);
    }
  } catch {
    /* audio unavailable */
  }
};

UI.milestone = function (m: Milestone) {
  showMilestoneModal(m, () => {
    renderPalette();
    refreshBadges(UI.cat);
  });
  UI.sfx('build');
};

// ---------------- side panels registration ----------------
const PANELS: Record<string, (p: HTMLElement) => void> = {
  views: renderViewsPanel,
  supply: renderSupplyPanel,
  budget: renderBudgetPanel,
  transit: renderTransitPanel,
  stats: renderStatsPanel,
  districts: renderDistrictsPanel,
  settings: renderSettingsPanel,
};

UI.openPanel = function (key: string | null) {
  if (key && UI.cat) {
    UI.openCat(null);
  }
  if (UI.panel === 'transit' && key !== 'transit') {
    const tt = Tools.tool.type;
    Transit.showRibbons(tt === 'line' || tt === 'lineEdit' || tt === 'stop');
  }
  UI.panel = key;
  $$<HTMLElement>('#menu [data-panel]').forEach(b => b.classList.toggle('on', b.dataset.panel === key));
  const p = $('sidePanel');
  if (!key) {
    p.hidden = true;
    p.innerHTML = '';
    return;
  }
  p.hidden = false;
  const renderer = PANELS[key];
  if (renderer) renderer(p);
};

UI.closePanels = function () {
  UI.openPanel(null);
};

UI.refreshTransit = function () {
  if (UI.panel === 'transit') {
    const sp = $('sidePanel');
    if (!sp.hidden) updTransit(sp);
  }
};

// ---------------- periodic update ----------------
let tick = 0;
UI.update = function () {
  if (!Game || !Game.running) return;
  tick++;
  const S = Sim,
    st = S.stats;
  $('cityName').textContent = S.name;
  $('money').textContent = U.money(S.money);
  $('money').className = 'num' + (S.money < 0 ? ' neg' : '');
  const pr = S.projected();
  const net = $('net');
  net.textContent = (pr.net >= 0 ? '+' : '') + U.money(pr.net) + ' / month';
  net.className = 'num ' + (pr.net >= 0 ? 'pos' : 'neg');
  $('pop').textContent = U.num(st.pop);
  $('popsub').textContent = U.num(st.filled + st.outsideIn) + ' jobs filled';
  $('happy').textContent = st.pop ? Math.round(st.happy) + '%' : '–';
  $('happysub').textContent = !st.pop
    ? ''
    : st.happy > 70
    ? 'Delighted'
    : st.happy > 55
    ? 'Content'
    : st.happy > 40
    ? 'Uneasy'
    : 'Unhappy';
  const hh = Math.floor(S.hour),
    mm = Math.floor((S.hour - hh) * 60);
  $('time').textContent = String(hh).padStart(2, '0') + ':' + String(Math.floor(mm / 15) * 15).padStart(2, '0');
  $('date').textContent = S.dateStr();
  for (const k in S.demand) {
    const el = $('dm_' + k);
    if (!el) continue;
    const fill = q<HTMLElement>('i', el);
    if (fill) fill.style.height = Math.round(S.demand[k]) + '%';
    const off =
      (k === 'rmed' && !S.unlocked(C.ZONES[2].unlock)) ||
      (k === 'rhigh' && !S.unlocked(C.ZONES[3].unlock)) ||
      (k === 'off' && !S.unlocked(C.ZONES[9].unlock));
    el.classList.toggle('off', off);
  }
  const m = S.milestone,
    nx = C.MILESTONES[m + 1];
  if (nx) {
    const prev = C.MILESTONES[m].pop;
    $('mileFill').style.width = U.clamp((st.pop - prev) / (nx.pop - prev), 0, 1) * 100 + '%';
    $('mileText').textContent = C.MILESTONES[m].name + ' → ' + nx.name + ' at ' + nx.pop.toLocaleString();
  } else {
    $('mileFill').style.width = '100%';
    $('mileText').textContent = C.MILESTONES[m].name;
  }
  while (S.notices.length) {
    const n = S.notices.shift();
    if (n) UI.toast(n.text, n.kind);
  }
  const tip = $('tip');
  const tt = Tools.tip;
  tip.hidden = !tt;
  if (tt) tip.textContent = tt;

  // panels
  const ip = $('infoPanel');
  if (!ip.hidden) {
    if (UI.selected) updBuilding(ip, UI.selected);
    else if (UI.selVehicle) updVehicle(ip);
    else if (UI.selStop) sv(ip, 'wait', UI.selStop.waiting.reduce((a: number, qitem: TransitWaitingPassenger) => a + qitem.n, 0));
  }
  const sp = $('sidePanel');
  if (!sp.hidden) {
    if (UI.panel === 'budget') updBudget(sp);
    else if (UI.panel === 'supply' && tick % 4 === 0) updSupply(sp);
    else if (UI.panel === 'transit') updTransit(sp);
    else if (UI.panel === 'stats' && tick % 4 === 0) updStats(sp);
    else if (UI.panel === 'districts' && tick % 4 === 0) updDistricts(sp);
  }
  if (UI.overlay && tick % 4 === 0) refreshOverlay();
  if (tick % 2 === 0) {
    updGoals(UI.goalsOpen, (open: boolean) => {
      UI.goalsOpen = open;
      updGoals(UI.goalsOpen, () => {});
    });
  }
  if (tick % 8 === 0 && UI.cat) {
    const cat = CATS.find(c => c.key === UI.cat);
    const locks = $$('#palette .card.locked').length;
    const items = catItems(UI.cat, cat && cat.tabs ? UI.tab[UI.cat] : null).filter(it => !S.unlocked(it.unlock)).length;
    if (locks !== items) renderPalette();
  }
  if (UI.junctionTile >= 0 && World.jcl[UI.junctionTile] < 0) {
    $('infoPanel').hidden = true;
    UI.junctionTile = -1;
  }
};

if (typeof window !== 'undefined') {
  (window as any).CB = (window as any).CB || {};
  (window as any).CB.UI = UI;
}

export default UI;
