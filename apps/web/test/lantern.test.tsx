import { scorePoints, scoreSession, type CompletedSession, type Variant } from '@steady/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Profiler } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { parseVariant } from '../src/game/env.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { fakeBackend, tokenN } from './support/fake-api.js';
import { fakeEnv } from './support/fake-env.js';

// Spec 006: the lantern scene, the frost mask, the glow, and the game variant's points.

function renderPlay(variant: Variant, override?: Variant) {
  const backend = fakeBackend();
  backend.control.variant = variant;
  backend.sessions.set(tokenN(1), [{ id: 'old' }] as CompletedSession[]); // returning player
  const clock = fakeEnv('keyboard', override);
  const renders = { count: 0 };
  render(
    <Profiler id="app" onRender={() => renders.count++}>
      <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
        <MemoryRouter initialEntries={['/play']}>
          <AppRoutes playEnv={clock.env} />
        </MemoryRouter>
      </PlayersProvider>
    </Profiler>,
  );
  return { backend, clock, renders };
}

const space = () => fireEvent.keyDown(window, { code: 'Space', key: ' ' });
const WHOLE_SESSION_MS = 3000 + 81 * 1200 + 3 * 1100 + 2000;

async function start() {
  await screen.findByRole('heading', { name: 'How are you today?' });
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  await screen.findByTestId('countdown');
}

/** Presses 400 ms after every digit except 3; `onTarget` may press on a 3 instead. */
function player(clock: ReturnType<typeof fakeEnv>, onTarget?: (n: number) => void) {
  let seen = -1;
  let threes = 0;
  let pressAt: number | null = null;
  return () => {
    const el = screen.queryByTestId('stimulus');
    const index = Number(el?.dataset.index ?? -1);
    const text = el?.textContent ?? '';
    if (el && index !== seen && text) {
      seen = index;
      pressAt = null;
      if (text === '3') onTarget?.(++threes);
      else pressAt = clock.now() + 400;
    }
    if (pressAt !== null && clock.now() >= pressAt) {
      space();
      pressAt = null;
    }
    const probe = screen.queryByRole('dialog', { name: /where was your mind/i });
    if (probe) fireEvent.click(within(probe).getByRole('button', { name: 'On task' }));
  };
}

describe('the lantern (both variants)', () => {
  it('counts down with Ready, Set, Go and never shows a digit', async () => {
    const { clock } = renderPlay('calm');
    await start();
    const words: string[] = [];
    clock.advance(2950, 50, () => {
      const w = screen.queryByTestId('countdown')?.textContent ?? '';
      if (!words.includes(w)) words.push(w);
      expect(screen.getByTestId('stimulus')).toHaveTextContent('');
      expect(screen.getByTestId('countdown').textContent).not.toMatch(/\d/);
    });
    expect(words.map((w) => w.match(/Ready|Set|Go/)?.[0])).toEqual(['Ready', 'Set', 'Go']);
  });

  it('mists the glass over after each digit, and shows no ⊗ anywhere', async () => {
    const { clock } = renderPlay('calm');
    await start();
    let frosted = 0;
    let digits = 0;
    clock.advance(3000 + 5 * 1150, 50, () => {
      const frost = screen.getByTestId('frost');
      const el = screen.getByTestId('stimulus');
      if (frost.dataset.on === 'true') {
        frosted++;
        expect(el).toHaveTextContent('');
      } else if (el.textContent) digits++;
      expect(document.body.textContent).not.toContain('⊗');
    });
    expect(frosted).toBeGreaterThan(0);
    expect(digits).toBeGreaterThan(0);
  });

  it.each(['calm', 'game'] as const)(
    'keeps the glass misted through the countdown, until the first digit (Spec 021, %s)',
    async (variant) => {
      const { clock } = renderPlay(variant);
      await start();
      clock.advance(2950, 50, () => {
        expect(screen.getByTestId('frost').dataset.on).toBe('true');
        expect(screen.getByTestId('stimulus')).toHaveTextContent('');
      });
      // The first digit replaces the mist, as every digit does.
      clock.advance(150);
      expect(screen.getByTestId('stimulus').textContent).toMatch(/^\d$/);
      expect(screen.getByTestId('frost').dataset.on).toBe('false');
    },
  );

  it('glows after a press on a digit and flickers after a press on a 3', async () => {
    const { clock } = renderPlay('calm');
    await start();
    const glows = new Set<string>();
    clock.advance(
      WHOLE_SESSION_MS,
      50,
      (() => {
        const p = player(clock, (n) => n === 1 && space());
        return () => {
          p();
          const g = screen.queryByTestId('lantern')?.dataset.glow;
          if (g) glows.add(g);
        };
      })(),
    );
    expect([...glows].sort()).toEqual(['bad', 'ok']);
  });
});

