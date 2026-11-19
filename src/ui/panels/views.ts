/**
 * Vira City — UI Info Views Panel (`src/ui/panels/views.ts`)
 *
 * Provides GPU-powered heatmap infoviews, active overlay toggles,
 * and comprehensive contextual color guides with explanation modals for every statistic.
 */

import { head, bindClose, $$, q } from '@/ui/dom';
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
  ['resources', 'Natural Resources', 'linear-gradient(90deg,#eab308,#16a34a,#64748b,#1e1b4b)'],
];

export interface ViewGuideColor {
  color: string;
  name: string;
  desc: string;
}

export interface ViewGuide {
  title: string;
  desc: string;
  colors: ViewGuideColor[];
  tips: string[];
}

export const VIEW_GUIDES: Record<string, ViewGuide> = {
  resources: {
    title: 'Natural Resources',
    desc: 'Displays the geographic distribution of raw mineral, biological, and fossil deposits beneath the soil.',
    colors: [
      {
        color: '#eab308',
        name: 'Fertile Land (Golden Yellow)',
        desc: 'Located in riverbeds, lake basins, and lowland meadows. Exploit with Farming & Ag district specialization for food security without industrial pollution.',
      },
      {
        color: '#16a34a',
        name: 'Forestry (Emerald Green)',
        desc: 'Located in dense conifer woodlands and hills. Exploit with Forestry specialization to produce lumber and paper with 50% reduced pollution.',
      },
      {
        color: '#64748b',
        name: 'Ore & Minerals (Slate Blue)',
        desc: 'Located along high rocky mountain ridges. Exploit with Ore Mining specialization to extract metal for steelworks and high municipal export profits.',
      },
      {
        color: '#1e1b4b',
        name: 'Crude Oil (Dark Violet / Black)',
        desc: 'Subterranean oil basins located in coastal and low-altitude zones. Exploit with Oil Industry for massive tax revenue and plastics, but creates severe pollution.',
      },
      {
        color: 'rgba(255,255,255,0.15)',
        name: 'Uncolored / Barren Terrain',
        desc: 'Standard ground without specialized raw deposits. Best suited for generic manufacturing, logistics depots, commercial zones, or housing.',
      },
    ],
    tips: [
      'Industrial buildings placed directly over matching resources gain a +60% to +80% extraction output bonus.',
      'Specialized industries supply local commercial stores with goods or export surplus via highways for municipal profit.',
    ],
  },
  traffic: {
    title: 'Traffic Congestion',
    desc: 'Real-time vehicle density and flow across all segments of the municipal road network.',
    colors: [
      {
        color: '#3fd65a',
        name: 'Green (Flowing Free)',
        desc: 'Road capacity utilization under 35%. Vehicles drive at maximum road speed limit without impedance.',
      },
      {
        color: '#e6c833',
        name: 'Yellow / Orange (Moderate Load)',
        desc: 'Traffic volume approaching 35% - 75% capacity. Minor queuing at junctions.',
      },
      {
        color: '#e6332a',
        name: 'Red (Severe Bottleneck)',
        desc: 'Traffic exceeds 75% capacity. Jammed roads severely delay freight delivery trucks, bus lines, and emergency vehicles; can cause store stockouts and abandoned buildings.',
      },
    ],
    tips: [
      'Upgrade congested intersections with roundabouts or dedicated turning lanes in the Junction panel.',
      'Provide public transit lines (bus, tram, rail) or bike paths to relieve road commuter pressure.',
    ],
  },
  lv: {
    title: 'Land Value',
    desc: 'The economic desirability and per-tile property value across your city.',
    colors: [
      {
        color: '#e6332a',
        name: 'Red (Low Land Value)',
        desc: 'Depressed zones adjacent to heavy industrial pollution, noisy highways, or lacking civic services.',
      },
      {
        color: '#3fd65a',
        name: 'Green (High Land Value)',
        desc: 'Desirable, high-value neighborhoods boosted by waterfronts, parks, health clinics, and elite schools.',
      },
    ],
    tips: [
      'High land value is required for residential and commercial buildings to upgrade to Levels 4 and 5.',
      'High land value directly increases municipal property tax revenues.',
    ],
  },
  happy: {
    title: 'Citizen Happiness',
    desc: 'Overall satisfaction and living conditions of residents and business tenants.',
    colors: [
      {
        color: '#e6332a',
        name: 'Red (Miserable / Distressed)',
        desc: 'Satisfaction below 35%. High risk of tenants moving out, business abandonment, and civic protests.',
      },
      {
        color: '#3fd65a',
        name: 'Green (Thriving / Happy)',
        desc: 'Satisfaction above 70%. Encourages rapid immigration and spontaneous private investments.',
      },
    ],
    tips: [
      'High taxes above 10% erode happiness by 2.2 points per extra percent.',
      'Parks, clean drinking water, low commute times, and police safety are the biggest happiness drivers.',
    ],
  },
  pollution: {
    title: 'Ground & Environmental Pollution',
    desc: 'Toxic soil contamination produced by fossil power plants, waste facilities, and heavy industry.',
    colors: [
      {
        color: '#8a5a2a',
        name: 'Brown (Toxic Soil Contamination)',
        desc: 'Heavily contaminated ground. Severely degrades citizen health, causing illnesses and abandonment.',
      },
      {
        color: '#4ade80',
        name: 'Light Green (Clean Ground)',
        desc: 'Healthy, uncontaminated natural terrain.',
      },
    ],
    tips: [
      'Never zone residential housing or place drinking water pumps over brown contaminated terrain.',
      'Enact the Recycling Program policy and designate High-Tech or Eco-Residential districts to keep pollution low.',
    ],
  },
  noise: {
    title: 'Noise Pollution',
    desc: 'Acoustic disturbances generated by transportation infrastructure and nightlife venues.',
    colors: [
      {
        color: '#c85ad8',
        name: 'Magenta / Purple (Acoustic Noise)',
        desc: 'High decibel levels emitted by highways, rail lines, commercial leisure hubs, and freight factories.',
      },
      {
        color: 'rgba(255,255,255,0.1)',
        name: 'Quiet Zones',
        desc: 'Peaceful residential and park neighborhoods.',
      },
    ],
    tips: [
      'Enact Heavy Traffic Bans in residential neighborhoods to divert noisy delivery trucks onto arterial avenues.',
      'Buffer loud highways with tree-lined avenues or commercial transition corridors.',
    ],
  },
  police: {
    title: 'Police Protection',
    desc: 'Patrol catchment and criminal deterrence reach provided by municipal police stations.',
    colors: [
      {
        color: '#2c5aa0',
        name: 'Blue (Active Patrol Zone)',
        desc: 'Streets within effective patrol range (~28 tiles via road network). Crime rate is kept near zero.',
      },
      {
        color: 'rgba(255,255,255,0.1)',
        name: 'Unprotected Territory',
        desc: 'Vulnerable to crime waves, burglaries, and store abandonment.',
      },
    ],
    tips: [
      'Coverage propagates along connected road networks, not as a simple circle. Ensure road connectivity.',
    ],
  },
  fire: {
    title: 'Fire Safety',
    desc: 'Fire engine response radius from fire stations to protect against structural blazes.',
    colors: [
      {
        color: '#b8322a',
        name: 'Red (Fire Response Range)',
        desc: 'Streets reachable by fire engines (~26 tiles). Extinguishes fires before buildings burn to ashes.',
      },
      {
        color: 'rgba(255,255,255,0.1)',
        name: 'High Fire Hazard',
        desc: 'Buildings that catch fire outside this coverage risk complete destruction.',
      },
    ],
    tips: [
      'Enact the Smoke Detectors policy in districts to cut fire risk by 80%.',
    ],
  },
  health: {
    title: 'Healthcare & Medical Access',
    desc: 'Ambulance dispatch and clinic reach to treat injured and sick citizens.',
    colors: [
      {
        color: '#c8323e',
        name: 'Crimson (Medical Reach)',
        desc: 'Catchment zone of clinics and hospitals (~30 tiles). Raises citizen life expectancy and overall health.',
      },
    ],
    tips: [
      'Good healthcare prevents disease outbreaks and boosts citizen happiness by up to 14 points.',
    ],
  },
  edu: {
    title: 'Education & Schools',
    desc: 'Educational access provided by elementary schools, high schools, and university campuses.',
    colors: [
      {
        color: '#a0632f',
        name: 'Amber / Orange (School Access)',
        desc: 'Neighborhoods served by schools (~32 tiles). Educates workforce and enables buildings to level up.',
      },
    ],
    tips: [
      'High-level commercial and high-tech offices require an educated workforce to operate and avoid abandonment.',
    ],
  },
  garbage: {
    title: 'Waste Management',
    desc: 'Garbage collection truck routes dispatched from waste transfer stations.',
    colors: [
      {
        color: '#4d7a4a',
        name: 'Olive Green (Collection Service)',
        desc: 'Garbage trucks service these streets (~35 tiles) and empty building waste bins.',
      },
    ],
    tips: [
      'If garbage exceeds 100 units in a building, tenants suffer severe unhappiness and eventually abandon the lot.',
    ],
  },
  park: {
    title: 'Parks & Recreation',
    desc: 'Recreational and leisure influence from small parks, plazas, and city landmarks.',
    colors: [
      {
        color: '#3f8a3a',
        name: 'Green (Recreation Influence)',
        desc: 'Surrounding streets (~18 tiles) gain immediate land value spikes and citizen leisure boosts.',
      },
    ],
    tips: [
      'Place parks inside dense residential blocks to instantly satisfy neighborhood quality of life.',
    ],
  },
  transit: {
    title: 'Public Transit Accessibility',
    desc: 'Pedestrian walking catchment zone to bus stops, tram stations, and rail terminals.',
    colors: [
      {
        color: '#2f86e0',
        name: 'Sky Blue (Walkable Transit Range)',
        desc: 'Pedestrians will walk up to 16 tiles to reach a public transit stop.',
      },
    ],
    tips: [
      'High transit ridership reduces road traffic congestion, lowers road maintenance, and generates ticket fare revenue.',
    ],
  },
  district: {
    title: 'Districts & Specializations',
    desc: 'Administrative boundaries of designated municipal districts with custom policies.',
    colors: [
      {
        color: '#3b82f6',
        name: 'Color-Coded Boroughs',
        desc: 'Shows each painted district with its unique policies (Heavy Traffic Ban, Free Transit, Recycling, etc.) and industry specializations.',
      },
    ],
    tips: [
      'Use the District Brush in the toolbar to paint autonomous boroughs and tailor local tax incentives.',
    ],
  },
};

