/**
 * ProtestRenderer — renders instanced crowds of citizen picketers, banners,
 * and demonstrators at active protest sites.
 *
 * Rules:
 * - [R-render-001] Every repeated placeable is drawn through InstancedMesh buckets.
 * - [R-render-005] No custom shaders; stock materials only.
 * - [R-render-006] No imported textures or GLTF assets; pure procedural geometry.
 * - Deterministic: all transforms and tints derive from stable protest ids and offsets;
 *   never Math.random or Date.now.
 */
import * as THREE from 'three';
import type { ActiveProtest } from '../shared/types';
import { tileToWorld } from '../shared/constants';
import { setInstanceCount } from './groundquad';

const MAX_PROTEST_CROWD = 128;
const PROTESTERS_PER_SITE = 16;

function hash(n: number): number {
  let h = n >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const CLOTHING_PALETTE = [
  new THREE.Color(0x2d5a88), // navy
  new THREE.Color(0x3a6042), // forest
  new THREE.Color(0x8a3e35), // crimson
  new THREE.Color(0x4a4a52), // slate
  new THREE.Color(0xd48834), // ochre
  new THREE.Color(0x75527a), // plum
];

export class ProtestRenderer {
  readonly group = new THREE.Group();

  private readonly bodyMesh: THREE.InstancedMesh;
  private readonly headMesh: THREE.InstancedMesh;
  private readonly signMesh: THREE.InstancedMesh;
  private readonly poleMesh: THREE.InstancedMesh;

  private readonly tempMatrix = new THREE.Matrix4();
  private readonly tempPos = new THREE.Vector3();
  private readonly tempQuat = new THREE.Quaternion();
  private readonly tempScale = new THREE.Vector3(1, 1, 1);
  private readonly tempColor = new THREE.Color();

  constructor() {
    this.group.name = 'civic-protests';

    // 1. Human Body Geometry & Material
    const bodyGeo = new THREE.CapsuleGeometry(0.2, 0.9, 4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.1,
    });
    this.bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, MAX_PROTEST_CROWD);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = false;

    // 2. Human Head Geometry & Material
    const headGeo = new THREE.SphereGeometry(0.18, 6, 6);
    const headMat = new THREE.MeshStandardMaterial({
      roughness: 0.7,
      metalness: 0.0,
      color: 0xdeb887,
    });
    this.headMesh = new THREE.InstancedMesh(headGeo, headMat, MAX_PROTEST_CROWD);
    this.headMesh.castShadow = true;
    this.headMesh.receiveShadow = false;

    // 3. Protest Placard / Signboard Geometry & Material
    const signGeo = new THREE.BoxGeometry(0.65, 0.42, 0.03);
    const signMat = new THREE.MeshStandardMaterial({
      roughness: 0.6,
      metalness: 0.05,
    });
    this.signMesh = new THREE.InstancedMesh(signGeo, signMat, MAX_PROTEST_CROWD);
    this.signMesh.castShadow = true;

    // 4. Placard Wooden Pole
    const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.3, 4);
    const poleMat = new THREE.MeshStandardMaterial({
      roughness: 0.9,
      metalness: 0.05,
      color: 0x8b5a2b,
    });
    this.poleMesh = new THREE.InstancedMesh(poleGeo, poleMat, MAX_PROTEST_CROWD);
    this.poleMesh.castShadow = true;

    this.group.add(this.bodyMesh, this.headMesh, this.signMesh, this.poleMesh);

    // Initial zero state
    setInstanceCount(this.bodyMesh, 0);
    setInstanceCount(this.headMesh, 0);
    setInstanceCount(this.signMesh, 0);
    setInstanceCount(this.poleMesh, 0);
  }

  /**
   * Updates instanced crowd placement and placard dressing from active protests.
   */
  update(
    protests: readonly ActiveProtest[],
    getElevation: (x: number, z: number) => number = () => 0,
  ): void {
    if (protests.length === 0) {
      setInstanceCount(this.bodyMesh, 0);
      setInstanceCount(this.headMesh, 0);
      setInstanceCount(this.signMesh, 0);
      setInstanceCount(this.poleMesh, 0);
      return;
    }

    let personIndex = 0;
    let signIndex = 0;

    for (const protest of protests) {
      const centerX = tileToWorld(protest.x);
      const centerZ = tileToWorld(protest.z);
      const siteElevation = getElevation(protest.x, protest.z);

      const count = Math.min(
        PROTESTERS_PER_SITE,
        MAX_PROTEST_CROWD - personIndex,
      );

      for (let i = 0; i < count; i++) {
        const seed = protest.id * 100 + i;
        const h1 = hash(seed);
        const h2 = hash(seed + 1);
        const h3 = hash(seed + 2);

        // Circular cluster scattering around the demonstration site
        const angle = (i / count) * Math.PI * 2 + (h1 - 0.5) * 0.4;
        const radius = 1.2 + h2 * 2.8; // 1.2m to 4.0m radius

        const px = centerX + Math.cos(angle) * radius;
        const pz = centerZ + Math.sin(angle) * radius;
        const py = siteElevation;

        // Facing towards street center with slight jitter
        const facingAngle = Math.atan2(centerX - px, centerZ - pz) + (h3 - 0.5) * 0.6;
        this.tempQuat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, facingAngle);

        // A. Set Body Matrix & Color
        this.tempPos.set(px, py + 0.65, pz);
        this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
        this.bodyMesh.setMatrixAt(personIndex, this.tempMatrix);

        const colorIndex = Math.floor(h1 * CLOTHING_PALETTE.length);
        this.bodyMesh.setColorAt(personIndex, CLOTHING_PALETTE[colorIndex]!);

        // B. Set Head Matrix
        this.tempPos.set(px, py + 1.25, pz);
        this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
        this.headMesh.setMatrixAt(personIndex, this.tempMatrix);

        // C. Every second demonstrator carries an elevated protest placard
        if (i % 2 === 0 && signIndex < MAX_PROTEST_CROWD) {
          // Placard pole
          const polePos = new THREE.Vector3(
            px + Math.sin(facingAngle) * 0.2,
            py + 1.2,
            pz + Math.cos(facingAngle) * 0.2,
          );
          this.tempMatrix.compose(polePos, this.tempQuat, this.tempScale);
          this.poleMesh.setMatrixAt(signIndex, this.tempMatrix);

          // Placard board (raised atop the pole at ~1.85m)
          const signPos = new THREE.Vector3(
            px + Math.sin(facingAngle) * 0.2,
            py + 1.85,
            pz + Math.cos(facingAngle) * 0.2,
          );
          this.tempMatrix.compose(signPos, this.tempQuat, this.tempScale);
          this.signMesh.setMatrixAt(signIndex, this.tempMatrix);

          // Placard color by grievance kind
          if (protest.kind === 'tax') {
            this.tempColor.setHex(h3 > 0.5 ? 0xe5533f : 0xff7a45); // Alert red/orange
          } else if (protest.kind === 'unemployment') {
            this.tempColor.setHex(h3 > 0.5 ? 0xffbe53 : 0xf2a900); // Yellow/gold
          } else {
            this.tempColor.setHex(0xf5f5f5); // White placard
          }
          this.signMesh.setColorAt(signIndex, this.tempColor);

          signIndex++;
        }

        personIndex++;
      }
    }

    setInstanceCount(this.bodyMesh, personIndex);
    setInstanceCount(this.headMesh, personIndex);
    setInstanceCount(this.signMesh, signIndex);
    setInstanceCount(this.poleMesh, signIndex);

    this.bodyMesh.instanceMatrix.needsUpdate = true;
    if (this.bodyMesh.instanceColor) this.bodyMesh.instanceColor.needsUpdate = true;
    this.headMesh.instanceMatrix.needsUpdate = true;
    this.poleMesh.instanceMatrix.needsUpdate = true;
    this.signMesh.instanceMatrix.needsUpdate = true;
    if (this.signMesh.instanceColor) this.signMesh.instanceColor.needsUpdate = true;
  }
}
