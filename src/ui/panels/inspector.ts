/**
 * Vira City — Entity Inspector Panel (`src/ui/panels/inspector.ts`)
 *
 * Provides inspection views and realtime status monitors for selected buildings,
 * simulation vehicles (with path ribbon & camera follow), and transit stations/stops.
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
import { UI } from '@/ui/ui';
import { $, q, head, bindClose, sv, sm, goodCol, meter } from '@/ui/dom';
import { Building, Vehicle, TransitStop, TransitWaitingPassenger } from '@/types';
import { t } from '@/i18n';

const PROB: Record<string, [string, string]> = {
  noroad: ['No road access', 'Connect a road to the front of this building.'],
  noconn: [
    'Not connected to the highway',
    'Residents and goods cannot reach this building. Connect its road to the rest of the city.',
  ],
  nowater: ['No drinking water', 'Connect clean water pipes and pumping stations to supply fresh water.'],
  sewage: ['Sewage is backing up', 'Connect sewer pipes and treatment facilities to drain wastewater.'],
  water_polluted: ['Poisoned water supply', 'Water pumps or towers are drawing from contaminated water/soil! Check environmental overlays.'],
  sick: ['Medical emergency', 'Citizens are sick. Local clinics or hospitals need to dispatch an ambulance.'],
  dead: ['Deceased awaiting hearse', 'Bodies need collection. Build a Cemetery or Crematorium within range.'],
  garbage: ['Garbage is piling up', 'Build a Waste Transfer Station within range.'],
  stockout: ['No goods to sell', 'Commercial business lacks stock. Build freight connections or local industry to supply goods.'],
  workers: ['Not enough workers', 'More housing nearby, or better transit, will fill these jobs.'],
  customers: ['Not enough customers', 'Shops need residents nearby. Zone more housing or add transit.'],
  fire: ['On fire', 'A fire truck is needed. Build a Fire Station within range.'],
};

function getProb(k: string): [string, string] {
  const base = PROB[k] || [k, ''];
  return [
    t('inspector.problems.' + k + '.title', base[0]),
    t('inspector.problems.' + k + '.desc', base[1]),
  ];
}

export function clearPathRibbon(): void {
  if (UI.pathRibbon) {
    Gfx.scene.remove(UI.pathRibbon);
    UI.pathRibbon.geometry.dispose();
    UI.pathRibbon = null;
  }
}

export function drawPathRibbon(v: Vehicle): void {
  clearPathRibbon();
  if (v.loop) return;
  const Wd = World,
    pts: number[] = [];
  for (let k = v.seg; k < v.path.length; k++) {
    const i = v.path[k];
    const x = (U.tx(i) + 0.5) * C.TILE,
      z = (U.ty(i) + 0.5) * C.TILE;
    pts.push(x, Wd.roadH(x, z) + 1.2, z);
  }
  UI.pathRibbon = Meshes.ribbon(pts, 1.4, '#9fd3ff', false);
  if (UI.pathRibbon) Gfx.scene.add(UI.pathRibbon);
}

export function selectBuilding(b: Building | null): void {
  UI.junctionTile = -1;
  UI.selected = b;
  UI.selVehicle = null;
  UI.selStop = null;
  UI.follow = false;
  clearPathRibbon();
  Meshes.setSelection(b);
  const p = $('infoPanel');
  if (!b) {
    p.hidden = true;
    return;
  }
  if (window.innerWidth <= 768) {
    UI.openPanel(null);
  }
  p.hidden = false;
  renderBuilding(p, b);
}

export function selectVehicle(v: Vehicle | null): void {
  UI.select(null);
  UI.selVehicle = v;
  if (!v) return;
  if (window.innerWidth <= 768) {
    UI.openPanel(null);
  }
  const p = $('infoPanel');
  p.hidden = false;
  const kind = v.kind || 'car';
  const vehTitle = t('inspector.vehicles.' + kind, kind);
  p.innerHTML =
    head(vehTitle, v.line ? v.line.name : v.purpose) +
    `<div class="row"><span>${t('inspector.status', 'Status')}</span><b data-v="status"></b></div>
     <div class="row"><span>${t('inspector.speed', 'Speed')}</span><b data-v="spd"></b></div>
     <div class="row"><span>${t('inspector.road', 'Road')}</span><b data-v="road"></b></div>
     <div class="row"><span>${t('inspector.lane', 'Lane')}</span><b data-v="lane"></b></div>
     ${
       v.line
         ? `<div class="row"><span>${t('inspector.pax', 'Passengers')}</span><b data-v="pax"></b></div>`
         : `<div class="row"><span>${t('inspector.trip', 'Time on the road')}</span><b data-v="trip"></b></div>`
     }
     <div class="btns" style="margin-top:8px"><button class="btn primary" id="vfollow">${t('inspector.follow', 'Follow')}</button></div>`;

  bindClose(p, () => {
    UI.selVehicle = null;
    UI.follow = false;
    clearPathRibbon();
    p.hidden = true;
  });

  const btnFollow = q<HTMLElement>('#vfollow', p);
  if (btnFollow) {
    btnFollow.onclick = () => {
      UI.follow = !UI.follow;
      btnFollow.textContent = UI.follow ? t('inspector.stop_following', 'Stop following') : t('inspector.follow', 'Follow');
    };
  }

  drawPathRibbon(v);
  updVehicle(p);
}

export function updVehicle(p: HTMLElement): void {
  const v = UI.selVehicle;
  if (!v) return;
  if (!Traffic.vehicles.includes(v)) {
    sv(p, 'status', t('inspector.arrived', 'Arrived'));
    UI.follow = false;
    clearPathRibbon();
    return;
  }
  const kmh = Math.round((v.speed / C.VEH_SPEED) * 3.6);
  sv(p, 'status', v.dwell > 0 ? t('inspector.at_stop', 'At a stop') : v.speed < 0.5 ? t('inspector.waiting_traffic', 'Waiting in traffic') : t('inspector.driving', 'Driving'));
  sv(p, 'spd', kmh + ' ' + t('common.km_h', 'km/h'));
  const rt = World.road[v.cur];
  sv(p, 'road', rt ? C.ROADS[rt].name : '–');
  const nl = World.lanesToward(v.cur, v.din).length;
  sv(
    p,
    'lane',
    nl > 1
      ? t('inspector.lane_of', {
          lane: v.laneIn + 1,
          total: nl,
          side: v.laneIn === 0 ? t('inspector.lane_right', ' (right)') : v.laneIn === nl - 1 ? t('inspector.lane_left', ' (left)') : '',
        })
      : t('inspector.single_lane', 'Single lane')
  );
  sv(p, 'trip', Math.round(((Traffic.time - v.born) * 60) / C.HOUR_SEC) + ' ' + t('common.min', 'min'));
  if (v.line) sv(p, 'pax', (v.load || 0) + ' / ' + C.TRANSIT[v.line.type].cap);
}

export function selectStop(s: TransitStop | null): void {
  UI.select(null);
  UI.selStop = s;
  if (!s) return;
  const p = $('infoPanel');
  p.hidden = false;
  const lines = Transit.lines.filter(l => l.stops.includes(s.id));
  const stopKind = s.type === 'bus'
    ? t('inspector.stops.bus', 'Bus stop')
    : s.type === 'tram'
    ? t('inspector.stops.tram', 'Streetcar stop')
    : World.rail[s.tile] === 2
    ? t('inspector.stops.station_underground', 'Underground station')
    : t('inspector.stops.station_elevated', 'Elevated station');

  p.innerHTML =
    head(s.name, stopKind) +
    `<div class="row"><span>${t('inspector.waiting_pax', 'Waiting passengers')}</span><b data-v="wait"></b></div>
     <div class="sec">${
       lines.length
         ? lines
             .map(
               l =>
                 `<div class="row"><span><span class="chip" style="background:${l.color}33;color:#fff">${
                   l.name
                 }</span></span><b>${l.vehicles} ${
                   l.type === 'rail' ? t('transit.trains', 'trains') : l.type === 'tram' ? t('transit.streetcars', 'streetcars') : t('transit.buses', 'buses')
                 }</b></div>`
             )
             .join('')
         : `<div class="sub">${t('inspector.no_lines_serving', 'No line serves this stop yet.')}</div>`
     }</div>
     <div class="btns" style="margin-top:10px"><button class="btn danger" id="sdel">${t('inspector.remove_stop', 'Remove stop')}</button></div>`;

  bindClose(p, () => {
    UI.selStop = null;
    p.hidden = true;
  });

  const btnDel = q<HTMLElement>('#sdel', p);
  if (btnDel) {
    btnDel.onclick = () => {
      Transit.removeStop(s);
      UI.selStop = null;
      p.hidden = true;
      UI.refreshTransit();
    };
  }

  sv(
    p,
    'wait',
    s.waiting.reduce((a: number, qitem: TransitWaitingPassenger) => a + qitem.n, 0)
  );
}

export function renderBuilding(p: HTMLElement, b: Building): void {
  const S = Sim;
  if (b.kind === 'svc') {
    const s = C.SERVICES[b.svc];
    p.innerHTML =
      head(s.name, s.desc) +
      `<div class="row"><span>${t('inspector.upkeep', 'Upkeep')}</span><b>${U.money(s.upkeep)} / ${t('common.month', 'month')}</b></div>
       ${
         s.cov !== 'landmark' && s.cov !== 'park'
           ? `<div class="row"><span>${t('inspector.works_best_within', 'Works best within')}</span><b>~${
               Math.round(((s.radius * 0.55 * C.TILE) / 10)) * 10
             } m</b></div>`
           : ''
       }
       ${b.svc === 'cemetery' ? `<div class="row"><span>${t('inspector.graves_occupied', 'Graves Occupied')}</span><b>${b.graves || 0} / 800</b></div>` : ''}
       ${b.svc === 'water_pump' || b.svc === 'water_tower' ? `<div class="row"><span>${t('inspector.water_pumping', 'Water Pumping')}</span><b>${(b.waterFlow || 0).toLocaleString()} m³/mo</b></div>` : ''}
       ${b.svc === 'water_treatment' || b.svc === 'sewage_drain' ? `<div class="row"><span>${t('inspector.sanitation_flow', 'Sanitation Flow')}</span><b>${(b.sewageCap || 0).toLocaleString()} m³/mo</b></div>` : ''}
       ${s.veh ? `<div class="row"><span>${t('inspector.vehicles_out', 'Vehicles out')}</span><b data-v="veh"></b></div>` : ''}
       <div data-v="sprob" class="sub"></div>
       <div class="btns" style="margin-top:10px"><button class="btn" id="bmove" title="Pick it up and place it somewhere else">${t('inspector.relocate', { cost: U.money(S.moveCost(b)) })}</button><button class="btn danger" id="bdel">${t('inspector.demolish', 'Demolish')}</button></div>`;
  } else {
    const z = C.ZONES[b.zone],
      res = z.cat === 'res';
    p.innerHTML =
      head(b.name, z.name) +
      `<div class="row"><span>${t('inspector.level', 'Level')}</span><b class="stars" data-v="stars"></b></div>
       <div data-v="chip"></div>
       <div class="sec">
       ${
         res
           ? `<div class="row"><span>${t('inspector.residents', 'Residents')}</span><b data-v="res"></b></div><div class="row"><span>${t('inspector.employed', 'Employed')}</span><b data-v="emp"></b></div><div class="row"><span>${t('inspector.commute', 'Average commute')}</span><b data-v="comm"></b></div>`
           : `<div class="row"><span>${t('inspector.workers', 'Workers')}</span><b data-v="wk"></b></div><div class="row"><span>${t('inspector.out_of_town', 'From out of town')}</span><b data-v="out"></b></div>${
               z.cat === 'com'
                 ? `<div class="row"><span>${t('inspector.customers', 'Customers')}</span>` +
                   meter('cust') +
                   `</div><div class="row"><span>${t('inspector.stock', 'Inventory Stock')}</span>` +
                   meter('stock') +
                   '</div>'
                 : z.cat === 'ind'
                 ? `<div class="row"><span>${t('inspector.industry_type', 'Industry Type')}</span><b data-v="indSpec"></b></div><div class="row"><span>${t('inspector.production_rate', 'Production Rate')}</span><b data-v="indRate"></b></div><div class="row"><span>${t('inspector.goods_buffer', 'Goods Buffer')}</span>` +
                   meter('indStock') +
                   `</div><div class="row"><span>${t('inspector.natural_deposit', 'Natural Deposit')}</span><b data-v="indDeposit"></b></div>`
                 : ''
             }`
       }
       <div class="row"><span>${t('inspector.happiness', 'Happiness')}</span>${meter('happy')}</div>
       <div class="row"><span>${t('inspector.land_value', 'Land value')}</span>${meter('lv')}</div>
       <div class="row"><span>${t('inspector.level_progress', 'Level progress')}</span>${meter('prog')}</div>
       <div class="row"><span>${t('inspector.garbage', 'Garbage')}</span>${meter('garb')}</div></div>
       <div class="sec"><div class="lbl">${t('inspector.services_in_range', 'Services in range')}</div>
       ${[
         ['police', t('inspector.services.police', 'Police')],
         ['fire', t('inspector.services.fire', 'Fire')],
         ['health', t('inspector.services.health', 'Health')],
         ['edu', t('inspector.services.edu', 'Education')],
         ['park', t('inspector.services.park', 'Parks')],
         ['transit', t('inspector.services.transit', 'Transit')],
       ]
         .map(k => `<div class="row"><span>${k[1]}</span>${meter('c_' + k[0])}</div>`)
         .join('')}</div>
       <div class="sec"><div class="lbl">${t('inspector.utilities_health', 'Utilities & Health')}</div>
       <div class="row"><span>${t('inspector.water_supply', 'Water Supply')}</span><b data-v="waterStatus"></b></div>
       <div class="row"><span>${t('inspector.sewage_drain', 'Sewage Drain')}</span><b data-v="sewageStatus"></b></div>
       <div class="row"><span>${t('inspector.sick_citizens', 'Sick Citizens')}</span><b data-v="sickStatus">0</b></div>
       <div class="row"><span>${t('inspector.dead_citizens', 'Deceased Citizens')}</span><b data-v="deadStatus">0</b></div>
       </div>
       <div class="btns" style="margin-top:10px"><button class="btn danger" id="bdel">${t('inspector.demolish', 'Demolish')}</button></div>`;
  }

  bindClose(p, () => UI.select(null));

  const btnDel = q<HTMLElement>('#bdel', p);
  if (btnDel) {
    btnDel.onclick = () => {
      S.removeBuilding(b);
      UI.sfx('demolish');
      UI.select(null);
    };
  }

  const mv = q<HTMLElement>('#bmove', p);
  if (mv) {
    mv.onclick = () => {
      UI.select(null);
      Tools.setTool({ type: 'move', id: b.id });
    };
  }

  updBuilding(p, b);
}

export function updBuilding(p: HTMLElement, b: Building): void {
  const S = Sim,
    cv = S.cov,
    i = S.centerTile(b);
  if (!S.buildings.has(b.id)) {
    UI.select(null);
    return;
  }
  if (b.kind === 'svc') {
    const s = C.SERVICES[b.svc];
    if (s.veh) sv(p, 'veh', b.vehOut + ' / ' + s.vehCount);
    sv(p, 'sprob', b.prob === 'noroad' ? t('inspector.no_road_access', 'This building has no road access.') : '');
    return;
  }
  const z = C.ZONES[b.zone],
    res = z.cat === 'res';
  const stars = q<HTMLElement>('[data-v="stars"]', p);
  if (stars && stars.dataset.l !== String(b.level)) {
    stars.dataset.l = String(b.level);
    stars.innerHTML = '★'.repeat(b.level) + '<span style="color:rgba(255,255,255,0.18)">' + '★'.repeat(5 - b.level) + '</span>';
  }
  const chip = q<HTMLElement>('[data-v="chip"]', p);
  let html: string;
  if (b.state === 'build') html = `<span class="chip warn">${t('inspector.under_construction', 'Under construction')}</span>`;
  else if (b.state === 'aband') html = `<span class="chip bad">${t('inspector.abandoned', 'Abandoned: residents left because they were unhappy')}</span>`;
  else if (b.state === 'fire') {
    const pInfo = getProb('fire');
    html = `<span class="chip bad">${pInfo[0]}</span><div class="sub" style="font-size:12px;margin-top:4px">${pInfo[1]}</div>`;
  } else if (b.prob && PROB[b.prob]) {
    const pInfo = getProb(b.prob);
    html = `<span class="chip bad">${pInfo[0]}</span><div class="sub" style="font-size:12px;margin-top:4px">${pInfo[1]}</div>`;
  } else html = `<span class="chip good">${t('inspector.operating_normally', 'Operating normally')}</span>`;

  if (chip && chip.dataset.h !== html) {
    chip.innerHTML = html;
    chip.dataset.h = html;
  }
  if (res) {
    sv(p, 'res', b.cap + ' ' + t('topbar.population', 'residents'));
    sv(p, 'emp', b.employed + ' / ' + b.cap);
    sv(p, 'comm', b.commute ? b.commute + ' ' + t('common.min', 'min') : '–');
  } else {
    sv(p, 'wk', b.filled + ' / ' + b.cap);
    sv(p, 'out', (b.outTown || 0) + ' ' + t('inspector.out_of_town', 'commuters'));
    if (z.cat === 'com') {
      sm(p, 'cust', (b.cust || 0) / 100, goodCol((b.cust || 0) / 70));
      const sMax = b.stockMax || 50;
      const sCur = b.stock || 0;
      sm(p, 'stock', sCur / sMax, sCur <= 0 ? 'var(--bad)' : sCur < sMax * 0.3 ? 'var(--warn)' : 'var(--good)');
    } else if (z.cat === 'ind') {
      sv(p, 'indSpec', (b.industryType || 'generic').toUpperCase());
      sv(p, 'indRate', (b.outputRate || 0) + ' ' + t('common.units_per_hour', 'units/h'));
      const sMax = b.stockMax || 150;
      sm(p, 'indStock', (b.stock || 0) / sMax, 'var(--accent)');
      const tileRes = World.resource ? World.resource[i] : 0;
      sv(p, 'indDeposit', C.RESOURCE_NAMES[tileRes] || 'None');
    }
  }
  sm(p, 'happy', b.happy / 100, goodCol(b.happy / 100));
  sm(p, 'lv', cv.lv[i] / 80, goodCol(cv.lv[i] / 70));
  sm(p, 'prog', b.level >= 5 ? 1 : b.prog, 'var(--accent)');
  sm(p, 'garb', b.garbage / 150, b.garbage > 100 ? 'var(--bad)' : 'var(--mute)');
  for (const k of ['police', 'fire', 'health', 'edu', 'park', 'transit']) {
    const v = Math.min(1, cv[k][i]);
    sm(p, 'c_' + k, v, goodCol(v));
  }
  const waterTxt = b.waterPolluted ? t('inspector.contaminated', 'Contaminated!') : b.water ? t('inspector.connected_clean', 'Connected (Clean)') : t('inspector.no_supply', 'No Supply');
  const sewageTxt = b.sewage ? t('inspector.connected', 'Connected') : t('inspector.backed_up', 'Backed Up');
  sv(p, 'waterStatus', waterTxt);
  sv(p, 'sewageStatus', sewageTxt);
  sv(p, 'sickStatus', String(b.sick || 0));
  sv(p, 'deadStatus', String(b.dead || 0));
}
