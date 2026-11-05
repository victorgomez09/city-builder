import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

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
