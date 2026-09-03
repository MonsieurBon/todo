import { Page, expect } from '@playwright/test';

const KEYCLOAK = process.env['KC_URL'] ?? 'http://localhost:8081';
const REALM = process.env['REALM'] ?? 'todo';

/**
 * Creates a throwaway person in the dev realm.
 *
 * <p>A fresh account per run is what makes the assertions exact: the zone caps are counted across
 * everything a person can see, so a test that shares an account with the last run cannot say what
 * the board should contain.
 */
export async function createUser(): Promise<{ email: string; password: string }> {
  const admin = await adminToken();
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
  const password = 'test';

  const response = await fetch(`${KEYCLOAK}/admin/realms/${REALM}/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: email,
      email,
      emailVerified: true,
      firstName: 'End',
      lastName: 'ToEnd',
      enabled: true,
      credentials: [{ type: 'password', value: password, temporary: false }],
    }),
  });
  if (!response.ok) {
    throw new Error(`could not create ${email}: ${response.status} ${await response.text()}`);
  }
  return { email, password };
}

async function adminToken(): Promise<string> {
  const response = await fetch(`${KEYCLOAK}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'admin-cli',
      username: process.env['KC_ADMIN'] ?? 'admin',
      password: process.env['KC_ADMIN_PASSWORD'] ?? 'admin',
      grant_type: 'password',
    }),
  });
  if (!response.ok) {
    throw new Error(`Keycloak admin login failed: ${response.status}. Is the stack running?`);
  }
  return ((await response.json()) as { access_token: string }).access_token;
}

/** Goes to the app and comes back signed in. The guard does the redirecting. */
export async function signIn(page: Page, who: { email: string; password: string }): Promise<void> {
  await page.goto('/');
  await page.waitForURL(/realms\/todo\/protocol\/openid-connect\/auth/);
  await page.fill('#username', who.email);
  await page.fill('#password', who.password);
  await page.click('#kc-login');
  // Back on the app, with the authorization code exchanged and the board drawn.
  await expect(page.getByRole('heading', { name: 'Critical Now' })).toBeVisible({
    timeout: 30_000,
  });
}
