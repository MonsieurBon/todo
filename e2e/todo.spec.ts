import { BrowserContext, Page, expect, test } from '@playwright/test';
import { createUser, signIn } from './keycloak';

/**
 * The app, driven the way it is used.
 *
 * <p>Serial and sharing one browser context on purpose: half of what is worth checking here is
 * about what survives — a session that outlives a restart, a service worker that has seen the
 * board before the connection goes, an outbox that empties itself. None of that is observable in
 * a fresh context per test.
 */
test.describe.configure({ mode: 'serial' });

let context: BrowserContext;
let page: Page;
let who: { email: string; password: string };

/** Scopes every assertion to this run, so a shared dev database cannot make one pass or fail. */
const run = `e2e${Date.now()}`;

test.beforeAll(async ({ browser }) => {
  who = await createUser();
  context = await browser.newContext();
  page = await context.newPage();
  await signIn(page, who);
});

test.afterAll(async () => {
  await context?.close();
});

async function capture(
  title: string,
  options: { zone?: string; labels?: string } = {},
): Promise<void> {
  await page.goto('/capture');
  await page.getByLabel('What needs doing?').fill(title);
  if (options.zone) {
    await page.getByLabel('Urgency').click();
    await page.getByRole('option', { name: options.zone }).click();
  }
  if (options.labels) {
    await page.getByLabel('Topics, comma separated').fill(options.labels);
  }
  await page.getByRole('button', { name: 'Add to the list' }).click();
  await expect(page.getByRole('heading', { name: 'Critical Now' })).toBeVisible();
}

function zoneSection(name: string) {
  return page.locator('section.zone').filter({ has: page.getByRole('heading', { name }) });
}

test('a new account starts with an empty board and the three zones', async () => {
  for (const zone of ['Critical Now', 'Opportunity Now', 'Over the Horizon']) {
    await expect(page.getByRole('heading', { name: zone })).toBeVisible();
  }
  await expect(page.getByText('Nothing here yet.')).toBeVisible();
});

test('a captured task lands in the zone it was given', async () => {
  await capture(`Fix the tile ${run}`, { zone: 'Critical Now', labels: run });
  await expect(zoneSection('Critical Now').getByText(`Fix the tile ${run}`)).toBeVisible();
  // Filed with no list named, so it goes to the inbox.
  await expect(zoneSection('Critical Now').getByText('Inbox')).toBeVisible();
});

test('the cap warns when a zone is over what the method says it holds', async () => {
  for (let i = 0; i < 5; i++) {
    await capture(`Urgent ${i} ${run}`, { zone: 'Critical Now', labels: run });
  }
  // Narrowed to this run's topic, so the count is exactly what these tests put there.
  await page.goto('/');
  await page.getByRole('button', { name: 'All topics' }).click();
  await page.getByRole('menuitem', { name: run }).click();

  const critical = zoneSection('Critical Now');
  await expect(critical.getByText('6 / 5')).toBeVisible();
  await expect(critical.getByText(/Over the 5 this zone is meant to hold/)).toBeVisible();
});

test('completing a task takes it off the board', async () => {
  await page.getByRole('button', { name: `Complete Urgent 0 ${run}` }).click();
  await expect(page.getByText(`Urgent 0 ${run}`)).toBeHidden();
  await expect(zoneSection('Critical Now').getByText('5 / 5')).toBeVisible();
});

test('the review sweep offers what is due and never Critical Now', async () => {
  await capture(`Soon ${run}`, { zone: 'Opportunity Now', labels: run });
  await page.goto('/review');

  // Everything in Critical Now is excluded by cadence, so this run's only entry is the new one.
  await expect(page.getByRole('heading', { name: `Soon ${run}` })).toBeVisible();
  await page.getByRole('button', { name: 'Leave it' }).click();
  await expect(page.getByText('Nothing is due for review.')).toBeVisible();
});

test('a share arrives on the capture screen with its link kept', async () => {
  const url = 'https://example.com/roof-tiles';
  await page.goto(`/capture?title=${encodeURIComponent('Roof tiles ' + run)}&url=${url}`);

  await expect(page.getByLabel('What needs doing?')).toHaveValue(`Roof tiles ${run}`);
  // The link goes to the notes: a task titled with a URL says nothing three days later.
  await expect(page.getByLabel('Notes')).toHaveValue(url);
});

test('a restart does not ask for a password again', async () => {
  const restarted = await context.newPage();
  await restarted.goto('/');
  await expect(restarted.getByRole('heading', { name: 'Critical Now' })).toBeVisible();
  expect(new URL(restarted.url()).origin).toBe(new URL(page.url()).origin);
  await restarted.close();
});

test('the board still renders with no connection, and a capture is kept and sent later', async () => {
  await page.goto('/');
  // The service worker has to be in charge before pulling the connection, or there is nothing
  // serving the cached board.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByText(`Fix the tile ${run}`)).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Offline')).toBeVisible();
  await expect(page.getByText(`Fix the tile ${run}`)).toBeVisible();

  await capture(`Captured underground ${run}`, { zone: 'Critical Now', labels: run });
  await expect(page.getByText(`Captured underground ${run}`)).toBeVisible();
  await expect(page.getByText('waiting to sync')).toBeVisible();

  await context.setOffline(false);
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect(page.getByText('waiting to sync')).toBeHidden();

  // And exactly once: the retry carries the reference the first attempt was sent under.
  await page.reload();
  await expect(page.getByText(`Captured underground ${run}`)).toHaveCount(1);
});
