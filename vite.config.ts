import type { Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig } from 'vite';

/** Files in public/ that are not needed to play, so are not cached offline. */
const NOT_PRECACHED = new Set(['og.jpg']);

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

/**
 * Writes sw.js from pwa/service-worker.js, filling in the exact list of files
 * this build produced. The version is a hash of their names and contents, so
 * any change to the build retires the old offline cache, and nothing else does.
 */
function serviceWorker(): Plugin {
  return {
    name: 'dodge-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const hash = createHash('sha256');
      const built: string[] = [];
      for (const [fileName, output] of Object.entries(bundle)) {
        if (fileName.endsWith('.map')) continue;
        hash.update(fileName);
        hash.update(output.type === 'chunk' ? output.code : output.source);
        if (fileName !== 'index.html') built.push(fileName);
      }

      const fromPublic = listFiles('public')
        .map((path) => relative('public', path).split('\\').join('/'))
        .filter((file) => !NOT_PRECACHED.has(file))
        .sort();
      for (const file of fromPublic) hash.update(readFileSync(join('public', file)));

      const precache = ['./', ...built.sort(), ...fromPublic];
      const template = readFileSync('pwa/service-worker.js', 'utf8');
      if (!template.includes('[/* filled in by the build */]')) {
        this.error('pwa/service-worker.js has lost its precache placeholder');
      }
      // A change to the worker's own rules starts a fresh cache as well.
      hash.update(template);
      const source = template
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('[/* filled in by the build */]', JSON.stringify(precache, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// Relative base so the same build works from a local `preview`, from a GitHub
// Pages *project* site (/Dodge-Asteroid/), or from any other sub-path, without
// having to bake the repository name into the bundle.
export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
});
