import { RoadType, ROAD_CONFIGS } from '@core/graph/road_types';
import { RoadDrawMode } from '@core/graph/road_draw_mode';

export class RoadToolbarUI {
  private container: HTMLElement;
  public selectedRoadType: RoadType = RoadType.LOCAL_2L;
  public selectedDrawMode: RoadDrawMode = RoadDrawMode.STRAIGHT;
  public selectedElevationOffset: number = 0;

  private onTypeChangeCallback?: (type: RoadType) => void;
  private onModeChangeCallback?: (mode: RoadDrawMode) => void;
  private onElevationChangeCallback?: (elev: number) => void;

  constructor(
    parent: HTMLElement,
    onTypeChange?: (type: RoadType) => void,
    onModeChange?: (mode: RoadDrawMode) => void,
    onElevationChange?: (elev: number) => void
  ) {
    this.onTypeChangeCallback = onTypeChange;
    this.onModeChangeCallback = onModeChange;
    this.onElevationChangeCallback = onElevationChange;
    this.container = document.createElement('div');
    this.container.id = 'road-panel';
    this.setupUI();
    this.setupKeybindings();
    parent.appendChild(this.container);
  }

  private setupUI(): void {
    this.container.innerHTML = `
      <div class="panel-section-title">📐 Modo de Trazado</div>
      <div class="draw-mode-buttons">
        <button class="draw-mode-btn active" data-mode="${RoadDrawMode.STRAIGHT}" title="Línea recta a cualquier ángulo con snapping magnético">
          📏 Recta
        </button>
        <button class="draw-mode-btn" data-mode="${RoadDrawMode.CURVE}" title="Arco y Curva suave Bézier">
          〰️ Curva
        </button>
        <button class="draw-mode-btn" data-mode="${RoadDrawMode.ROUNDABOUT}" title="Colocar rotonda circular de 1 clic">
          ⭕ Rotonda
        </button>
      </div>

      <div class="panel-section-title" style="margin-top: 8px;">🏗️ Nivel de Elevación</div>
      <div class="road-elev-buttons" style="display: flex; gap: 8px;">
        <button class="draw-mode-btn active" data-elev="0" title="A ras de suelo (0m) [Q]">
          🌱 Suelo (0m)
        </button>
        <button class="draw-mode-btn" data-elev="6" title="Viaducto sobre pilares (+6m) [E]">
          🪜 Elevada (+6m)
        </button>
        <button class="draw-mode-btn" data-elev="12" title="Puente alto (+12m) [E]">
          🌉 Puente (+12m)
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
        Modo: Recta | Nivel: Suelo | Velocidad: 40 km/h | Doble Sentido | $20/celda
      </div>
    `;

    // Eventos para modo de trazado
    const modeButtons = this.container.querySelectorAll<HTMLButtonElement>('.draw-mode-btn[data-mode]');
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

    // Eventos para elevación
    const elevButtons = this.container.querySelectorAll<HTMLButtonElement>('.draw-mode-btn[data-elev]');
    elevButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        elevButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const elev = parseInt(btn.getAttribute('data-elev') ?? '0', 10);
        this.setElevation(elev);
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

  private setupKeybindings(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'e' || e.key === 'E') {
        // Subir elevación: 0 -> 6 -> 12
        if (this.selectedElevationOffset === 0) this.setElevation(6);
        else if (this.selectedElevationOffset === 6) this.setElevation(12);
      } else if (e.key === 'q' || e.key === 'Q') {
        // Bajar elevación: 12 -> 6 -> 0
        if (this.selectedElevationOffset === 12) this.setElevation(6);
        else if (this.selectedElevationOffset === 6) this.setElevation(0);
      }
    });
  }

  public setElevation(elev: number): void {
    this.selectedElevationOffset = elev;
    const elevButtons = this.container.querySelectorAll<HTMLButtonElement>('.draw-mode-btn[data-elev]');
    elevButtons.forEach((b) => {
      b.classList.toggle('active', parseInt(b.getAttribute('data-elev') ?? '0', 10) === elev);
    });
    this.updateInfo();
    if (this.onElevationChangeCallback) {
      this.onElevationChangeCallback(elev);
    }
  }

  private updateInfo(): void {
    const infoText = this.container.querySelector<HTMLElement>('#road-info-text')!;
    const config = ROAD_CONFIGS[this.selectedRoadType];
    const modeLabel =
      this.selectedDrawMode === RoadDrawMode.STRAIGHT
        ? 'Recta'
        : this.selectedDrawMode === RoadDrawMode.CURVE
        ? 'Curva Bézier'
        : 'Rotonda';

    const elevLabel = this.selectedElevationOffset === 0 ? 'Suelo (0m)' : `+${this.selectedElevationOffset}m`;

    infoText.textContent = `Modo: ${modeLabel} | Nivel: ${elevLabel} | Velocidad: ${config.speedLimit} km/h | ${
      config.isOneWay ? 'Sentido Único' : 'Doble Sentido'
    } | $${config.costPerCell}/celda`;
  }

  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'flex' : 'none';
  }
}
