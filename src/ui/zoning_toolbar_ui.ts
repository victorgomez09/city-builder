import { ZoneType } from '@core/zoning/zoning_manager';

export class ZoningToolbarUI {
  private container: HTMLElement;
  public selectedZone: ZoneType = ZoneType.RESIDENTIAL;
  public brushRadius: number = 8.0;

  private onZoneChangeCallback?: (zone: ZoneType) => void;

  constructor(parent: HTMLElement, onZoneChange?: (zone: ZoneType) => void) {
    this.onZoneChangeCallback = onZoneChange;
    this.container = document.createElement('div');
    this.container.id = 'zoning-panel';
    this.setupUI();
    this.setupKeybindings();
    parent.appendChild(this.container);
  }

  private setupUI(): void {
    this.container.style.position = 'absolute';
    this.container.style.bottom = '84px';
    this.container.style.left = '50%';
    this.container.style.transform = 'translateX(-50%)';
    this.container.style.background = 'rgba(20, 24, 30, 0.96)';
    this.container.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    this.container.style.borderRadius = '14px';
    this.container.style.padding = '14px 20px';
    this.container.style.color = '#fff';
    this.container.style.zIndex = '95';
    this.container.style.boxShadow = '0 12px 36px rgba(0, 0, 0, 0.55)';
    this.container.style.backdropFilter = 'blur(16px)';
    this.container.style.display = 'none';
    this.container.style.flexDirection = 'column';
    this.container.style.gap = '10px';
    this.container.style.minWidth = '420px';

    this.container.innerHTML = `
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #4caf50;">
        🏘️ Zonificación Urbana RCI (CityRT)
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="zone-btn active" data-zone="${ZoneType.RESIDENTIAL}" style="
          background: rgba(76, 175, 80, 0.25); border: 1px solid #4caf50; color: #fff; padding: 8px 14px; border-radius: 8px; font-weight: 700; cursor: pointer; flex: 1;
        ">
          🟩 Residencial <span style="font-size: 10px; opacity: 0.7;">(R)</span>
        </button>
        <button class="zone-btn" data-zone="${ZoneType.COMMERCIAL}" style="
          background: rgba(33, 150, 243, 0.15); border: 1px solid rgba(33, 150, 243, 0.4); color: #cfd8dc; padding: 8px 14px; border-radius: 8px; font-weight: 700; cursor: pointer; flex: 1;
        ">
          🟦 Comercial <span style="font-size: 10px; opacity: 0.7;">(C)</span>
        </button>
        <button class="zone-btn" data-zone="${ZoneType.INDUSTRIAL}" style="
          background: rgba(255, 152, 0, 0.15); border: 1px solid rgba(255, 152, 0, 0.4); color: #cfd8dc; padding: 8px 14px; border-radius: 8px; font-weight: 700; cursor: pointer; flex: 1;
        ">
          🟨 Industrial <span style="font-size: 10px; opacity: 0.7;">(I)</span>
        </button>
        <button class="zone-btn" data-zone="${ZoneType.NONE}" style="
          background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2); color: #cfd8dc; padding: 8px 14px; border-radius: 8px; font-weight: 700; cursor: pointer; flex: 1;
        ">
          ⬜ Deszonar <span style="font-size: 10px; opacity: 0.7;">(X)</span>
        </button>
      </div>
      <div style="font-size: 11px; color: #90a4ae; text-align: center;">
        Arrastra el ratón sobre las casillas que bordean las calles para asignar distritos.
      </div>
    `;

    const buttons = this.container.querySelectorAll<HTMLButtonElement>('.zone-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => {
          b.classList.remove('active');
          b.style.background = 'rgba(255, 255, 255, 0.08)';
          b.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          b.style.color = '#cfd8dc';
        });

        btn.classList.add('active');
        const zone = btn.getAttribute('data-zone') as ZoneType;
        this.selectedZone = zone;

        if (zone === ZoneType.RESIDENTIAL) {
          btn.style.background = 'rgba(76, 175, 80, 0.25)';
          btn.style.borderColor = '#4caf50';
          btn.style.color = '#fff';
        } else if (zone === ZoneType.COMMERCIAL) {
          btn.style.background = 'rgba(33, 150, 243, 0.25)';
          btn.style.borderColor = '#2196f3';
          btn.style.color = '#fff';
        } else if (zone === ZoneType.INDUSTRIAL) {
          btn.style.background = 'rgba(255, 152, 0, 0.25)';
          btn.style.borderColor = '#ff9800';
          btn.style.color = '#fff';
        } else {
          btn.style.background = 'rgba(255, 255, 255, 0.2)';
          btn.style.borderColor = '#fff';
          btn.style.color = '#fff';
        }

        if (this.onZoneChangeCallback) {
          this.onZoneChangeCallback(zone);
        }
      });
    });
  }

  private setupKeybindings(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'r' || e.key === 'R') {
        const btn = this.container.querySelector<HTMLButtonElement>(`[data-zone="${ZoneType.RESIDENTIAL}"]`);
        if (btn) btn.click();
      } else if (e.key === 'c' || e.key === 'C') {
        const btn = this.container.querySelector<HTMLButtonElement>(`[data-zone="${ZoneType.COMMERCIAL}"]`);
        if (btn) btn.click();
      } else if (e.key === 'i' || e.key === 'I') {
        const btn = this.container.querySelector<HTMLButtonElement>(`[data-zone="${ZoneType.INDUSTRIAL}"]`);
        if (btn) btn.click();
      } else if (e.key === 'x' || e.key === 'X') {
        const btn = this.container.querySelector<HTMLButtonElement>(`[data-zone="${ZoneType.NONE}"]`);
        if (btn) btn.click();
      }
    });
  }

  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'flex' : 'none';
  }
}
