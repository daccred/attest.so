import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Allows using describe, it, expect, etc., without importing
    environment: 'node', // Essential for backend testing
    setupFiles: [
      // Use different setup files based on test type
      process.env.VITEST_MODE === 'integration' 
        ? './__tests__/fixtures/integration-setup.ts'
        : './__tests__/fixtures/unit-setup.ts'
    ],
    hookTimeout: 120000, // 120 seconds for hooks (beforeAll, afterAll, etc.)
    testTimeout: 300000,  // 300 seconds (5 minutes) for individual tests - needed for backfill operations
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html'],
    },
    sequence: {
      concurrent: false,
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**'
    ],
  },
});
