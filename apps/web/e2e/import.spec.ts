import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

test('the link printed by pnpm seed:demo opens the demo player on Progress', async ({ page }) => {
  const out = execFileSync('pnpm', ['--filter', '@steady/api', 'seed:demo'], {
    encoding: 'utf8',
  });
  const printed = /https?:\/\/\S+\/import#\S+/.exec(out)?.[0];
  expect(printed, out).toBeDefined();
  // The printed link names the default dev server; open it on the one under test.
  const { pathname, hash } = new URL(printed!);
  expect(hash).toMatch(/^#token=.+&name=Demo$/);

  await page.goto(pathname + hash);
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Player: Demo' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Last 7 days' })).toBeVisible();
  // The token is gone from the address bar.
  expect(new URL(page.url()).hash).toBe('');

  // Opening the same link again does not add a second copy of the player.
  await page.goto(pathname + hash);
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
  await page.getByRole('button', { name: 'Player: Demo' }).click();
  await expect(page.getByRole('menuitemradio', { name: 'Demo' })).toHaveCount(1);
});
