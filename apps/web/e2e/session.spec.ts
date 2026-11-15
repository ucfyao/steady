import { expect, test } from '@playwright/test';
import { activeToken, hidePage, playBlock, skipCheckIn } from './helpers.js';

test('a new player practises, plays a full session and sees results and progress', async ({
  page,
}) => {
  await page.goto('/play');
  await skipCheckIn(page);

  // First visit: how to play, then the practice round.
  await expect(page.getByRole('heading', { name: 'First, a short practice' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'How to play' })).toContainText('not for 3');
  await page.getByRole('button', { name: 'Start practice' }).click();
  await playBlock(page);

  await expect(page.getByText(/practice complete/i)).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const { presses, probes } = await playBlock(page);
  expect(presses).toBe(112);
  expect(probes).toBe(4);

  // Scored by the server, which also checked that the session took real time.
  await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
  const ribbon = page.getByRole('img', { name: /session journey/i });
  await expect(ribbon.getByTestId('trial')).toHaveCount(126);
  await expect(ribbon.getByTestId('probe')).toHaveCount(4);
  await expect(page.getByRole('group', { name: 'Missed digits' })).toContainText('0');
  const resultsUrl = page.url();

  await page.getByRole('link', { name: 'Progress' }).click();
  await expect(page.getByText('1 of 4 days this week')).toBeVisible();
  await expect(page.getByText('Your starting point is set after 5 more sessions.')).toBeVisible();

  // A second player on the same device sees none of it.
  await page.getByRole('button', { name: 'Add player' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Sam');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('combobox', { name: 'Player' })).toHaveValue(/.+/);
  await expect(page.getByText(/no sessions yet/i)).toBeVisible();
  await page.goto(resultsUrl);
  await expect(page.getByRole('heading', { name: 'Session not found' })).toBeVisible();

  // Switching back shows the first player's session again.
  await page.getByRole('combobox', { name: 'Player' }).selectOption({ index: 0 });
  await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
});

test('leaving the page during trials voids the session', async ({ page, request }) => {
  await page.goto('/play');
  await skipCheckIn(page);
  await page.getByRole('button', { name: 'Start practice' }).click();
  await playBlock(page);
  await page.getByRole('button', { name: 'Start', exact: true }).click();

  // Wait for the first digit, then switch away.
  await expect(page.getByTestId('stimulus')).toHaveAttribute('data-index', /\d+/, {
    timeout: 10_000,
  });
  await hidePage(page);
  await expect(page.getByRole('heading', { name: 'Session voided' })).toBeVisible();

  const res = await request.get('/api/sessions', {
    headers: { authorization: `Bearer ${await activeToken(page)}` },
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual([]);
});
