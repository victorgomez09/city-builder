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

const LEVEL_LABELS: Record<UnrestLevel, { label: string; color: string; desc: string }> = {
  peaceful: {
    label: 'Paz y Convivencia Cívica',
    color: '#22c55e',
    desc: 'Los ciudadanos están conformes con los servicios, el empleo y los impuestos.',
  },
  tense: {
    label: 'Tensión Vecinal Incipiente',
    color: '#eab308',
    desc: 'Empiezan a surgir quejas en barrios por presión fiscal o servicios saturados.',
  },
  protest: {
    label: 'Manifestaciones Activas en Calles',
    color: '#f97316',
    desc: 'Concentraciones cívicas y cortes de tráfico frente a sedes municipales.',
  },
  strike: {
    label: 'Huelga General de Servicios Públicos',
    color: '#ea580c',
    desc: 'Paralización de recogida de basuras, transporte, bomberos o triaje médico.',
  },
  riot: {
    label: 'Disturbios Callejeros y Barricadas',
    color: '#dc2626',
    desc: 'Grupos radicales montan barricadas ardiendo en calzadas bloqueando el tráfico.',
  },
};

const FACTOR_NAMES: Record<string, { label: string; icon: string; desc: string }> = {
  taxPressure: {
    label: 'Presión Fiscal',
    icon: '💸',
    desc: 'Impuestos residenciales, comerciales o industriales por encima del 10%.',
  },
  unemployment: {
    label: 'Tasa de Desempleo',
    icon: '📉',
    desc: 'Falta de puestos de trabajo para la población activa cualificada.',
  },
  pollution: {
    label: 'Polución y Humos',
    icon: '🏭',
    desc: 'Viviendas expuestas a nubes de polución industrial o aguas contaminadas.',
  },
  serviceDeficit: {
    label: 'Déficit de Servicios',
    icon: '🚒',
    desc: 'Carencia de cobertura de bomberos, policía, colegios o salud en barrios.',
  },
  stockouts: {
    label: 'Desabastecimiento Comercial',
    icon: '📦',
    desc: 'Comercios sin mercancías ni suministros para abastecer a la población.',
  },
  corpses: {
    label: 'Cadáveres Sin Recoger',
    icon: '⚰️',
    desc: 'Falta de cobertura funeraria y vehículos fúnebres para retirar difuntos.',
  },
};

