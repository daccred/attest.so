import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['bin/run.ts', 'src/index.ts'],
  format: ['cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  target: 'node20',
  platform: 'node'
})