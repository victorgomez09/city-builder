import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { SimplexNoise } from '@core/utils/noise';

/**
 * Gestor Centralizado de Assets (Texturas PBR, HDRI y Modelos GLTF/GLB).
 * Carga con caché y optimización de memoria para evitar duplicaciones.
 */
export class AssetManager {
  private static instance: AssetManager;
  private textureLoader: THREE.TextureLoader = new THREE.TextureLoader();
  private gltfLoader: GLTFLoader = new GLTFLoader();
  private rgbeLoader: RGBELoader = new RGBELoader();

  private textureCache: Map<string, THREE.Texture> = new Map();
  private gltfCache: Map<string, THREE.Group> = new Map();
  private envMapCache: Map<string, THREE.Texture> = new Map();
  private noiseTexCache: THREE.DataTexture | null = null;
  private waterNormalCache: THREE.DataTexture | null = null;

  public static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  /**
   * Carga una textura tileable con repetición configurada y espacio de color correcto.
   * @param isSRGB true para texturas de color/albedo/diffuse; false para normales, rugosidad, etc.
   */
  public loadTexture(
    url: string,
    repeatX: number = 1,
    repeatY: number = 1,
    isSRGB: boolean = true
  ): THREE.Texture {
    const cacheKey = `${url}_${repeatX}_${repeatY}_${isSRGB}`;
    const cached = this.textureCache.get(cacheKey);
    if (cached) return cached;

    const texture = this.textureLoader.load(url);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.colorSpace = isSRGB ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.anisotropy = 8;

    this.textureCache.set(cacheKey, texture);
    return texture;
  }

