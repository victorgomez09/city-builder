/**
 * Construction staging: tower cranes and scaffolding curtains on actively
 * building sites (BuildingState.Constructing).
 *
 * Silhouettes and site identity: a constructing building is an active urban
 * work site — multi-storey buildings get an instanced yellow tower crane
 * looming over the roof slab with its jib swept across the deck, while the
 * perimeter of the rising structure is shrouded in safety netting/scaffolding.
 * Houses and single-storey buildings carry scaffolding curtains.
 *
 * When construction finishes (BuildingState.Active), the crane and scaffolding
 * are freed immediately (O(1) slot pool return), revealing the finished building.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { uniform } from 'three/tsl';
import {
  BuildingCatalogEntry,
  BuildingDelta,
  BuildingInstance,
  BuildingState,
} from '../shared/types';
import { TILE_METERS } from '../shared/constants';
import { footprintForRotation } from '../shared/footprint';
import { maxHeightUnderBody } from './footprint';
import {
  computeSetbacks,
  frontageSetbackFor,
  InstancedSlotPool,
  type FrontageSetback,
  type SetbackBox,
} from './massing';
import { nightBodyMaterial } from './nightlook';
import { NO_STREETS } from './frontage';
import { framedBodyPlacement } from './houselot';
import type { KerbSurroundings } from '../shared/kerblayout';
import type { KerbCreditOf } from './lotplan';
import { isFarmEntry, isHouseEntry } from './archetypes';

// ---------------------------------------------------------------------------
// Metrics & Colors
// ---------------------------------------------------------------------------

export const CRANE_MAST_WIDTH_M = 1.2;
export const CRANE_JIB_LENGTH_M = 16.0;
export const CRANE_COUNTER_JIB_LENGTH_M = 5.0;
export const CRANE_APEX_HEIGHT_M = 3.5;
export const CRANE_CLEARANCE_ABOVE_ROOF_M = 6.0;
export const MIN_CRANE_HEIGHT_M = 14.0;

/** Vibrant construction yellow/safety orange. */
export const CRANE_COLOR_HEX = 0xf59e0b;
/** Counterweight concrete tone. */
export const CRANE_COUNTERWEIGHT_HEX = 0x78716c;
/** Emerald green construction safety net. */
export const SCAFFOLD_NET_COLOR_HEX = 0x1b4931;
/** Red aviation beacon. */
export const WARNING_LIGHT_COLOR = 0xff2222;
export const WARNING_LIGHT_RADIUS_M = 0.25;

const INITIAL_CAPACITY = 16;

// ---------------------------------------------------------------------------
// Geometries (pure, unrotated, base-anchored)
// ---------------------------------------------------------------------------

/** Unit vertical mast column: 1.0 x 1.0 x 1.0 m, base at y=0. */
function buildCraneMastGeometry(): THREE.BufferGeometry {
  const geom = new THREE.BoxGeometry(1, 1, 1);
  geom.translate(0, 0.5, 0);
  return geom;
}

/** Tower crane top assembly: turntable, cabin, apex, main jib, counter-jib, ballast and hook. */
function buildCraneJibGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Turntable platform at y = 0..0.4
  const turntable = new THREE.BoxGeometry(1.4, 0.4, 1.4);
  turntable.translate(0, 0.2, 0);
  parts.push(turntable);

  // Operator cabin beside turntable
  const cabin = new THREE.BoxGeometry(1.2, 1.5, 1.2);
  cabin.translate(0.7, 1.15, 0.4);
  parts.push(cabin);

  // Tower apex pyramid / spire rising above the turntable
  const apex = new THREE.BoxGeometry(0.7, CRANE_APEX_HEIGHT_M, 0.7);
  apex.translate(0, 0.4 + CRANE_APEX_HEIGHT_M / 2, 0);
  parts.push(apex);

  // Main horizontal jib boom extending forward along +X
  const jib = new THREE.BoxGeometry(CRANE_JIB_LENGTH_M, 0.6, 0.6);
  jib.translate(CRANE_JIB_LENGTH_M / 2, 0.7, 0);
  parts.push(jib);

  // Counter-jib boom extending backward along -X
  const counterJib = new THREE.BoxGeometry(CRANE_COUNTER_JIB_LENGTH_M, 0.6, 0.6);
  counterJib.translate(-CRANE_COUNTER_JIB_LENGTH_M / 2, 0.7, 0);
  parts.push(counterJib);

  // Concrete counterweight ballast blocks on counter-jib
  const ballast = new THREE.BoxGeometry(1.4, 1.2, 1.0);
  ballast.translate(-CRANE_COUNTER_JIB_LENGTH_M + 1.0, 0.3, 0);
  parts.push(ballast);

  // Hoist trolley & vertical cable hanging down over the site
  const trolley = new THREE.BoxGeometry(0.6, 0.3, 0.6);
  trolley.translate(9.0, 0.25, 0);
  parts.push(trolley);

  const cable = new THREE.CylinderGeometry(0.03, 0.03, 3.0, 6);
  cable.translate(9.0, -1.2, 0);
  parts.push(cable);

  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('buildCraneJibGeometry: mergeGeometries failed');
  return merged;
}

