import { defineConfig } from 'vite';

// Relative base so the same build works from a local `preview`, from a GitHub
// Pages *project* site (/Dodge-Asteroid/), or from any other sub-path, without
// having to bake the repository name into the bundle.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
});
