import { expect, test } from '@playwright/test';
import { activeToken, hidePage, playBlock, skipCheckIn } from './helpers.js';

test('a new player practises, plays a full session and sees results and progress', async ({
  page,
}) => {
  await page.goto('/play');

  // First visit: step 1 (how it works), the practice round, step 2 (practice result).
  await expect(page.getByText('Step 1 of 3')).toBeVisible();
  await expect(page.getByRole('region', { name: 'How to play' })).toContainText('Hold back');
  await page.getByRole('button', { name: 'Try a short practice' }).click();
  await playBlock(page);
  await expect(page.getByRole('heading', { name: 'Nice warm-up' })).toBeVisible();
  // The helper never presses on a 3, and presses for every other digit, usually within a few
  // ms, which the practice result counts as too early (under 100 ms) rather than caught.
  await expect(page.getByRole('group', { name: '3s held back' })).toContainText('2 / 2');
  const first = async (name: string) =>
    Number((await page.getByRole('group', { name }).textContent())!.match(/\d+/)![0]);
  expect((await first('digits caught')) + (await first('too early'))).toBe(16);
  await page.getByRole('button', { name: "I'm ready" }).click();

  // Step 3: before you start (the check-in), then the session.
  await expect(page.getByText('Step 3 of 3')).toBeVisible();
  await skipCheckIn(page);
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
  await expect(page.getByRole('region', { name: 'Last 7 days' })).toContainText('1 of 4 days');
  await expect(page.getByText('Your starting point is set after 5 more sessions.')).toBeVisible();

  // A second player on the same device sees none of it.
  // The native dialog: Escape closes it and focus returns to the avatar.
  const avatar = page.getByRole('button', { name: /^Player: / });
  await avatar.click();
  await page.getByRole('menuitem', { name: 'Add player' }).click();
  await expect(page.getByRole('dialog', { name: 'Add a player' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(avatar).toBeFocused();
  await avatar.click();
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
  await expect(page.getByRole('button', { name: 'Try a short practice' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'How to play' })).toHaveCount(0);
});

test('leaving the page during trials voids the session', async ({ page, request }) => {
  await page.goto('/play');
  await page.getByRole('button', { name: 'Try a short practice' }).click();
  await playBlock(page);
  await page.getByRole('button', { name: "I'm ready" }).click();
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