export function updUnrest(p: HTMLElement): void {
  const st = Unrest.state;
  const info = LEVEL_LABELS[st.level] || LEVEL_LABELS.peaceful;

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
    { key: 'garbage', name: 'Recogida de Basuras', active: sk.garbage, icon: '🗑️' },
    { key: 'transit', name: 'Red de Transporte (25%)', active: sk.transit, icon: '🚌' },
    { key: 'fire', name: 'Servicio de Bomberos', active: sk.fire, icon: '🔥' },
    { key: 'police', name: 'Policía y Seguridad', active: sk.police, icon: '👮' },
    { key: 'health', name: 'Sanidad y Ambulancias', active: sk.health, icon: '🏥' },
  ];
  for (const s of sList) {
    const badge = q<HTMLElement>(`#strike_badge_${s.key}`, p);
    if (badge) {
      badge.className = 'pill ' + (s.active ? 'neg' : 'pos');
      badge.textContent = s.active ? 'HUELGA ACTIVA' : 'Servicio Normal';
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
  const info = LEVEL_LABELS[st.level] || LEVEL_LABELS.peaceful;

  let html = head('Paz Social y Sindicatos', 'Mesa de diálogo cívico, huelgas y conflictividad fiscal');

  // 1. Social Tension Thermometer
  html += `
  <div class="card" style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <b style="font-size:14px">Índice de Tensión Urbana</b>
      <b id="unrestScore" style="font-size:16px;color:${info.color}">${Math.round(st.score)} / 100</b>
    </div>
    <div style="width:100%;height:10px;background:rgba(255,255,255,0.08);border-radius:5px;overflow:hidden;margin-bottom:8px">
      <div id="unrestBarFill" style="height:100%;width:${Math.round(st.score)}%;background:${info.color};transition:width 0.3s, background-color 0.3s"></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span id="unrestLevelText" style="font-weight:600;font-size:13px;color:${info.color}">${info.label}</span>
      <span style="font-size:11px;color:var(--mute)">Umbral Huelga: >65 | Disturbios: >80</span>
    </div>
    <div id="unrestLevelDesc" style="font-size:11.5px;color:var(--mute);margin-top:4px">${info.desc}</div>
  </div>`;

  // 2. Incident summary counters
  html += `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
    <div class="card" style="text-align:center;padding:8px">
      <div style="font-size:11px;color:var(--mute);text-transform:uppercase">Manifestaciones Activas</div>
      <b id="protestsCount" style="font-size:20px;color:#f97316">${st.crowds.length}</b>
      <div style="font-size:10.5px;color:var(--mute)">Cortes de tráfico</div>
    </div>
    <div class="card" style="text-align:center;padding:8px">
      <div style="font-size:11px;color:var(--mute);text-transform:uppercase">Barricadas en Calzadas</div>
      <b id="barricadesCount" style="font-size:20px;color:#dc2626">${st.barricades.length}</b>
      <div style="font-size:10.5px;color:var(--mute)">Calles bloqueadas</div>
    </div>
  </div>`;

  // 3. Essential Public Service Strikes
  html += `
  <div class="card" style="margin-bottom:12px">
    <b style="display:block;margin-bottom:8px;font-size:13px">Estado de Servicios Públicos Esenciales</b>
    <div style="display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
        <span>🗑️ Limpieza y Basuras</span>
        <span id="strike_badge_garbage" class="pill ${st.strikes.garbage ? 'neg' : 'pos'}">${st.strikes.garbage ? 'HUELGA ACTIVA' : 'Servicio Normal'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
        <span>🚌 Transporte Público (25%)</span>
        <span id="strike_badge_transit" class="pill ${st.strikes.transit ? 'neg' : 'pos'}">${st.strikes.transit ? 'HUELGA ACTIVA' : 'Servicio Normal'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
        <span>🔥 Bomberos y Extinción</span>
        <span id="strike_badge_fire" class="pill ${st.strikes.fire ? 'neg' : 'pos'}">${st.strikes.fire ? 'HUELGA ACTIVA' : 'Servicio Normal'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
        <span>👮 Policía y Seguridad Local</span>
        <span id="strike_badge_police" class="pill ${st.strikes.police ? 'neg' : 'pos'}">${st.strikes.police ? 'HUELGA ACTIVA' : 'Servicio Normal'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0">
        <span>🏥 Sanidad y Ambulancias</span>
        <span id="strike_badge_health" class="pill ${st.strikes.health ? 'neg' : 'pos'}">${st.strikes.health ? 'HUELGA ACTIVA' : 'Servicio Normal'}</span>
      </div>
    </div>
  </div>`;

  // 4. Breakdown of Friction Factors
  html += `
  <div class="card" style="margin-bottom:12px">
    <b style="display:block;margin-bottom:8px;font-size:13px">Factores de Fricción y Malestar Social</b>
    <div style="display:flex;flex-direction:column;gap:8px">`;

  for (const [k, def] of Object.entries(FACTOR_NAMES)) {
    const val = Math.round((st.factors as any)[k] || 0);
    html += `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:2px">
          <span>${def.icon} ${def.label}</span>
          <b id="factor_val_${k}">${val}%</b>
        </div>
        <div style="width:100%;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
          <div id="factor_fill_${k}" style="height:100%;width:${val}%;background:#38bdf8;transition:width 0.25s"></div>
        </div>
        <div style="font-size:10.5px;color:var(--mute);margin-top:2px">${def.desc}</div>
      </div>`;
  }
  html += `</div></div>`;

  // 5. Collective Bargaining with Unions
  html += `
  <div class="card" style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <b style="font-size:13px">Mesa de Negociación Sindical</b>
      <span style="font-size:11px;color:var(--mute)">Paz laboral garantizada</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">`;

  for (const u of st.pacts) {
    const hasPact = u.accepted && u.monthsRemaining > 0;
    const costMonthly = u.monthlyCost || Math.round(u.cost / 12);
    html += `
      <div style="background:rgba(0,0,0,0.2);padding:8px 10px;border-radius:6px;border-left:3px solid ${hasPact ? '#22c55e' : '#f59e0b'}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b style="font-size:12.5px">${u.union}</b>
          <span class="pill ${hasPact ? 'pos' : 'warn'}" style="font-size:10px">${hasPact ? `Convenio (${u.monthsRemaining}m)` : 'En Conflicto'}</span>
        </div>
        <div style="font-size:11.5px;color:var(--text);margin:3px 0">${u.demands || u.desc}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
          <span style="font-size:11px;color:var(--mute)">Coste de paz: <b>${U.money(costMonthly)} / mes</b></span>
          ${
            hasPact
              ? `<span style="font-size:11px;color:#22c55e">✓ Acuerdo en vigor</span>`
              : `<button class="btn btn-sm" data-sign-union="${u.id}" style="font-size:11px">Firmar Convenio</button>`
          }
        </div>
      </div>`;
  }
  html += `</div></div>`;

  // 6. Emergency City Hall Interventions
  html += `
  <div class="card">
    <b style="display:block;margin-bottom:8px;font-size:13px">Medidas de Emergencia Municipal</b>
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="background:rgba(0,0,0,0.2);padding:8px;border-radius:6px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b>🚔 Desplegar Unidades Antidisturbios</b>
          <span style="color:#ef4444;font-size:11.5px;font-weight:600">$2,800</span>
        </div>
        <div style="font-size:11px;color:var(--mute);margin:4px 0">
          La policía local desmantela de inmediato todas las barricadas y dispersa marchas violentas.
        </div>
        <button class="btn btn-sm" id="btnRiotPolice" style="width:100%;margin-top:2px">Despejar Calles y Barricadas</button>
      </div>

      <div style="background:rgba(0,0,0,0.2);padding:8px;border-radius:6px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b>🏛️ Fondo Municipal de Alivio Social</b>
          <span style="color:#ef4444;font-size:11.5px;font-weight:600">$5,000</span>
        </div>
        <div style="font-size:11px;color:var(--mute);margin:4px 0">
          Subvención directa de emergencia para familias y pequeños autónomos. 6 meses de tregua cívica (-25 tensión).
        </div>
        <button class="btn btn-sm" id="btnReliefFund" style="width:100%;margin-top:2px">Aprobar Fondo de Alivio</button>
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