let activeGuideKey: string | null = null;
let isGuideCollapsed: boolean = false;

export function setOverlay(k: string | null): void {
  UI.overlay = k;
  Gfx.uni.uOvOn.value = k ? 1 : 0;
  Transit.showRibbons(k === 'transit' || ['line', 'stop', 'rail'].includes(Tools.tool.type));
  if (k) refreshOverlay();
}

export function refreshOverlay(): void {
  if (UI.overlay) Meshes.writeOverlay(Sim.overlayFn(UI.overlay));
}

export function renderViewsPanel(p: HTMLElement, targetGuide?: string): void {
  if (targetGuide !== undefined) {
    activeGuideKey = targetGuide;
    isGuideCollapsed = false;
  } else if (!activeGuideKey && UI.overlay && VIEW_GUIDES[UI.overlay]) {
    activeGuideKey = UI.overlay;
  }

  const activeGuide = activeGuideKey ? VIEW_GUIDES[activeGuideKey] : null;
  const activeViewItem = VIEWS.find(v => v[0] === activeGuideKey);

  p.innerHTML =
    head('Info Views', 'Color the city by live statistics') +
    `<div class="views">
      ${VIEWS.map(v => {
        const key = v[0] || '';
        const isSelected = (UI.overlay || '') === key;
        return `
          <button data-ov="${key}" class="${isSelected ? 'on' : ''}">
            <i style="background:${v[2]}"></i>${v[1]}
          </button>`;
      }).join('')}
    </div>

    ${
      activeGuide && activeGuideKey
        ? `
        <div class="view-accordion ${isGuideCollapsed ? 'collapsed' : ''}" id="viewAccordion">
          <div class="view-accordion-head" id="accordionHead">
            <div class="view-accordion-title">
              <i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${
                activeViewItem ? activeViewItem[2] : 'var(--accent)'
              }"></i>
              <span>${activeGuide.title} Guide & Legend</span>
            </div>
            <span class="view-accordion-toggle">${isGuideCollapsed ? '▶' : '▼'}</span>
          </div>
          <div class="view-accordion-body">
            <div class="sub" style="font-size:12px;line-height:1.45">${activeGuide.desc}</div>
            
            <div class="lbl" style="margin-top:4px">Color Breakdown</div>
            <div class="vguide-card" style="margin-top:0">
              ${activeGuide.colors
                .map(
                  c => `
                <div class="vguide-row">
                  <span class="vguide-swatch" style="background:${c.color};border:1px solid rgba(255,255,255,0.2)"></span>
                  <div>
                    <b>${c.name}</b>
                    <div class="sub" style="font-size:11px;margin-top:2px">${c.desc}</div>
                  </div>
                </div>`
                )
                .join('')}
            </div>

            <div class="lbl" style="margin-top:4px">City Planning Tips</div>
            <div style="display:flex;flex-direction:column;gap:5px">
              ${activeGuide.tips.map(t => `<div class="vguide-tip">${t}</div>`).join('')}
            </div>
          </div>
        </div>`
        : `
        <div class="sec">
          <div class="legend"><span>Poor</span><span class="grad"></span><span>Good</span></div>
          <div class="sub" style="font-size:12px;line-height:1.4">
            Click any view above to activate its live heatmap overlay and expand its color breakdown and management tips.
          </div>
        </div>`
    }`;

  bindClose(p, () => UI.openPanel(null));

  // Overlay button selection: activates view and expands its guide
  $$<HTMLElement>('[data-ov]', p).forEach(b => {
    b.onclick = () => {
      const k = b.dataset.ov || null;
      setOverlay(k);
      if (k && VIEW_GUIDES[k]) {
        activeGuideKey = k;
        isGuideCollapsed = false;
      } else {
        activeGuideKey = null;
      }
      renderViewsPanel(p);
    };
  });

  // Accordion toggle click on header
  const accHead = q<HTMLElement>('#accordionHead', p);
  if (accHead) {
    accHead.onclick = () => {
      isGuideCollapsed = !isGuideCollapsed;
      renderViewsPanel(p);
    };
  }
}
