/**
 * Vira City — UI Transit Panel
 */

import { C } from '@/core/constants';
import { U } from '@/core/utils';
import { Sim } from '@/sim/sim';
import { Transit } from '@/transit/transit';
import { Tools } from '@/tools/tools';
import { Gfx } from '@/render/gfx';
import { head, bindClose, sv, q, $$ } from '@/ui/dom';
import { UI } from '@/ui/ui';
import { t } from '@/i18n';
import { TransitLine } from '@/types';

export const TYPE_NAME: Record<string, string> = { bus: 'Bus', tram: 'Streetcar', rail: 'Metro' };

let currentFilter: 'all' | 'bus' | 'tram' | 'rail' = 'all';
let currentSort: 'riders' | 'profit' | 'name' = 'riders';

export function renderLines(p: HTMLElement): void {
  const X = Transit,
    L = q<HTMLElement>('#lineList', p);
  if (!L) return;
  const esc = (text: string) =>
    String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');

  const typeLabels: Record<string, string> = {
    bus: t('tabs.bus', 'Bus'),
    tram: t('tabs.tram', 'Streetcar'),
    rail: t('tabs.metro', 'Metro'),
  };

  // Filter lines
  let filtered = X.lines.filter(l => {
    if (currentFilter === 'all') return true;
    return l.type === currentFilter;
  });

  // Sort lines
  filtered = filtered.slice().sort((a, b) => {
    if (currentSort === 'riders') {
      return (b.ridersLast ?? b.ridersMonth ?? 0) - (a.ridersLast ?? a.ridersMonth ?? 0);
    }
    if (currentSort === 'profit') {
      return X.profitOf(b) - X.profitOf(a);
    }
    return a.name.localeCompare(b.name);
  });

  L.innerHTML = filtered.length
    ? filtered
        .map(l => {
          const editing = Tools.tool.type === 'lineEdit' && Tools.tool.line === l.id;
          const vehLabel = l.type === 'rail' ? t('transit.trains', 'Trains') : l.type === 'tram' ? t('transit.streetcars', 'Streetcars') : t('transit.buses', 'Buses');
          const rev = X.revenueOf(l);
          const cost = X.costOf(l);
          const profit = X.profitOf(l);
          const ratio = X.recoveryRatioOf(l);
          const occ = X.occupancyOf(l);
          const occPercent = Math.min(100, Math.round(occ * 100));
          const occClass = occ < 0.3 ? 'occ-low' : occ <= 0.75 ? 'occ-good' : occ <= 1.0 ? 'occ-crowd' : 'occ-crush';
          const occLabel = occ < 0.3
            ? t('transit.occupancy_low', 'Low (<30%)')
            : occ <= 0.75
            ? t('transit.occupancy_optimal', 'Balanced (30-75%)')
            : occ <= 1.0
            ? t('transit.occupancy_crowded', 'Crowded (75-100%)')
            : t('transit.occupancy_crushed', 'Saturated (>100%)');

          return `<div class="tline ${l.broken ? 'broken' : ''} ${editing ? 'editing' : ''}" data-l="${l.id}">
      <div class="tl-head">
        <input type="color" value="${l.color}" data-a="col" title="Line colour">
        <input class="tl-name" value="${esc(l.name)}" data-a="name" maxlength="28">
        <span class="chip">${typeLabels[l.type] || TYPE_NAME[l.type]}</span>
        <span class="badge ${profit >= 0 ? 'good' : 'bad'}" title="${t('transit.recovery_ratio', 'Farebox recovery')}: ${ratio.toFixed(0)}%">
          ${profit >= 0 ? '+' : ''}${U.money(profit)}/mo
        </span>
        <button class="ib" data-a="v" title="${t('transit.show_map', 'Show on the map')}">◎</button>
        <button class="ib" data-a="x" title="${t('transit.delete_line', 'Delete line')}">×</button>
      </div>
      <div class="tl-grid">
        <span>${vehLabel}</span><div class="stepper"><button data-a="-">−</button><b data-v="lv_${l.id}"></b><button data-a="+">+</button></div>
        <span>${t('transit.fare', 'Ticket price')}</span><div class="stepper"><button data-a="f-">−</button><b data-v="lf_${l.id}"></b><button data-a="f+">+</button></div>
        <span>${t('transit.riders', 'Riders')}</span><b data-v="lr_${l.id}"></b>
        <span>${t('transit.every', 'Every')}</span><b data-v="lh_${l.id}"></b>
        <span>${t('transit.revenue', 'Revenue')}</span><b style="color:var(--c-good,#34d399)">+${U.money(rev)}/mo</b>
        <span>${t('transit.upkeep', 'Upkeep')}</span><b data-v="lu_${l.id}"></b>
      </div>
      <div class="tl-occ" style="margin:6px 0;padding:4px 6px;background:rgba(0,0,0,0.2);border-radius:4px;font-size:11px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
          <span>${t('transit.occupancy', 'Crowding / Load')}: <b>${occLabel}</b></span>
          <span>${occPercent}%</span>
        </div>
        <div style="height:5px;background:rgba(255,255,255,0.12);border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${occPercent}%;background:${occ <= 0.75 ? '#10b981' : occ <= 1.0 ? '#f59e0b' : '#ef4444'};border-radius:3px;"></div>
        </div>
      </div>
      <div class="tl-stops">${l.stops
        .map(id => {
          const s = X.stopById(id);
          return s
            ? `<button class="sstop" data-s="${s.id}" title="Show ${esc(s.name)}"><i style="background:${l.color}"></i>${esc(
                s.name
              )}</button>`
            : '';
        })
        .join('<span class="arr">›</span>')}</div>
      <div class="btns"><button class="btn ${editing ? 'primary' : ''}" data-a="edit">${
            editing ? t('transit.done_editing', 'Done editing') : t('transit.edit_route', 'Edit route')
          }</button></div>
      ${
        l.broken
          ? `<div class="sub bad">${t('transit.broken_route', 'Broken route: a stop can no longer be reached. Edit the route or fix the roads.')}</div>`
          : ''
      }
    </div>`;
        })
        .join('')
    : `<div class="sub">${t('transit.no_lines', 'No lines yet. Pick a line tool, click stops in order, then click the first stop again to close the loop.')}</div>`;

  $$<HTMLElement>('.tline', L).forEach(el => {
    const l = X.lineById(+el.dataset.l!);
    if (!l) return;
    $$<HTMLElement>('[data-a]', el).forEach(b => {
      const a = b.dataset.a;
      if (a === 'col') {
        (b as HTMLInputElement).oninput = () => {
          X.setColor(l, (b as HTMLInputElement).value);
          $$<HTMLElement>('.sstop i', el).forEach(i => (i.style.background = (b as HTMLInputElement).value));
        };
        return;
      }
      if (a === 'name') {
        (b as HTMLInputElement).onchange = () => {
          l.name = (b as HTMLInputElement).value.trim() || l.name;
          UI.refreshTransit();
        };
        b.onkeydown = e => e.stopPropagation();
        return;
      }
      b.onclick = () => {
        if (a === '+') X.setVehicles(l, l.vehicles + 1);
        else if (a === '-') X.setVehicles(l, l.vehicles - 1);
        else if (a === 'f+') X.setFare(l, X.fareOf(l) + 0.5);
        else if (a === 'f-') X.setFare(l, X.fareOf(l) - 0.5);
        else if (a === 'x') {
          if (Tools.tool.line === l.id) Tools.setTool(null);
          X.deleteLine(l);
          renderLines(p);
          return;
        } else if (a === 'v') {
          const s = X.stopById(l.stops[0]);
          if (s) Gfx.focus((U.tx(s.tile) + 0.5) * C.TILE, (U.ty(s.tile) + 0.5) * C.TILE, 500);
          X.showRibbons(true, l);
        } else if (a === 'edit') {
          const on = Tools.tool.type === 'lineEdit' && Tools.tool.line === l.id;
          Tools.setTool(on ? null : { type: 'lineEdit', line: l.id });
          if (!on)
            UI.toast(
              t('transit.stop_add_hint', { name: l.name }),
              'good'
            );
          renderLines(p);
          return;
        }
        updTransit(p);
      };
    });
    $$<HTMLElement>('[data-s]', el).forEach(b => {
      b.onclick = () => {
        const s = X.stopById(+b.dataset.s!);
        if (s) {
          Gfx.focus((U.tx(s.tile) + 0.5) * C.TILE, (U.ty(s.tile) + 0.5) * C.TILE, 260);
          UI.selectStop(s);
        }
      };
    });
  });
}

