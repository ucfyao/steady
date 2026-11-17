import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

test('a link printed by pnpm seed:demo opens that demo player on Progress', async ({ page }) => {
  const out = execFileSync('pnpm', ['--filter', '@steady/api', 'seed:demo'], {
    encoding: 'utf8',
  });
  // One link per variant (Spec 011): Demo plain, Demo calm, Demo game.
  const printed = out.match(/https?:\/\/\S+\/import#\S+/g) ?? [];
  expect(printed, out).toHaveLength(3);
  expect(printed.map((l) => new URL(l).hash.replace(/^.*&name=/, ''))).toEqual([
    'Demo+plain',
    'Demo+calm',
    'Demo+game',
  ]);
  // The printed link names the default dev server; open it on the one under test.
  const { pathname, hash } = new URL(printed[0]!);

  await page.goto(pathname + hash);
  // For screen readers only (Spec 010): attached, not visible.
  await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeAttached();
  await expect(page.getByRole('button', { name: 'Player: Demo plain' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Last 7 days' })).toBeVisible();
  // The token is gone from the address bar.
  expect(new URL(page.url()).hash).toBe('');

  // Opening the same link again does not add a second copy of the player.
  await page.goto(pathname + hash);
  // For screen readers only (Spec 010): attached, not visible.
  await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeAttached();
  await page.getByRole('button', { name: 'Player: Demo plain' }).click();
  // In development the item also shows the group (Spec 011), so match the start of the name.
  await expect(page.getByRole('menuitemradio', { name: /^Demo plain/ })).toHaveCount(1);
  await page.keyboard.press('Escape');

  // The demo's 10 sessions are joined by straight lines: an SVG path of only M and L
  // commands, no curves (C) that would invent values between sessions.
  const line = page.getByRole('figure', { name: '3s held back' }).locator('.recharts-line-curve');
  await expect(line).toHaveAttribute('d', /^M[\d.,\sML-]+$/);

  // The session list opens a session's Results.
  const sessions = page.getByRole('region', { name: 'Your sessions' });
  await expect(sessions.getByRole('link')).toHaveCount(10);
  await sessions.getByRole('link', { name: /Session 10/ }).click();
  // For screen readers only (Spec 010): attached, not visible.
  await expect(page.getByRole('heading', { level: 1, name: 'Session complete' })).toBeAttached();
  await expect(page).toHaveURL(/\/results\//);
});
