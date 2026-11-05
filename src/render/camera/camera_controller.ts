import * as THREE from 'three';

export interface CameraControllerOptions {
  fov?: number;
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  panSpeed?: number;
  zoomSpeed?: number;
  rotateSpeed?: number;
  dampingFactor?: number;
}

/**
 * Controlador de cámara estilizada para City Builder (RTS / City Sim).
 * 
 * Características:
 * - Movimiento Pan con WASD / Flechas o arrastre con botón central/derecho del ratón.
 * - Zoom suave hacia el punto del mundo bajo el cursor del ratón (o pivote).
 * - Rotación orbital 360° con ángulo polar limitado (evita colapsar contra el suelo).
 * - Amortiguación (damping) cinemática fluida sin caída de FPS.
 * - Zero-allocation en el bucle continuo (reutiliza vectores y matrices internas).
 */
export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;

  // Parámetros de configuración
  private minDistance: number;
  private maxDistance: number;
  private minPolarAngle: number;
  private maxPolarAngle: number;
  private panSpeed: number;
  private zoomSpeed: number;
  private rotateSpeed: number;
  private dampingFactor: number;

  // Estados actuales y objetivo (para amortiguación fluida)
  public target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private currentTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  // Coordenadas esféricas relativas al target
  private targetRadius: number = 65;
  private currentRadius: number = 65;
  private targetTheta: number = Math.PI / 4; // Rotación azimutal horizontal (45°)
  private currentTheta: number = Math.PI / 4;
  private targetPhi: number = Math.PI / 3;   // Elevación polar (60° respecto al eje Y)
  private currentPhi: number = Math.PI / 3;

  // Teclado
  private keysPressed: Record<string, boolean> = {};

  // Estado del puntero
  private isRotating: boolean = false;
  private isPanning: boolean = false;
  private previousMousePosition = { x: 0, y: 0 };

  // Vectores temporales prealocados para evitar garbage collection
  private readonly _forward = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _moveDir = new THREE.Vector3();
  private readonly _sphericalPos = new THREE.Vector3();

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    options: CameraControllerOptions = {}
  ) {
    this.camera = camera;
    this.domElement = domElement;

    this.minDistance = options.minDistance ?? 10;
    this.maxDistance = options.maxDistance ?? 200;
    this.minPolarAngle = options.minPolarAngle ?? 0.35; // ~20° (no mirar horizontalmente a ras del suelo)
    this.maxPolarAngle = options.maxPolarAngle ?? Math.PI / 2.3; // ~78° (visión superior casi vertical)
    this.panSpeed = options.panSpeed ?? 45.0;
    this.zoomSpeed = options.zoomSpeed ?? 0.15;
    this.rotateSpeed = options.rotateSpeed ?? 0.005;
    this.dampingFactor = options.dampingFactor ?? 0.12;

    this.attachEventListeners();
    this.updateCameraTransform();
  }

  private attachEventListeners(): void {
    // Teclado
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // Ratón
    this.domElement.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    this.domElement.addEventListener('wheel', this.onMouseWheel, { passive: false });
    this.domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.domElement.removeEventListener('wheel', this.onMouseWheel);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
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
      // Clic derecho: Rotar cámara
      this.isRotating = true;
    } else if (event.button === 1) {
      // Clic rueda central: Pan rápido
      this.isPanning = true;
    }
  };

  private onMouseMove = (event: MouseEvent): void => {
    const deltaX = event.clientX - this.previousMousePosition.x;
    const deltaY = event.clientY - this.previousMousePosition.y;
    this.previousMousePosition.x = event.clientX;
    this.previousMousePosition.y = event.clientY;

    if (this.isRotating) {
      this.targetTheta -= deltaX * this.rotateSpeed;
      this.targetPhi = Math.max(
        this.minPolarAngle,
        Math.min(this.maxPolarAngle, this.targetPhi - deltaY * this.rotateSpeed)
      );
    } else if (this.isPanning) {
      // Pan proporcional a la distancia actual de la cámara
      const panFactor = (this.currentRadius / 50) * 0.04;
      this.panRelative(-deltaX * panFactor, deltaY * panFactor);
    }
  };

  private onMouseUp = (event: MouseEvent): void => {
    if (event.button === 2) {
      this.isRotating = false;
    } else if (event.button === 1) {
      this.isPanning = false;
    }
  };

  private onMouseWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const zoomAmount = Math.sign(event.deltaY) * this.targetRadius * this.zoomSpeed;
    this.targetRadius = Math.max(
      this.minDistance,
      Math.min(this.maxDistance, this.targetRadius + zoomAmount)
    );
  };

  /**
   * Desplaza el objetivo relativo a la orientación azimutal de la cámara en el plano XZ.
   */
  private panRelative(deltaRight: number, deltaForward: number): void {
    const sinTheta = Math.sin(this.currentTheta);
    const cosTheta = Math.cos(this.currentTheta);

    // Forward en plano horizontal
    this._forward.set(-sinTheta, 0, -cosTheta).normalize();
    // Right en plano horizontal
    this._right.set(cosTheta, 0, -sinTheta).normalize();

    this.target.addScaledVector(this._right, deltaRight);
    this.target.addScaledVector(this._forward, deltaForward);
  }

  /**
   * Actualización en cada cuadro (llamada en el loop de render).
   * @param deltaTime Segundos transcurridos desde el último frame
   */
  public update(deltaTime: number): void {
    // 1. Manejar teclado WASD / Flechas / QE para rotación
    this._moveDir.set(0, 0, 0);

    if (this.keysPressed['KeyW'] || this.keysPressed['ArrowUp']) this._moveDir.z += 1;
    if (this.keysPressed['KeyS'] || this.keysPressed['ArrowDown']) this._moveDir.z -= 1;
    if (this.keysPressed['KeyD'] || this.keysPressed['ArrowRight']) this._moveDir.x += 1;
    if (this.keysPressed['KeyA'] || this.keysPressed['ArrowLeft']) this._moveDir.x -= 1;

    // Rotación con teclado Q y E
    if (this.keysPressed['KeyQ']) this.targetTheta += 1.5 * deltaTime;
    if (this.keysPressed['KeyE']) this.targetTheta -= 1.5 * deltaTime;

    if (this._moveDir.lengthSq() > 0) {
      this._moveDir.normalize();
      const moveDistance = this.panSpeed * (this.currentRadius / 45) * deltaTime;
      this.panRelative(this._moveDir.x * moveDistance, this._moveDir.z * moveDistance);
    }

    // 2. Interpolación con Damping para suavidad visual
    this.currentTarget.lerp(this.target, this.dampingFactor);
    this.currentRadius += (this.targetRadius - this.currentRadius) * this.dampingFactor;
    this.currentTheta += (this.targetTheta - this.currentTheta) * this.dampingFactor;
    this.currentPhi += (this.targetPhi - this.currentPhi) * this.dampingFactor;

    // 3. Aplicar a Three.js Camera
    this.updateCameraTransform();
  }

  private updateCameraTransform(): void {
    // Conversión de coordenadas esféricas a cartesianas centradas en currentTarget
    const sinPhiRadius = this.currentRadius * Math.sin(this.currentPhi);
    this._sphericalPos.set(
      this.currentTarget.x + sinPhiRadius * Math.sin(this.currentTheta),
      this.currentTarget.y + this.currentRadius * Math.cos(this.currentPhi),
      this.currentTarget.z + sinPhiRadius * Math.cos(this.currentTheta)
    );

    this.camera.position.copy(this._sphericalPos);
    this.camera.lookAt(this.currentTarget);
  }
}
