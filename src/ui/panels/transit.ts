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

export const TYPE_NAME: Record<string, string> = { bus: 'Bus', tram: 'Streetcar', rail: 'Metro' };

export function renderLines(p: HTMLElement): void {
  const X = Transit,
    L = q<HTMLElement>('#lineList', p);
  if (!L) return;
  const esc = (t: string) =>
    String(t)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');

  L.innerHTML = X.lines.length
    ? X.lines
        .map(l => {
          const editing = Tools.tool.type === 'lineEdit' && Tools.tool.line === l.id;
          return `<div class="tline ${l.broken ? 'broken' : ''} ${editing ? 'editing' : ''}" data-l="${l.id}">
      <div class="tl-head"><input type="color" value="${l.color}" data-a="col" title="Line colour"><input class="tl-name" value="${esc(
            l.name
          )}" data-a="name" maxlength="28"><span class="chip">${TYPE_NAME[l.type]}</span><button class="ib" data-a="v" title="Show on the map">◎</button><button class="ib" data-a="x" title="Delete line">×</button></div>
      <div class="tl-grid">
        <span>${l.type === 'rail' ? 'Trains' : l.type === 'tram' ? 'Streetcars' : 'Buses'}</span><div class="stepper"><button data-a="-">−</button><b data-v="lv_${l.id}"></b><button data-a="+">+</button></div>
        <span>Ticket price</span><div class="stepper"><button data-a="f-">−</button><b data-v="lf_${l.id}"></b><button data-a="f+">+</button></div>
        <span>Riders</span><b data-v="lr_${l.id}"></b>
        <span>Every</span><b data-v="lh_${l.id}"></b>
        <span>Upkeep</span><b data-v="lu_${l.id}"></b>
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
            editing ? 'Done editing' : 'Edit route'
          }</button></div>
      ${
        l.broken
          ? '<div class="sub bad">Broken route: a stop can no longer be reached. Edit the route or fix the roads.</div>'
          : ''
      }
    </div>`;
        })
        .join('')
    : '<div class="sub">No lines yet. Pick a line tool, click stops in order (each stop sits on the side of the road you click), then click the first stop again to close the loop.</div>';

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
              'Editing ' + l.name + ': click a stop on it to remove it, click a road to add a stop. Esc when done.',
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
  let r = 0;
  for (const l of X.lines) r += l.ridersLast || 0;
  sv(p, 'riders', U.num(r));
  sv(p, 'share', Math.round(S.stats.transitShare * 100) + '%');
  sv(p, 'waiting', U.num(X.stats.waiting));
  for (const l of X.lines) {
    sv(p, 'lv_' + l.id, l.vehicles);
    sv(p, 'lf_' + l.id, '$' + X.fareOf(l).toFixed(2));
    sv(p, 'lr_' + l.id, U.num(l.ridersMonth) + ' this month · ' + U.num(l.ridersLast || 0) + ' last');
    sv(
      p,
      'lh_' + l.id,
      l.loopTime ? Math.max(1, Math.round(((l.loopTime / l.vehicles) * 60) / C.HOUR_SEC)) + ' min' : '–'
    );
    sv(p, 'lu_' + l.id, U.money(l.vehicles * C.TRANSIT[l.type].upkeep) + '/mo');
  }
}

export function renderTransitPanel(p: HTMLElement): void {
  const X = Transit,
    S = Sim;
  const busOK = S.unlocked(C.TRANSIT.bus.unlock),
    railOK = S.unlocked(C.TRANSIT.rail.unlock),
    tramOK = S.unlocked(C.TRANSIT.tram.unlock);

  p.innerHTML =
    head('Public transport', 'Every line, its vehicles, colour and fares') +
    `<div class="row"><span>Riders last month</span><b data-v="riders"></b></div>
     <div class="row"><span>Trips by transit</span><b data-v="share"></b></div>
     <div class="row"><span>Waiting at stops</span><b data-v="waiting"></b></div>
     <div class="btns" style="margin-top:8px"><button class="btn primary" id="nbus" ${
       busOK ? '' : 'disabled'
     }>New bus line</button><button class="btn primary" id="ntram" ${
      tramOK ? '' : 'disabled'
    }>New streetcar line</button><button class="btn primary" id="nrail" ${
      railOK ? '' : 'disabled'
    }>New metro line</button></div>
     <div class="sec tlines" id="lineList"></div>`;

  bindClose(p, () => UI.openPanel(null));

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

  X.showRibbons(true);
  renderLines(p);
  updTransit(p);
}
