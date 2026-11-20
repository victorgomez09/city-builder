/**
 * Vira City — Intersection / Junction Editor Panel (`src/ui/panels/junction.ts`)
 *
 * Provides the interactive UI for traffic signals, stop signs, all-way stops,
 * roundabout settings, green-time sliders, and per-lane turning arrow toggles.
 */

import { C } from '@/core/constants';
import { World } from '@/world/world';
import { Meshes } from '@/render/meshes';
import { Traffic } from '@/traffic/traffic';
import { UI } from '@/ui/ui';
import { $, $$, q, head, bindClose } from '@/ui/dom';
import { JunctionCluster, JunctionApproach, JunctionExit, IntersectionControl } from '@/types';
import { t } from '@/i18n';

const DIRN = ['North', 'East', 'South', 'West'];
const CTRL: [IntersectionControl, string][] = [
  ['auto', 'Automatic'],
  ['none', 'None'],
  ['lights', 'Traffic Lights'],
  ['stop', 'Stop Signs'],
  ['allstop', 'All-Way Stop'],
  ['round', 'Roundabout'],
];
const TURN_BITS: [number, string, string][] = [
  [4, 'L', 'Left'],
  [1, 'S', 'Straight'],
  [2, 'R', 'Right'],
  [8, 'U', 'U-turn'],
];

export function applyJunction(): void {
  const Wd = World;
  Wd.updateJunctions();
  Wd.roadVer++;
  Meshes.junctionsChanged();
}

export function setJunctionCtrl(tile: number, ctrl: IntersectionControl): void {
  const Wd = World,
    c = Wd.jcl[tile];
  if (c < 0) return;
  Wd.clusters[c].cfg.ctrl = ctrl;
  applyJunction();
}

