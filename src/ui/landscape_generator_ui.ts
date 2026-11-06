import {
  LandscapeConfig,
  LandscapePresetName,
  LANDSCAPE_PRESETS,
  DEFAULT_LANDSCAPE_CONFIG,
} from '@core/terrain/landscape_config';

export class LandscapeGeneratorUI {
  private container: HTMLElement;
  private onGenerateCallback: (config: LandscapeConfig) => void;
  private currentConfig: LandscapeConfig;
  private isVisible: boolean = false;

  constructor(parent: HTMLElement, onGenerate: (config: LandscapeConfig) => void) {
    this.onGenerateCallback = onGenerate;
    this.currentConfig = { ...DEFAULT_LANDSCAPE_CONFIG };

    this.container = document.createElement('div');
    this.container.id = 'landscape-panel';
    this.setupUI();
    parent.appendChild(this.container);
  }

  private setupUI(): void {
    this.container.style.position = 'absolute';
    this.container.style.top = '75px';
    this.container.style.right = '24px';
    this.container.style.background = 'rgba(16, 22, 32, 0.96)';
    this.container.style.border = '1px solid rgba(0, 229, 255, 0.4)';
    this.container.style.borderRadius = '16px';
    this.container.style.padding = '20px 24px';
    this.container.style.color = '#fff';
    this.container.style.boxShadow = '0 20px 50px rgba(0, 0, 0, 0.7)';
    this.container.style.backdropFilter = 'blur(20px)';
    this.container.style.display = 'none';
    this.container.style.flexDirection = 'column';
    this.container.style.gap = '14px';
    this.container.style.width = '360px';
    this.container.style.zIndex = '98';
    this.container.style.fontFamily = 'system-ui, -apple-system, sans-serif';

    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">🏔️</span>
          <span style="font-size: 15px; font-weight: 800; color: #fff; letter-spacing: 0.5px;">GENERADOR DE PAISAJE</span>
        </div>
        <button id="btn-close-landscape" style="
          background: none; border: none; color: #90a4ae; font-size: 18px; cursor: pointer; padding: 2px 6px; border-radius: 6px;
        ">✕</button>
      </div>

      <!-- Presets de Entorno Natural -->
      <div>
        <label style="font-size: 11px; text-transform: uppercase; color: #00e5ff; font-weight: 700; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
          Bioma / Perfil del Paisaje:
        </label>
        <select id="select-preset" style="
          width: 100%; background: #222b38; color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 8px 12px; font-size: 13px; font-weight: 600; cursor: pointer;
        ">
          <option value="COASTAL_VALLEY">🌄 Valle Costero Alpino (Fable Cities)</option>
          <option value="MOUNTAIN_HIGHLANDS">🏔️ Tierras Altas y Cañones Alpinos</option>
          <option value="ROLLING_PLAINS">🌾 Llanuras y Praderas Suaves (Urbano)</option>
          <option value="RUGGED_COAST">🌊 Costa de Acantilados y Fiordos</option>
        </select>
      </div>

      <!-- Controles de Orografía y Relieve -->
      <div style="display: flex; flex-direction: column; gap: 10px; background: rgba(0,0,0,0.25); padding: 12px 14px; border-radius: 10px;">
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
            <span>🏔️ Cordillera / Montaña</span>
            <span id="lbl-mountain" style="color: #64b5f6; font-weight: 700;">${Math.round(this.currentConfig.mountainIntensity * 100)}%</span>
          </div>
          <input id="slider-mountain" type="range" min="0" max="100" value="${this.currentConfig.mountainIntensity * 100}" style="width: 100%; cursor: pointer;">
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
            <span>🌊 Cobertura de Costa / Mar</span>
            <span id="lbl-coast" style="color: #4dd0e1; font-weight: 700;">${Math.round(this.currentConfig.coastExtent * 100)}%</span>
          </div>
          <input id="slider-coast" type="range" min="10" max="90" value="${this.currentConfig.coastExtent * 100}" style="width: 100%; cursor: pointer;">
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
            <span>🧗 Acantilados vs Playas</span>
            <span id="lbl-cliff" style="color: #ffb74d; font-weight: 700;">${Math.round(this.currentConfig.cliffIntensity * 100)}%</span>
          </div>
          <input id="slider-cliff" type="range" min="0" max="100" value="${this.currentConfig.cliffIntensity * 100}" style="width: 100%; cursor: pointer;">
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
            <span>🚣 Anchura del Río</span>
            <span id="lbl-river" style="color: #81c784; font-weight: 700;">${this.currentConfig.riverWidth}m</span>
          </div>
          <input id="slider-river" type="range" min="40" max="220" step="5" value="${this.currentConfig.riverWidth}" style="width: 100%; cursor: pointer;">
        </div>
      </div>

      <!-- Semilla determinista -->
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <label style="font-size: 12px; color: #b0bec5; font-weight: 600;">Semilla (Seed):</label>
        <div style="display: flex; gap: 6px;">
          <input id="input-seed" type="number" value="${this.currentConfig.seed}" style="
            width: 110px; background: #222b38; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; padding: 6px 10px; color: #fff; font-size: 13px; text-align: center;
          ">
          <button id="btn-rand-seed" style="
            background: #37474f; border: none; color: #fff; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 14px;
          " title="Semilla aleatoria">🎲</button>
        </div>
      </div>

      <!-- Botón de Acción -->
      <button id="btn-apply-landscape" style="
        background: linear-gradient(135deg, #00b4d8, #0077b6);
        color: #fff;
        border: none;
        padding: 12px;
        border-radius: 10px;
        font-weight: 800;
        font-size: 14px;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(0, 180, 216, 0.4);
        transition: transform 0.15s ease, filter 0.15s ease;
      ">
        ✨ Generar Paisaje Natural
      </button>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    const closeBtn = this.container.querySelector('#btn-close-landscape');
    closeBtn?.addEventListener('click', () => this.setVisible(false));

    const presetSelect = this.container.querySelector<HTMLSelectElement>('#select-preset');
    presetSelect?.addEventListener('change', (e) => {
      const presetName = (e.target as HTMLSelectElement).value as LandscapePresetName;
      const preset = LANDSCAPE_PRESETS[presetName];
      if (preset) {
        this.currentConfig = { ...preset, seed: this.currentConfig.seed };
        this.render();
      }
    });

    const mountainSlider = this.container.querySelector<HTMLInputElement>('#slider-mountain');
    mountainSlider?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.currentConfig.mountainIntensity = val / 100.0;
      const lbl = this.container.querySelector('#lbl-mountain');
      if (lbl) lbl.textContent = `${Math.round(val)}%`;
    });