describe('game variant', () => {
  it('shows points that end at the points of the server’s outcomes, the multiplier and fireflies', async () => {
    const { backend, clock } = renderPlay('game');
    await start();
    let last = '';
    const mult = new Set<string>();
    let maxFlies = 0;
    let fliesAfterSlip = -1;
    let slipped = false;
    const p = player(clock, (n) => {
      if (n === 3) {
        space(); // a press on the third 3: a slip
        slipped = true;
      }
    });
    let frame = 0;
    clock.advance(WHOLE_SESSION_MS, 50, () => {
      p();
      frame++;
      const pts = screen.queryByTestId('points');
      if (pts) last = pts.textContent!;
      const m = screen.queryByTestId('multiplier');
      if (m) mult.add(m.textContent!);
      const flies = document.querySelectorAll('[data-testid="firefly"]:not([data-gone])').length;
      maxFlies = Math.max(maxFlies, flies);
      if (
        slipped &&
        fliesAfterSlip === -1 &&
        screen.queryByTestId('lantern')?.dataset.glow === 'bad'
      )
        fliesAfterSlip = flies;
      // Nothing says how far along the block is (checked every 20th frame: a full-text
      // query on every frame made this test too slow for CI).
      if (frame % 20 === 0) expect(document.body.textContent).not.toMatch(/of 81|remaining|left/i);
    });
    await screen.findByRole('heading', { name: 'Session complete' });
    const { id, body } = backend.submitted[0]!;
    const plan = backend.plans.get(id)!.plan;
    // One count: the points of the server's trial outcomes, which Results shows too.
    const { trialOutcomes } = scoreSession({ seed: 0, ...plan }, body);
    expect(Number(last)).toBe(scorePoints(trialOutcomes));
    expect(mult.has('×2')).toBe(true);
    expect(maxFlies).toBeGreaterThan(0);
    expect(maxFlies).toBeLessThanOrEqual(30);
    expect(fliesAfterSlip).toBe(0);
  }, 15_000); // a whole 81-trial session with a check on every frame

  it('raises the dawn as the points grow', async () => {
    const { clock } = renderPlay('game');
    await start();
    const dawn = () => Number(screen.getByTestId('scene').style.getPropertyValue('--dawn') || 0);
    expect(dawn()).toBe(0);
    clock.advance(3000 + 20 * 1150, 50, player(clock));
    expect(dawn()).toBeGreaterThan(0);
    expect(dawn()).toBeLessThan(1);
  });

  it('keeps React commits at the phase changes', async () => {
    const { clock, renders } = renderPlay('game');
    await start();
    const before = renders.count;
    clock.advance(WHOLE_SESSION_MS - 2000, 50, player(clock));
    // countdown steps, then per probe: probe, resume, trials. Not one per trial (81).
    expect(renders.count - before).toBeLessThan(25);
  });
});

describe('calm variant', () => {
  it('shows no points, multiplier, fireflies or dawn', async () => {
    const { clock } = renderPlay('calm');
    await start();
    clock.advance(3000 + 10 * 1150, 50, player(clock));
    expect(screen.queryByTestId('points')).toBeNull();
    expect(screen.queryByTestId('multiplier')).toBeNull();
    expect(screen.queryAllByTestId('firefly')).toHaveLength(0);
    expect(screen.getByTestId('scene').style.getPropertyValue('--dawn')).toBe('');
  });
});

describe('plain variant (Spec 008)', () => {
  it('shows the bare digit and the ⊗ mask: no scene, lantern, frost or game layer', async () => {
    const { clock } = renderPlay('plain');
    await start();
    expect(screen.queryByTestId('scene')).toBeNull();
    expect(screen.queryByTestId('lantern')).toBeNull();
    expect(screen.queryByTestId('frost')).toBeNull();
    let masks = 0;
    let digits = 0;
    clock.advance(3000 + 5 * 1150, 50, () => {
      const text = screen.getByTestId('stimulus').textContent;
      if (text === '⊗') masks++;
      else if (text) digits++;
    });
    expect(masks).toBeGreaterThan(0);
    expect(digits).toBeGreaterThan(0);
  });

  it('counts down without a digit, as the other variants', async () => {
    const { clock } = renderPlay('plain');
    await start();
    clock.advance(2950, 50, () => {
      expect(screen.getByTestId('stimulus')).toHaveTextContent('');
      expect(screen.getByTestId('countdown').textContent).not.toMatch(/\d/);
    });
  });

  it('gives no sign that a press counted, shows no points, and ends on calm Results', async () => {
    const { clock } = renderPlay('plain');
    await start();
    let probeNote = false;
    const p = player(clock, (n) => n === 1 && space());
    clock.advance(WHOLE_SESSION_MS, 50, () => {
      p();
      if (document.querySelector('[data-glow]')) throw new Error('a glow was shown');
      if (screen.queryByText('Your answer never changes your points.')) probeNote = true;
    });
    expect(probeNote).toBe(false);
    expect(screen.queryByTestId('points')).toBeNull();
    expect(screen.queryAllByTestId('firefly')).toHaveLength(0);
    await screen.findByRole('heading', { name: 'Session complete' });
    expect(screen.queryByRole('region', { name: 'Your game' })).toBeNull();
  }, 15_000);
});

describe('Stop in every variant (Spec 009)', () => {
  for (const v of ['plain', 'calm', 'game'] as const)
    it(`shows Stop in the ${v} variant`, async () => {
      renderPlay(v);
      await start();
      expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    });
});

describe('variant override (?variant=)', () => {
  it('reads plain, calm or game from the address, and nothing else', () => {
    expect(parseVariant('?variant=game')).toBe('game');
    expect(parseVariant('?x=1&variant=calm')).toBe('calm');
    expect(parseVariant('?variant=plain')).toBe('plain');
    expect(parseVariant('?variant=loud')).toBeUndefined();
    expect(parseVariant('')).toBeUndefined();
  });

  it('sends the override with the session and shows it', async () => {
    const { backend } = renderPlay('calm', 'game');
    await start();
    expect(backend.started[0]!.body.variant).toBe('game');
    expect(screen.getByTestId('points')).toBeInTheDocument();
  });

  it('sends no variant without an override', async () => {
    const { backend } = renderPlay('game');
    await start();
    expect(backend.started[0]!.body).not.toHaveProperty('variant');
  });
});
