import type { Vec2 } from '../core/types.js';
import { INPUT, WORLD } from '../config.js';
import { normalizeAxis } from '../game/movement.js';
import { screenToWorld } from '../core/viewport.js';

export type InputMode = 'pointer' | 'touch' | 'keyboard';
export type Action = 'pause' | 'confirm' | 'restart' | 'mute';

export interface InputSnapshot {
  /** Pointer target in world coordinates, or `null` while steering by key. */
  readonly target: Vec2 | null;
  /** Keyboard axis, magnitude at most 1. */
  readonly axis: Vec2;
  readonly mode: InputMode;
  readonly justPressed: ReadonlySet<Action>;
}

const KEY_ACTIONS: Readonly<Record<string, Action>> = {
  Escape: 'pause',
  KeyP: 'pause',
  Enter: 'confirm',
  Space: 'confirm',
  KeyR: 'restart',
  KeyM: 'mute',
};

const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA']);
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD']);
const UP_KEYS = new Set(['ArrowUp', 'KeyW']);
const DOWN_KEYS = new Set(['ArrowDown', 'KeyS']);

/**
 * Unifies mouse, touch and keyboard into one snapshot per frame.
 *
 * The original bound only `mousemove`, so the game could not be played on a
 * phone at all despite shipping a mobile stylesheet.
 */
export class InputManager {
  private target: Vec2 | null = null;
  private mode: InputMode = 'pointer';
  private readonly held = new Set<string>();
  private readonly pressed = new Set<Action>();
  private attached = false;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.canvas.addEventListener('pointermove', this.onPointerMove, { passive: true });
    this.canvas.addEventListener('pointerdown', this.onPointerMove, { passive: true });
    this.canvas.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  snapshot(): InputSnapshot {
    let x = 0;
    let y = 0;
    if (this.anyHeld(LEFT_KEYS)) x -= 1;
    if (this.anyHeld(RIGHT_KEYS)) x += 1;
    if (this.anyHeld(UP_KEYS)) y -= 1;
    if (this.anyHeld(DOWN_KEYS)) y += 1;

    const axis = normalizeAxis(x, y);
    const steeringByKey = x !== 0 || y !== 0;

    return {
      target: steeringByKey ? null : this.target,
      axis,
      mode: steeringByKey ? 'keyboard' : this.mode,
      justPressed: this.pressed,
    };
  }

  /** Clears the just-pressed edge set. Call once per frame after reading. */
  endFrame(): void {
    this.pressed.clear();
  }

  /** Forgets the pointer target, so a new run does not inherit the old one. */
  clearTarget(): void {
    this.target = null;
  }

  private anyHeld(keys: ReadonlySet<string>): boolean {
    for (const key of keys) if (this.held.has(key)) return true;
    return false;
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const isTouch = event.pointerType === 'touch';

    // A fingertip physically covers the ship, so touches steer a point above it.
    const offsetY = isTouch ? INPUT.touchYOffset : 0;
    const point = screenToWorld(
      event.clientX,
      event.clientY - offsetY,
      rect,
      WORLD.width,
      WORLD.height,
    );

    this.target = point;
    this.mode = isTouch ? 'touch' : 'pointer';
  };

  private readonly onPointerLeave = (event: PointerEvent): void => {
    // A mouse leaving the canvas should stop steering. A finger lifting should
    // not: touch pointers cease to exist on release, so clearing here would
    // mean a tap barely moved the ship and only a held drag ever worked.
    if (event.pointerType === 'touch') return;
    this.target = null;
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;

    const action = KEY_ACTIONS[event.code];
    if (action !== undefined) {
      this.pressed.add(action);
      // Space and the arrows scroll the page otherwise.
      event.preventDefault();
    }

    if (isDirectionKey(event.code)) {
      this.held.add(event.code);
      this.mode = 'keyboard';
      event.preventDefault();
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.held.clear();
  };
}

function isDirectionKey(code: string): boolean {
  return LEFT_KEYS.has(code) || RIGHT_KEYS.has(code) || UP_KEYS.has(code) || DOWN_KEYS.has(code);
}
