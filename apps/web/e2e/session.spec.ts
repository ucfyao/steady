import { expect, test } from '@playwright/test';
import { activeToken, asNewPlayer, hidePage, playBlock, skipCheckIn } from './helpers.js';

test('a new player practises, plays a full session and sees results and progress', async ({
  page,
  request,
}) => {
  const me = await asNewPlayer(page, request, 'New');
  await page.goto('/play');

  // First visit: step 1 (how it works), the practice round, then step 2 (before you start)
  // with how the practice went at the top.
  await expect(page.getByText('Step 1 of 2')).toBeVisible();
  await expect(page.getByRole('region', { name: 'How to play' })).toContainText('Hold back');
  await page.getByRole('button', { name: 'Try a short practice' }).click();
  await playBlock(page);
  await expect(page.getByText('Step 2 of 2')).toBeVisible();
  // The helper never presses on a 3, and presses for every other digit, usually within a few
  // ms, which the practice counts as too early (under 100 ms) rather than caught.
  const line = (await page.getByTestId('practice-line').textContent())!;
  expect(line).toContain('2 of 2 3s held back');
  const caught = Number(line.match(/(\d+) of 10 digits caught/)![1]);
  const early = Number(line.match(/(\d+) too early/)?.[1] ?? 0);
  expect(caught + early).toBe(10);

  await skipCheckIn(page);
  // Focus mode: no header or navigation while the block runs.
  await expect(page.getByTestId('stimulus')).toBeAttached({ timeout: 15_000 });
  await expect(page.getByRole('banner')).toHaveCount(0);
  const { presses, probes } = await playBlock(page);
  expect(presses).toBe(72);
  expect(probes).toBe(3);

  // Scored by the server, which also checked that the session took real time.
  // For screen readers only (Spec 010): attached, not visible.
  await expect(page.getByRole('heading', { level: 1, name: 'Session complete' })).toBeAttached();
  const ribbon = page.getByRole('img', { name: /session journey/i });
  await expect(ribbon.getByTestId('trial')).toHaveCount(81);
  await expect(ribbon.getByTestId('probe')).toHaveCount(3);
  await expect(page.getByRole('group', { name: 'Digits missed' })).toContainText('0');
  const resultsUrl = page.url();

  await page.getByRole('link', { name: 'See your trends' }).click();
  await expect(page.getByRole('region', { name: 'Last 7 days' })).toContainText('1 of 4 days');
  await expect(page.getByText('Your starting point is set after 5 more sessions.')).toBeVisible();

  // A second player on the same device sees none of it.
  // Manage players: the native dialog closes on Escape and focus returns to Add a player.
  const avatar = page.getByRole('button', { name: /^Player: / });
  await avatar.click();
  await page.getByRole('menuitem', { name: 'Manage players' }).click();
  const add = page.getByRole('button', { name: 'Add a player' });
  await add.click();
  await expect(page.getByRole('dialog', { name: 'Add a player' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(add).toBeFocused();
  await add.click();
  const sam = `Sam ${Date.now() % 100_000}`;
  await page.getByRole('textbox', { name: 'Name' }).fill(sam);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: sam })).toBeVisible();
  // Adding does not switch player; the menu does.
  await avatar.click();
  await page.getByRole('menuitemradio', { name: sam }).click();
  await expect(page.getByRole('button', { name: `Player: ${sam}` })).toBeVisible();
  await page.getByRole('link', { name: 'Trends' }).click();
  await expect(page.getByText(/no sessions yet/i)).toBeVisible();
  await page.goto(resultsUrl);
  await expect(page.getByRole('heading', { name: 'Session not found' })).toBeVisible();

  // Switching back shows this player's session again.
  await page.getByRole('button', { name: `Player: ${sam}` }).click();
  await page.getByRole('menuitemradio', { name: me }).click();
  // For screen readers only (Spec 010): attached, not visible.
  await expect(page.getByRole('heading', { level: 1, name: 'Session complete' })).toBeAttached();

  // Now a returning player: one check-in screen, then straight to the countdown.
  await page.goto('/play');
  await expect(page.getByRole('button', { name: 'How to play' })).toBeVisible();
  await skipCheckIn(page);
  await expect(page.getByTestId('stimulus')).toBeAttached({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Try a short practice' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'How to play' })).toHaveCount(0);
});

test('leaving the page during trials voids the session', async ({ page, request }) => {
  await asNewPlayer(page, request, 'Leaver');
  await page.goto('/play');
  await page.getByRole('button', { name: 'Try a short practice' }).click();
  await playBlock(page);
  await skipCheckIn(page);

  // Wait for the first digit, then switch away.
  await expect(page.getByTestId('stimulus')).toHaveAttribute('data-index', /\d+/, {
    timeout: 10_000,
  });
  await hidePage(page);
  await expect(page.getByRole('heading', { name: 'Session voided' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible();

  const res = await request.get('/api/sessions', {
    headers: { authorization: `Bearer ${await activeToken(page)}` },
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual([]);
});

test('an unknown address shows "Page not found" with the header and a way home', async ({
  page,
}) => {
  await page.goto('/nope');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('banner')).toBeVisible();
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page).toHaveURL('/');
});