/** Unit scaffolding box: 1.0 x 1.0 x 1.0 m, base at y=0. */
function buildScaffoldGeometry(): THREE.BufferGeometry {
  const geom = new THREE.BoxGeometry(1, 1, 1);
  geom.translate(0, 0.5, 0);
  return geom;
}

// ---------------------------------------------------------------------------
// ConstructionRenderer
// ---------------------------------------------------------------------------

interface ConstructionSlots {
  craneMast?: number;
  craneJib?: number;
  warningLight?: number;
  scaffold?: number;
}

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const _yAxis = new THREE.Vector3(0, 1, 0);

export class ConstructionRenderer {
  private readonly heightAt: (x: number, z: number) => number;
  private readonly catalogById: Map<string, BuildingCatalogEntry>;
  private readonly roadAt: (x: number, z: number) => boolean;
  private readonly kerb: KerbSurroundings | null;
  private readonly kerbCreditOf?: KerbCreditOf;

  private readonly nightFactorUniform = uniform(0);
  private readonly warningLightMaterial: THREE.MeshLambertMaterial;

  private readonly craneMastPool: InstancedSlotPool;
  private readonly craneJibPool: InstancedSlotPool;
  private readonly warningLightPool: InstancedSlotPool;
  private readonly scaffoldPool: InstancedSlotPool;

  private readonly buildingSlots = new Map<number, ConstructionSlots>();

  constructor(
    scene: THREE.Scene,
    heightAt: (x: number, z: number) => number,
    catalog: BuildingCatalogEntry[] | Map<string, BuildingCatalogEntry>,
    roadAt?: (x: number, z: number) => boolean,
    kerb: KerbSurroundings | null = null,
    kerbCreditOf?: KerbCreditOf,
  ) {
    this.heightAt = heightAt;
    this.catalogById =
      catalog instanceof Map ? catalog : new Map(catalog.map((entry) => [entry.id, entry]));
    this.roadAt = roadAt ?? ((): boolean => false);
    this.kerb = kerb;
    this.kerbCreditOf = kerbCreditOf;

    const craneMat = nightBodyMaterial(this.nightFactorUniform);
    const scaffoldMat = nightBodyMaterial(this.nightFactorUniform);

    this.warningLightMaterial = new THREE.MeshLambertMaterial({
      color: WARNING_LIGHT_COLOR,
      emissive: WARNING_LIGHT_COLOR,
      emissiveIntensity: 0,
    });

    this.craneMastPool = new InstancedSlotPool(
      scene,
      buildCraneMastGeometry(),
      craneMat,
      INITIAL_CAPACITY,
    );
    this.craneJibPool = new InstancedSlotPool(
      scene,
      buildCraneJibGeometry(),
      craneMat,
      INITIAL_CAPACITY,
    );
    this.scaffoldPool = new InstancedSlotPool(
      scene,
      buildScaffoldGeometry(),
      scaffoldMat,
      INITIAL_CAPACITY,
    );
    this.warningLightPool = new InstancedSlotPool(
      scene,
      new THREE.SphereGeometry(WARNING_LIGHT_RADIUS_M, 8, 6),
      this.warningLightMaterial,
      INITIAL_CAPACITY,
    );
  }

  setNightFactor(nightFactor: number): void {
    this.nightFactorUniform.value = Math.min(1, Math.max(0, nightFactor));
    this.warningLightMaterial.emissiveIntensity = nightFactor * 1.5;
  }

  apply(delta: BuildingDelta): void {
    for (const b of delta.added) this.updateBuilding(b);
    for (const b of delta.updated) this.updateBuilding(b);
    for (const id of delta.removed) this.freeBuilding(id);
  }

  private freeBuilding(id: number): void {
    const held = this.buildingSlots.get(id);
    if (!held) return;
    if (held.craneMast !== undefined) this.craneMastPool.free(held.craneMast);
    if (held.craneJib !== undefined) this.craneJibPool.free(held.craneJib);
    if (held.warningLight !== undefined) this.warningLightPool.free(held.warningLight);
    if (held.scaffold !== undefined) this.scaffoldPool.free(held.scaffold);
    this.buildingSlots.delete(id);
  }

