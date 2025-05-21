import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Allows using describe, it, expect, etc., without importing
    environment: 'node', // Essential for backend testing
    setupFiles: ['./__tests__/setup.ts'],
    hookTimeout: 60000, // 60 seconds for hooks (beforeAll, afterAll, etc.)
    testTimeout: 30000,  // 30 seconds for individual tests (it blocks)
    coverage: { // Optional: configure coverage
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html'],
    },
  },
});