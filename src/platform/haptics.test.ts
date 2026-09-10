import { describe, expect, it, vi } from 'vitest';
import { createHaptics } from './haptics.js';

describe('createHaptics', () => {
  it('reports unsupported and stays silent with no platform implementation', () => {
    const haptics = createHaptics(undefined);
    // Node has a `navigator` but no `vibrate`, so this is the real fallback.
    expect(haptics.supported).toBe(false);
    expect(() => haptics.play('destroyed')).not.toThrow();
  });

  it('dispatches a distinct pattern per event', () => {
    const vibrate = vi.fn((_pattern: number | number[]) => true);
    const haptics = createHaptics(vibrate);

    haptics.play('pickup');
    haptics.play('destroyed');

    expect(vibrate).toHaveBeenCalledTimes(2);
    const patterns = vibrate.mock.calls.map((call) => JSON.stringify(call[0]));
    expect(new Set(patterns).size).toBe(2);
  });

  it('stays silent while disabled, and cancels anything in flight', () => {
    const vibrate = vi.fn((_pattern: number | number[]) => true);
    const haptics = createHaptics(vibrate);

    haptics.enabled = false;
    expect(vibrate).toHaveBeenCalledWith(0); // cancel on switch-off

    vibrate.mockClear();
    haptics.play('lifeLost');
    expect(vibrate).not.toHaveBeenCalled();

    haptics.enabled = true;
    haptics.play('lifeLost');
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('never lets a throwing platform take the game down', () => {
    const haptics = createHaptics(() => {
      throw new Error('not allowed while hidden');
    });
    expect(() => haptics.play('shieldBreak')).not.toThrow();
  });
});
