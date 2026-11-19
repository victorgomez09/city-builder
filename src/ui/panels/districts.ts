/**
 * Vira City — UI Districts and Policies Panel
 */

import { C } from '@/core/constants';
import { U } from '@/core/utils';
import { World } from '@/world/world';
import { Tools } from '@/tools/tools';
import { Gfx } from '@/render/gfx';
import { Meshes } from '@/render/meshes';
import { Sim } from '@/sim/sim';
import { head, bindClose, sv, q, $$ } from '@/ui/dom';
import { UI } from '@/ui/ui';

export const DIST_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#14b8a6',
  '#6366f1',
  '#e11d48',
];

export const SPEC_CARDS = [
  ['none', 'Standard', 'Mixed general zoning with default municipal parameters.'],
  ['eco_res', 'Eco Residential', '-30% power & water, -20% garbage, +6 citizen happiness.'],
  ['nightlife', 'Leisure & Nightlife', '+25% commercial visitors & revenue, vibrant nights, +noise.'],
  ['organic', 'Organic Produce', 'Commercial shops sell local produce. +7 health & happiness.'],
  ['farming', 'Farming & Ag', 'Zero heavy industrial pollution, boosts local food security.'],
  ['forestry', 'Forestry', 'Sustainable timber harvesting. -50% industrial pollution.'],
  ['mining', 'Ore Mining', 'Extracts mineral ores & metals from mountain ridges. Heavy industrial output, high profit.'],
  ['oil', 'Oil Industry', 'Extracts and refines crude petroleum & plastics. Extremely lucrative tax base, high pollution.'],
  ['tech', 'High-Tech', 'Clean tech & research: +25% revenue, highly educated workforce.'],
];

export const POLICY_ITEMS = [
  ['heavyTrafficBan', 'Heavy Traffic Ban (ZBE)', 'Bans heavy freight trucks from local streets to reduce noise & pollution.'],
  ['waterMetering', 'Water Metering', 'Mandatory water meters reduce district water consumption by 20%.'],
  ['smokingBan', 'Smoking Ban', 'Prohibits smoking in public buildings. Boosts citizen health & happiness.'],
  ['recycling', 'Recycling Program', 'Comprehensive recycling cuts garbage output by 30% ($15/mo per 100 tiles).'],
  ['smokeDetectors', 'Smoke Detectors', 'Subsidized smoke detectors cut district fire risk by 80% ($20/mo per 100 tiles).'],
  ['freeTransit', 'Free Public Transit', 'Free bus and tram rides dramatically boost public transit ridership.'],
  ['bikeCity', 'Encourage Biking', 'Prioritizes bike paths, cycling infrastructure and bicycle commuting.'],
  ['localBusinessTaxRelief', 'Small Business Tax Relief', 'Reduces commercial property taxes by 25% to boost local business prosperity.'],
];

export function updDistricts(p: HTMLElement): void {
  const Wd = World;
  if (!UI.selectedDistrictId || !Wd.districts) return;
  const dist = Wd.districts.get(UI.selectedDistrictId);
  if (!dist) return;
  sv(p, 'd_tiles', dist.stats.tiles);
  sv(p, 'd_pop', U.num(dist.stats.pop));
  sv(p, 'd_jobs', U.num(dist.stats.jobs));
  sv(p, 'd_workers', U.num(dist.stats.workers));
  sv(p, 'd_happy', dist.stats.avgHappy + '%');
  sv(p, 'd_unemp', dist.stats.unemployment + '%');
  sv(p, 'd_power', dist.stats.powerUsage + ' MW');
  sv(p, 'd_water', dist.stats.waterUsage + ' m³');
  sv(p, 'd_garb', dist.stats.garbage + ' t');
  sv(p, 'd_tax', U.money(dist.stats.taxIncome) + '/mo');
}

export function openDistrict(id: number): void {
  UI.selectedDistrictId = id;
  UI.openPanel('districts');
  if (UI.overlay !== 'district') UI.setOverlay('district');
  const dist = World.districts.get(id);
  if (dist && dist.stats.tiles > 0) {
    Gfx.focus((dist.cx + 0.5) * C.TILE, (dist.cy + 0.5) * C.TILE, 240);
  }
}

