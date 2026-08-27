import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'server/**/*.test.js'],
    setupFiles: ['./server/tests/setup.js'],
    testTimeout: 15000,
    // The API/security suites share the seeded pilot tenant. Run files
    // serially so one file cannot close a period or cash session while
    // another file is exercising the same tenant.
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
});
