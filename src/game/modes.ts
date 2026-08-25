/** Difficulty presets. Each stretches or compresses the same ramp. */
export type DifficultyMode = 'easy' | 'normal' | 'hard';

export const DIFFICULTY_SCALES: Readonly<Record<DifficultyMode, number>> = {
  easy: 0.6,
  normal: 1,
  hard: 1.7,
};

export function isDifficultyMode(value: unknown): value is DifficultyMode {
  return value === 'easy' || value === 'normal' || value === 'hard';
}
