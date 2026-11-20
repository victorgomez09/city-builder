/**
 * Vira City — Demographics, Healthcare, Labor Market & Tourism Panel (`src/ui/panels/demographics.ts`)
 */

import { U } from '@/core/utils';
import { Sim } from '@/sim/sim';
import { DemographicsSystem } from '@/sim/demographics';
import { head, bindClose, q, $$ } from '@/ui/dom';
import { UI } from '@/ui/ui';
import { t } from '@/i18n';

export function renderDemographicsPanel(p: HTMLElement): void {
  const S = DemographicsSystem.state;
  const P = Sim.stats.pop;

  const childPct = P > 0 ? Math.round((S.children / P) * 100) : 0;
  const studentPct = P > 0 ? Math.round((S.students / P) * 100) : 0;
  const workforcePct = P > 0 ? Math.round((S.workforce / P) * 100) : 0;
  const seniorPct = P > 0 ? Math.round((S.seniors / P) * 100) : 0;

  const mismatchColor = S.laborMismatchIndex < 25 ? '#22c55e' : S.laborMismatchIndex < 55 ? '#eab308' : '#ef4444';
  const hospColor = S.hospitalOccupancy < 65 ? '#22c55e' : S.hospitalOccupancy < 85 ? '#eab308' : '#ef4444';

  let html = head(t('demographics.title', 'Demographics & Healthcare'), 'demographics');
  html += `<div class="pbody" style="padding:12px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;max-height:calc(100vh - 110px)">`;

  // 1. Brain Drain Alert Banner
  if (S.brainDrainActive) {
    html += `
    <div style="background:rgba(239,68,68,0.15);border:1px solid #ef4444;border-radius:8px;padding:10px 12px">
      <div style="display:flex;align-items:center;gap:8px;color:#ef4444;font-weight:700;font-size:12.5px">
        <span>🎓</span>
        <span>${t('demographics.braindrain_banner_title', 'ACTIVE BRAIN DRAIN IN PROGRESS')}</span>
      </div>
      <div style="font-size:11.5px;color:#fca5a5;margin-top:4px">
        ${t('demographics.braindrain_banner_desc', 'Educated university graduates are emigrating due to a lack of high-skilled office and tech jobs.')}
      </div>
      <div style="font-size:11px;color:#fecaca;margin-top:4px;font-weight:600">
        ${t('demographics.braindrain_rate', { n: S.brainDrainRate }, '{n} graduates emigrating per month')}
      </div>
    </div>`;
  }

  // 2. Population Pyramid & Age Cohorts Card
  html += `
  <div style="background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:8px;padding:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span style="font-size:11.5px;font-weight:700;color:var(--mute);text-transform:uppercase">
        ${t('demographics.pyramid_title', 'Population Cohorts & Vital Indices')}
      </span>
      <span style="font-size:11px;color:#38bdf8;font-weight:600">
        ${t('demographics.life_exp', { n: S.lifeExpectancy.toFixed(1) }, 'Life Exp: {n} yrs')}
      </span>
    </div>

    <!-- Cohorts Bar Graph -->
    <div style="display:flex;flex-direction:column;gap:8px">
      <!-- Children -->
      <div>
        <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:3px">
          <span>👶 ${t('demographics.cohort_children', 'Children (0–17)')}</span>
          <b>${U.num(S.children)} (${childPct}%)</b>
        </div>
        <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">
          <div style="width:${childPct}%;height:100%;background:#38bdf8;border-radius:3px"></div>
        </div>
      </div>

      <!-- Students -->
      <div>
        <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:3px">
          <span>🎒 ${t('demographics.cohort_students', 'Students (18–24)')}</span>
          <b>${U.num(S.students)} (${studentPct}%)</b>
        </div>
        <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">
          <div style="width:${studentPct}%;height:100%;background:#a855f7;border-radius:3px"></div>
        </div>
      </div>

      <!-- Workforce -->
      <div>
        <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:3px">
          <span>💼 ${t('demographics.cohort_workforce', 'Workforce (25–64)')}</span>
          <b>${U.num(S.workforce)} (${workforcePct}%)</b>
        </div>
        <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">
          <div style="width:${workforcePct}%;height:100%;background:#22c55e;border-radius:3px"></div>
        </div>
      </div>

      <!-- Seniors -->
      <div>
        <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:3px">
          <span>👴 ${t('demographics.cohort_seniors', 'Seniors (65+)')}</span>
          <b>${U.num(S.seniors)} (${seniorPct}%)</b>
        </div>
        <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">
          <div style="width:${seniorPct}%;height:100%;background:#eab308;border-radius:3px"></div>
        </div>
      </div>
    </div>

    <!-- Vital Stats Footer -->
    <div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:var(--mute)">
      <span>${t('demographics.fertility', { n: S.fertilityRate.toFixed(1) }, 'Fertility Rate: {n} / 1k')}</span>
      <span>${t('demographics.health_status', { status: S.infectedCitizens > 40 ? 'Severe Epidemic' : 'Optimal' }, 'Public Health: {status}')}</span>
    </div>
  </div>`;

  // 3. Labor Market & Qualifications Matching
  html += `
  <div style="background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:8px;padding:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span style="font-size:11.5px;font-weight:700;color:var(--mute);text-transform:uppercase">
        ${t('demographics.labor_title', 'Labor Qualifications & Market')}
      </span>
      <span style="font-size:11px;color:${mismatchColor};font-weight:700">
        ${t('demographics.mismatch_index', { n: S.laborMismatchIndex }, 'Mismatch: {n}%')}
      </span>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <!-- Skilled -->
      <div style="background:rgba(0,0,0,0.2);padding:8px;border-radius:6px">
        <div style="font-size:11px;font-weight:700;color:#c084fc">🎓 ${t('demographics.skilled_workers', 'Skilled (College)')}</div>
        <div style="font-size:14px;font-weight:700;color:#fff;margin-top:2px">${U.num(S.skilledWorkers)}</div>
        <div style="font-size:10.5px;color:var(--mute);margin-top:2px">${t('demographics.skilled_jobs', { n: U.num(S.skilledJobs) }, '{n} jobs available')}</div>
      </div>

      <!-- Unskilled -->
      <div style="background:rgba(0,0,0,0.2);padding:8px;border-radius:6px">
        <div style="font-size:11px;font-weight:700;color:#60a5fa">🔨 ${t('demographics.unskilled_workers', 'Unskilled (Manual)')}</div>
        <div style="font-size:14px;font-weight:700;color:#fff;margin-top:2px">${U.num(S.unskilledWorkers)}</div>
        <div style="font-size:10.5px;color:var(--mute);margin-top:2px">${t('demographics.unskilled_jobs', { n: U.num(S.unskilledJobs) }, '{n} jobs available')}</div>
      </div>
    </div>
  </div>`;

  // 4. Gentrification & Housing Displacement
  html += `
  <div style="background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:8px;padding:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <span style="font-size:11.5px;font-weight:700;color:var(--mute);text-transform:uppercase">
        ${t('demographics.gentrification_title', 'Gentrification & Displacement')}
      </span>
      <span style="font-size:11.5px;font-weight:700;color:#facc15">
        ${S.gentrificationIndex}/100
      </span>
    </div>
    <div style="font-size:11px;color:var(--mute);line-height:1.4">
      ${t('demographics.gentrification_desc', 'High land value triggers redevelopment of low-density cottages into luxury apartments, displacing low-income residents.')}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
      <div style="font-size:11.5px;color:#f87171;font-weight:600">
        ${t('demographics.displaced_count', { n: U.num(S.displacedCitizens) }, 'Displaced Tenants: {n}')}
      </div>
      <button class="btn btn-sm" id="btnViewGentrification" style="font-size:11px;padding:3px 8px">
        👁️ ${t('demographics.btn_view_layer', 'View Layer')}
      </button>
    </div>
  </div>`;

  // 5. Contagious Epidemic Outbreak & Healthcare Saturation
  html += `
  <div style="background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:8px;padding:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:11.5px;font-weight:700;color:var(--mute);text-transform:uppercase">
        ${t('demographics.epidemic_title', 'Public Health & Epidemic Outbreak')}
      </span>
      <span style="font-size:11px;font-weight:700;color:${hospColor}">
        ${S.hospitalOccupancy}% ${t('demographics.occupied', 'Capacity')}
      </span>
    </div>

    <!-- Active Sick Gauge -->
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:3px">
        <span>🦠 ${t('demographics.infected_patients', 'Infected Citizens')}</span>
        <b style="color:#ef4444">${U.num(S.infectedCitizens)} / ${U.num(S.hospitalCapacity)} beds</b>
      </div>
      <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">
        <div style="width:${Math.min(100, S.hospitalOccupancy)}%;height:100%;background:${hospColor};border-radius:3px"></div>
      </div>
    </div>

    <!-- Health Directives -->
    <div style="display:flex;flex-direction:column;gap:6px">
      <!-- Sanitation Blitz -->
      <div style="background:rgba(0,0,0,0.2);padding:8px 10px;border-radius:6px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:11.5px;font-weight:700;color:#fff">
            🧹 ${t('demographics.sanitation_title', 'Citywide Sanitation Blitz')}
            ${S.sanitationBlitzActive ? `<span style="color:#22c55e;font-size:10px"> (${(S.sanitationTimer / 24).toFixed(0)}d left)</span>` : ''}
          </div>
          <div style="font-size:10px;color:var(--mute)">${t('demographics.sanitation_desc', 'Chemical disinfection of streets and sewers. Halves contagion rate for 30 days.')}</div>
        </div>
        <button class="btn btn-sm" id="btnSanitationBlitz" style="white-space:nowrap;margin-left:8px" ${S.sanitationBlitzActive ? 'disabled' : ''}>
          ${S.sanitationBlitzActive ? t('demographics.active', 'Active') : '$3,000'}
        </button>
      </div>

      <!-- Emergency Vaccination Drive -->
      <div style="background:rgba(0,0,0,0.2);padding:8px 10px;border-radius:6px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:11.5px;font-weight:700;color:#fff">
            💉 ${t('demographics.vaccination_title', 'Emergency Vaccination Drive')}
            ${S.vaccinationActive ? `<span style="color:#22c55e;font-size:10px"> (${(S.vaccinationTimer / 24).toFixed(0)}d left)</span>` : ''}
          </div>
          <div style="font-size:10px;color:var(--mute)">${t('demographics.vaccination_desc', 'Distributes herd immunity vaccines to clinics, curing 60% of active infections.')}</div>
        </div>
        <button class="btn btn-sm" id="btnVaccination" style="white-space:nowrap;margin-left:8px" ${S.vaccinationActive ? 'disabled' : ''}>
          ${S.vaccinationActive ? t('demographics.active', 'Active') : '$4,500'}
        </button>
      </div>

      <!-- Health Quarantine -->
      <div style="background:rgba(0,0,0,0.2);padding:8px 10px;border-radius:6px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:11.5px;font-weight:700;color:#fff">
            🔒 ${t('demographics.quarantine_title', 'Health Quarantine Protocol')}
          </div>
          <div style="font-size:10px;color:var(--mute)">${t('demographics.quarantine_desc', 'Restricts non-essential travel to slow contagion by 75%.')}</div>
        </div>
        <button class="btn btn-sm" id="btnQuarantine" style="white-space:nowrap;margin-left:8px;background:${S.quarantineActive ? '#ef4444' : 'var(--panel)'}">
          ${S.quarantineActive ? t('demographics.lift', 'Lift') : '$1,500'}
        </button>
      </div>
    </div>
  </div>`;

  // 6. Tourism & Hospitality Economy
  html += `
  <div style="background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:8px;padding:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:11.5px;font-weight:700;color:var(--mute);text-transform:uppercase">
        🏨 ${t('demographics.tourism_title', 'Tourism & Hospitality Economy')}
      </span>
      <span style="font-size:11px;color:#22c55e;font-weight:700">
        +${U.money(S.touristSpendMonthly)} / mo
      </span>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="background:rgba(0,0,0,0.2);padding:8px;border-radius:6px;text-align:center">
        <div style="font-size:10.5px;color:var(--mute);text-transform:uppercase">${t('demographics.tourist_arrivals', 'Monthly Visitors')}</div>
        <div style="font-size:14px;font-weight:700;color:#38bdf8;margin-top:2px">${U.num(S.touristCount)}</div>
      </div>
      <div style="background:rgba(0,0,0,0.2);padding:8px;border-radius:6px;text-align:center">
        <div style="font-size:10.5px;color:var(--mute);text-transform:uppercase">${t('demographics.hotel_occupancy', 'Hotel Occupancy')}</div>
        <div style="font-size:14px;font-weight:700;color:#22c55e;margin-top:2px">${S.hotelOccupancy}%</div>
      </div>
    </div>
  </div>`;

  html += `</div>`;
  p.innerHTML = html;
  bindClose(p, () => UI.openPanel(null));

  // --- Bind Actions ---
  const btnViewGent = q<HTMLElement>('#btnViewGentrification', p);
  if (btnViewGent) {
    btnViewGent.onclick = () => {
      UI.openPanel('views');
      UI.setOverlay('gentrification');
    };
  }

  const btnSanitation = q<HTMLElement>('#btnSanitationBlitz', p);
  if (btnSanitation) {
    btnSanitation.onclick = () => {
      if (DemographicsSystem.citywideSanitationBlitz()) {
        renderDemographicsPanel(p);
      }
    };
  }

  const btnVaccine = q<HTMLElement>('#btnVaccination', p);
  if (btnVaccine) {
    btnVaccine.onclick = () => {
      if (DemographicsSystem.emergencyVaccinationDrive()) {
        renderDemographicsPanel(p);
      }
    };
  }

  const btnQuarantine = q<HTMLElement>('#btnQuarantine', p);
  if (btnQuarantine) {
    btnQuarantine.onclick = () => {
      if (DemographicsSystem.toggleQuarantine()) {
        renderDemographicsPanel(p);
      }
    };
  }
}
