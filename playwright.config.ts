import { defineConfig } from '@playwright/test';

/**
 * End-to-end checks against the real stack: the built app served by Spring Boot, a real Keycloak,
 * a real database. Nothing here is mocked, because the things worth checking at this level —
 * a login that survives a restart, a service worker serving a board with no connection — only
 * exist when all three are present.
 *
 * <p>Start the stack first: `docker compose up -d`, then `mvn spring-boot:run -Dspring-boot.run.profiles=dev`.
 * These are a local gate, not a CI one: CI has no browser and no Keycloak.
 */
export default defineConfig({
  testDir: './e2e',
  // Registration, sign-in and the service worker all share one browser profile per run, and the
  // offline test would race a parallel one for it.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env['CI'] ? 'list' : [['list']],
  use: {
    baseURL: process.env['APP_URL'] ?? 'http://localhost:8090',
    // The system Chrome, so nothing has to be downloaded. A service worker needs a real
    // browser engine; there is no faking one.
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
