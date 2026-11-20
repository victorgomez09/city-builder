/**
 * Vira City — Civic Peace, Social Unrest & Collective Bargaining Panel (`src/ui/panels/unrest.ts`)
 *
 * Provides civic conflict diagnostics, factors breakdown, strikes oversight,
 * collective bargaining with municipal worker unions, and emergency city peace actions.
 */

import { U } from '@/core/utils';
import { Sim } from '@/sim/sim';
import { Unrest } from '@/sim/unrest';
import { head, bindClose, sv, q, $$ } from '@/ui/dom';
import { UI } from '@/ui/ui';
import { UnrestLevel, UnionDemand } from '@/types';
import { t } from '@/i18n';

export const LEVEL_LABELS: Record<UnrestLevel, { label: string; color: string; desc: string }> = {
  peaceful: {
    label: 'Peace & Civic Harmony',
    color: '#22c55e',
    desc: 'Citizens are satisfied with public services, employment, and taxation.',
  },
  tense: {
    label: 'Incipient Neighborhood Tension',
    color: '#eab308',
    desc: 'Grievances begin to surface over tax pressure or congested public services.',
  },
  protest: {
    label: 'Active Street Demonstrations',
    color: '#f97316',
    desc: 'Civic rallies and traffic blockades outside municipal headquarters.',
  },
  strike: {
    label: 'Public Services General Strike',
    color: '#ea580c',
    desc: 'Shutdown of sanitation, public transit, fire brigades, or emergency triage.',
  },
  riot: {
    label: 'Street Riots & Barricades',
    color: '#dc2626',
    desc: 'Radical groups set burning barricades across roadways, paralyzing traffic.',
  },
};

export const FACTOR_NAMES: Record<string, { label: string; icon: string; desc: string }> = {
  taxPressure: {
    label: 'Tax Pressure',
    icon: '💸',
    desc: 'Residential, commercial, or industrial tax rates above 10%.',
  },
  unemployment: {
    label: 'Unemployment Rate',
    icon: '📉',
    desc: 'Lack of job opportunities for the active working population.',
  },
  pollution: {
    label: 'Pollution & Smog',
    icon: '🏭',
    desc: 'Homes exposed to industrial pollution clouds or contaminated water.',
  },
  serviceDeficit: {
    label: 'Service Deficit',
    icon: '🚒',
    desc: 'Lack of fire, police, school, or healthcare coverage in neighborhoods.',
  },
  stockouts: {
    label: 'Commercial Stockouts',
    icon: '📦',
    desc: 'Shops lacking inventory and freight supplies to serve customers.',
  },
  corpses: {
    label: 'Uncollected Deceased',
    icon: '⚰️',
    desc: 'Shortage of funeral facilities and hearses to collect deceased citizens.',
  },
};

function getLevelInfo(lvl: UnrestLevel) {
  const base = LEVEL_LABELS[lvl] || LEVEL_LABELS.peaceful;
  return {
    label: t('unrest.levels.' + lvl + '.name', base.label),
    color: base.color,
    desc: t('unrest.levels.' + lvl + '.desc', base.desc),
  };
}

