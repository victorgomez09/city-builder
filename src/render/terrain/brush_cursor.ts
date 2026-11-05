import * as THREE from 'three';

/**
 * Indicador visual 3D de la brocha de terraformación.
 * Muestra un anillo/disco semitransparente sobre el terreno con el radio exacto de influencia.
 */
export class BrushCursor {
  public group: THREE.Group = new THREE.Group();
  private innerRing: THREE.Mesh;
  private outerRing: THREE.Line;
  private currentRadius: number = 6.0;

  constructor(radius: number = 6.0) {
    this.currentRadius = radius;

    // 1. Disco interior semitransparente
    const diskGeo = new THREE.CircleGeometry(radius, 32);
    diskGeo.rotateX(-Math.PI / 2);
    const diskMat = new THREE.MeshBasicMaterial({
      color: 0x4fc3f7,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.innerRing = new THREE.Mesh(diskGeo, diskMat);
    this.group.add(this.innerRing);

    // 2. Línea perimétrica brillante
    const lineGeo = new THREE.BufferGeometry();
    const segments = 64;
    const points: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(Math.cos(theta) * radius, 0.02, Math.sin(theta) * radius);
    }
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      linewidth: 2,
      transparent: true,
      opacity: 0.85,
    });
    this.outerRing = new THREE.Line(lineGeo, lineMat);
    this.group.add(this.outerRing);

    this.group.visible = false;
  }

  /**
   * Actualiza el radio de la brocha dinámicamente si el jugador lo cambia en la UI.
   */
  public setRadius(radius: number): void {
    if (radius === this.currentRadius || radius <= 0) return;
    this.currentRadius = radius;

    const scale = radius / (this.innerRing.geometry as THREE.CircleGeometry).parameters.radius;
    this.group.scale.set(scale, 1, scale);
  }

  /**
   * Cambia el color del cursor según la herramienta (ej. verde elevar, rojo hundir, amarillo suavizar).
   */
  public setColor(hex: number): void {
    (this.innerRing.material as THREE.MeshBasicMaterial).color.setHex(hex);
    (this.outerRing.material as THREE.LineBasicMaterial).color.setHex(hex);
  }

  public setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y + 0.05, z);
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public dispose(): void {
    this.innerRing.geometry.dispose();
    (this.innerRing.material as THREE.Material).dispose();
    this.outerRing.geometry.dispose();
    (this.outerRing.material as THREE.Material).dispose();
  }
}
