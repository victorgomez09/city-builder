/**
 * Vira City — Supply Chain & Logistics Panel (`src/ui/panels/supply.ts`)
 *
 * Provides real-time metrics, industrial extraction breakdowns,
 * freight logistics, and trade balance (imports/exports).
 */

import { head, bindClose, sv, sm, goodCol, meter } from '@/ui/dom';
import { Sim } from '@/sim/sim';
import { UI } from '@/ui/ui';
import { U } from '@/core/utils';
import { setOverlay } from '@/ui/panels/views';
import { t } from '@/i18n';

export function renderSupplyPanel(p: HTMLElement): void {
  const sup = Sim.supply;
  const isOk = sup.commercialStockRate >= 0.85;

  p.innerHTML =
    head(t('supply.title', 'Supply Chain & Logistics'), t('supply.subtitle', 'Manage resource extraction, freight networks & trade')) +
    `<div class="sec">
      <div class="row"><span>${t('supply.rate', 'Commercial Supply Rate')}</span><b data-v="supRate" style="color:${isOk ? 'var(--good)' : 'var(--bad)'}">${Math.round(sup.commercialStockRate * 100)}%</b></div>
      <div class="row"><span>${t('supply.stockouts', 'Active Stockouts')}</span><b data-v="supStockouts" style="color:${sup.stockoutStores > 0 ? 'var(--bad)' : 'var(--good)'}">${t('supply.stores', { count: sup.stockoutStores })}</b></div>
      <div class="row"><span>${t('supply.demand', 'City Demand')}</span><b data-v="supDemand">${sup.cityDemand} ${t('common.units_per_hour', 'units/h')}</b></div>
      <div class="row"><span>${t('supply.prod', 'Local Production')}</span><b data-v="supProd">${sup.localProduction} ${t('common.units_per_hour', 'units/h')}</b></div>
    </div>

    <div class="sec">
      <div class="lbl">${t('supply.raw_title', 'Raw Material Extraction')}</div>
      <div class="row">
        <span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#eab308;margin-right:6px"></i>${t('supply.food', 'Farming & Crops')}</span>
        <b data-v="supFood">${sup.rawFood} ${t('common.units_per_hour', 'units/h')}</b>
      </div>
      <div class="row">
        <span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#16a34a;margin-right:6px"></i>${t('supply.timber', 'Forestry & Timber')}</span>
        <b data-v="supTimber">${sup.rawTimber} ${t('common.units_per_hour', 'units/h')}</b>
      </div>
      <div class="row">
        <span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#64748b;margin-right:6px"></i>${t('supply.ore', 'Ore & Minerals')}</span>
        <b data-v="supOre">${sup.rawOre} ${t('common.units_per_hour', 'units/h')}</b>
      </div>
      <div class="row">
        <span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#7c3aed;margin-right:6px"></i>${t('supply.oil', 'Oil & Petroleum')}</span>
        <b data-v="supOil">${sup.rawOil} ${t('common.units_per_hour', 'units/h')}</b>
      </div>
      <div class="row">
        <span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#38bdf8;margin-right:6px"></i>${t('supply.goods', 'Consumer Goods')}</span>
        <b data-v="supGoods">${sup.consumerGoods} ${t('common.units_per_hour', 'units/h')}</b>
      </div>
    </div>

    <div class="sec">
      <div class="lbl">${t('supply.ledger_title', 'Trade & Freight Ledger')}</div>
      <div class="row"><span>${t('supply.export_earn', 'Export Earnings')}</span><b data-v="supExport" style="color:var(--good)">+${U.money(sup.exportRevenue)}/mo</b></div>
      <div class="row"><span>${t('supply.export_vol', 'Export Volume')}</span><b data-v="supExportVol">${sup.exportedGoods} ${t('common.units', 'units')}</b></div>
      <div class="row"><span>${t('supply.import_cost', 'Import Surcharge')}</span><b data-v="supImport" style="color:var(--bad)">-${U.money(sup.importCost)}/mo</b></div>
      <div class="row"><span>${t('supply.import_vol', 'Import Volume')}</span><b data-v="supImportVol">${sup.importedGoods} ${t('common.units', 'units')}</b></div>
    </div>

    <div class="btns" style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
      <button class="btn primary" id="btnResOverlay">${t('supply.view_res_btn', 'View Natural Resources Map')}</button>
      <button class="btn" id="btnOpenDistricts">${t('supply.dist_specs_btn', 'District Specializations')}</button>
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
  sv(p, 'supStockouts', t('supply.stores', { count: sup.stockoutStores }));
  sv(p, 'supDemand', sup.cityDemand + ' ' + t('common.units_per_hour', 'units/h'));
  sv(p, 'supProd', sup.localProduction + ' ' + t('common.units_per_hour', 'units/h'));

  sv(p, 'supFood', sup.rawFood + ' ' + t('common.units_per_hour', 'units/h'));
  sv(p, 'supTimber', sup.rawTimber + ' ' + t('common.units_per_hour', 'units/h'));
  sv(p, 'supOre', sup.rawOre + ' ' + t('common.units_per_hour', 'units/h'));
  sv(p, 'supOil', sup.rawOil + ' ' + t('common.units_per_hour', 'units/h'));
  sv(p, 'supGoods', sup.consumerGoods + ' ' + t('common.units_per_hour', 'units/h'));

  sv(p, 'supExport', '+' + U.money(sup.exportRevenue) + '/mo');
  sv(p, 'supExportVol', sup.exportedGoods + ' ' + t('common.units', 'units'));
  sv(p, 'supImport', '-' + U.money(sup.importCost) + '/mo');
  sv(p, 'supImportVol', sup.importedGoods + ' ' + t('common.units', 'units'));
}
