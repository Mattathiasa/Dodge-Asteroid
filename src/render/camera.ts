import type { Rng } from '../core/types.js';
import { CAMERA } from '../config.js';

/**
 * Trauma-based screen shake.
 *
 * Offset scales with the square of trauma, so small events barely register
 * while a real impact is unmistakable — a linear response feels mushy.
 */
export interface Camera {
  trauma: number;
  shakeX: number;
  shakeY: number;
  enabled: boolean;
}

export function createCamera(): Camera {
  return { trauma: 0, shakeX: 0, shakeY: 0, enabled: true };
}

export function addTrauma(camera: Camera, amount: number): void {
  if (!camera.enabled) return;
  camera.trauma = Math.min(1, camera.trauma + amount);
}

export function updateCamera(camera: Camera, dt: number, rng: Rng): void {
  if (!camera.enabled) {
    camera.trauma = 0;
    camera.shakeX = 0;
    camera.shakeY = 0;
    return;
  }

  camera.trauma = Math.max(0, camera.trauma - CAMERA.traumaDecayPerSecond * dt);
  const magnitude = camera.trauma * camera.trauma * CAMERA.maxOffset;
  camera.shakeX = rng.range(-magnitude, magnitude);
  camera.shakeY = rng.range(-magnitude, magnitude);
}