export function openJunction(tile: number): void {
  UI.select(null);
  UI.junctionTile = tile;
  const Wd = World,
    p = $('infoPanel');
  const c = Wd.jcl[tile];
  if (c < 0) {
    p.hidden = true;
    UI.junctionTile = -1;
    return;
  }
  const cl = Wd.clusters[c],
    cfg = cl.cfg;
  p.hidden = false;
  const roads = [...new Set(cl.aps.map(ap => C.ROADS[Wd.road[ap.tile]].name))];
  const ctrlNow = cl.ctrl;
  const label: Record<string, string> = {
    none: t('junction.ctrl_label.none', 'No control'),
    lights: t('junction.ctrl_label.lights', 'Traffic lights'),
    stop: t('junction.ctrl_label.stop', 'Stop signs'),
    allstop: t('junction.ctrl_label.allstop', 'All-way stop'),
    round: t('junction.ctrl_label.round', 'Roundabout'),
  };
  let html =
    head(t('junction.title', 'Intersection'), roads.join(' × ')) +
    `<div class="seg">${CTRL.map(
      o =>
        `<button data-ctrl="${o[0]}" class="${cfg.ctrl === o[0] ? 'on' : ''}">${t('junction.ctrl.' + o[0], o[1])}${
          o[0] === 'auto' && cfg.ctrl === 'auto' ? ` <small>(${label[ctrlNow]})</small>` : ''
        }</button>`
    ).join('')}</div>`;
  html += junctionDiagram(cl);
  if (ctrlNow === 'lights') {
    const g = cfg.green || [12, 12];
    html += `<div class="sec"><div class="lbl">${t('junction.green_time', 'Green time')}</div>
      ${[
        [t('junction.green_ns', 'North–south'), 0],
        [t('junction.green_ew', 'East–west'), 1],
      ]
        .map(
          ([n, ax]: [string, number]) =>
            `<div class="tax"><label>${n}</label><input type="range" min="5" max="30" value="${g[ax]}" data-green="${ax}"><b class="num">${g[ax]}s</b></div>`
        )
        .join('')}</div>`;
  }
  if (ctrlNow === 'stop') {
    html += `<div class="sec"><div class="lbl">${t('junction.who_stops', 'Who stops')}</div>${cl.aps
      .map(
        ap =>
          `<label class="row"><span>${t('junction.dir_from', { dir: DIRN[(ap.d + 2) % 4], road: C.ROADS[Wd.road[ap.tile]].name })}</span><input type="checkbox" data-stopk="${ap.key}" ${
            Traffic.isStopFor(cl, ap.key) ? 'checked' : ''
          }></label>`
      )
      .join('')}</div>`;
  }
  html += `<div class="sec"><div class="lbl">${t('junction.lane_arrows', 'Lane arrows')} <span style="text-transform:none;letter-spacing:0;font-weight:500">· click to allow or forbid a turn</span></div>`;
  for (const ap of cl.aps) {
    const masks = cfg.lanes[ap.key] || [];
    const avail = cl.avail[ap.d];
    html +=
      `<div class="appr"><div class="an">${t('junction.dir_from', { dir: DIRN[(ap.d + 2) % 4], road: C.ROADS[Wd.road[ap.tile]].name })}</div><div class="lanes">` +
      masks
        .map(
          (m: number, k: number) =>
            `<div class="lane" title="Lane ${k + 1} (${
              k === 0 ? 'rightmost' : k === masks.length - 1 ? 'leftmost' : 'middle'
            })">${TURN_BITS.map(([bit, l, nm]) =>
              avail & bit
                ? `<button data-ap="${ap.key}" data-lane="${k}" data-bit="${bit}" class="${
                    m & bit ? 'on' : ''
                  }" title="${nm}">${l === 'L' ? '↰' : l === 'S' ? '↑' : l === 'R' ? '↱' : '↶'}</button>`
                : ''
            ).join('')}</div>`
        )
        .reverse()
        .join('') +
      `</div></div>`;
  }
  html += `</div><div class="btns" style="margin-top:10px"><button class="btn" id="jreset">Reset lanes</button></div>`;
  p.innerHTML = html;
  bindClose(p, () => {
    UI.junctionTile = -1;
    p.hidden = true;
  });

  $$<HTMLElement>('[data-ctrl]', p).forEach(b => {
    b.onclick = () => {
      cfg.ctrl = b.dataset.ctrl as IntersectionControl;
      applyJunction();
      UI.openJunction(tile);
    };
  });

  $$<HTMLInputElement>('[data-green]', p).forEach(inp => {
    inp.oninput = () => {
      cfg.green = cfg.green || [12, 12];
      cfg.green[+inp.dataset.green!] = +inp.value;
      if (inp.nextElementSibling) inp.nextElementSibling.textContent = inp.value + 's';
    };
  });

  $$<HTMLInputElement>('[data-stopk]', p).forEach(cb => {
    cb.onchange = () => {
      cfg.stops[+cb.dataset.stopk!] = cb.checked;
      applyJunction();
      UI.openJunction(tile);
    };
  });

  $$<HTMLElement>('[data-ap]', p).forEach(btn => {
    btn.onclick = () => {
      const k = +btn.dataset.ap!,
        lane = +btn.dataset.lane!,
        bit = +btn.dataset.bit!;
      const arr = cfg.lanes[k];
      if (!arr) return;
      const nv = arr[lane] ^ bit;
      if (!nv) {
        UI.toast('Every lane needs at least one direction', 'bad');
        return;
      }
      arr[lane] = nv;
      applyJunction();
      UI.openJunction(tile);
    };
  });

  const btnReset = q<HTMLElement>('#jreset', p);
  if (btnReset) {
    btnReset.onclick = () => {
      cfg.lanes = {};
      applyJunction();
      UI.openJunction(tile);
    };
  }
}

export function junctionDiagram(cl: JunctionCluster): string {
  const cx = 80,
    cy = 80,
    box = 26;
  let g = `<rect x="${cx - box}" y="${cy - box}" width="${box * 2}" height="${box * 2}" fill="#3c3f44"/>`;
  const st = cl.ctrl;
  for (let d = 0; d < 4; d++) {
    const aps = cl.aps.filter((a: JunctionApproach) => a.d === (d + 2) % 4),
      exs = cl.exits.filter((e: JunctionExit) => e.d === d);
    if (!aps.length && !exs.length) continue;
    const fx = C.DX[d],
      fy = C.DY[d];
    const x0 = cx + fx * box,
      y0 = cy + fy * box;
    const w = 22;
    const rx = fx ? (fx > 0 ? x0 : x0 - 50) : cx - w,
      ry = fy ? (fy > 0 ? y0 : y0 - 50) : cy - w;
    g += `<rect x="${rx}" y="${ry}" width="${fx ? 50 : w * 2}" height="${fy ? 50 : w * 2}" fill="#4a4e55"/>`;
    for (const ap of aps) {
      const m = (cl.cfg.lanes[ap.key] || []).reduce((a: number, b: number) => a | b, 0);
      const lab = (m & 4 ? '↰' : '') + (m & 1 ? '↑' : '') + (m & 2 ? '↱' : '') + (m & 8 ? '↶' : '');
      const tx = cx + fx * (box + 30) + (fy ? -fy * 10 : 0),
        ty = cy + fy * (box + 30) + (fx ? fx * 10 : 0) + 5;
      const rot = [180, 270, 0, 90][d];
      g += `<text x="${tx}" y="${ty}" fill="#fff" font-size="13" text-anchor="middle" transform="rotate(${rot} ${tx} ${
        ty - 5
      })">${lab}</text>`;
      if (st === 'lights')
        g += `<circle cx="${cx + fx * (box + 6) + (fy ? -fy * 16 : 0)}" cy="${
          cy + fy * (box + 6) + (fx ? fx * 16 : 0)
        }" r="4" fill="#28e05a"/>`;
      if ((st === 'stop' || st === 'allstop') && Traffic.isStopFor(cl, ap.key))
        g += `<polygon points="${oct(
          cx + fx * (box + 6) + (fy ? -fy * 16 : 0),
          cy + fy * (box + 6) + (fx ? fx * 16 : 0),
          5
        )}" fill="#c8231c"/>`;
    }
  }
  if (st === 'round') g += `<circle cx="${cx}" cy="${cy}" r="11" fill="#5d8c3c" stroke="#aeada6" stroke-width="2"/>`;
  return `<svg class="jdia" viewBox="0 0 160 160">${g}</svg>`;
}

export function oct(x: number, y: number, r: number): string {
  const p: string[] = [];
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    p.push((x + Math.cos(a) * r).toFixed(1) + ',' + (y + Math.sin(a) * r).toFixed(1));
  }
  return p.join(' ');
}
