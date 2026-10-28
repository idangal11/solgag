import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests (Playwright + the installed Microsoft Edge — no browser download).
 *
 * Needs the LOCAL Supabase stack: sign-in codes are read from its Mailpit inbox.
 *   npx supabase start && npx supabase db reset     # schema + the 12 fictional demo listings
 *   .env.local points at http://127.0.0.1:55321     # see README
 *   npx playwright test                             # or: npm run test:e2e  (--project=desktop / --project=mobile)
 *
 * Optional: SUPABASE_SERVICE_ROLE_KEY in the environment lets the journey spec delete the
 * users (and their listings/photos) it created when it finishes.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  // The journey spec shares one database; keep runs deterministic.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:3000',
    browserName: 'chromium',
    channel: 'msedge',
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    // Map flights become instant (ExploreClient honours reduced motion) and CSS animations stop.
    reducedMotion: 'reduce',
    // The first visit to a route compiles it in `next dev`.
    navigationTimeout: 60_000,
    actionTimeout: 15_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1400, height: 860 } },
    },
    {
      name: 'mobile',
      use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
