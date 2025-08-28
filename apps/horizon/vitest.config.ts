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
    hookTimeout: 60000, // 60 seconds for hooks (beforeAll, afterAll, etc.)
    testTimeout: 30000,  // 30 seconds for individual tests (it blocks)
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
