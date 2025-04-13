import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['bin/run.ts'],
  splitting: false,
  sourcemap: false,
  clean: true,
})
