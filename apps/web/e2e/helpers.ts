import { expect, type Page } from '@playwright/test';

/**
 * Plays the block on screen like a careful player: Space for every digit except 3,
 * "1" (On task) at each probe. Returns when the block ends (the stimulus unmounts).
 * Presses are real key events, so the app's own timing records them.
 */
export async function playBlock(page: Page): Promise<{ presses: number; probes: number }> {
  // The block may still be loading (the server is creating the session).
  await page.getByTestId('stimulus').waitFor({ state: 'attached', timeout: 15_000 });
  let last = -1;
  let presses = 0;
  let probes = 0;
  for (;;) {
    const next = await page.waitForFunction(
      ({ last }) => {
        if (document.querySelector('[role=dialog]')) return { kind: 'probe' as const };
        const el = document.querySelector<HTMLElement>('[data-testid=stimulus]');
        if (!el) return { kind: 'done' as const };
        const index = Number(el.dataset.index ?? -1);
        const text = el.textContent ?? '';
        // The mask is frost over an empty digit (Spec 006), or the ⊗ itself in the plain
        // variant (Spec 008), so a digit is any other non-empty text.
        if (index !== last && text !== '' && text !== '⊗') {
          return { kind: 'digit' as const, index, digit: text };
        }
        return null;
      },
      { last },
      { polling: 'raf', timeout: 15_000 },
    );
    const step = await next.jsonValue();
    if (!step) continue;
    if (step.kind === 'done') return { presses, probes };
    if (step.kind === 'probe') {
      await page.keyboard.press('1');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      probes++;
      continue;
    }
    last = step.index;
    if (step.digit !== '3') {
      await page.keyboard.press('Space');
      presses++;
    }
  }
}

/** Skips the optional check-in. */
export async function skipCheckIn(page: Page) {
  await expect(page.getByRole('heading', { name: 'How are you today?' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
}

/** Simulates switching tabs: the page becomes hidden. */
export async function hidePage(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

/** The active player's token, to ask the API directly what it stored. */
export async function activeToken(page: Page): Promise<string> {
  return page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('steady.players.v1') ?? '{}') as {
      profiles: { id: string; token: string }[];
      activeId: string;
    };
    return state.profiles.find((p) => p.id === state.activeId)!.token;
  });
}
