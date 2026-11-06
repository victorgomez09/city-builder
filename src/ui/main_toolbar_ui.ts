import { ActiveTool } from '@core/tools';

export class MainToolbarUI {
  private container: HTMLElement;
  public activeTool: ActiveTool = ActiveTool.INSPECT;
  private onToolChangeCallback?: (tool: ActiveTool) => void;
  private onLandscapeToggleCallback?: () => void;

  constructor(
    parent: HTMLElement,
    onToolChange?: (tool: ActiveTool) => void,
    onLandscapeToggle?: () => void
  ) {
    this.onToolChangeCallback = onToolChange;
    this.onLandscapeToggleCallback = onLandscapeToggle;
    this.container = document.createElement('div');
    this.container.id = 'main-toolbar';
    this.setupUI();
    this.setupKeybindings();
    parent.appendChild(this.container);
  }

  private setupUI(): void {
    this.container.innerHTML = `
      <div class="toolbar-wrapper">
        <button class="main-tool-btn active" data-tool="INSPECT" title="Inspeccionar (1)">🔍 Inspeccionar <span class="key-tag" style="margin-left: 4px;">1</span></button>
        <button class="main-tool-btn" data-tool="ROAD" title="Construir Carreteras (2)">🛣️ Carreteras <span class="key-tag" style="margin-left: 4px;">2</span></button>
        <button class="main-tool-btn" data-tool="ZONE" title="Zonificación RCI (3)">🏘️ Zonas <span class="key-tag" style="margin-left: 4px;">3</span></button>
        <button class="main-tool-btn" data-tool="TERRAFORM" title="Modificar Relieve (4)">⛰️ Terraformar <span class="key-tag" style="margin-left: 4px;">4</span></button>
        <button class="main-tool-btn" data-tool="DEMOLISH" title="Demoler Infraestructura (5)">🧨 Demoler <span class="key-tag" style="margin-left: 4px;">5</span></button>
        <button class="main-tool-btn" data-tool="AREAS" title="Comprar Parcelas / Límites de Ciudad (6)">🗺️ Áreas <span class="key-tag" style="margin-left: 4px;">6</span></button>
        <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.18); margin: 0 4px; align-self: center;"></div>
        <button class="main-tool-btn" id="btn-toggle-landscape" title="Generador y Parámetros del Paisaje Natural (P)">🏔️ Paisaje <span class="key-tag" style="margin-left: 4px;">P</span></button>
      </div>
    `;

    const buttons = this.container.querySelectorAll<HTMLButtonElement>('.main-tool-btn[data-tool]');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const tool = (btn.getAttribute('data-tool') ?? 'INSPECT') as ActiveTool;
        this.activeTool = tool;

        if (this.onToolChangeCallback) {
          this.onToolChangeCallback(tool);
        }
      });
    });

    const landscapeBtn = this.container.querySelector<HTMLButtonElement>('#btn-toggle-landscape');
    landscapeBtn?.addEventListener('click', () => {
      if (this.onLandscapeToggleCallback) {
        this.onLandscapeToggleCallback();
      }
    });
  }

  private setupKeybindings(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === '1') this.setTool(ActiveTool.INSPECT);
      else if (e.key === '2') this.setTool(ActiveTool.ROAD);
      else if (e.key === '3') this.setTool(ActiveTool.ZONE);
      else if (e.key === '4') this.setTool(ActiveTool.TERRAFORM);
      else if (e.key === '5') this.setTool(ActiveTool.DEMOLISH);
      else if (e.key === '6') this.setTool(ActiveTool.AREAS);
      else if (e.key === 'p' || e.key === 'P') {
        if (this.onLandscapeToggleCallback) {
          this.onLandscapeToggleCallback();
        }
      }
    });
  }

  public setTool(tool: ActiveTool): void {
    const btn = this.container.querySelector<HTMLButtonElement>(`[data-tool="${tool}"]`);
    if (btn) btn.click();
  }
}
