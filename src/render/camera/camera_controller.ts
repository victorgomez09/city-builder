import * as THREE from 'three';
import { clamp, damp, dampAngle, DEG2RAD } from '@core/utils/math';

export interface CameraViewPreset {
  target?: { x?: number; y?: number; z?: number };
  distance?: number;
  yaw?: number;
  pitch?: number;
}

export interface CameraBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  margin?: number; // Margen elástico de encuadre hacia el exterior
}

export interface CameraControllerOptions {
  fov?: number;
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  panSpeed?: number;
  zoomSpeed?: number;
  rotateSpeed?: number;
  smoothing?: number;
  minHeightAboveGround?: number;
  bounds?: CameraBounds;
}

/**
 * Controlador de Cámara Isométrica / RTS de Alta Fidelidad (estilo Fable Cities / Cities: Skylines II).
 * 
 * Características:
 * - Movimiento Pan con WASD / Flechas modulado proporcionalmente por la distancia (zoom-scaled).
 * - Restricción elástica dentro de la caja de límites de la ciudad (Camera Pan Bounds).
 * - Rotación horizontal azimutal (Q / E o arrastre con clic secundario).
 * - Inclinación polar / cabeceo (R / F o arrastre vertical secundario).
 * - Zoom suave con rueda de ratón focalizado hacia el punto de mira.
 * - Amortiguación exponencial cinemática independiente del framerate (`damp` / `dampAngle`).
 * - Protección contra colapso bajo el terreno (`minHeightAboveGround`).
 * - Métodos para vistas predeterminadas (`setView`, `getView`).
 * - Zero-allocation en cada frame (vectores y matrices prealocados).
 */
export class CameraController {
  public camera: THREE.PerspectiveCamera;
  public domElement: HTMLElement;

  // Restricciones y configuración
  public minDistance: number;
  public maxDistance: number;
  public minPitch: number;
  public maxPitch: number;
  public panSpeed: number;
  public zoomSpeed: number;
  public rotateSpeed: number;
  public smoothing: number;
  public minHeightAboveGround: number;

  // Límites de desplazamiento
  public bounds: CameraBounds | null = null;
  public enableQERotation: boolean = true;

  // Estado objetivo (deseado) y estado actual amortiguado
  public target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private currentTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  public distance: number = 65;
  private currentDistance: number = 65;

  public yaw: number = 45 * DEG2RAD;   // Azimut (horizontal)
  private currentYaw: number = 45 * DEG2RAD;

  public pitch: number = 55 * DEG2RAD; // Elevación polar respecto a la vertical
  private currentPitch: number = 55 * DEG2RAD;

  // Teclado
  private keysPressed: Record<string, boolean> = {};

  // Estado del puntero
  private isRotating: boolean = false;
  private isPanning: boolean = false;
  private previousMousePosition = { x: 0, y: 0 };

