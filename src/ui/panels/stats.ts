/**
 * Vira City — UI City Statistics Panel
 */

import { C } from '@/core/constants';
import { U } from '@/core/utils';
import { Sim } from '@/sim/sim';
import { Traffic } from '@/traffic/traffic';
import { head, bindClose, sv, spark, q } from '@/ui/dom';
import { UI } from '@/ui/ui';
import { t } from '@/i18n';

export function updStats(p: HTMLElement): void {
  const S = Sim,
    st = S.stats,
    Tr = Traffic;
  sv(p, 'jobs', U.num(st.filled + st.outsideIn) + ' / ' + U.num(st.jobs));
  sv(p, 'unemp', (st.unemp * 100).toFixed(1) + '%');
  sv(p, 'cin', U.num(st.outsideIn));
  sv(p, 'edu', Math.round(st.edu * 100) + '%');
  sv(p, 'comm', st.commute ? Math.round((st.commute * 60) / C.HOUR_SEC) + ' ' + t('common.min', 'min') : '–');
  sv(p, 'flow', Math.round(Tr.stats.flow * 100) + '%');
  sv(p, 'veh', U.num(Tr.stats.active));
  sv(p, 'stuck', U.num(Tr.stats.stuck));
  sv(p, 'soft', U.num(Tr.stats.bikes) + ' / ' + U.num(Tr.stats.peds));
  const M = Tr.mode,
    tot = M.car + M.transit + M.bike + M.walk || 1;
  sv(
    p,
    'modes',
    `🚗 ${Math.round((M.car / tot) * 100)}%  🚌 ${Math.round((M.transit / tot) * 100)}%  🚲 ${Math.round(
      (M.bike / tot) * 100
    )}%  🚶 ${Math.round((M.walk / tot) * 100)}%`
  );
  sv(p, 'bcount', U.num(st.buildingCount));
  const hist = S.history.concat([{ pop: st.pop, money: S.money }]);
  spark(q<HTMLCanvasElement>('#spPop', p), hist.map((h: { pop: number; money: number }) => h.pop), '#5fcf5a');
  spark(q<HTMLCanvasElement>('#spMoney', p), hist.map((h: { pop: number; money: number }) => h.money), '#ffb547');
}

export function renderStatsPanel(p: HTMLElement): void {
  p.innerHTML =
    head(t('stats.title', 'City statistics'), '') +
    `<div class="lbl">${t('stats.pop', 'Population')}</div><canvas class="spark" id="spPop" width="600" height="112"></canvas>
     <div class="lbl" style="margin-top:6px">${t('stats.funds', 'Funds')}</div><canvas class="spark" id="spMoney" width="600" height="112"></canvas>
     <div class="sec">
     <div class="row"><span>${t('stats.jobs', 'Jobs filled')}</span><b data-v="jobs"></b></div>
     <div class="row"><span>${t('stats.unemp', 'Unemployment')}</span><b data-v="unemp"></b></div>
     <div class="row"><span>${t('stats.cin', 'Commuters from out of town')}</span><b data-v="cin"></b></div>
     <div class="row"><span>${t('stats.edu', 'Education coverage')}</span><b data-v="edu"></b></div>
     <div class="row"><span>${t('stats.comm', 'Average commute')}</span><b data-v="comm"></b></div>
     <div class="row"><span>${t('stats.flow', 'Traffic flow')}</span><b data-v="flow"></b></div>
     <div class="row"><span>${t('stats.veh', 'Vehicles on the road')}</span><b data-v="veh"></b></div>
     <div class="row"><span>${t('stats.soft', 'Cyclists / pedestrians')}</span><b data-v="soft"></b></div>
     <div class="row"><span>${t('stats.modes', 'How people get around')}</span><b data-v="modes"></b></div>
     <div class="row"><span>${t('stats.stuck', 'Cars that gave up (gridlock)')}</span><b data-v="stuck"></b></div>
     <div class="row"><span>${t('stats.bcount', 'Buildings')}</span><b data-v="bcount"></b></div></div>`;

  bindClose(p, () => UI.openPanel(null));
  updStats(p);
}
