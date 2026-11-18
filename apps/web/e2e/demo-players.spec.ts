import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

test('the demo players from pnpm seed:demo are in everyone’s list, with their history', async ({
  page,
}) => {
  execFileSync('pnpm', ['--filter', '@steady/api', 'seed:demo'], { encoding: 'utf8' });

  // Spec 016: no link to open; the seeded players are already in the shared list.
  await page.goto('/progress');
  await page.getByRole('button', { name: /^Player: / }).click();
  for (const name of ['O-Ava', 'N-Amy', 'O-Ben', 'N-Bella', 'O-Cleo', 'N-Cora'])
    await expect(page.getByRole('menuitemradio', { name: new RegExp(`^${name}\\b`) })).toHaveCount(
      1,
    );
  await page.getByRole('menuitemradio', { name: /^O-Ava\b/ }).click();
  await expect(page.getByRole('button', { name: 'Player: O-Ava' })).toBeVisible();
  // For screen readers only (Spec 010): attached, not visible.
  await expect(page.getByRole('heading', { level: 1, name: 'Trends' })).toBeAttached();
  await expect(page.getByRole('region', { name: 'Last 7 days' })).toBeVisible();

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
