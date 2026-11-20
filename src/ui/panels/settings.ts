/**
 * Vira City — Fullscreen Settings and System Preferences Window
 */

import { C } from '@/core/constants';
import { Gfx } from '@/render/gfx';
import { Game } from '@/game';
import { renderSaveHubModal } from '@/ui/panels/saveHub';
import { q, $$ } from '@/ui/dom';
import { UI } from '@/ui/ui';

let activeCategory: 'all' | 'graphics' | 'sim' | 'storage' | 'controls' = 'all';

export function openSettingsModal(cat: 'all' | 'graphics' | 'sim' | 'storage' | 'controls' = 'all'): void {
  activeCategory = cat;
  let modal = q<HTMLElement>('#settingsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'settingsModal';
    modal.className = 'fullscreen-settings';
    document.body.appendChild(modal);
  }
  modal.hidden = false;
  renderSettingsModalContent(modal);
}

export function closeSettingsModal(): void {
  const modal = q<HTMLElement>('#settingsModal');
  if (modal) {
    modal.hidden = true;
  }
}

export function renderSettingsPanel(p?: HTMLElement): void {
  openSettingsModal();
}

function renderSettingsModalContent(modal: HTMLElement): void {
  const s = Gfx.settings;

  const optRow = (
    id: string,
    title: string,
    subtitle: string,
    opts: [string | number, string][],
    val: string | number | boolean
  ) => `
    <div class="fset-row">
      <div class="fset-label">
        <b>${title}</b>
        <span>${subtitle}</span>
      </div>
      <select id="${id}" class="fset-select">
        ${opts
          .map(o => `<option value="${o[0]}" ${String(o[0]) === String(val) ? 'selected' : ''}>${o[1]}</option>`)
          .join('')}
      </select>
    </div>
  `;

  const tabs: { id: typeof activeCategory; label: string; icon: string }[] = [
    { id: 'all', label: 'Overview', icon: '🌐' },
    { id: 'graphics', label: 'Graphics', icon: '🎨' },
    { id: 'sim', label: 'Simulation', icon: '🚦' },
    { id: 'storage', label: 'Storage', icon: '💾' },
    { id: 'controls', label: 'Controls', icon: '⌨️' },
  ];

  modal.innerHTML = `
    <header class="fset-header">
      <div class="fset-brand">
        <div class="fset-title">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
          </svg>
          <span>Vira City</span> Settings
        </div>
        <div class="fset-sub">Graphics, Simulation & Controls</div>
      </div>

      <nav class="fset-tabs">
        ${tabs
          .map(
            t => `
          <button class="fset-tab ${activeCategory === t.id ? 'on' : ''}" data-cat="${t.id}" title="${t.label}">
            <span class="fset-tab-icon">${t.icon}</span>
            <span class="fset-tab-text">${t.label}</span>
          </button>
        `
          )
          .join('')}
      </nav>

      <button class="fset-close-btn" id="fsetCloseBtn" title="Close settings and return to city (Escape)">
        <span class="fset-close-txt">← Return to City</span>
        <kbd class="fset-esc-badge" style="font-size:10px;padding:2px 5px;background:rgba(255,255,255,0.1);border-radius:4px;">ESC</kbd>
      </button>
    </header>

    <main class="fset-body">
      <div class="fset-grid">
        <!-- 1. Display & Rendering Card -->
        ${
          activeCategory === 'all' || activeCategory === 'graphics'
            ? `
          <section class="fset-card">
            <div class="fset-card-head">
              <div class="fset-card-title">🎨 Display & Rendering</div>
              <span class="fset-card-badge">Instant Apply</span>
            </div>
            ${optRow(
              'st_preset',
              'Quality Preset',
              'Global graphics configuration preset',
              [
                ['low', 'Low (Intel HD / Old Laptops)'],
                ['medium', 'Medium (Balanced)'],
                ['high', 'High (Dedicated GPUs)'],
                ['ultra', 'Ultra (High-end Desktop)'],
                ['custom', 'Custom Profile'],
              ],
              s.preset
            )}
            ${optRow(
              'st_res',
              'Render Resolution Scaling',
              'Scale viewport rendering buffer size',
              [
                [0.5, '50% (Performance Boost)'],
                [0.7, '70%'],
                [1, '100% (Native 1:1)'],
                [1.25, '125%'],
                [1.5, '150% (High DPI)'],
                [2, '200% (Retina / 4K Crisp)'],
              ],
              s.res
            )}
            ${optRow(
              'st_aa',
              'Anti-Aliasing (FXAA)',
              'Smooth edge jaggedness on geometries',
              [
                [0, 'Off (Sharp pixel edges)'],
                [1, 'On (Smooth FXAA)'],
              ],
              s.aa ? 1 : 0
            )}
            ${optRow(
              'st_fps',
              'Show FPS Counter',
              'Real-time frame rate indicator in corner',
              [
                [0, 'Off'],
                [1, 'On'],
              ],
              s.fps ? 1 : 0
            )}
          </section>

          <section class="fset-card">
            <div class="fset-card-head">
              <div class="fset-card-title">☀️ Lighting & Environment</div>
              <span class="fset-card-badge">Shaders</span>
            </div>
            ${optRow(
              'st_shadows',
              'Shadow Map Resolution',
              'Directional sunlight shadow fidelity',
              [
                [0, 'Disabled (Fastest)'],
                [1024, 'Low (1024²)'],
                [2048, 'Medium (2048²)'],
                [4096, 'High (4096² Crisp)'],
              ],
              s.shadows
            )}
            ${optRow(
              'st_view',
              'Render View Distance',
              'Horizon draw distance across the 208×208 map',
              [
                [1100, 'Near (1,100 m)'],
                [1700, 'Medium (1,700 m)'],
                [2400, 'Far (2,400 m)'],
                [3200, 'Very Far (3,200 m)'],
              ],
              s.view
            )}
            ${optRow(
              'st_lighting',
              'Lighting Model',
              'PBR material response vs simple Lambertian',
              [
                ['simple', 'Simple (High FPS)'],
                ['pbr', 'Realistic PBR'],
              ],
              s.lighting
            )}
            ${optRow(
              'st_water',
              'Water Shaders',
              'Water body surface animation',
              [
                ['simple', 'Still Water'],
                ['waves', 'Animated Waves (GLSL)'],
              ],
              s.water
            )}
            ${optRow(
              'st_dayNight',
              'Day & Night Cycle',
              'Dynamic circadian lighting and vehicle headlights',
              [
                [1, 'Dynamic (24h Clock Cycle)'],
                [0, 'Always Daytime (Fixed Sun)'],
              ],
              s.dayNight ? 1 : 0
            )}
          </section>
        `
            : ''
        }

        <!-- 2. Simulation & Traffic Card -->
        ${
          activeCategory === 'all' || activeCategory === 'sim'
            ? `
          <section class="fset-card">
            <div class="fset-card-head">
              <div class="fset-card-title">🚦 Simulation & Agent Load</div>
              <span class="fset-card-badge">Zero-GC</span>
            </div>
            ${optRow(
              'st_cars',
              'Max Active Vehicles',
              'Caps the number of 3D cars and buses simulated',
              [
                [150, '150 Vehicles (Light)'],
                [250, '250 Vehicles (Standard)'],
                [500, '500 Vehicles (Dense)'],
                [900, '900 Vehicles (Heavy Traffic)'],
                [1400, '1,400 Vehicles (Metropolitan)'],
                [2000, '2,000 Vehicles (Extreme Swarm)'],
              ],
              s.cars
            )}
            ${optRow(
              'st_detail',
              'Vehicle & Pedestrian Detail',
              'Procedural car models, lights & marching protestors',
              [
                [0, 'Low Polygon'],
                [1, 'Detailed (Headlights & Wheels)'],
              ],
              s.detail ? 1 : 0
            )}
            ${optRow(
              'st_trees',
              'Vegetation & Forest Density',
              'Procedural tree mesh instancing across terrain',
              [
                [0.2, 'Sparse (20%)'],
                [0.35, 'Low (35%)'],
                [0.7, 'Medium (70%)'],
                [1, 'High (100%)'],
                [1.4, 'Lush (140% Dense Forest)'],
              ],
              s.trees
            )}
          </section>
        `
            : ''
        }

        <!-- 3. Saves & Storage Card -->
        ${
          activeCategory === 'all' || activeCategory === 'storage'
            ? `
          <section class="fset-card">
            <div class="fset-card-head">
              <div class="fset-card-title">💾 Saves & Storage Management</div>
              <span class="fset-card-badge">Multi-Slot</span>
            </div>
            <div style="font-size:12.5px;color:var(--mute);line-height:1.4;">
              Vira City uses compressed RLE serialization for the 43,264 map cells. You can manage multiple slots, export .viracity files, or trigger quick saves anytime.
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;">
              <button class="btn primary" id="st_save" style="height:38px;padding:0 16px;font-size:13px;">
                💾 Quick Save Now
              </button>
              <button class="btn" id="st_hub" style="height:38px;padding:0 16px;background:#2563eb;color:#fff;border-color:#3b82f6;font-size:13px;">
                📂 Open Save & Load Hub
              </button>
              <button class="btn danger" id="st_new" style="height:38px;padding:0 16px;font-size:13px;">
                ⚠️ Start New City
              </button>
            </div>
            <div id="st_confirm"></div>
          </section>
        `
            : ''
        }

        <!-- 4. Keyboard & Mouse Controls Card -->
        ${
          activeCategory === 'all' || activeCategory === 'controls'
            ? `
          <section class="fset-card" style="grid-column: 1 / -1;">
            <div class="fset-card-head">
              <div class="fset-card-title">⌨️ Keyboard & Mouse Controls</div>
              <span class="fset-card-badge">Shortcuts Reference</span>
            </div>
            <div class="keys" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:12px 18px;font-size:12.5px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <kbd>W A S D</kbd> <span>Pan camera (<kbd>Shift</kbd> for turbo speed)</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <kbd>Right-Drag</kbd> <span>Orbit camera & pitch tilt</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <kbd>Middle-Drag</kbd> <span>Pan map across view</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <kbd>Wheel / R F</kbd> <span>Zoom in and out smoothly</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <kbd>Q / E</kbd> <span>Rotate view 45°</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <kbd>T / G</kbd> <span>Pitch camera angle</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <kbd>Space</kbd> <span>Pause / resume simulation</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <kbd>1 2 3</kbd> <span>Sim speed: 1x, 2x, 4x</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <kbd>B</kbd> <span>Toggle Bulldozer demolition</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <kbd>C</kbd> <span>Cycle Road Mode (Straight, Curve, S-Bend, Grid)</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <kbd>R</kbd> <span>Rotate building 90° before placing</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <kbd>Esc</kbd> <span>Deselect, cancel tool or close modal</span>
              </div>
            </div>
          </section>
        `
            : ''
        }
      </div>
    </main>
  `;

  // Bind close buttons
  const closeBtn = q<HTMLElement>('#fsetCloseBtn', modal);
  if (closeBtn) {
    closeBtn.onclick = () => {
      closeSettingsModal();
      UI.openPanel(null);
    };
  }

  // Bind Category Tabs
  $$<HTMLElement>('.fset-tab', modal).forEach(btn => {
    btn.onclick = () => {
      const cat = btn.dataset.cat as typeof activeCategory;
      if (cat) {
        activeCategory = cat;
        renderSettingsModalContent(modal);
      }
    };
  });

  // Bind Dropdown Selects
  $$<HTMLSelectElement>('select.fset-select', modal).forEach(sel => {
    sel.onchange = () => {
      const k = sel.id.slice(3);
      const ns = Object.assign({}, Gfx.settings);
      if (k === 'preset') {
        if (sel.value !== 'custom') {
          Object.assign(ns, (C.QUALITY as any)[sel.value], { preset: sel.value });
        } else {
          ns.preset = 'custom';
        }
      } else {
        let v: string | number | boolean = sel.value;
        if (['res', 'shadows', 'view', 'cars', 'trees'].includes(k)) v = +v;
        if (['aa', 'dayNight', 'fps', 'detail'].includes(k)) v = v === '1';
        (ns as any)[k] = v;
        ns.preset = 'custom';
      }
      Game.applySettings(ns);
      renderSettingsModalContent(modal);
    };
  });

  // Bind Storage Buttons
  const btnSave = q<HTMLElement>('#st_save', modal);
  if (btnSave) {
    btnSave.onclick = () => {
      if (Game.save()) {
        UI.toast('City saved successfully.', 'good');
      }
    };
  }

  const btnHub = q<HTMLElement>('#st_hub', modal);
  if (btnHub) {
    btnHub.onclick = () => {
      renderSaveHubModal(city => {
        if (Game.loadCity) Game.loadCity(city);
      });
    };
  }

  const btnNew = q<HTMLElement>('#st_new', modal);
  if (btnNew) {
    btnNew.onclick = () => {
      const c = q<HTMLElement>('#st_confirm', modal);
      if (!c) return;
      c.innerHTML = `
        <div class="chip bad" style="margin-top:10px;padding:8px 12px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:6px;color:#fca5a5;">
          ⚠️ Starting a new city will return to the setup screen. Ensure your current game is saved.
        </div>
        <div class="btns" style="margin-top:8px;display:flex;gap:8px;">
          <button class="btn danger" id="st_yes" style="height:34px;padding:0 14px;">Yes, Start New City</button>
          <button class="btn" id="st_no" style="height:34px;padding:0 14px;">Keep Playing</button>
        </div>
      `;
      const yesBtn = q<HTMLElement>('#st_yes', c);
      if (yesBtn) {
        yesBtn.onclick = () => {
          closeSettingsModal();
          UI.openPanel(null);
          Game.showStart(true);
        };
      }
      const noBtn = q<HTMLElement>('#st_no', c);
      if (noBtn) {
        noBtn.onclick = () => {
          c.innerHTML = '';
        };
      }
    };
  }
}
