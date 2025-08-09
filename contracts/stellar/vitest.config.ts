import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 120000, // 2 minutes timeout for integration tests
    hookTimeout: 30000,  // 30 second timeout for setup hooks
    teardownTimeout: 30000,
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'authority', 'protocol'],
    // Run tests serially to avoid conflicts with testnet
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true
      }
    }
  }
})