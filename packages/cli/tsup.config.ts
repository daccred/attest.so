import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    'bin/run': 'bin/run.ts'
  },
  format: ['cjs'],
  dts: false,
  splitting: false,
  sourcemap: false,
  clean: true,
  outDir: 'dist',
  target: 'node20',
  platform: 'node',
  banner: {
    js: '#!/usr/bin/env node'
  },
  minify: true
})