  private updateBuilding(building: BuildingInstance): void {
    if (building.state !== BuildingState.Constructing) {
      this.freeBuilding(building.id);
      return;
    }

    const entry = this.catalogById.get(building.catalogId);
    if (!entry || isFarmEntry(entry)) {
      this.freeBuilding(building.id);
      return;
    }

    // Frontage and setback seat
    const frontage = frontageSetbackFor(
      entry,
      building.x,
      building.z,
      this.roadAt,
      NO_STREETS,
      building.rotation,
      this.kerb,
    );
    const { boxes } = computeSetbacks(entry, building.id, frontage);
    const baseBox = boxes[0]!;

    const seat = this.seatFor(entry, building, frontage, baseBox);
    const held: ConstructionSlots = {};

    // 1. Scaffolding curtain wrapping the active constructing footprint
    // Constructing height is currently ~0.25 to ~0.5 of final height
    const constructingHeight = Math.max(3.2, baseBox.h * 0.4);
    const scaffoldSlot = this.scaffoldPool.allocate();
    _position.set(seat.x, seat.groundY, seat.z);
    _quaternion.setFromAxisAngle(_yAxis, seat.yaw);
    _scale.set(baseBox.w + 0.6, constructingHeight, baseBox.d + 0.6);
    _matrix.compose(_position, _quaternion, _scale);
    this.scaffoldPool.setMatrixAt(scaffoldSlot, _matrix);
    _color.setHex(SCAFFOLD_NET_COLOR_HEX);
    this.scaffoldPool.setColorAt(scaffoldSlot, _color);
    held.scaffold = scaffoldSlot;

    // 2. Tower crane for multi-storey or urban commercial/industrial/civic buildings
    const needsCrane = !isHouseEntry(entry) || (entry.level ?? 1) >= 2 || entry.height >= 12;
    if (needsCrane) {
      // Place crane anchored just outside the rear-right corner of the lot
      const cosYaw = Math.cos(seat.yaw);
      const sinYaw = Math.sin(seat.yaw);
      const localOffX = baseBox.w / 2 + 1.2;
      const localOffZ = baseBox.d / 2 + 1.2;
      const craneX = seat.x + (localOffX * cosYaw + localOffZ * sinYaw);
      const craneZ = seat.z + (-localOffX * sinYaw + localOffZ * cosYaw);
      const craneGroundY = seat.groundY;

      const mastHeight = Math.max(
        MIN_CRANE_HEIGHT_M,
        constructingHeight + CRANE_CLEARANCE_ABOVE_ROOF_M,
      );

      // Crane Mast
      const mastSlot = this.craneMastPool.allocate();
      _position.set(craneX, craneGroundY, craneZ);
      _quaternion.setFromAxisAngle(_yAxis, seat.yaw);
      _scale.set(CRANE_MAST_WIDTH_M, mastHeight, CRANE_MAST_WIDTH_M);
      _matrix.compose(_position, _quaternion, _scale);
      this.craneMastPool.setMatrixAt(mastSlot, _matrix);
      _color.setHex(CRANE_COLOR_HEX);
      this.craneMastPool.setColorAt(mastSlot, _color);
      held.craneMast = mastSlot;

      // Crane Jib (rotates toward building center)
      const jibSlot = this.craneJibPool.allocate();
      const jibYaw = Math.atan2(seat.z - craneZ, seat.x - craneX);
      _position.set(craneX, craneGroundY + mastHeight, craneZ);
      _quaternion.setFromAxisAngle(_yAxis, jibYaw);
      _scale.set(1, 1, 1);
      _matrix.compose(_position, _quaternion, _scale);
      this.craneJibPool.setMatrixAt(jibSlot, _matrix);
      this.craneJibPool.setColorAt(jibSlot, _color);
      held.craneJib = jibSlot;

      // Crane Warning Beacon at the apex
      const lightSlot = this.warningLightPool.allocate();
      _position.set(craneX, craneGroundY + mastHeight + 0.4 + CRANE_APEX_HEIGHT_M, craneZ);
      _matrix.makeTranslation(_position.x, _position.y, _position.z);
      this.warningLightPool.setMatrixAt(lightSlot, _matrix);
      held.warningLight = lightSlot;
    }

    this.buildingSlots.set(building.id, held);
  }

  private seatFor(
    entry: BuildingCatalogEntry,
    building: BuildingInstance,
    frontage: FrontageSetback,
    baseBox: SetbackBox,
  ): { x: number; z: number; yaw: number; groundY: number } {
    if (building.frame) {
      const seat = framedBodyPlacement(building.frame, entry, NO_STREETS, this.kerbCreditOf);
      const groundY = maxHeightUnderBody(
        this.heightAt,
        seat.x,
        seat.z,
        seat.boundsW,
        seat.boundsD,
        0,
      );
      return { x: seat.x, z: seat.z, yaw: seat.yaw, groundY };
    }
    const lot = footprintForRotation(entry, building.rotation);
    const x = (building.x + lot.w / 2) * TILE_METERS + frontage.centerXM;
    const z = (building.z + lot.d / 2) * TILE_METERS + frontage.centerZM;
    const groundY = maxHeightUnderBody(
      this.heightAt,
      x,
      z,
      baseBox.w,
      baseBox.d,
      building.rotation,
    );
    return { x, z, yaw: building.rotation * (Math.PI / 2), groundY };
  }
}
