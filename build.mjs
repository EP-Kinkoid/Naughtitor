import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';

mkdirSync('dist/renderer', { recursive: true });

await build({
  entryPoints: ['src/index.tsx'],
  bundle: true,
  outfile: 'dist/renderer/bundle.js',
  format: 'iife',
  platform: 'browser',
  sourcemap: true,
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'css',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});

// Copy static files
copyFileSync('src/index.html', 'dist/renderer/index.html');
copyFileSync('src/styles/global.css', 'dist/renderer/global.css');

console.log('Renderer bundle built successfully');