export function updUnrest(p: HTMLElement): void {
  const st = Unrest.state;
  const info = getLevelInfo(st.level);

  const scoreEl = q<HTMLElement>('#unrestScore', p);
  if (scoreEl) {
    scoreEl.textContent = Math.round(st.score) + ' / 100';
    scoreEl.style.color = info.color;
  }

  const fillEl = q<HTMLElement>('#unrestBarFill', p);
  if (fillEl) {
    fillEl.style.width = Math.min(100, Math.max(0, st.score)) + '%';
    fillEl.style.backgroundColor = info.color;
  }

  const lvlEl = q<HTMLElement>('#unrestLevelText', p);
  if (lvlEl) {
    lvlEl.textContent = info.label;
    lvlEl.style.color = info.color;
  }

  const descEl = q<HTMLElement>('#unrestLevelDesc', p);
  if (descEl) descEl.textContent = info.desc;

  // Update factors live values
  for (const [k, v] of Object.entries(st.factors)) {
    const vEl = q<HTMLElement>(`#factor_val_${k}`, p);
    if (vEl) vEl.textContent = Math.round(v) + '%';
    const fEl = q<HTMLElement>(`#factor_fill_${k}`, p);
    if (fEl) fEl.style.width = Math.min(100, Math.max(0, v)) + '%';
  }

  // Active strike pills
  const sk = st.strikes;
  const sList = [
    { key: 'garbage', name: t('unrest.services.garbage', 'Garbage Collection'), active: sk.garbage, icon: '🗑️' },
    { key: 'transit', name: t('unrest.services.transit', 'Transit Network (25%)'), active: sk.transit, icon: '🚌' },
    { key: 'fire', name: t('unrest.services.fire', 'Fire Services'), active: sk.fire, icon: '🔥' },
    { key: 'police', name: t('unrest.services.police', 'Police & Security'), active: sk.police, icon: '👮' },
    { key: 'health', name: t('unrest.services.health', 'Healthcare & Ambulances'), active: sk.health, icon: '🏥' },
  ];
  for (const s of sList) {
    const badge = q<HTMLElement>(`#strike_badge_${s.key}`, p);
    if (badge) {
      badge.className = 'pill ' + (s.active ? 'neg' : 'pos');
      badge.textContent = s.active ? t('unrest.strike_active', 'ACTIVE STRIKE') : t('unrest.service_normal', 'Normal Service');
    }
  }

  // Barricades & crowds counters
  const barCountEl = q<HTMLElement>('#barricadesCount', p);
  if (barCountEl) barCountEl.textContent = String(st.barricades.length);

  const protCountEl = q<HTMLElement>('#protestsCount', p);
  if (protCountEl) protCountEl.textContent = String(st.crowds.length);
}

