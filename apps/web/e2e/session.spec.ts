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
  // Focus mode: no header or navigation while the block runs.
  await expect(page.getByTestId('stimulus')).toBeAttached({ timeout: 15_000 });
  await expect(page.getByRole('banner')).toHaveCount(0);
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

  await page.getByRole('link', { name: 'See your progress' }).click();
  await expect(page.getByRole('region', { name: 'This week' })).toContainText('1 of 4 days');
  await expect(page.getByText('Your starting point is set after 5 more sessions.')).toBeVisible();

  // A second player on the same device sees none of it.
  await page.getByRole('button', { name: /^Player: / }).click();
  await page.getByRole('menuitem', { name: 'Add player' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Sam');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('button', { name: 'Player: Sam' })).toBeVisible();
  await expect(page.getByText(/no sessions yet/i)).toBeVisible();
  await page.goto(resultsUrl);
  await expect(page.getByRole('heading', { name: 'Session not found' })).toBeVisible();

  // Switching back shows the first player's session again.
  await page.getByRole('button', { name: 'Player: Sam' }).click();
  await page.getByRole('menuitemradio').first().click();
  await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();

  // Now a returning player: one check-in screen, then straight to the countdown.
  await page.goto('/play');
  await expect(page.getByRole('button', { name: 'How to play' })).toBeVisible();
  await skipCheckIn(page);
  await expect(page.getByTestId('stimulus')).toBeAttached({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Start practice' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'How to play' })).toHaveCount(0);
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
