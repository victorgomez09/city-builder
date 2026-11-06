import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraController } from '@render/camera/camera_controller';

describe('CameraController (Bounds & Navigation Limits)', () => {
  it('debe restringir el objetivo de la cámara (target) dentro de los límites con margen suave', () => {
    // Entorno de prueba DOM mock
    const domElement = {
      addEventListener: () => {},
      removeEventListener: () => {},
      style: {},
      ownerDocument: {
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    } as unknown as HTMLElement;

    const camera = new THREE.PerspectiveCamera(45, 1.0, 0.1, 1000);
    const controller = new CameraController(camera, domElement, {
      smoothing: 10,
    });

    // Definir límites de la macro-parcela
    controller.setBounds({
      minX: -128,
      maxX: 0,
      minZ: 0,
      maxZ: 128,
      margin: 40,
    });

    // Intentar mover el target muy lejos fuera de los límites (+500, +500)
    controller.target.set(500, 0, 500);

    // Ejecutar actualización
    controller.update(0.016);

    // El target deseado debe haber sido clampeado a maxX + margin = 0 + 40 = 40, maxZ + margin = 128 + 40 = 168
    expect(controller.target.x).toBeLessThanOrEqual(40.01);
    expect(controller.target.z).toBeLessThanOrEqual(168.01);

    // Intentar mover hacia el extremo negativo (-500, -500)
    controller.target.set(-500, 0, -500);
    controller.update(0.016);

    // Clampeado a minX - margin = -128 - 40 = -168, minZ - margin = 0 - 40 = -40
    expect(controller.target.x).toBeGreaterThanOrEqual(-168.01);
    expect(controller.target.z).toBeGreaterThanOrEqual(-40.01);

    controller.dispose();
  });

  it('debe permitir desplazar la vista sin límites cuando bounds es null', () => {
    const domElement = {
      addEventListener: () => {},
      removeEventListener: () => {},
      style: {},
      ownerDocument: {
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    } as unknown as HTMLElement;

    const camera = new THREE.PerspectiveCamera(45, 1.0, 0.1, 1000);
    const controller = new CameraController(camera, domElement);
    controller.setBounds(null);

    controller.target.set(2000, 10, 2000);
    controller.update(0.016);

    expect(controller.target.x).toBe(2000);
    expect(controller.target.z).toBe(2000);

    controller.dispose();
  });
});
