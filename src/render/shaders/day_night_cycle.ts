import * as THREE from 'three';
import { AssetManager } from '@render/assets/asset_manager';
import { clamp01, lerp, smoothstep } from '@core/utils/math';

export interface DayNightOptions {
  cycleDurationSeconds?: number;
  startTime?: number; // 0.38 = mañana luminosa / mediodía
}

/**
 * Gestor Atmosférico e Iluminación PBR Física (estilo Fable Cities / Cities: Skylines II):
 * - Ephemeris solar y lunar continuo con cálculo analítico de `nightFactor` [0..1] y dirección de luz.
 * - Espectro solar físico: mediodía dorado (#fff6ec), atardecer ámbar cálido (#ffa257), crepúsculo violeta y noche de luna fría (#55759c).
 * - Sombra direccional calibrada (PCF Vogel-disk, normalBias = 0.025 para eliminar shadow acne sin descolgar sombras de contacto).
 * - Exposición de uniformes globales (`uNight`, `uSunDir`, `uMoonDir`) para sincronizar iluminación en carreteras, agua y edificios.
 */
export class DayNightCycle {
  private scene: THREE.Scene;
  private renderer?: THREE.WebGLRenderer;

  public sunLight: THREE.DirectionalLight;
  public moonLight: THREE.DirectionalLight;
  public ambientLight: THREE.AmbientLight;
  public hemiLight: THREE.HemisphereLight;
  private envMap: THREE.Texture | null = null;

  private cycleDuration: number;
  private currentTime: number;
  private isPaused: boolean = false;

  public nightFactor: number = 0; // 0 = pleno día, 1 = noche profunda
  public readonly sunDirection: THREE.Vector3 = new THREE.Vector3(0, -1, 0);
  public readonly moonDirection: THREE.Vector3 = new THREE.Vector3(0, -1, 0);

  // Paleta espectral calibrada
  private sunColorNoon = new THREE.Color(0xfff6ec);
  private sunColorSunset = new THREE.Color(0xff9944);
  private moonColor = new THREE.Color(0x6080a8);
  private skyColorDay = new THREE.Color(0xb5dcfa);
  private skyColorSunset = new THREE.Color(0xf6af75);
  private skyColorNight = new THREE.Color(0x121b28);
  private groundBounceDay = new THREE.Color(0x52483a);
  private groundBounceNight = new THREE.Color(0x10141a);

  constructor(scene: THREE.Scene, renderer?: THREE.WebGLRenderer, options: DayNightOptions = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.cycleDuration = options.cycleDurationSeconds ?? 360; // 6 minutos por ciclo completo
    this.currentTime = options.startTime ?? 0.38; // 9:00 AM

    // 1. Sol direccional principal con sombras PCF calibradas
    this.sunLight = new THREE.DirectionalLight(0xfff6ec, 2.5);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 450;

    const shadowBox = 115;
    this.sunLight.shadow.camera.left = -shadowBox;
    this.sunLight.shadow.camera.right = shadowBox;
    this.sunLight.shadow.camera.top = shadowBox;
    this.sunLight.shadow.camera.bottom = -shadowBox;
    this.sunLight.shadow.bias = -0.0001;
    this.sunLight.shadow.normalBias = 0.025; // Cero acné en terreno inclinado
    this.sunLight.shadow.radius = 1.2;
    this.scene.add(this.sunLight);

    // 2. Luz de luna secundaria para reflejos nocturnos
    this.moonLight = new THREE.DirectionalLight(0x6080a8, 0.35);
    this.moonLight.castShadow = false;
    this.scene.add(this.moonLight);

    // 3. Relleno ambiental
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(this.ambientLight);

    // 4. Luz hemisférica reactiva (cielo y rebote de suelo)
    this.hemiLight = new THREE.HemisphereLight(0xb5dcfa, 0x52483a, 0.35);
    this.scene.add(this.hemiLight);

    if (this.renderer) {
      this.initEnvironmentMap();
    }

    this.updateLighting();
  }

  private async initEnvironmentMap(): Promise<void> {
    if (!this.renderer) return;
    try {
      const assets = AssetManager.getInstance();
      const env = await assets.loadEnvironmentMap(
        this.renderer,
        '/assets/shared/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr'
      );
      this.envMap = env;
      this.scene.environment = env;
      this.scene.background = env;
      this.scene.environmentIntensity = 0.95;
      this.updateLighting();
    } catch (err) {
      console.warn('[DayNightCycle] Error al cargar HDRI de entorno:', err);
    }
  }

