import * as THREE from 'three';

/**
 * Cursor visual en forma de casilla 3D proyectado sobre la cuadrícula del mundo.
 * Realiza raycasting contra el plano o geometría del terreno sin alocar objetos en cada frame.
 */
export class GridCursor {
  public mesh: THREE.Mesh;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouseVec: THREE.Vector2 = new THREE.Vector2();
  private groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private intersectionPoint: THREE.Vector3 = new THREE.Vector3();

  public currentGridX: number = 0;
  public currentGridZ: number = 0;
  public isVisible: boolean = false;

  private cellSize: number;

  constructor(cellSize: number = 2.0) {
    this.cellSize = cellSize;

    // Crear un indicador de celda resaltado (marco low-poly)
    const geometry = new THREE.BoxGeometry(cellSize * 0.95, 0.1, cellSize * 0.95);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(0, 0.05, 0);
    this.mesh.visible = false;
  }

  /**
   * Actualiza la posición del cursor a partir de las coordenadas del ratón en la ventana.
   */
  public updateFromMouse(
    eventClientX: number,
    eventClientY: number,
    camera: THREE.Camera,
    windowWidth: number,
    windowHeight: number
  ): void {
    this.mouseVec.x = (eventClientX / windowWidth) * 2 - 1;
    this.mouseVec.y = -(eventClientY / windowHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseVec, camera);

    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.intersectionPoint);
    if (hit) {
      // Cuantizar a la cuadrícula
      const gx = Math.floor((this.intersectionPoint.x + this.cellSize / 2) / this.cellSize);
      const gz = Math.floor((this.intersectionPoint.z + this.cellSize / 2) / this.cellSize);

      this.currentGridX = gx;
      this.currentGridZ = gz;

      this.mesh.position.set(gx * this.cellSize, 0.05, gz * this.cellSize);
      this.mesh.visible = true;
      this.isVisible = true;
    } else {
      this.mesh.visible = false;
      this.isVisible = false;
    }
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