    const coastSlider = this.container.querySelector<HTMLInputElement>('#slider-coast');
    coastSlider?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.currentConfig.coastExtent = val / 100.0;
      const lbl = this.container.querySelector('#lbl-coast');
      if (lbl) lbl.textContent = `${Math.round(val)}%`;
    });

    const cliffSlider = this.container.querySelector<HTMLInputElement>('#slider-cliff');
    cliffSlider?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.currentConfig.cliffIntensity = val / 100.0;
      const lbl = this.container.querySelector('#lbl-cliff');
      if (lbl) lbl.textContent = `${Math.round(val)}%`;
    });

    const riverSlider = this.container.querySelector<HTMLInputElement>('#slider-river');
    riverSlider?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.currentConfig.riverWidth = val;
      const lbl = this.container.querySelector('#lbl-river');
      if (lbl) lbl.textContent = `${val}m`;
    });

    const seedInput = this.container.querySelector<HTMLInputElement>('#input-seed');
    seedInput?.addEventListener('change', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      if (!isNaN(val)) this.currentConfig.seed = val;
    });

    const randSeedBtn = this.container.querySelector('#btn-rand-seed');
    randSeedBtn?.addEventListener('click', () => {
      const newSeed = Math.floor(Math.random() * 90000) + 1000;
      this.currentConfig.seed = newSeed;
      if (seedInput) seedInput.value = newSeed.toString();
    });

    const applyBtn = this.container.querySelector('#btn-apply-landscape');
    applyBtn?.addEventListener('click', () => {
      this.onGenerateCallback({ ...this.currentConfig });
      this.setVisible(false);
    });
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.container.style.display = visible ? 'flex' : 'none';
  }

  public toggle(): void {
    this.setVisible(!this.isVisible);
  }

  public getConfig(): LandscapeConfig {
    return { ...this.currentConfig };
  }
}