  /**
   * Genera o retorna una textura RGBA de ruido procedimental continuo y tileable (estilo Fable Cities).
   * R: manchas amplias (baja frecuencia)
   * G: frecuencia media
   * B: detalle fino
   * A: celular / variación micro
   */
  public getProceduralNoiseTexture(size: number = 256, seed: number = 1337): THREE.DataTexture {
    if (this.noiseTexCache) return this.noiseTexCache;

    const n1 = new SimplexNoise(seed + 11);
    const n2 = new SimplexNoise(seed + 12);
    const n3 = new SimplexNoise(seed + 13);
    const n4 = new SimplexNoise(seed + 14);

    const seamlessFbm = (noise: SimplexNoise, u: number, v: number, freq: number, oct: number): number => {
      const s = (x: number, y: number) => 0.5 + 0.5 * noise.fbm2D(x * freq, y * freq, oct);
      const a = s(u, v);
      const b = s(u - 1, v);
      const c = s(u, v - 1);
      const d = s(u - 1, v - 1);
      const wu = u * u * (3 - 2 * u);
      const wv = v * v * (3 - 2 * v);
      const top = a * (1 - wu) + b * wu;
      const bot = c * (1 - wu) + d * wu;
      return top * (1 - wv) + bot * wv;
    };

    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const k = (y * size + x) * 4;
        data[k + 0] = Math.floor(255 * seamlessFbm(n1, u, v, 2.0, 3));
        data[k + 1] = Math.floor(255 * seamlessFbm(n2, u, v, 5.0, 4));
        data[k + 2] = Math.floor(255 * seamlessFbm(n3, u, v, 12.0, 4));
        const w = seamlessFbm(n4, u, v, 7.0, 2);
        data[k + 3] = Math.floor(255 * Math.pow(Math.abs(w * 2 - 1), 0.6));
      }
    }

    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;

    this.noiseTexCache = tex;
    return tex;
  }

  /**
   * Genera o retorna una textura de normales de oleaje marino/fluvial 100% continua y tileable (estilo CityRT / Cities: Skylines).
   * R, G, B: componentes del vector normal en espacio tangente (X, Y, Z).
   * A: máscara de crestas de espuma y oleaje micro.
   */
  public getProceduralWaterNormalTexture(size: number = 256): THREE.DataTexture {
    if (this.waterNormalCache) return this.waterNormalCache;

    const data = new Uint8Array(size * size * 4);
    // Armónicos periódicos cerrados (k_x, k_y enteros) para garantizar tileabilidad matemática perfecta
    const waves = [
      { kx: 3, ky: 2, amp: 0.045, phase: 0.1 },
      { kx: -2, ky: 5, amp: 0.035, phase: 1.2 },
      { kx: 6, ky: -4, amp: 0.022, phase: 2.3 },
      { kx: 8, ky: 7, amp: 0.015, phase: 0.7 },
      { kx: -11, ky: 9, amp: 0.010, phase: 3.1 },
      { kx: 14, ky: -12, amp: 0.007, phase: 1.8 },
      { kx: 20, ky: 18, amp: 0.004, phase: 0.5 },
      { kx: -25, ky: 22, amp: 0.003, phase: 2.7 },
    ];

    const twoPi = Math.PI * 2;

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;

        let dhdu = 0;
        let dhdv = 0;
        let height = 0;

        for (let i = 0; i < waves.length; i++) {
          const w = waves[i]!;
          const angle = twoPi * (w.kx * u + w.ky * v) + w.phase;
          const s = Math.sin(angle);
          const c = Math.cos(angle);

          height += s * w.amp;
          dhdu += c * (twoPi * w.kx) * w.amp;
          dhdv += c * (twoPi * w.ky) * w.amp;
        }

        const strength = 2.0;
        const nx = -dhdu * strength;
        const ny = -dhdv * strength;
        const nz = 1.0;
        const len = Math.hypot(nx, ny, nz);

        const normX = nx / len;
        const normY = ny / len;
        const normZ = nz / len;

        const idx = (y * size + x) * 4;
        data[idx + 0] = Math.floor((normX * 0.5 + 0.5) * 255);
        data[idx + 1] = Math.floor((normY * 0.5 + 0.5) * 255);
        data[idx + 2] = Math.floor((normZ * 0.5 + 0.5) * 255);
        data[idx + 3] = Math.floor(Math.max(0, Math.min(255, (height * 10.0 + 0.5) * 255)));
      }
    }

    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;

    this.waterNormalCache = tex;
    return tex;
  }

  /**
   * Carga un archivo HDR y genera un mapa de entorno IBL prefiltrado mediante PMREMGenerator.
   */
  public async loadEnvironmentMap(
    renderer: THREE.WebGLRenderer,
    url: string
  ): Promise<THREE.Texture> {
    const cached = this.envMapCache.get(url);
    if (cached) return cached;

    return new Promise((resolve, reject) => {
      this.rgbeLoader.load(
        url,
        (hdrTexture) => {
          const pmremGenerator = new THREE.PMREMGenerator(renderer);
          pmremGenerator.compileEquirectangularShader();
          const renderTarget = pmremGenerator.fromEquirectangular(hdrTexture);
          const envMap = renderTarget.texture;

          hdrTexture.dispose();
          pmremGenerator.dispose();

          this.envMapCache.set(url, envMap);
          resolve(envMap);
        },
        undefined,
        (err) => {
          console.error(`[AssetManager] Error al cargar HDRI desde ${url}:`, err);
          reject(err);
        }
      );
    });
  }

  /**
   * Carga un modelo GLTF/GLB de forma asíncrona devolviendo un clon optimizado con sombras.
   */
  public async loadGLTF(url: string): Promise<THREE.Group> {
    const cached = this.gltfCache.get(url);
    if (cached) {
      return cached.clone(true);
    }

    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });
          this.gltfCache.set(url, model);
          resolve(model.clone(true));
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  /**
   * Crea un material PBR configurado con las texturas de la librería de assets.
   */
  public createPBRMaterial(options: {
    colorMapUrl: string;
    normalMapUrl?: string;
    roughnessMapUrl?: string;
    aoMapUrl?: string;
    repeat?: number;
    colorTint?: number;
    roughness?: number;
    metalness?: number;
  }): THREE.MeshStandardMaterial {
    const repeat = options.repeat ?? 16;
    const map = this.loadTexture(options.colorMapUrl, repeat, repeat, true);

    const normalMap = options.normalMapUrl
      ? this.loadTexture(options.normalMapUrl, repeat, repeat, false)
      : undefined;

    const roughnessMap = options.roughnessMapUrl
      ? this.loadTexture(options.roughnessMapUrl, repeat, repeat, false)
      : undefined;

    const aoMap = options.aoMapUrl
      ? this.loadTexture(options.aoMapUrl, repeat, repeat, false)
      : undefined;

    return new THREE.MeshStandardMaterial({
      map,
      normalMap,
      roughnessMap,
      aoMap,
      roughness: options.roughness ?? 0.8,
      metalness: options.metalness ?? 0.05,
      color: options.colorTint !== undefined ? new THREE.Color(options.colorTint) : 0xffffff,
    });
  }
}
