/**
 * Open Skylines — Supply Chain & Logistics Panel (`src/ui/panels/supply.ts`)
 *
 * Provides real-time metrics, industrial extraction breakdowns,
 * freight logistics, and trade balance (imports/exports).
 */

import { head, bindClose, sv, sm, goodCol, meter } from '@/ui/dom';
import { Sim } from '@/sim/sim';
import { UI } from '@/ui/ui';
import { U } from '@/core/utils';
import { setOverlay } from '@/ui/panels/views';

export function renderSupplyPanel(p: HTMLElement): void {
  const sup = Sim.supply;
  const isOk = sup.commercialStockRate >= 0.85;

  p.innerHTML =
    head('Supply Chain & Logistics', 'Manage resource extraction, freight networks & trade') +
    `<div class="sec">
      <div class="row"><span>Commercial Supply Rate</span><b data-v="supRate" style="color:${isOk ? 'var(--good)' : 'var(--bad)'}">${Math.round(sup.commercialStockRate * 100)}%</b></div>
      <div class="row"><span>Active Stockouts</span><b data-v="supStockouts" style="color:${sup.stockoutStores > 0 ? 'var(--bad)' : 'var(--good)'}">${sup.stockoutStores} stores</b></div>
      <div class="row"><span>City Demand</span><b data-v="supDemand">${sup.cityDemand} units/h</b></div>
      <div class="row"><span>Local Production</span><b data-v="supProd">${sup.localProduction} units/h</b></div>
    </div>

    <div class="sec">
      <div class="lbl">Raw Material Extraction</div>
      <div class="row">
        <span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#eab308;margin-right:6px"></i>Farming & Crops</span>
        <b data-v="supFood">${sup.rawFood} units/h</b>
      </div>
      <div class="row">
        <span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#16a34a;margin-right:6px"></i>Forestry & Timber</span>
        <b data-v="supTimber">${sup.rawTimber} units/h</b>
      </div>
      <div class="row">
        <span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#64748b;margin-right:6px"></i>Ore & Minerals</span>
        <b data-v="supOre">${sup.rawOre} units/h</b>
      </div>
      <div class="row">
        <span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#7c3aed;margin-right:6px"></i>Oil & Petroleum</span>
        <b data-v="supOil">${sup.rawOil} units/h</b>
      </div>
      <div class="row">
        <span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#38bdf8;margin-right:6px"></i>Consumer Goods</span>
        <b data-v="supGoods">${sup.consumerGoods} units/h</b>
      </div>
    </div>

    <div class="sec">
      <div class="lbl">Trade & Freight Ledger</div>
      <div class="row"><span>Export Earnings</span><b data-v="supExport" style="color:var(--good)">+${U.money(sup.exportRevenue)}/mo</b></div>
      <div class="row"><span>Export Volume</span><b data-v="supExportVol">${sup.exportedGoods} units</b></div>
      <div class="row"><span>Import Surcharge</span><b data-v="supImport" style="color:var(--bad)">-${U.money(sup.importCost)}/mo</b></div>
      <div class="row"><span>Import Volume</span><b data-v="supImportVol">${sup.importedGoods} units</b></div>
    </div>

    <div class="btns" style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
      <button class="btn primary" id="btnResOverlay">View Natural Resources Map</button>
      <button class="btn" id="btnOpenDistricts">District Specializations</button>
    </div>`;

  bindClose(p, () => UI.openPanel(null));

  const btnRes = p.querySelector<HTMLButtonElement>('#btnResOverlay');
  if (btnRes) {
    btnRes.onclick = () => {
      setOverlay('resources');
      UI.openPanel('views');
    };
  }

  const btnDist = p.querySelector<HTMLButtonElement>('#btnOpenDistricts');
  if (btnDist) {
    btnDist.onclick = () => {
      UI.openPanel('districts');
    };
  }
}

export function updSupply(p: HTMLElement): void {
  const sup = Sim.supply;
  const isOk = sup.commercialStockRate >= 0.85;

  sv(p, 'supRate', Math.round(sup.commercialStockRate * 100) + '%');
  sv(p, 'supStockouts', sup.stockoutStores + ' stores');
  sv(p, 'supDemand', sup.cityDemand + ' units/h');
  sv(p, 'supProd', sup.localProduction + ' units/h');

  sv(p, 'supFood', sup.rawFood + ' units/h');
  sv(p, 'supTimber', sup.rawTimber + ' units/h');
  sv(p, 'supOre', sup.rawOre + ' units/h');
  sv(p, 'supOil', sup.rawOil + ' units/h');
  sv(p, 'supGoods', sup.consumerGoods + ' units/h');

  sv(p, 'supExport', '+' + U.money(sup.exportRevenue) + '/mo');
  sv(p, 'supExportVol', sup.exportedGoods + ' units');
  sv(p, 'supImport', '-' + U.money(sup.importCost) + '/mo');
  sv(p, 'supImportVol', sup.importedGoods + ' units');
}