export function updTransit(p: HTMLElement): void {
  const X = Transit,
    S = Sim;
  const totals = X.networkTotals();

  sv(p, 'riders', U.num(totals.riders));
  sv(p, 'share', Math.round(S.stats.transitShare * 100) + '%');
  sv(p, 'waiting', U.num(X.stats.waiting));
  sv(p, 'total_rev', '+' + U.money(totals.revenue) + '/mo');
  sv(p, 'total_cost', '-' + U.money(totals.cost) + '/mo');
  sv(p, 'net_profit', (totals.profit >= 0 ? '+' : '') + U.money(totals.profit) + '/mo');
  sv(p, 'recovery_ratio', totals.recoveryRatio.toFixed(0) + '%');

  for (const l of X.lines) {
    sv(p, 'lv_' + l.id, l.vehicles);
    sv(p, 'lf_' + l.id, '$' + X.fareOf(l).toFixed(2));
    sv(p, 'lr_' + l.id, t('transit.this_month_last', { thisMonth: U.num(l.ridersMonth), lastMonth: U.num(l.ridersLast || 0) }));
    sv(
      p,
      'lh_' + l.id,
      l.loopTime ? Math.max(1, Math.round(((l.loopTime / l.vehicles) * 60) / C.HOUR_SEC)) + ' ' + t('common.min', 'min') : '–'
    );
    sv(p, 'lu_' + l.id, U.money(X.costOf(l)) + '/mo');
  }
}