  // Buffer de cálculo prealocado (Zero-Allocation)
  private readonly _forward = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _moveDir = new THREE.Vector3();
  private readonly _camPos = new THREE.Vector3();

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    options: CameraControllerOptions = {}
  ) {
    this.camera = camera;
    this.domElement = domElement;

    this.minDistance = options.minDistance ?? 8.0;
    this.maxDistance = options.maxDistance ?? 280.0;
    this.minPitch = options.minPolarAngle ?? 18 * DEG2RAD; // ~0.31 rad
    this.maxPitch = options.maxPolarAngle ?? 82 * DEG2RAD; // ~1.43 rad
    this.panSpeed = options.panSpeed ?? 1.2;
    this.zoomSpeed = options.zoomSpeed ?? 0.12;
    this.rotateSpeed = options.rotateSpeed ?? 0.0042;
    this.smoothing = options.smoothing ?? 10.0;
    this.minHeightAboveGround = options.minHeightAboveGround ?? 2.5;
    this.bounds = options.bounds ?? null;

    this.attachEventListeners();
    this.updateCameraTransform(true);
  }

  public setBounds(bounds: CameraBounds | null): void {
    this.bounds = bounds;
    this.clampTargetToBounds();
  }

  private clampTargetToBounds(): void {
    if (!this.bounds) return;
    const m = this.bounds.margin ?? 35.0;
    this.target.x = clamp(this.target.x, this.bounds.minX - m, this.bounds.maxX + m);
    this.target.z = clamp(this.target.z, this.bounds.minZ - m, this.bounds.maxZ + m);
  }

  private attachEventListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('mousemove', this.onMouseMove);
      window.addEventListener('mouseup', this.onMouseUp);
    }

    if (this.domElement?.addEventListener) {
      this.domElement.addEventListener('mousedown', this.onMouseDown);
      this.domElement.addEventListener('wheel', this.onMouseWheel, { passive: false });
      this.domElement.addEventListener('contextmenu', this.onContextMenu);
    }
  }

  public dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('mousemove', this.onMouseMove);
      window.removeEventListener('mouseup', this.onMouseUp);
    }

    if (this.domElement?.removeEventListener) {
      this.domElement.removeEventListener('mousedown', this.onMouseDown);
      this.domElement.removeEventListener('wheel', this.onMouseWheel);
      this.domElement.removeEventListener('contextmenu', this.onContextMenu);
    }
  }

  private onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    this.keysPressed[event.code] = true;
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keysPressed[event.code] = false;
  };

  private onMouseDown = (event: MouseEvent): void => {
    this.previousMousePosition.x = event.clientX;
    this.previousMousePosition.y = event.clientY;

    if (event.button === 2) {
      this.isRotating = true;
    } else if (event.button === 1 || (event.button === 0 && event.altKey)) {
      this.isPanning = true;
    }
  };

  private onMouseMove = (event: MouseEvent): void => {
    const deltaX = event.clientX - this.previousMousePosition.x;
    const deltaY = event.clientY - this.previousMousePosition.y;
    this.previousMousePosition.x = event.clientX;
    this.previousMousePosition.y = event.clientY;

    if (this.isRotating) {
      this.yaw -= deltaX * this.rotateSpeed;
      this.pitch = clamp(this.pitch - deltaY * this.rotateSpeed, this.minPitch, this.maxPitch);
    } else if (this.isPanning) {
      const panFactor = (this.currentDistance / 60) * 0.055;
      this.panRelative(-deltaX * panFactor, deltaY * panFactor);
    }
  };

  private onMouseUp = (event: MouseEvent): void => {
    if (event.button === 2) {
      this.isRotating = false;
    } else if (event.button === 1 || event.button === 0) {
      this.isPanning = false;
    }
  };

  private onMouseWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const zoomDelta = Math.sign(event.deltaY) * this.distance * this.zoomSpeed;
    this.distance = clamp(this.distance + zoomDelta, this.minDistance, this.maxDistance);
  };

  /**
   * Configura una vista programática suave o inmediata.
   */
  public setView(view: CameraViewPreset, immediate: boolean = false): void {
    if (view.target) {
      if (view.target.x !== undefined) this.target.x = view.target.x;
      if (view.target.y !== undefined) this.target.y = view.target.y;
      if (view.target.z !== undefined) this.target.z = view.target.z;
    }
    this.clampTargetToBounds();

    if (view.distance !== undefined) {
      this.distance = clamp(view.distance, this.minDistance, this.maxDistance);
    }
    if (view.yaw !== undefined) this.yaw = view.yaw;
    if (view.pitch !== undefined) {
      this.pitch = clamp(view.pitch, this.minPitch, this.maxPitch);
    }

    if (immediate) {
      this.currentTarget.copy(this.target);
      this.currentDistance = this.distance;
      this.currentYaw = this.yaw;
      this.currentPitch = this.pitch;
      this.updateCameraTransform(true);
    }
  }

  public getView(): { target: THREE.Vector3; distance: number; yaw: number; pitch: number } {
    return {
      target: this.target.clone(),
      distance: this.distance,
      yaw: this.yaw,
      pitch: this.pitch,
    };
  }

  /**
   * Desplaza el objetivo relativo a la orientación azimutal horizontal actual.
   */
  public panRelative(deltaRight: number, deltaForward: number): void {
    const sinYaw = Math.sin(this.currentYaw);
    const cosYaw = Math.cos(this.currentYaw);

    this._forward.set(-sinYaw, 0, -cosYaw).normalize();
    this._right.set(cosYaw, 0, -sinYaw).normalize();

    this.target.addScaledVector(this._right, deltaRight);
    this.target.addScaledVector(this._forward, deltaForward);
    this.clampTargetToBounds();
  }

  /**
   * Actualización cinemática por fotograma.
   * @param dt Segundos transcurridos
   */
  public update(dt: number): void {
    // 1. Teclado: WASD / Flechas para pan; Q/E para rotar; R/F para cabeceo
    this._moveDir.set(0, 0, 0);

    if (this.keysPressed['KeyW'] || this.keysPressed['ArrowUp']) this._moveDir.z += 1;
    if (this.keysPressed['KeyS'] || this.keysPressed['ArrowDown']) this._moveDir.z -= 1;
    if (this.keysPressed['KeyD'] || this.keysPressed['ArrowRight']) this._moveDir.x += 1;
    if (this.keysPressed['KeyA'] || this.keysPressed['ArrowLeft']) this._moveDir.x -= 1;

    // Rotación yaw con teclado Q / E (si no está bloqueado por herramientas de elevación)
    if (this.enableQERotation) {
      if (this.keysPressed['KeyQ']) this.yaw += 1.8 * dt;
      if (this.keysPressed['KeyE']) this.yaw -= 1.8 * dt;
    }

    // Inclinación pitch con teclado R / F
    if (this.keysPressed['KeyR']) this.pitch = clamp(this.pitch - 1.2 * dt, this.minPitch, this.maxPitch);
    if (this.keysPressed['KeyF']) this.pitch = clamp(this.pitch + 1.2 * dt, this.minPitch, this.maxPitch);

    if (this._moveDir.lengthSq() > 0) {
      this._moveDir.normalize();
      const moveDistance = this.panSpeed * this.currentDistance * dt;
      this.panRelative(this._moveDir.x * moveDistance, this._moveDir.z * moveDistance);
    }

    // 2. Restringir objetivo elásticamente a los límites configurados
    this.clampTargetToBounds();

    // 3. Amortiguación suave exponencial independiente de FPS
    this.currentTarget.x = damp(this.currentTarget.x, this.target.x, this.smoothing, dt);
    this.currentTarget.y = damp(this.currentTarget.y, this.target.y, this.smoothing, dt);
    this.currentTarget.z = damp(this.currentTarget.z, this.target.z, this.smoothing, dt);

    this.currentDistance = damp(this.currentDistance, this.distance, this.smoothing, dt);
    this.currentYaw = dampAngle(this.currentYaw, this.yaw, this.smoothing, dt);
    this.currentPitch = damp(this.currentPitch, this.pitch, this.smoothing, dt);

    // 3. Aplicar transformación final a la cámara
    this.updateCameraTransform(false);
  }

  private updateCameraTransform(force: boolean = false): void {
    const sinPitch = Math.sin(this.currentPitch);
    const cosPitch = Math.cos(this.currentPitch);
    const sinYaw = Math.sin(this.currentYaw);
    const cosYaw = Math.cos(this.currentYaw);

    const horizontalRadius = this.currentDistance * sinPitch;
    const posY = this.currentTarget.y + this.currentDistance * cosPitch;

    // Evitar que la cámara descienda por debajo de la altura mínima
    const safePosY = Math.max(this.minHeightAboveGround, posY);

    this._camPos.set(
      this.currentTarget.x + horizontalRadius * sinYaw,
      safePosY,
      this.currentTarget.z + horizontalRadius * cosYaw
    );

    this.camera.position.copy(this._camPos);
    this.camera.lookAt(this.currentTarget);
    if (force) {
      this.camera.updateMatrixWorld();
    }
  }
}
