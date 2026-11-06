/**
 * HUD Flotante de Construcción de Carreteras (Estilo CityRT):
 * Se posiciona en tiempo real junto al cursor del ratón durante el trazado de vías.
 * Muestra longitud métrica exacta, ángulo con snapping magnético y coste de obra.
 */
export class RoadConstructionHUD {
  private element: HTMLElement;
  private isVisible: boolean = false;

  constructor(parent: HTMLElement = document.body) {
    this.element = document.createElement('div');
    this.element.id = 'road-construction-hud';
    this.setupUI();
    parent.appendChild(this.element);
  }

  private setupUI(): void {
    this.element.style.position = 'fixed';
    this.element.style.pointerEvents = 'none';
    this.element.style.display = 'none';
    this.element.style.flexDirection = 'column';
    this.element.style.gap = '4px';
    this.element.style.background = 'rgba(16, 22, 30, 0.92)';
    this.element.style.border = '1px solid rgba(0, 229, 255, 0.5)';
    this.element.style.borderRadius = '8px';
    this.element.style.padding = '6px 12px';
    this.element.style.color = '#fff';
    this.element.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    this.element.style.fontSize = '12px';
    this.element.style.fontWeight = '600';
    this.element.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.6)';
    this.element.style.backdropFilter = 'blur(10px)';
    this.element.style.zIndex = '1000';
    this.element.style.transform = 'translate(18px, -28px)';
  }

  /**
   * Actualiza los datos métricos y la posición del HUD en pantalla.
   */
  public update(
    screenX: number,
    screenY: number,
    lengthMeters: number,
    angleDegrees: number,
    cost: number,
    isValid: boolean = true,
    errorReason?: string,
    elevOffset: number = 0
  ): void {
    this.element.style.left = `${screenX}px`;
    this.element.style.top = `${screenY}px`;

    const statusBadge = isValid
      ? `<span style="color: #69f0ae;">✓ Válido</span>`
      : `<span style="color: #ff5252; font-weight: 700;">⚠️ ${errorReason ?? 'No permitido'}</span>`;

    const elevBadge = elevOffset > 0
      ? `<span style="color: #ffd54f; background: rgba(255,213,79,0.18); padding: 1px 5px; border-radius: 4px;">+${elevOffset}m Elevada</span>`
      : '';

    this.element.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span>📏 <strong style="color: #00e5ff;">${Math.round(lengthMeters)} m</strong></span>
        <span style="color: rgba(255,255,255,0.3);">|</span>
        <span>🧭 <strong style="color: #ffb74d;">${Math.round(angleDegrees)}°</strong></span>
        <span style="color: rgba(255,255,255,0.3);">|</span>
        <span>💵 <strong style="color: #81c784;">$${cost.toLocaleString()}</strong></span>
        ${elevBadge}
      </div>
      <div style="font-size: 11px; display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
        ${statusBadge}
        <span style="color: #90a4ae; font-size: 10px;">[E] Subir nivel &nbsp; [Q] Bajar</span>
      </div>
    `;

    if (!this.isVisible) {
      this.element.style.display = 'flex';
      this.isVisible = true;
    }
  }

  public hide(): void {
    if (this.isVisible) {
      this.element.style.display = 'none';
      this.isVisible = false;
    }
  }

  public dispose(): void {
    this.element.remove();
  }
}
