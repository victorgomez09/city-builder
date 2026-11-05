import { ActiveTool } from '@core/tools';

export class MainToolbarUI {
  private container: HTMLElement;
  public activeTool: ActiveTool = ActiveTool.INSPECT;
  private onToolChangeCallback?: (tool: ActiveTool) => void;

  constructor(parent: HTMLElement, onToolChange?: (tool: ActiveTool) => void) {
    this.onToolChangeCallback = onToolChange;
    this.container = document.createElement('div');
    this.container.id = 'main-toolbar';
    this.setupUI();
    parent.appendChild(this.container);
  }

  private setupUI(): void {
    this.container.innerHTML = `
      <div class="toolbar-wrapper">
        <button class="main-tool-btn active" data-tool="INSPECT" title="Inspeccionar">🔍 Inspeccionar</button>
        <button class="main-tool-btn" data-tool="ROAD" title="Construir Carreteras">🛣️ Carreteras</button>
        <button class="main-tool-btn" data-tool="TERRAFORM" title="Modificar Relieve">⛰️ Terraformar</button>
        <button class="main-tool-btn" data-tool="DEMOLISH" title="Demoler Infraestructura">🧨 Demoler</button>
      </div>
    `;

    const buttons = this.container.querySelectorAll<HTMLButtonElement>('.main-tool-btn');
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
  }

  public setTool(tool: ActiveTool): void {
    const btn = this.container.querySelector<HTMLButtonElement>(`[data-tool="${tool}"]`);
    if (btn) btn.click();
  }
}