export function renderTransitPanel(p: HTMLElement): void {
  const X = Transit,
    S = Sim;
  const busOK = S.unlocked(C.TRANSIT.bus.unlock),
    railOK = S.unlocked(C.TRANSIT.rail.unlock),
    tramOK = S.unlocked(C.TRANSIT.tram.unlock);

  const underActive = Gfx.underground;

  p.innerHTML =
    head(t('transit.title', 'Public transport'), t('transit.subtitle', 'Every line, its vehicles, colour and fares')) +
    `<div class="stats-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
      <div class="row" style="margin:0;padding:6px;background:rgba(255,255,255,0.03);border-radius:4px;"><span>${t('transit.riders_last', 'Riders last month')}</span><b data-v="riders"></b></div>
      <div class="row" style="margin:0;padding:6px;background:rgba(255,255,255,0.03);border-radius:4px;"><span>${t('transit.transit_share', 'Trips by transit')}</span><b data-v="share"></b></div>
      <div class="row" style="margin:0;padding:6px;background:rgba(255,255,255,0.03);border-radius:4px;"><span>${t('transit.total_revenue', 'Fare revenue')}</span><b data-v="total_rev" style="color:var(--c-good,#10b981)"></b></div>
      <div class="row" style="margin:0;padding:6px;background:rgba(255,255,255,0.03);border-radius:4px;"><span>${t('transit.total_cost', 'Fleet upkeep')}</span><b data-v="total_cost" style="color:var(--c-bad,#ef4444)"></b></div>
      <div class="row" style="margin:0;padding:6px;background:rgba(255,255,255,0.03);border-radius:4px;"><span>${t('transit.net_profit', 'Net profit / loss')}</span><b data-v="net_profit"></b></div>
      <div class="row" style="margin:0;padding:6px;background:rgba(255,255,255,0.03);border-radius:4px;"><span>${t('transit.recovery_ratio', 'Farebox recovery')}</span><b data-v="recovery_ratio"></b></div>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:8px;">
      <button class="btn ${underActive ? 'primary' : ''}" id="btnUnderground" style="flex:1;">
        ${underActive ? '🚇 ' + t('transit.underground_active', 'Underground View Active') : '🚇 ' + t('transit.toggle_underground', 'Toggle Underground View')}
      </button>
    </div>
    <div class="btns" style="margin-bottom:8px">
      <button class="btn primary" id="nbus" ${busOK ? '' : 'disabled'}>${t('transit.new_bus', 'New bus line')}</button>
      <button class="btn primary" id="ntram" ${tramOK ? '' : 'disabled'}>${t('transit.new_tram', 'New streetcar line')}</button>
      <button class="btn primary" id="nrail" ${railOK ? '' : 'disabled'}>${t('transit.new_metro', 'New metro line')}</button>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.08);font-size:12px;">
      <div style="display:flex;gap:4px;">
        <button class="chip ${currentFilter === 'all' ? 'active' : ''}" id="fltAll">${t('transit.filter_all', 'All')}</button>
        <button class="chip ${currentFilter === 'bus' ? 'active' : ''}" id="fltBus">${t('tabs.bus', 'Bus')}</button>
        <button class="chip ${currentFilter === 'tram' ? 'active' : ''}" id="fltTram">${t('tabs.tram', 'Tram')}</button>
        <button class="chip ${currentFilter === 'rail' ? 'active' : ''}" id="fltRail">${t('tabs.metro', 'Metro')}</button>
      </div>
      <select id="selSort" style="background:#1e293b;color:#f8fafc;border:1px solid rgba(255,255,255,0.15);border-radius:4px;padding:2px 6px;font-size:11px;">
        <option value="riders" ${currentSort === 'riders' ? 'selected' : ''}>${t('transit.sort_riders', 'Sort by Riders')}</option>
        <option value="profit" ${currentSort === 'profit' ? 'selected' : ''}>${t('transit.sort_profit', 'Sort by Profit')}</option>
        <option value="name" ${currentSort === 'name' ? 'selected' : ''}>${t('transit.sort_name', 'Sort by Name')}</option>
      </select>
    </div>
    <div class="sec tlines" id="lineList"></div>`;

  bindClose(p, () => UI.openPanel(null));

  const btnUnderground = q<HTMLElement>('#btnUnderground', p);
  if (btnUnderground) {
    btnUnderground.onclick = () => {
      Gfx.setUnderground(!Gfx.underground);
      renderTransitPanel(p);
    };
  }

  const nbus = q<HTMLElement>('#nbus', p);
  if (nbus)
    nbus.onclick = () => {
      UI.tab.transit = 'bus';
      UI.openCat('transit');
      Tools.setTool({ type: 'line', lt: 'bus' });
    };

  const ntram = q<HTMLElement>('#ntram', p);
  if (ntram)
    ntram.onclick = () => {
      UI.tab.transit = 'tram';
      UI.openCat('transit');
      Tools.setTool({ type: 'line', lt: 'tram' });
    };

  const nrail = q<HTMLElement>('#nrail', p);
  if (nrail)
    nrail.onclick = () => {
      UI.tab.transit = 'metro';
      UI.openCat('transit');
      Tools.setTool({ type: 'line', lt: 'rail' });
    };

  // Filters
  const setFilter = (flt: 'all' | 'bus' | 'tram' | 'rail') => {
    currentFilter = flt;
    renderTransitPanel(p);
  };
  q<HTMLElement>('#fltAll', p)!.onclick = () => setFilter('all');
  q<HTMLElement>('#fltBus', p)!.onclick = () => setFilter('bus');
  q<HTMLElement>('#fltTram', p)!.onclick = () => setFilter('tram');
  q<HTMLElement>('#fltRail', p)!.onclick = () => setFilter('rail');

  // Sorting
  const selSort = q<HTMLSelectElement>('#selSort', p);
  if (selSort) {
    selSort.onchange = () => {
      currentSort = selSort.value as any;
      renderLines(p);
    };
  }

  X.showRibbons(true);
  renderLines(p);
  updTransit(p);
}
