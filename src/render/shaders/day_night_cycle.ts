import * as THREE from 'three';
import { AssetManager } from '@render/assets/asset_manager';

export interface DayNightOptions {
  cycleDurationSeconds?: number;
  startTime?: number; // 0.38 = Mañana luminosa / mediodía
}

/**
 * Gestor Atmosférico e Iluminación PBR de Alta Fidelidad (estilo Fable Cities / Cities: Skylines II):
 * - Iluminación basada en imagen (IBL) mediante HDRI cielo nublado Poly Haven ('kloofendal_48d_partly_cloudy_puresky_1k.hdr').
 * - Sol direccional cálido con sombras suaves PCF calibradas con normalBias (sin artefactos de sombra en terreno).
 * - Transición de día a noche modulando la intensidad del entorno y la temperatura de color.
 */
export class DayNightCycle {
  private scene: THREE.Scene;
  private renderer?: THREE.WebGLRenderer;
  private sunLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;
  private hemiLight: THREE.HemisphereLight;
  private envMap: THREE.Texture | null = null;

  private cycleDuration: number;
  private currentTime: number;
  private isPaused: boolean = false;

  private sunColorNoon = new THREE.Color(0xfff6ec);    // Sol dorado natural
  private sunColorSunset = new THREE.Color(0xffa257);  // Ámbar atardecer
  private sunColorNight = new THREE.Color(0x354b70);   // Noche azulada

  constructor(scene: THREE.Scene, renderer?: THREE.WebGLRenderer, options: DayNightOptions = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.cycleDuration = options.cycleDurationSeconds ?? 360; // 6 minutos por ciclo
    this.currentTime = options.startTime ?? 0.38; // Mañana clara con sombras laterales pronunciadas

    // 1. Sol direccional PBR
    this.sunLight = new THREE.DirectionalLight(0xfff6ec, 2.2);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 400;

    const shadowDist = 110;
    this.sunLight.shadow.camera.left = -shadowDist;
    this.sunLight.shadow.camera.right = shadowDist;
    this.sunLight.shadow.camera.top = shadowDist;
    this.sunLight.shadow.camera.bottom = -shadowDist;
    this.sunLight.shadow.bias = -0.0001;
    this.sunLight.shadow.normalBias = 0.025; // Evita el shadow acne y mantiene contacto en la base
    this.scene.add(this.sunLight);

    // 2. Luz de relleno ambiental suave complementaria a IBL
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(this.ambientLight);

    // 3. Luz hemisférica (cielo y rebote del terreno)
    this.hemiLight = new THREE.HemisphereLight(0xbadcf2, 0x483e32, 0.35);
    this.scene.add(this.hemiLight);

    // 4. Cargar mapa de entorno HDRI real si se proporciona el renderer
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
    const angle = (this.currentTime - 0.25) * Math.PI * 2;
    const distance = 120;

    // Ángulo de inclinación solar que produce sombras nítidas estilo Fable Cities
    const sunX = Math.cos(angle) * distance;
    const sunY = Math.sin(angle) * distance;
    const sunZ = 60;

    this.sunLight.position.set(sunX, sunY, sunZ);

    const isDay = sunY > 0;
    const sunElevation = Math.max(0, sunY / distance);

    if (isDay) {
      if (sunElevation < 0.25) {
        // Atardecer / Amanecer
        const factor = sunElevation / 0.25;
        this.sunLight.color.lerpColors(this.sunColorSunset, this.sunColorNoon, factor);
        this.sunLight.intensity = THREE.MathUtils.lerp(1.2, 2.2, factor);
        this.ambientLight.intensity = THREE.MathUtils.lerp(0.15, 0.25, factor);
        this.scene.environmentIntensity = THREE.MathUtils.lerp(0.5, 0.95, factor);
      } else {
        // Pleno día
        this.sunLight.color.copy(this.sunColorNoon);
        this.sunLight.intensity = 2.2;
        this.ambientLight.intensity = 0.2;
        this.scene.environmentIntensity = 0.95;
      }
      this.sunLight.castShadow = true;
    } else {
      // Noche
      this.sunLight.color.copy(this.sunColorNight);
      this.sunLight.intensity = 0.15;
      this.ambientLight.intensity = 0.1;
      this.scene.environmentIntensity = 0.15;
      this.sunLight.castShadow = false;
    }
  }

  public dispose(): void {
    this.scene.remove(this.sunLight);
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.hemiLight);
    if (this.envMap) {
      this.envMap.dispose();
    }
  }
}
