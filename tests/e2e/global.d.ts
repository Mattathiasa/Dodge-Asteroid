export {};

declare global {
  interface Window {
    __dodge?: {
      snapshot(): {
        phase: string;
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
    };
  }
}
