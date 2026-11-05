import { TerraformTool, BrushSettings } from '@core/terrain/terrain_modifier';

export class TerraformUI {
  private container: HTMLElement;
  public settings: BrushSettings = {
    tool: TerraformTool.NONE,
    radius: 6.0,
    strength: 3.5,
    targetHeight: 3.0,
  };

  private onSettingsChangeCallback?: (settings: BrushSettings) => void;

  constructor(parent: HTMLElement, onSettingsChange?: (settings: BrushSettings) => void) {
    this.onSettingsChangeCallback = onSettingsChange;
    this.container = document.createElement('div');
    this.container.id = 'terraform-panel';
    this.setupUI();
    parent.appendChild(this.container);
  }

  private setupUI(): void {
    this.container.innerHTML = `
      <div class="panel-header">🛠️ Herramientas de Terraformación</div>
      <div class="tool-buttons">
        <button class="tool-btn active" data-tool="NONE">👁️ Inspeccionar</button>
        <button class="tool-btn" data-tool="RAISE">⛰️ Elevar</button>
        <button class="tool-btn" data-tool="LOWER">🕳️ Hundir</button>
        <button class="tool-btn" data-tool="FLATTEN">📏 Aplanar</button>
        <button class="tool-btn" data-tool="SMOOTH">🌊 Suavizar</button>
      </div>
      <div class="brush-controls" id="brush-controls" style="display: none;">
        <div class="control-row">
          <label>Radio: <span id="radius-val">6</span>m</label>
          <input type="range" id="brush-radius" min="2" max="18" step="1" value="6" />
        </div>
        <div class="control-row">
          <label>Fuerza: <span id="strength-val">3.5</span></label>
          <input type="range" id="brush-strength" min="1" max="10" step="0.5" value="3.5" />
        </div>
        <div class="control-row" id="height-control-row" style="display: none;">
          <label>Altura Objetivo: <span id="target-height-val">3</span>m</label>
          <input type="range" id="brush-target-height" min="0" max="15" step="0.5" value="3" />
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const buttons = this.container.querySelectorAll<HTMLButtonElement>('.tool-btn');
    const controls = this.container.querySelector<HTMLElement>('#brush-controls')!;
    const heightRow = this.container.querySelector<HTMLElement>('#height-control-row')!;

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const tool = (btn.getAttribute('data-tool') ?? 'NONE') as TerraformTool;
        this.settings.tool = tool;

        if (tool === TerraformTool.NONE) {
          controls.style.display = 'none';
        } else {
          controls.style.display = 'block';
          heightRow.style.display = tool === TerraformTool.FLATTEN ? 'flex' : 'none';
        }

        this.notifyChange();
      });
    });

    const radiusInput = this.container.querySelector<HTMLInputElement>('#brush-radius')!;
    const radiusVal = this.container.querySelector<HTMLElement>('#radius-val')!;
    radiusInput.addEventListener('input', () => {
      this.settings.radius = parseFloat(radiusInput.value);
      radiusVal.innerText = radiusInput.value;
      this.notifyChange();
    });

    const strengthInput = this.container.querySelector<HTMLInputElement>('#brush-strength')!;
    const strengthVal = this.container.querySelector<HTMLElement>('#strength-val')!;
    strengthInput.addEventListener('input', () => {
      this.settings.strength = parseFloat(strengthInput.value);
      strengthVal.innerText = strengthInput.value;
      this.notifyChange();
    });

    const heightInput = this.container.querySelector<HTMLInputElement>('#brush-target-height')!;
    const heightVal = this.container.querySelector<HTMLElement>('#target-height-val')!;
    heightInput.addEventListener('input', () => {
      this.settings.targetHeight = parseFloat(heightInput.value);
      heightVal.innerText = heightInput.value;
      this.notifyChange();
    });
  }

  private notifyChange(): void {
    if (this.onSettingsChangeCallback) {
      this.onSettingsChangeCallback(this.settings);
    }
  }

  public setTool(tool: TerraformTool): void {
    const btn = this.container.querySelector<HTMLButtonElement>(`[data-tool="${tool}"]`);
    if (btn) btn.click();
  }
}
