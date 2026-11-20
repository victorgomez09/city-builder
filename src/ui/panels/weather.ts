/**
 * Vira City — Weather, Atmospheric Cycles & Disaster Management Panel (`src/ui/panels/weather.ts`)
 */

import { C } from '@/core/constants';
import { U } from '@/core/utils';
import { Sim } from '@/sim/sim';
import { WeatherSystem } from '@/sim/weather';
import { Gfx } from '@/render/gfx';
import { head, bindClose, q, $$ } from '@/ui/dom';
import { UI } from '@/ui/ui';
import { WeatherType, DisasterIncident } from '@/types';
import { t } from '@/i18n';

const WEATHER_ICONS: Record<WeatherType, string> = {
  clear: '☀️',
  overcast: '⛅',
  rain: '🌧️',
  storm: '⛈️',
  fog: '🌫️',
  snow: '❄️',
};

export function renderWeatherPanel(p: HTMLElement): void {
  const S = WeatherSystem.state;
  const wind = Sim.wind;
  const bState = Sim.bankruptcy;

  const weatherIcon = WEATHER_ICONS[S.type] || '☀️';
  const weatherName = t(`weather.types.${S.type}`, S.type.toUpperCase());
  const seasonName = t(`weather.seasons.${S.season}`, S.season.toUpperCase());

  const wildfireRisk = WeatherSystem.getWildfireRisk();
  const structuralRisk = WeatherSystem.getStructuralFireRisk();
  const stormRisk = WeatherSystem.getStormSurgeRisk();

  const activeIncidents = WeatherSystem.getActiveIncidents();

  const riskColor = (val: number) => {
    if (val < 30) return '#22c55e';
    if (val < 60) return '#eab308';
    if (val < 80) return '#f97316';
    return '#ef4444';
  };

  const riskLabel = (val: number) => {
    if (val < 30) return t('weather.risk_low', 'Low');
    if (val < 60) return t('weather.risk_moderate', 'Moderate');
    if (val < 80) return t('weather.risk_high', 'High');
    return t('weather.risk_extreme', 'Extreme');
  };

  let html = head(t('weather.title', 'Weather & Disaster Management'), 'weather');
  html += `<div class="pbody" style="padding:12px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;max-height:calc(100vh - 110px)">`;

  // 1. Bankruptcy / Debt Crisis Alert Banner
  if (bState.inDefault) {
    html += `
    <div style="background:rgba(220,38,38,0.18);border:1px solid #ef4444;border-radius:8px;padding:10px 12px">
      <div style="display:flex;align-items:center;gap:8px;color:#ef4444;font-weight:700;font-size:13px">
        <span>⚠️</span>
        <span>${t('weather.default_banner_title', 'AUSTERITY DEFAULT MODE ACTIVE')}</span>
      </div>
      <div style="font-size:11.5px;color:#fca5a5;margin-top:4px">
        ${t('weather.default_banner_desc', 'City is operating under State restructuring conditionality. +30% construction costs & debt fees applied.')}
      </div>
      <div style="font-size:11px;color:#fecaca;margin-top:4px;font-weight:600">
        ${t('weather.default_months_left', { n: bState.austerityMonthsLeft }, 'Austerity period remaining: {n} months')}
      </div>
    </div>`;
  } else if (bState.inWarning) {
    html += `
    <div style="background:rgba(234,179,8,0.15);border:1px solid #eab308;border-radius:8px;padding:10px 12px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:8px;color:#eab308;font-weight:700;font-size:13px">
          <span>⚠️</span>
          <span>${t('weather.warning_banner_title', 'CRITICAL TREASURY DEFICIT')}</span>
        </div>
        <span style="font-size:11px;color:#fde047;font-weight:700">${bState.warningDaysLeft} ${t('weather.days_left', 'days left')}</span>
      </div>
      <div style="font-size:11.5px;color:#fef08a;margin-top:4px">
        ${t('weather.warning_banner_desc', 'Treasury has dipped below -$10,000. Balance budget or accept the emergency external bailout.')}
      </div>
      <button class="btn btn-sm" id="btnAcceptBailout" style="width:100%;margin-top:8px;background:#dc2626;color:#fff;border:none">
        ${t('weather.btn_accept_bailout', 'Sign State Emergency Bailout Pact (+$50,000)')}
      </button>
    </div>`;
  }

  // 2. Severe Meteorological Anomaly Banner
  if (S.heatwave) {
    html += `
    <div style="background:rgba(249,115,22,0.15);border:1px solid #f97316;border-radius:8px;padding:8px 10px;display:flex;align-items:center;gap:8px">
      <span style="font-size:16px">🔥</span>
      <div style="font-size:11.5px;color:#fdba74">
        <b>${t('weather.heatwave_title', 'Severe Heatwave Alert')}:</b> ${t('weather.heatwave_desc', '+35% water & power demand. Extreme fire ignition risk.')}
      </div>
    </div>`;
  } else if (S.coldSnap) {
    html += `
    <div style="background:rgba(59,130,246,0.15);border:1px solid #3b82f6;border-radius:8px;padding:8px 10px;display:flex;align-items:center;gap:8px">
      <span style="font-size:16px">🥶</span>
      <div style="font-size:11.5px;color:#93c5fd">
        <b>${t('weather.cold_snap_title', 'Arctic Cold Snap')}:</b> ${t('weather.cold_snap_desc', 'Sub-zero temperatures. +25% heating electricity demand.')}
      </div>
    </div>`;
  }

  // 3. Current Live Weather Card
  html += `
  <div style="background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:8px;padding:14px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:38px;line-height:1">${weatherIcon}</span>
        <div>
          <div style="font-size:24px;font-weight:700;color:#fff">${S.temp.toFixed(1)}°C</div>
          <div style="font-size:13px;font-weight:600;color:var(--mute)">${weatherName} · ${seasonName}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:var(--mute)">${t('weather.wind', 'Wind')}</div>
        <div style="font-size:14px;font-weight:700;color:#60a5fa">${wind.speed.toFixed(0)} km/h ${wind.dirName}</div>
        <div style="font-size:10.5px;color:var(--mute)">${wind.name}</div>
      </div>
    </div>

    <!-- Meteorological Metrics Grid -->
    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06)">
      <div style="text-align:center">
        <div style="font-size:10px;color:var(--mute);text-transform:uppercase">${t('weather.humidity', 'Humidity')}</div>
        <div style="font-size:14px;font-weight:700;color:#93c5fd;margin-top:2px">${S.humidity.toFixed(0)}%</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:10px;color:var(--mute);text-transform:uppercase">${t('weather.pressure', 'Pressure')}</div>
        <div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-top:2px">${S.pressure.toFixed(0)} hPa</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:10px;color:var(--mute);text-transform:uppercase">${t('weather.precip', 'Precipitation')}</div>
        <div style="font-size:14px;font-weight:700;color:${S.precipitation > 0 ? '#38bdf8' : 'var(--mute)'};margin-top:2px">
          ${(S.precipitation * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  </div>`;

  // 4. 5-Day Radar & Meteorological Forecast
  html += `
  <div>
    <div style="font-size:11.5px;font-weight:700;color:var(--mute);text-transform:uppercase;margin-bottom:8px">
      ${t('weather.forecast_title', '5-Day Meteorological Forecast')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:6px">
      ${S.forecast.map((fc, idx) => `
        <div style="background:rgba(255,255,255,0.02);border:1px solid var(--line);border-radius:6px;padding:8px 4px;text-align:center">
          <div style="font-size:10.5px;font-weight:700;color:${idx === 0 ? '#38bdf8' : 'var(--mute)'}">
            ${idx === 0 ? t('weather.today', 'Today') : `+${fc.dayOffset}d`}
          </div>
          <div style="font-size:20px;margin:4px 0">${WEATHER_ICONS[fc.type] || '☀️'}</div>
          <div style="font-size:11px;font-weight:700;color:#fff">${fc.tempMax}°</div>
          <div style="font-size:10px;color:var(--mute)">${fc.tempMin}°</div>
          <div style="font-size:9.5px;color:#60a5fa;margin-top:2px">${fc.precipitationChance}%</div>
        </div>
      `).join('')}
    </div>
  </div>`;

  // 5. Disaster Threat Levels (Gauges)
  html += `
  <div style="background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:8px;padding:12px">
    <div style="font-size:11.5px;font-weight:700;color:var(--mute);text-transform:uppercase;margin-bottom:10px">
      ${t('weather.disaster_threat_title', 'Municipal Disaster Threat Levels')}
    </div>

    <!-- Wildfire Danger -->
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px">
        <span>🌲 ${t('weather.risk_wildfire', 'Wildfire Danger Index')}</span>
        <b style="color:${riskColor(wildfireRisk)}">${wildfireRisk}/100 (${riskLabel(wildfireRisk)})</b>
      </div>
      <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">
        <div style="width:${wildfireRisk}%;height:100%;background:${riskColor(wildfireRisk)};border-radius:3px"></div>
      </div>
    </div>

    <!-- Structural Fire Risk -->
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px">
        <span>🏢 ${t('weather.risk_structural', 'Structural Fire Propagation Risk')}</span>
        <b style="color:${riskColor(structuralRisk)}">${structuralRisk}/100 (${riskLabel(structuralRisk)})</b>
      </div>
      <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">
        <div style="width:${structuralRisk}%;height:100%;background:${riskColor(structuralRisk)};border-radius:3px"></div>
      </div>
    </div>

    <!-- Severe Storm & Surge Risk -->
    <div>
      <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px">
        <span>⚡ ${t('weather.risk_storm', 'Severe Storm & Lightning Risk')}</span>
        <b style="color:${riskColor(stormRisk)}">${stormRisk}/100 (${riskLabel(stormRisk)})</b>
      </div>
      <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">
        <div style="width:${stormRisk}%;height:100%;background:${riskColor(stormRisk)};border-radius:3px"></div>
      </div>
    </div>
  </div>`;

  // 6. Active Municipal Emergency Incidents
  html += `
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:11.5px;font-weight:700;color:var(--mute);text-transform:uppercase">
        ${t('weather.incidents_title', 'Active Incidents Tracker')}
      </span>
      <span style="font-size:11px;padding:2px 6px;border-radius:10px;background:${activeIncidents.length > 0 ? '#ef4444' : '#22c55e'};color:#fff;font-weight:700">
        ${activeIncidents.length}
      </span>
    </div>

    ${activeIncidents.length === 0 ? `
      <div style="background:rgba(34,197,94,0.08);border:1px solid #22c55e;border-radius:6px;padding:10px;text-align:center;color:#4ade80;font-size:12px">
        ✓ ${t('weather.no_incidents', 'All clear — No active municipal emergency incidents.')}
      </div>
    ` : `
      <div style="display:flex;flex-direction:column;gap:6px">
        ${activeIncidents.map(inc => `
          <div style="background:rgba(0,0,0,0.25);border:1px solid rgba(239,68,68,0.4);border-radius:6px;padding:8px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:12px;font-weight:700;color:#f87171">
                ${inc.type === 'wildfire' ? '🌲 Wildfire' : inc.type === 'structural_fire' ? '🏢 Building Fire' : '⚡ Lightning Strike'}
              </div>
              <div style="font-size:11px;color:#cbd5e1;margin-top:2px">${inc.description}</div>
            </div>
            <button class="btn btn-sm" data-focus-tile="${inc.tile}" data-fx="${inc.x}" data-fy="${inc.y}" style="font-size:11px;padding:3px 8px">
              🔍 ${t('weather.btn_focus', 'Focus')}
            </button>
          </div>
        `).join('')}
      </div>
    `}
  </div>`;

  // 7. Executive Emergency Operations
  html += `
  <div style="background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:8px;padding:12px">
    <div style="font-size:11.5px;font-weight:700;color:var(--mute);text-transform:uppercase;margin-bottom:10px">
      ${t('weather.operations_title', 'Emergency Executive Directives')}
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">

      <!-- Cloud Seeding -->
      <div style="background:rgba(0,0,0,0.2);padding:8px 10px;border-radius:6px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:12px;font-weight:700;color:#fff">✈️ ${t('weather.cloud_seeding_title', 'Cloud Seeding Operation')}</div>
          <div style="font-size:10.5px;color:var(--mute);margin-top:2px">
            ${t('weather.cloud_seeding_desc', 'Disperse silver iodide to induce rain within 4 hours. Extinguishes wildfires.')}
          </div>
        </div>
        <button class="btn btn-sm" id="btnCloudSeeding" style="white-space:nowrap;margin-left:8px">
          $3,500
        </button>
      </div>

      <!-- Mobilize Fire Brigades -->
      <div style="background:rgba(0,0,0,0.2);padding:8px 10px;border-radius:6px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:12px;font-weight:700;color:#fff">
            🚒 ${t('weather.brigades_title', 'Mobilize Fire Brigades')}
            ${S.brigadesMobilized ? `<span style="color:#22c55e;font-size:10.5px"> (${S.brigadesTimer.toFixed(0)}h left)</span>` : ''}
          </div>
          <div style="font-size:10.5px;color:var(--mute);margin-top:2px">
            ${t('weather.brigades_desc', 'Call reserve firefighters. Doubles brigade response speed & radius for 72 hours.')}
          </div>
        </div>
        <button class="btn btn-sm" id="btnMobilizeBrigades" style="white-space:nowrap;margin-left:8px" ${S.brigadesMobilized ? 'disabled' : ''}>
          ${S.brigadesMobilized ? t('weather.active', 'Active') : '$4,000'}
        </button>
      </div>

      <!-- Public Emergency Sirens -->
      <div style="background:rgba(0,0,0,0.2);padding:8px 10px;border-radius:6px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:12px;font-weight:700;color:#fff">
            📢 ${t('weather.sirens_title', 'Severe Weather Sirens & Curfew')}
          </div>
          <div style="font-size:10.5px;color:var(--mute);margin-top:2px">
            ${t('weather.sirens_desc', 'Directs citizens to shelter indoors. Reduces road traffic by 60% and avoids casualties.')}
          </div>
        </div>
        <button class="btn btn-sm" id="btnToggleSirens" style="white-space:nowrap;margin-left:8px;background:${S.emergencySirensActive ? '#ef4444' : 'var(--panel)'}">
          ${S.emergencySirensActive ? t('weather.silence', 'Silence') : '$1,000'}
        </button>
      </div>

    </div>
  </div>`;

  html += `</div>`;
  p.innerHTML = html;
  bindClose(p, () => UI.openPanel(null));

  // --- Bind Event Handlers ---
  const btnBailout = q<HTMLElement>('#btnAcceptBailout', p);
  if (btnBailout) {
    btnBailout.onclick = () => {
      Sim.acceptBailout();
      renderWeatherPanel(p);
    };
  }

  const btnCloud = q<HTMLElement>('#btnCloudSeeding', p);
  if (btnCloud) {
    btnCloud.onclick = () => {
      if (WeatherSystem.cloudSeeding()) {
        renderWeatherPanel(p);
      }
    };
  }

  const btnBrigades = q<HTMLElement>('#btnMobilizeBrigades', p);
  if (btnBrigades) {
    btnBrigades.onclick = () => {
      if (WeatherSystem.mobilizeBrigades()) {
        renderWeatherPanel(p);
      }
    };
  }

  const btnSirens = q<HTMLElement>('#btnToggleSirens', p);
  if (btnSirens) {
    btnSirens.onclick = () => {
      if (WeatherSystem.toggleEmergencySirens()) {
        renderWeatherPanel(p);
      }
    };
  }

  // Camera Focus on Incidents
  $$<HTMLElement>('[data-focus-tile]', p).forEach(btn => {
    btn.onclick = () => {
      const fx = parseFloat(btn.dataset.fx || '0');
      const fy = parseFloat(btn.dataset.fy || '0');
      if (Gfx && typeof Gfx.focus === 'function') {
        Gfx.focus((fx + 0.5) * C.TILE, (fy + 0.5) * C.TILE, 220);
      }
    };
  });
}
