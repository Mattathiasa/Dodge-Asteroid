export {};

declare global {
  interface Window {
    __dodge?: {
      snapshot(): {
        phase: string;
        mode: string;
        ghost: boolean;
        score: number;
        elapsed: number;
        lives: number;
        ship: { x: number; y: number };
        asteroids: number;
        seed: number;
        sector: number;
        shards: number;
        nearMisses: number;
      };
      verifyBest(): { stored: number; replayed: number } | null;
    };
  }
}
