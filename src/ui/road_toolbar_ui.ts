import { RoadType, ROAD_CONFIGS } from '@core/graph/road_types';
import { RoadDrawMode } from '@core/graph/road_draw_mode';

export class RoadToolbarUI {
  private container: HTMLElement;
  public selectedRoadType: RoadType = RoadType.LOCAL_2L;
  public selectedDrawMode: RoadDrawMode = RoadDrawMode.STRAIGHT;

  private onTypeChangeCallback?: (type: RoadType) => void;
  private onModeChangeCallback?: (mode: RoadDrawMode) => void;

  constructor(
    parent: HTMLElement,
    onTypeChange?: (type: RoadType) => void,
    onModeChange?: (mode: RoadDrawMode) => void
  ) {
    this.onTypeChangeCallback = onTypeChange;
    this.onModeChangeCallback = onModeChange;
    this.container = document.createElement('div');
    this.container.id = 'road-panel';
    this.setupUI();
    parent.appendChild(this.container);
  }

  private setupUI(): void {
    this.container.innerHTML = `
      <div class="panel-section-title">📐 Modo de Trazado</div>
      <div class="draw-mode-buttons">
        <button class="draw-mode-btn active" data-mode="${RoadDrawMode.STRAIGHT}" title="Línea recta y cuadrícula">
          📏 Recta
        </button>
        <button class="draw-mode-btn" data-mode="${RoadDrawMode.CURVE}" title="Arco y Curva suave Bézier">
          〰️ Curva
        </button>
        <button class="draw-mode-btn" data-mode="${RoadDrawMode.ROUNDABOUT}" title="Colocar rotonda circular de 1 clic">
          ⭕ Rotonda
        </button>
      </div>

      <div class="panel-section-title" style="margin-top: 8px;">🛣️ Tipología de Vía</div>
      <div class="road-type-buttons">
        <button class="road-type-btn active" data-type="${RoadType.LOCAL_2L}" title="Doble sentido, 40 km/h, $20">
          🏡 Calle Local (2L)
        </button>
        <button class="road-type-btn" data-type="${RoadType.ONE_WAY_2L}" title="Sentido único, 50 km/h, $25">
          ➡️ Sentido Único (2L)
        </button>
        <button class="road-type-btn" data-type="${RoadType.AVENUE_4L}" title="Avenida con mediana, 70 km/h, $60">
          🌳 Avenida (4L)
        </button>
        <button class="road-type-btn" data-type="${RoadType.HIGHWAY_4L}" title="Autopista rápida, 100 km/h, $120">
          🏎️ Autopista (4L)
        </button>
      </div>
      <div class="road-info" id="road-info-text">
        Modo: Recta | Velocidad: 40 km/h | Doble Sentido | $20/celda
      </div>
    `;

    // Eventos para modo de trazado
    const modeButtons = this.container.querySelectorAll<HTMLButtonElement>('.draw-mode-btn');
    modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        modeButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const mode = (btn.getAttribute('data-mode') ?? RoadDrawMode.STRAIGHT) as RoadDrawMode;
        this.selectedDrawMode = mode;
        this.updateInfo();

        if (this.onModeChangeCallback) {
          this.onModeChangeCallback(mode);
        }
      });
    });

    // Eventos para tipología de vía
    const typeButtons = this.container.querySelectorAll<HTMLButtonElement>('.road-type-btn');
    typeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        typeButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const type = (btn.getAttribute('data-type') ?? RoadType.LOCAL_2L) as RoadType;
        this.selectedRoadType = type;
        this.updateInfo();

        if (this.onTypeChangeCallback) {
          this.onTypeChangeCallback(type);
        }
      });
    });
  }

  private updateInfo(): void {
    const infoText = this.container.querySelector<HTMLElement>('#road-info-text')!;
    const config = ROAD_CONFIGS[this.selectedRoadType];
    const modeLabel =
      this.selectedDrawMode === RoadDrawMode.STRAIGHT
        ? 'Recta'
        : this.selectedDrawMode === RoadDrawMode.CURVE
        ? 'Curva Bézier'
        : 'Rotonda Automática';
    infoText.innerText = `Modo: ${modeLabel} | Vel: ${config.speedLimit} km/h | ${config.isOneWay ? 'Sentido Único ➡️' : 'Doble Sentido ⇄'} | $${config.costPerCell}/celda`;
  }

  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'flex' : 'none';
  }
}
