/**
 * Open Skylines — UI Info Views Panel
 */

import { head, bindClose, $$ } from '@/ui/dom';
import { Gfx } from '@/render/gfx';
import { Transit } from '@/transit/transit';
import { Tools } from '@/tools/tools';
import { Meshes } from '@/render/meshes';
import { Sim } from '@/sim/sim';
import { UI } from '@/ui/ui';

export const VIEWS: [string | null, string, string][] = [
  [null, 'None', '#555'],
  ['traffic', 'Traffic', 'linear-gradient(90deg,#3fd65a,#e6c833,#e6332a)'],
  ['lv', 'Land value', 'linear-gradient(90deg,#e6332a,#3fd65a)'],
  ['happy', 'Happiness', 'linear-gradient(90deg,#e6332a,#3fd65a)'],
  ['pollution', 'Pollution', '#8a5a2a'],
  ['noise', 'Noise', '#c85ad8'],
  ['police', 'Police', '#2c5aa0'],
  ['fire', 'Fire', '#b8322a'],
  ['health', 'Health', '#c8323e'],
  ['edu', 'Education', '#a0632f'],
  ['garbage', 'Garbage', '#4d7a4a'],
  ['park', 'Parks', '#3f8a3a'],
  ['transit', 'Transit', '#2f86e0'],
  ['district', 'Districts', '#3b82f6'],
];

export function setOverlay(k: string | null): void {
  UI.overlay = k;
  Gfx.uni.uOvOn.value = k ? 1 : 0;
  Transit.showRibbons(k === 'transit' || ['line', 'stop', 'rail'].includes(Tools.tool.type));
  if (k) refreshOverlay();
}

export function refreshOverlay(): void {
  if (UI.overlay) Meshes.writeOverlay(Sim.overlayFn(UI.overlay));
}

export function renderViewsPanel(p: HTMLElement): void {
  p.innerHTML =
    head('Info views', 'Color the city by one statistic') +
    `<div class="views">${VIEWS.map(
      v =>
        `<button data-ov="${v[0] || ''}" class="${(UI.overlay || '') === (v[0] || '') ? 'on' : ''}"><i style="background:${v[2]}"></i>${v[1]}</button>`
    ).join('')}</div>
    <div class="sec"><div class="legend"><span>Poor</span><span class="grad"></span><span>Good</span></div>
    <div class="sub" style="font-size:12px;line-height:1.4">Traffic view: green roads flow freely, red roads are jammed. Coverage views show how far each service building reaches.</div></div>`;

  bindClose(p, () => UI.openPanel(null));

  $$<HTMLElement>('[data-ov]', p).forEach(b => {
    b.onclick = () => {
      setOverlay(b.dataset.ov || null);
      renderViewsPanel(p);
    };
  });
}