export function renderUnrestPanel(p: HTMLElement): void {
  const st = Unrest.state;
  const info = getLevelInfo(st.level);

  let html = head(t('unrest.title', 'Peace & Unrest'), t('unrest.subtitle', 'Civic dialogue, strikes, and tax conflict'));

  // 1. Social Tension Thermometer
  html += `
  <div class="card" style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <b style="font-size:14px">${t('unrest.index_title', 'Urban Tension Index')}</b>
      <b id="unrestScore" style="font-size:16px;color:${info.color}">${Math.round(st.score)} / 100</b>
    </div>
    <div style="width:100%;height:10px;background:rgba(255,255,255,0.08);border-radius:5px;overflow:hidden;margin-bottom:8px">
      <div id="unrestBarFill" style="height:100%;width:${Math.round(st.score)}%;background:${info.color};transition:width 0.3s, background-color 0.3s"></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span id="unrestLevelText" style="font-weight:600;font-size:13px;color:${info.color}">${info.label}</span>
      <span style="font-size:11px;color:var(--mute)">${t('unrest.threshold_hint', 'Strike Threshold: >65 | Riot: >80')}</span>
    </div>
    <div id="unrestLevelDesc" style="font-size:11.5px;color:var(--mute);margin-top:4px">${info.desc}</div>
  </div>`;

  // 2. Incident summary counters
  html += `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
    <div class="card" style="text-align:center;padding:8px">
      <div style="font-size:11px;color:var(--mute);text-transform:uppercase">${t('unrest.protests_active', 'Active Demonstrations')}</div>
      <b id="protestsCount" style="font-size:20px;color:#f97316">${st.crowds.length}</b>
      <div style="font-size:10.5px;color:var(--mute)">${t('unrest.traffic_cuts', 'Traffic cuts')}</div>
    </div>
    <div class="card" style="text-align:center;padding:8px">
      <div style="font-size:11px;color:var(--mute);text-transform:uppercase">${t('unrest.barricades_active', 'Barricades on Roadways')}</div>
      <b id="barricadesCount" style="font-size:20px;color:#dc2626">${st.barricades.length}</b>
      <div style="font-size:10.5px;color:var(--mute)">${t('unrest.streets_blocked', 'Streets blocked')}</div>
    </div>
  </div>`;

  // 3. Essential Public Service Strikes
  html += `
  <div class="card" style="margin-bottom:12px">
    <b style="display:block;margin-bottom:8px;font-size:13px">${t('unrest.services_title', 'Essential Public Services Status')}</b>
    <div style="display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
        <span>🗑️ ${t('unrest.services.garbage', 'Garbage Collection')}</span>
        <span id="strike_badge_garbage" class="pill ${st.strikes.garbage ? 'neg' : 'pos'}">${st.strikes.garbage ? t('unrest.strike_active', 'ACTIVE STRIKE') : t('unrest.service_normal', 'Normal Service')}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
        <span>🚌 ${t('unrest.services.transit', 'Transit Network (25%)')}</span>
        <span id="strike_badge_transit" class="pill ${st.strikes.transit ? 'neg' : 'pos'}">${st.strikes.transit ? t('unrest.strike_active', 'ACTIVE STRIKE') : t('unrest.service_normal', 'Normal Service')}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
        <span>🔥 ${t('unrest.services.fire', 'Fire Services')}</span>
        <span id="strike_badge_fire" class="pill ${st.strikes.fire ? 'neg' : 'pos'}">${st.strikes.fire ? t('unrest.strike_active', 'ACTIVE STRIKE') : t('unrest.service_normal', 'Normal Service')}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
        <span>👮 ${t('unrest.services.police', 'Police & Security')}</span>
        <span id="strike_badge_police" class="pill ${st.strikes.police ? 'neg' : 'pos'}">${st.strikes.police ? t('unrest.strike_active', 'ACTIVE STRIKE') : t('unrest.service_normal', 'Normal Service')}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0">
        <span>🏥 ${t('unrest.services.health', 'Healthcare & Ambulances')}</span>
        <span id="strike_badge_health" class="pill ${st.strikes.health ? 'neg' : 'pos'}">${st.strikes.health ? t('unrest.strike_active', 'ACTIVE STRIKE') : t('unrest.service_normal', 'Normal Service')}</span>
      </div>
    </div>
  </div>`;

  // 4. Breakdown of Friction Factors
  html += `
  <div class="card" style="margin-bottom:12px">
    <b style="display:block;margin-bottom:8px;font-size:13px">${t('unrest.factors_title', 'Social Friction & Grievance Factors')}</b>
    <div style="display:flex;flex-direction:column;gap:8px">`;

  for (const [k, def] of Object.entries(FACTOR_NAMES)) {
    const val = Math.round((st.factors as any)[k] || 0);
    const label = t('unrest.factors.' + k + '.name', def.label);
    const desc = t('unrest.factors.' + k + '.desc', def.desc);
    html += `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:2px">
          <span>${def.icon} ${label}</span>
          <b id="factor_val_${k}">${val}%</b>
        </div>
        <div style="width:100%;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
          <div id="factor_fill_${k}" style="height:100%;width:${val}%;background:#38bdf8;transition:width 0.25s"></div>
        </div>
        <div style="font-size:10.5px;color:var(--mute);margin-top:2px">${desc}</div>
      </div>`;
  }
  html += `</div></div>`;

  // 5. Collective Bargaining with Unions
  html += `
  <div class="card" style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <b style="font-size:13px">${t('unrest.unions_title', 'Labor Union Negotiation Table')}</b>
      <span style="font-size:11px;color:var(--mute)">${t('unrest.labor_peace', 'Labor peace guaranteed')}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">`;

  for (const u of st.pacts) {
    const hasPact = u.accepted && u.monthsRemaining > 0;
    const costMonthly = u.monthlyCost || Math.round(u.cost / 12);
    html += `
      <div style="background:rgba(0,0,0,0.2);padding:8px 10px;border-radius:6px;border-left:3px solid ${hasPact ? '#22c55e' : '#f59e0b'}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b style="font-size:12.5px">${u.union}</b>
          <span class="pill ${hasPact ? 'pos' : 'warn'}" style="font-size:10px">${hasPact ? t('unrest.pact_active', { months: u.monthsRemaining }) : t('unrest.in_conflict', 'In Dispute')}</span>
        </div>
        <div style="font-size:11.5px;color:var(--text);margin:3px 0">${u.demands || u.desc}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
          <span style="font-size:11px;color:var(--mute)">${t('unrest.peace_cost', { cost: U.money(costMonthly) })}</span>
          ${
            hasPact
              ? `<span style="font-size:11px;color:#22c55e">${t('unrest.pact_in_effect', '✓ Agreement in effect')}</span>`
              : `<button class="btn btn-sm" data-sign-union="${u.id}" style="font-size:11px">${t('unrest.sign_pact', 'Sign Agreement')}</button>`
          }
        </div>
      </div>`;
  }
  html += `</div></div>`;

  // 6. Emergency City Hall Interventions
  html += `
  <div class="card">
    <b style="display:block;margin-bottom:8px;font-size:13px">${t('unrest.emergency_title', 'Municipal Emergency Measures')}</b>
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="background:rgba(0,0,0,0.2);padding:8px;border-radius:6px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b>${t('unrest.riot_police_title', '🚔 Deploy Riot Police Units')}</b>
          <span style="color:#ef4444;font-size:11.5px;font-weight:600">$2,800</span>
        </div>
        <div style="font-size:11px;color:var(--mute);margin:4px 0">
          ${t('unrest.riot_police_desc', 'Local police immediately dismantle all barricades and disperse violent protests.')}
        </div>
        <button class="btn btn-sm" id="btnRiotPolice" style="width:100%;margin-top:2px">${t('unrest.riot_police_btn', 'Clear Streets and Barricades')}</button>
      </div>

      <div style="background:rgba(0,0,0,0.2);padding:8px;border-radius:6px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b>${t('unrest.relief_fund_title', '🏛️ Municipal Social Relief Fund')}</b>
          <span style="color:#ef4444;font-size:11.5px;font-weight:600">$5,000</span>
        </div>
        <div style="font-size:11px;color:var(--mute);margin:4px 0">
          ${t('unrest.relief_fund_desc', 'Direct emergency grant for families and small shops. 6 months of civic truce (-25 tension).')}
        </div>
        <button class="btn btn-sm" id="btnReliefFund" style="width:100%;margin-top:2px">${t('unrest.relief_fund_btn', 'Approve Relief Fund')}</button>
      </div>
    </div>
  </div>`;

  p.innerHTML = html;
  bindClose(p, () => UI.openPanel(null));

  // Bind actions
  $$<HTMLElement>('[data-sign-union]', p).forEach(btn => {
    btn.onclick = () => {
      const uid = btn.dataset.signUnion;
      if (!uid) return;
      const res = Unrest.acceptPact(uid, Sim.money);
      if (res.success) {
        Sim.money -= res.cost;
        UI.toast(res.message, 'good');
        renderUnrestPanel(p);
      } else {
        UI.toast(res.message, 'bad');
      }
    };
  });

  const btnRiot = q<HTMLElement>('#btnRiotPolice', p);
  if (btnRiot) {
    btnRiot.onclick = () => {
      const res = Unrest.deployRiotPolice(Sim.money);
      if (res.success) {
        Sim.money -= res.cost;
        UI.toast(res.message, 'warn');
        renderUnrestPanel(p);
      } else {
        UI.toast(res.message, 'bad');
      }
    };
  }

  const btnRelief = q<HTMLElement>('#btnReliefFund', p);
  if (btnRelief) {
    btnRelief.onclick = () => {
      const res = Unrest.declareSocialRelief(Sim.money);
      if (res.success) {
        Sim.money -= res.cost;
        UI.toast(res.message, 'good');
        renderUnrestPanel(p);
      } else {
        UI.toast(res.message, 'bad');
      }
    };
  }
}
