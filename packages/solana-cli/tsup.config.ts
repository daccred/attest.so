import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'bin/run.ts'],
  format: ['cjs', 'esm'],
  splitting: false,
  sourcemap: false,
  clean: true,
})