export function renderDistrictsPanel(p: HTMLElement): void {
  const Wd = World;
  if (!Wd.districts || Wd.districts.size === 0) {
    p.innerHTML =
      head('Districts & Policies', 'Designate areas, enact municipal policies and apply specializations.') +
      `<div class="sec"><div class="sub" style="font-size:13px;line-height:1.4;margin:12px 0">
         No districts designated yet. Create a district to customize tax relief, traffic bans, eco-housing, or industrial specializations.
       </div>
       <button class="btn primary" id="btnCreateFirstDist" style="width:100%;height:38px">+ Create First District</button>
       </div>`;
    bindClose(p, () => UI.openPanel(null));
    const bFirst = q<HTMLElement>('#btnCreateFirstDist', p);
    if (bFirst) {
      bFirst.onclick = () => {
        const nd = Wd.createDistrict();
        UI.selectedDistrictId = nd.id;
        Tools.setTool({ type: 'district', mode: 'paint', radius: 4, districtId: nd.id });
        renderDistrictsPanel(p);
      };
    }
    return;
  }

  if (!UI.selectedDistrictId || !Wd.districts.has(UI.selectedDistrictId)) {
    UI.selectedDistrictId = [...Wd.districts.keys()][0];
  }
  const dist = Wd.districts.get(UI.selectedDistrictId);
  if (!dist) return;

  const distListHtml = [...Wd.districts.values()]
    .map(
      d =>
        `<div class="dist-row-item ${d.id === dist.id ? 'sel' : ''}" data-did="${d.id}">
         <div style="display:flex;align-items:center;gap:8px">
           <span class="dist-badge-pip" style="background:${d.color}"></span>
           <b>${d.name}</b>
         </div>
         <span class="sub">${d.stats.tiles} tiles · ${U.num(d.stats.pop)} pop</span>
       </div>`
    )
    .join('');

  const specHtml = SPEC_CARDS.map(
    s =>
      `<div class="dist-spec-card ${dist.spec === s[0] ? 'on' : ''}" data-spec="${s[0]}">
         <div class="dist-spec-title">${s[1]}</div>
         <div class="dist-spec-desc">${s[2]}</div>
       </div>`
  ).join('');

  const policiesHtml = POLICY_ITEMS.map(pol => {
    const active = !!(dist.policies && (dist.policies as any)[pol[0]]);
    return `<div class="policy-item">
       <div class="policy-info">
         <div class="policy-name">${pol[1]}</div>
         <div class="policy-desc">${pol[2]}</div>
       </div>
       <label class="policy-switch">
         <input type="checkbox" data-policy="${pol[0]}" ${active ? 'checked' : ''}>
         <span class="policy-slider"></span>
       </label>
     </div>`;
  }).join('');

  const paletteHtml = DIST_COLORS.map(
    c => `<div class="dist-swatch ${c === dist.color ? 'sel' : ''}" style="background:${c}" data-col="${c}"></div>`
  ).join('');

  p.innerHTML =
    head('Districts & Policies', 'Designate areas and manage district policies') +
    `<div class="sec">
       <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
         <span class="lbl">City Districts (${Wd.districts.size})</span>
         <button class="btn" id="btnNewDist" style="padding:3px 8px;font-size:11px">+ New District</button>
       </div>
       <div class="dist-list">${distListHtml}</div>
     </div>
     <div class="sec">
       <div class="field" style="margin-bottom:8px">
         <label class="lbl">District Name</label>
         <input type="text" id="distNameInput" maxlength="32" value="${dist.name}">
       </div>
       <div class="lbl">Theme Color</div>
       <div class="dist-palette">${paletteHtml}</div>
       <div class="btns" style="margin-top:10px">
         <button class="btn" id="btnDistFocus">Center Camera</button>
         <button class="btn" id="btnDistPaint">Paint Brush</button>
         <button class="btn danger" id="btnDistDelete">Delete</button>
       </div>
     </div>
     <div class="sec">
       <div class="lbl">District Statistics</div>
       <table class="bud" style="margin-top:6px">
         <tr><td>Tiles</td><td class="num" data-v="d_tiles">${dist.stats.tiles}</td><td>Population</td><td class="num" data-v="d_pop">${U.num(
      dist.stats.pop
    )}</td></tr>
         <tr><td>Jobs</td><td class="num" data-v="d_jobs">${U.num(dist.stats.jobs)}</td><td>Workers</td><td class="num" data-v="d_workers">${U.num(
      dist.stats.workers
    )}</td></tr>
         <tr><td>Happiness</td><td class="num" data-v="d_happy">${dist.stats.avgHappy}%</td><td>Unemployment</td><td class="num" data-v="d_unemp">${
      dist.stats.unemployment
    }%</td></tr>
         <tr><td>Power Usage</td><td class="num" data-v="d_power">${dist.stats.powerUsage} MW</td><td>Water Usage</td><td class="num" data-v="d_water">${
      dist.stats.waterUsage
    } m³</td></tr>
         <tr><td>Garbage</td><td class="num" data-v="d_garb">${dist.stats.garbage} t</td><td>Tax Revenue</td><td class="num" data-v="d_tax">${U.money(
      dist.stats.taxIncome
    )}/mo</td></tr>
       </table>
     </div>
     <div class="sec">
       <div class="lbl">District Specialization</div>
       <div class="dist-specs">${specHtml}</div>
     </div>
     <div class="sec">
       <div class="lbl">Municipal Policies</div>
       <div class="policy-list">${policiesHtml}</div>
     </div>`;

  bindClose(p, () => UI.openPanel(null));

  $$<HTMLElement>('.dist-row-item', p).forEach(el => {
    el.onclick = () => {
      UI.selectedDistrictId = +el.dataset.did!;
      renderDistrictsPanel(p);
    };
  });

  const bNew = q<HTMLElement>('#btnNewDist', p);
  if (bNew) {
    bNew.onclick = () => {
      const nd = Wd.createDistrict();
      UI.selectedDistrictId = nd.id;
      Tools.setTool({ type: 'district', mode: 'paint', radius: 4, districtId: nd.id });
      renderDistrictsPanel(p);
    };
  }

  const nameInput = q<HTMLInputElement>('#distNameInput', p);
  if (nameInput) {
    nameInput.oninput = () => {
      dist.name = nameInput.value.trim() || 'District ' + dist.id;
      const rowName = q<HTMLElement>(`.dist-row-item[data-did="${dist.id}"] b`, p);
      if (rowName) rowName.textContent = dist.name;
    };
  }

  $$<HTMLElement>('.dist-swatch', p).forEach(sw => {
    sw.onclick = () => {
      dist.color = sw.dataset.col || '#3b82f6';
      $$<HTMLElement>('.dist-swatch', p).forEach(s => s.classList.toggle('sel', s.dataset.col === dist.color));
      const pip = q<HTMLElement>(`.dist-row-item[data-did="${dist.id}"] .dist-badge-pip`, p);
      if (pip) pip.style.background = dist.color;
      if (Meshes && Sim && UI.overlay === 'district') {
        Meshes.writeOverlay(Sim.overlayFn('district'));
      }
    };
  });

  const bFocus = q<HTMLElement>('#btnDistFocus', p);
  if (bFocus) {
    bFocus.onclick = () => {
      if (dist.stats.tiles > 0) {
        Gfx.focus((dist.cx + 0.5) * C.TILE, (dist.cy + 0.5) * C.TILE, 240);
      } else {
        UI.toast('District has no tiles painted yet.', 'bad');
      }
    };
  }

  const bPaint = q<HTMLElement>('#btnDistPaint', p);
  if (bPaint) {
    bPaint.onclick = () => {
      Tools.setTool({ type: 'district', mode: 'paint', radius: 4, districtId: dist.id });
      UI.toast(`Painting ${dist.name} (Radius 4). Click or drag on map.`, 'good');
    };
  }

  const bDel = q<HTMLElement>('#btnDistDelete', p);
  if (bDel) {
    bDel.onclick = () => {
      Wd.deleteDistrict(dist.id);
      UI.selectedDistrictId = null;
      UI.toast(`District deleted.`, 'bad');
      renderDistrictsPanel(p);
    };
  }

  $$<HTMLElement>('.dist-spec-card', p).forEach(sc => {
    sc.onclick = () => {
      dist.spec = (sc.dataset.spec as any) || 'none';
      Wd.updateDistrictStats();
      $$<HTMLElement>('.dist-spec-card', p).forEach(c => c.classList.toggle('on', c.dataset.spec === dist.spec));
      const titleEl = q<HTMLElement>('.dist-spec-title', sc);
      UI.toast(`District specialization set to: ${titleEl ? titleEl.textContent : dist.spec}`, 'good');
    };
  });

  $$<HTMLInputElement>('input[data-policy]', p).forEach(inp => {
    inp.onchange = () => {
      if (!dist.policies) dist.policies = {} as any;
      (dist.policies as any)[inp.dataset.policy!] = inp.checked;
      Wd.updateDistrictStats();
    };
  });
}
