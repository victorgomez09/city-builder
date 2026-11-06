import { CityTile } from '@core/world/city_tile_manager';

export class AreasUI {
  private container: HTMLElement;
  private onBuyCallback?: (tx: number, tz: number) => void;
  private currentTile: CityTile | null = null;
  private isAdjacent: boolean = false;
  private playerMoney: number = 0;
  private unlockCheck: { allowed: boolean; reason?: string } = { allowed: true };

  constructor(parent: HTMLElement, onBuy?: (tx: number, tz: number) => void) {
    this.onBuyCallback = onBuy;
    this.container = document.createElement('div');
    this.container.id = 'areas-panel';
    this.setupUI();
    parent.appendChild(this.container);
  }

  private setupUI(): void {
    this.container.style.position = 'absolute';
    this.container.style.bottom = '95px';
    this.container.style.left = '50%';
    this.container.style.transform = 'translateX(-50%)';
    this.container.style.background = 'rgba(16, 20, 28, 0.96)';
    this.container.style.border = '1px solid rgba(0, 229, 255, 0.35)';
    this.container.style.borderRadius = '14px';
    this.container.style.padding = '18px 24px';
    this.container.style.color = '#fff';
    this.container.style.boxShadow = '0 16px 40px rgba(0, 0, 0, 0.65)';
    this.container.style.backdropFilter = 'blur(16px)';
    this.container.style.display = 'none';
    this.container.style.flexDirection = 'column';
    this.container.style.gap = '12px';
    this.container.style.minWidth = '380px';
    this.container.style.zIndex = '95';
    this.container.style.textAlign = 'center';

    this.renderContent();
  }

  private renderContent(): void {
    if (!this.currentTile) {
      this.container.innerHTML = `
        <div style="font-size: 13px; font-weight: 700; color: #00e5ff; text-transform: uppercase; letter-spacing: 0.5px;">🗺️ Gestión de Macro-Parcelas</div>
        <div style="font-size: 12px; color: #b0bec5; margin-top: 4px;">
          Haz clic sobre una parcela para examinar su topografía, recursos y coste de adquisición.
        </div>
      `;
      return;
    }

    const {
      name,
      unlocked,
      cost,
      tx,
      tz,
      metricSize,
      areaHectares,
      flatBuildablePct,
      waterCoveragePct,
      forestCoveragePct,
      upkeepWeekly,
    } = this.currentTile;

    const canAfford = this.playerMoney >= cost;
    const canUnlock = this.unlockCheck.allowed;

    let statusHtml = '';
    let actionBtnHtml = '';

    if (unlocked) {
      statusHtml = `<span style="color: #81c784; font-weight: 700;">✅ Territorio Adquirido (Construible)</span>`;
      actionBtnHtml = `<div style="font-size: 12px; color: #90a4ae;">Sector urbanizable activo de tu metrópolis.</div>`;
    } else if (this.isAdjacent) {
      if (!canUnlock) {
        statusHtml = `<span style="color: #ffb74d; font-weight: 700;">⚠️ Requisito de Expansión Pendiente</span>`;
        actionBtnHtml = `
          <div style="font-size: 12px; color: #ffb74d; margin-bottom: 6px;">${this.unlockCheck.reason ?? 'Hito demográfico no alcanzado'}</div>
          <button id="btn-buy-tile" disabled style="
            background: #37474f;
            color: #78909c;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 700;
            cursor: not-allowed;
            font-size: 13px;
          ">
            Bloqueado por Hito Demográfico
          </button>
        `;
      } else if (!canAfford) {
        statusHtml = `<span style="color: #e57373; font-weight: 700;">💵 Fondos Insuficientes</span>`;
        actionBtnHtml = `
          <button id="btn-buy-tile" disabled style="
            background: #37474f;
            color: #78909c;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 700;
            cursor: not-allowed;
            font-size: 13px;
          ">
            Requiere $${cost.toLocaleString()} (Tienes $${this.playerMoney.toLocaleString()})
          </button>
        `;
      } else {
        statusHtml = `<span style="color: #00e5ff; font-weight: 700;">🔷 Sector Disponible para Adquisición</span>`;
        actionBtnHtml = `
          <button id="btn-buy-tile" style="
            background: linear-gradient(135deg, #00b4d8, #0077b6);
            color: #fff;
            border: none;
            padding: 11px 22px;
            border-radius: 8px;
            font-weight: 700;
            cursor: pointer;
            font-size: 13px;
            box-shadow: 0 4px 16px rgba(0, 180, 216, 0.4);
            transition: transform 0.15s ease, filter 0.15s ease;
          ">
            Adquirir Sector ($${cost.toLocaleString()})
          </button>
        `;
      }
    } else {
      statusHtml = `<span style="color: #78909c; font-weight: 600;">🔒 Sector No Adyacente</span>`;
      actionBtnHtml = `<div style="font-size: 12px; color: #78909c;">Debes adquirir una parcela contigua antes de poder incorporar este territorio.</div>`;
    }

    this.container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
        <span style="font-size: 15px; font-weight: 800; color: #fff;">${name}</span>
        <span style="font-size: 12px; color: #00e5ff; font-weight: 700;">${metricSize}m × ${metricSize}m (${areaHectares.toFixed(2)} ha)</span>
      </div>
      <div style="font-size: 12px; margin: 2px 0;">${statusHtml}</div>

      <!-- Métricas orográficas y recursos del sector -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: rgba(0,0,0,0.25); padding: 10px 14px; border-radius: 8px; text-align: left; font-size: 12px;">
        <div>🏞️ <strong>Suelo Llano:</strong> <span style="color: #81c784;">${flatBuildablePct}%</span></div>
        <div>💧 <strong>Masa de Agua:</strong> <span style="color: #64b5f6;">${waterCoveragePct}%</span></div>
        <div>🌲 <strong>Bosque:</strong> <span style="color: #a5d6a7;">${forestCoveragePct}%</span></div>
        <div>⚙️ <strong>Mantenimiento:</strong> <span style="color: #ffb74d;">$${upkeepWeekly}/sem</span></div>
      </div>

      <div style="margin-top: 6px;">${actionBtnHtml}</div>
    `;

    const buyBtn = this.container.querySelector<HTMLButtonElement>('#btn-buy-tile');
    if (buyBtn && canAfford && canUnlock && !unlocked && this.isAdjacent) {
      buyBtn.addEventListener('click', () => {
        if (this.onBuyCallback) {
          this.onBuyCallback(tx, tz);
        }
      });
    }
  }

  public setSelectedTile(
    tile: CityTile | null,
    isAdjacent: boolean,
    playerMoney: number,
    unlockCheck?: { allowed: boolean; reason?: string }
  ): void {
    this.currentTile = tile;
    this.isAdjacent = isAdjacent;
    this.playerMoney = playerMoney;
    this.unlockCheck = unlockCheck ?? { allowed: true };
    this.renderContent();
  }

  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'flex' : 'none';
  }
}
