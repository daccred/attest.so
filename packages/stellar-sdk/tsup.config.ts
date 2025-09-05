import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  outDir: 'dist',
  external: ['@stellar/stellar-sdk'],
  treeshake: true,
  esbuildOptions: (options, context) => {
    options.platform = 'neutral'
  },
  // Copy llm.txt to dist for package consumers
  onSuccess: async () => {
    const { copyFile } = await import('fs/promises')
    await copyFile('llm.txt', 'dist/llm.txt')
  }
})