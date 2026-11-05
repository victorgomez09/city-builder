import * as THREE from 'three';

/**
 * Plantilla de Cuadrícula Flotante de Alta Visibilidad para Construcción:
 * - Se proyecta sobre el relieve del terreno sin quedar ocluida (depthTest: false / renderOrder: 99).
 * - Líneas nítidas blancas y cian brillantes con grosor visible.
 * - Resaltador de celda tipo blueprint translúcido.
 */
export class WorldGridHelper {
  public group: THREE.Group = new THREE.Group();
  private gridLines: THREE.LineSegments;
  private blockLines: THREE.LineSegments;
  private cellHighlightMesh: THREE.Mesh;

  private width: number;
  private height: number;
  private cellSize: number;

  constructor(width: number = 64, height: number = 64, cellSize: number = 2.0) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;

    const halfW = (width * cellSize) / 2;
    const halfH = (height * cellSize) / 2;

    const thinPoints: number[] = [];
    const thickPoints: number[] = [];

    for (let x = 0; x <= width; x++) {
      const px = x * cellSize - halfW;
      const isMajor = x % 4 === 0;

      if (isMajor) {
        thickPoints.push(px, 0.25, -halfH);
        thickPoints.push(px, 0.25, halfH);
      } else {
        thinPoints.push(px, 0.22, -halfH);
        thinPoints.push(px, 0.22, halfH);
      }
    }

    for (let z = 0; z <= height; z++) {
      const pz = z * cellSize - halfH;
      const isMajor = z % 4 === 0;

      if (isMajor) {
        thickPoints.push(-halfW, 0.25, pz);
        thickPoints.push(halfW, 0.25, pz);
      } else {
        thinPoints.push(-halfW, 0.22, pz);
        thinPoints.push(halfW, 0.22, pz);
      }
    }

    // 1. Líneas finas individuales (blanco bien visible con opacidad 0.5)
    const thinGeo = new THREE.BufferGeometry();
    thinGeo.setAttribute('position', new THREE.Float32BufferAttribute(thinPoints, 3));
    const thinMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      depthTest: true,
      depthWrite: false,
    });
    this.gridLines = new THREE.LineSegments(thinGeo, thinMat);
    this.gridLines.renderOrder = 10;
    this.group.add(this.gridLines);

    // 2. Líneas maestras de manzana cada 4 casillas (cian eléctrico)
    const thickGeo = new THREE.BufferGeometry();
    thickGeo.setAttribute('position', new THREE.Float32BufferAttribute(thickPoints, 3));
    const thickMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.85,
      depthTest: true,
      depthWrite: false,
    });
    this.blockLines = new THREE.LineSegments(thickGeo, thickMat);
    this.blockLines.renderOrder = 11;
    this.group.add(this.blockLines);

    // 3. Cuadro resaltador de celda con marco
    const highlightGeo = new THREE.PlaneGeometry(cellSize * 0.96, cellSize * 0.96);
    highlightGeo.rotateX(-Math.PI / 2);
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.cellHighlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
    this.cellHighlightMesh.renderOrder = 12;
    this.cellHighlightMesh.visible = false;
    this.group.add(this.cellHighlightMesh);

    this.group.visible = false;
  }

  public highlightCell(gx: number, gz: number, elevation: number = 0): void {
    if (gx < 0 || gx >= this.width || gz < 0 || gz >= this.height) {
      this.cellHighlightMesh.visible = false;
      return;
    }

    const halfW = (this.width * this.cellSize) / 2;
    const halfH = (this.height * this.cellSize) / 2;
    const cx = (gx + 0.5) * this.cellSize - halfW;
    const cz = (gz + 0.5) * this.cellSize - halfH;

    this.cellHighlightMesh.position.set(cx, elevation + 0.15, cz);
    this.cellHighlightMesh.visible = true;
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
    if (!visible) {
      this.cellHighlightMesh.visible = false;
    }
  }

  public dispose(): void {
    this.gridLines.geometry.dispose();
    (this.gridLines.material as THREE.Material).dispose();
    this.blockLines.geometry.dispose();
    (this.blockLines.material as THREE.Material).dispose();
    this.cellHighlightMesh.geometry.dispose();
    (this.cellHighlightMesh.material as THREE.Material).dispose();
  }
}
