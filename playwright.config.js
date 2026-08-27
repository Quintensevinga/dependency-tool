import { defineConfig } from '@playwright/test'

// Regressietestset voor Dependency Insight. Draai lokaal via `npm run test:e2e`
// vóór elke release/demo — zie CLAUDE.md voor de afgesproken cadans.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 60000,
  },
})