  public setTime(normalizedTime: number): void {
    this.currentTime = ((normalizedTime % 1) + 1) % 1;
    this.updateLighting();
  }

  public getTime(): number {
    return this.currentTime;
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
  }

  public update(deltaTime: number): void {
    if (this.isPaused) return;

    this.currentTime += deltaTime / this.cycleDuration;
    if (this.currentTime >= 1.0) {
      this.currentTime -= 1.0;
    }

    this.updateLighting();
  }

  private updateLighting(): void {
    // Órbita solar: ángulo continuo donde 0.25 = amanecer, 0.5 = mediodía, 0.75 = atardecer, 0.0 = medianoche
    const solarAngle = (this.currentTime - 0.25) * Math.PI * 2;
    const distance = 140;

    const sunX = Math.cos(solarAngle) * distance;
    const sunY = Math.sin(solarAngle) * distance;
    const sunZ = 55.0;

    this.sunLight.position.set(sunX, sunY, sunZ);
    this.sunDirection.set(-sunX, -sunY, -sunZ).normalize();

    // Luna en posición opuesta
    const moonX = -sunX;
    const moonY = -sunY;
    const moonZ = -sunZ;
    this.moonLight.position.set(moonX, Math.max(15, moonY), moonZ);
    this.moonDirection.set(-moonX, -moonY, -moonZ).normalize();

    // Elevación solar normalizada
    const sunElevation = sunY / distance; // [-1.0 .. 1.0]

    // Cálculo suave de nightFactor
    this.nightFactor = clamp01(1.0 - smoothstep(-0.08, 0.15, sunElevation));

    if (sunElevation > 0.0) {
      // Día o transición
      this.sunLight.visible = true;
      this.sunLight.castShadow = true;

      if (sunElevation < 0.22) {
        // Amanecer / Atardecer dorado cálido
        const t = sunElevation / 0.22;
        this.sunLight.color.lerpColors(this.sunColorSunset, this.sunColorNoon, t);
        this.sunLight.intensity = lerp(1.2, 2.5, t);
        this.ambientLight.intensity = lerp(0.12, 0.22, t);
        this.scene.environmentIntensity = lerp(0.45, 0.95, t);

        this.hemiLight.color.lerpColors(this.skyColorSunset, this.skyColorDay, t);
        this.hemiLight.groundColor.lerpColors(this.groundBounceDay, this.groundBounceDay, t);
        this.hemiLight.intensity = lerp(0.25, 0.40, t);
      } else {
        // Pleno mediodía
        this.sunLight.color.copy(this.sunColorNoon);
        this.sunLight.intensity = 2.5;
        this.ambientLight.intensity = 0.22;
        this.scene.environmentIntensity = 0.95;

        this.hemiLight.color.copy(this.skyColorDay);
        this.hemiLight.groundColor.copy(this.groundBounceDay);
        this.hemiLight.intensity = 0.40;
      }

      this.moonLight.intensity = 0.05;
    } else {
      // Noche profunda
      this.sunLight.visible = false;
      this.sunLight.castShadow = false;

      this.ambientLight.intensity = 0.08;
      this.scene.environmentIntensity = 0.18;

      this.moonLight.visible = true;
      this.moonLight.color.copy(this.moonColor);
      this.moonLight.intensity = 0.35;

      this.hemiLight.color.copy(this.skyColorNight);
      this.hemiLight.groundColor.copy(this.groundBounceNight);
      this.hemiLight.intensity = 0.12;
    }

    // Sincronización continua del color de la niebla atmosférica (THREE.Fog)
    if (this.scene.fog && 'color' in this.scene.fog) {
      if (sunElevation > 0.0) {
        if (sunElevation < 0.22) {
          const t = sunElevation / 0.22;
          this.scene.fog.color.lerpColors(this.skyColorSunset, this.skyColorDay, t);
        } else {
          this.scene.fog.color.copy(this.skyColorDay);
        }
      } else {
        this.scene.fog.color.copy(this.skyColorNight);
      }
    }
  }

  public dispose(): void {
    this.scene.remove(this.sunLight);
    this.scene.remove(this.moonLight);
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.hemiLight);
    if (this.envMap) {
      this.envMap.dispose();
    }
  }
}
