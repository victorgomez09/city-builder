/**
 * Open Skylines — UI Settings and Controls Panel
 */

import { C } from '@/core/constants';
import { Gfx } from '@/render/gfx';
import { Game } from '@/game';
import { head, bindClose, q, $$ } from '@/ui/dom';
import { UI } from '@/ui/ui';

export function renderSettingsPanel(p: HTMLElement): void {
  const s = Gfx.settings;
  const opt = (id: string, label: string, opts: [string | number, string][], val: string | number | boolean) =>
    `<label for="${id}">${label}</label><select id="${id}">${opts
      .map(o => `<option value="${o[0]}" ${String(o[0]) === String(val) ? 'selected' : ''}>${o[1]}</option>`)
      .join('')}</select>`;

  p.innerHTML =
    head('Settings', 'Graphics changes apply immediately') +
    `<div class="set">
      ${opt(
        'st_preset',
        'Quality preset',
        [
          ['low', 'Low'],
          ['medium', 'Medium'],
          ['high', 'High'],
          ['ultra', 'Ultra'],
          ['custom', 'Custom'],
        ],
        s.preset
      )}
      ${opt(
        'st_res',
        'Render resolution',
        [
          [0.5, '50%'],
          [0.7, '70%'],
          [1, '100%'],
          [1.25, '125%'],
          [1.5, '150%'],
          [2, 'Native (max 200%)'],
        ],
        s.res
      )}
      ${opt(
        'st_shadows',
        'Shadows',
        [
          [0, 'Off'],
          [1024, 'Low'],
          [2048, 'Medium'],
          [4096, 'High'],
        ],
        s.shadows
      )}
      ${opt(
        'st_aa',
        'Anti-aliasing',
        [
          [0, 'Off'],
          [1, 'On'],
        ],
        s.aa ? 1 : 0
      )}
      ${opt(
        'st_view',
        'View distance',
        [
          [1100, 'Near'],
          [1700, 'Medium'],
          [2400, 'Far'],
          [3200, 'Very far'],
        ],
        s.view
      )}
      ${opt(
        'st_cars',
        'Vehicle limit',
        [
          [150, '150'],
          [250, '250'],
          [500, '500'],
          [900, '900'],
          [1400, '1,400'],
          [2000, '2,000'],
        ],
        s.cars
      )}
      ${opt(
        'st_detail',
        'Vehicle & people detail',
        [
          [0, 'Simple'],
          [1, 'Detailed'],
        ],
        s.detail ? 1 : 0
      )}
      ${opt(
        'st_trees',
        'Tree density',
        [
          [0.2, 'Sparse'],
          [0.35, 'Low'],
          [0.7, 'Medium'],
          [1, 'High'],
          [1.4, 'Lush'],
        ],
        s.trees
      )}
      ${opt(
        'st_lighting',
        'Lighting',
        [
          ['simple', 'Simple (fast)'],
          ['pbr', 'Realistic'],
        ],
        s.lighting
      )}
      ${opt(
        'st_water',
        'Water',
        [
          ['simple', 'Still'],
          ['waves', 'Animated waves'],
        ],
        s.water
      )}
      ${opt(
        'st_dayNight',
        'Day & night cycle',
        [
          [1, 'On'],
          [0, 'Off (always day)'],
        ],
        s.dayNight ? 1 : 0
      )}
      ${opt(
        'st_fps',
        'Show FPS',
        [
          [0, 'Off'],
          [1, 'On'],
        ],
        s.fps ? 1 : 0
      )}
    </div>
    <div class="sub" style="font-size:12px;margin-top:6px">The vehicle limit also caps how much traffic is simulated. Lower it if the game stutters in a big city.</div>
    <div class="sec"><div class="lbl">Game</div><div class="btns"><button class="btn" id="st_save">Save now</button><button class="btn danger" id="st_new">Start a new city</button></div><div id="st_confirm"></div></div>
    <div class="sec"><div class="lbl">Controls</div><div class="keys">
      <kbd>W A S D</kbd><span>Move the camera (Shift for faster)</span><kbd>Q / E</kbd><span>Rotate</span><kbd>R / F</kbd><span>Zoom in and out</span><kbd>T / G</kbd><span>Tilt</span>
      <kbd>Right-drag</kbd><span>Rotate and tilt</span><kbd>Middle-drag</kbd><span>Pan</span><kbd>Wheel</kbd><span>Zoom</span>
      <kbd>Space</kbd><span>Pause</span><kbd>1 2 3</kbd><span>Game speed</span><kbd>B</kbd><span>Bulldoze</span><kbd>C</kbd><span>Road mode: straight, curve, S-bend, grid</span><kbd>R</kbd><span>Rotate a building before placing it</span><kbd>Esc</kbd><span>Cancel tool</span></div></div>`;

  bindClose(p, () => UI.openPanel(null));

  $$<HTMLSelectElement>('select', p).forEach(sel => {
    sel.onchange = () => {
      const k = sel.id.slice(3);
      const ns = Object.assign({}, Gfx.settings);
      if (k === 'preset') {
        if (sel.value !== 'custom') Object.assign(ns, (C.QUALITY as any)[sel.value], { preset: sel.value });
        else ns.preset = 'custom';
      } else {
        let v: string | number | boolean = sel.value;
        if (['res', 'shadows', 'view', 'cars', 'trees'].includes(k)) v = +v;
        if (['aa', 'dayNight', 'fps', 'detail'].includes(k)) v = v === '1';
        (ns as any)[k] = v;
        ns.preset = 'custom';
      }
      Game.applySettings(ns);
      renderSettingsPanel(p);
    };
  });

  const btnSave = q<HTMLElement>('#st_save', p);
  if (btnSave) {
    btnSave.onclick = () => {
      if (Game.save()) UI.toast('City saved.', 'good');
    };
  }

  const btnNew = q<HTMLElement>('#st_new', p);
  if (btnNew) {
    btnNew.onclick = () => {
      const c = q<HTMLElement>('#st_confirm', p);
      if (!c) return;
      c.innerHTML = `<div class="chip bad" style="margin-top:6px">This replaces your saved city.</div><div class="btns" style="margin-top:6px"><button class="btn danger" id="st_yes">Yes, start over</button><button class="btn" id="st_no">Keep playing</button></div>`;
      const yesBtn = q<HTMLElement>('#st_yes', c);
      if (yesBtn) yesBtn.onclick = () => Game.showStart(true);
      const noBtn = q<HTMLElement>('#st_no', c);
      if (noBtn)
        noBtn.onclick = () => {
          c.innerHTML = '';
        };
    };
  }
}
