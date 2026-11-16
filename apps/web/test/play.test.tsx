import { validateSubmission, type CompletedSession } from '@steady/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Profiler } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { fakeBackend, tokenN } from './support/fake-api.js';
import { fakeEnv } from './support/fake-env.js';

const MASK = '⊗';

function renderPlay(opts: { returning: boolean; device?: 'keyboard' | 'touch' }) {
  const backend = fakeBackend();
  if (opts.returning) backend.sessions.set(tokenN(1), [{ id: 'old' }] as CompletedSession[]);
  const clock = fakeEnv(opts.device ?? 'keyboard');
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

/**
 * A simulated player: presses 400 ms after every digit except 3, answers every probe
 * "On task" on the next frame. `press` decides how a press is made.
 */
function simulatedPlayer(
  clock: ReturnType<typeof fakeEnv>,
  press: () => void,
  onTarget?: () => void,
  answerProbe?: () => void,
) {
  let seen = -1;
  let pressAt: number | null = null;
  return () => {
    const el = screen.queryByTestId('stimulus');
    const index = Number(el?.dataset.index ?? -1);
    const text = el?.textContent ?? '';
    if (el && index !== seen && text && text !== MASK) {
      seen = index;
      if (text === '3') {
        pressAt = null;
        onTarget?.();
      } else pressAt = clock.now() + 400;
    }
    if (pressAt !== null && clock.now() >= pressAt) {
      press();
      pressAt = null;
    }
    const probe = screen.queryByRole('dialog', { name: /where was your mind/i });
    if (probe) {
      if (answerProbe) answerProbe();
      else fireEvent.click(within(probe).getByRole('button', { name: 'On task' }));
    }
  };
}

const space = () => fireEvent.keyDown(window, { code: 'Space', key: ' ' });
// 3 s countdown + 126 trials × 1150 ms + 4 probes × (1 frame + 1 s) + frame slack
const WHOLE_SESSION_MS = 3000 + 126 * 1200 + 4 * 1100 + 2000;
// 3 s countdown + 6 × 2000 + 6 × 1500 + 6 × 1150 ms trials, 800 ms feedback each
const PRACTICE_MS = 3000 + 6 * 2000 + 6 * 1500 + 6 * 1150 + 18 * 850 + 1000;

/** The how-to-play steps from Spec 004, for the given device. */
function expectHowToPlay(action: RegExp) {
  const how = screen.getByRole('region', { name: 'How to play' });
  const steps = within(how)
    .getAllByRole('listitem')
    .map((li) => li.textContent);
  expect(steps).toHaveLength(4);
  expect(steps[0]).toMatch(/digit flashes.*⊗/i);
  expect(steps[1]).toMatch(action);
  expect(steps[2]).toMatch(/not for 3/i);
  expect(steps[3]).toMatch(/still counts while ⊗/i);
  expect(how).toHaveTextContent(/everyone presses on some/i);
}

/** Check-in, then the button that leaves it: "Start" (returning) or "Continue" (first time). */
async function startFromCheckIn(sleep?: string, button: 'Start' | 'Continue' = 'Start') {
  await screen.findByRole('heading', { name: /how are you today/i });
  if (sleep) fireEvent.click(screen.getByRole('radio', { name: sleep }));
  fireEvent.click(screen.getByRole('button', { name: button }));
}

const KEYBOARD_HINT = 'Space for every digit except 3';

describe('Check-in and the way into a session', () => {
  it('a returning player checks in on one screen and goes straight to the countdown', async () => {
    const { backend } = renderPlay({ returning: true });
    await screen.findByRole('heading', { name: 'How are you today?' });
    expect(screen.getByText('Optional. It never changes your score.')).toBeInTheDocument();
    const sleep = screen.getByRole('group', { name: 'Sleep' });
    const stress = screen.getByRole('group', { name: 'Stress' });
    expect(
      within(sleep)
        .getAllByRole('radio')
        .map((r) => r.getAttribute('value')),
    ).toEqual(['poor', 'ok', 'good']);
    expect(
      within(stress)
        .getAllByRole('radio')
        .map((r) => r.getAttribute('value')),
    ).toEqual(['low', 'medium', 'high']);
    // Nothing is chosen for the player.
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'How to play' })).toBeInTheDocument();

    fireEvent.click(within(stress).getByRole('radio', { name: 'High' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByText('3')).toBeInTheDocument(); // countdown
    expect(backend.started[0]!.body.checkIn).toEqual({ stress: 'high' });
    expect(screen.queryByRole('region', { name: 'How to play' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start practice' })).toBeNull();
  });

  it('Skip leaves out the answers and goes straight to the countdown', async () => {
    const { backend } = renderPlay({ returning: true });
    await screen.findByRole('heading', { name: 'How are you today?' });
    fireEvent.click(screen.getByRole('radio', { name: 'Poor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(backend.started[0]!.body.checkIn).toBeNull();
    expect(screen.queryByRole('region', { name: 'How to play' })).toBeNull();
  });

  it('How to play shows the rules and starts the session with the check-in kept', async () => {
    const { backend } = renderPlay({ returning: true });
    await screen.findByRole('heading', { name: 'How are you today?' });
    fireEvent.click(screen.getByRole('radio', { name: 'Good' }));
    fireEvent.click(screen.getByRole('button', { name: 'How to play' }));
    expectHowToPlay(/press space for every digit/i);
    expect(backend.started).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(backend.started[0]!.body.checkIn).toEqual({ sleep: 'good' });
  });

  it('How to play lets a returning player practise again before the session', async () => {
    const { backend, clock } = renderPlay({ returning: true });
    await screen.findByRole('heading', { name: 'How are you today?' });
    fireEvent.click(screen.getByRole('button', { name: 'How to play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Practice again' }));
    clock.advance(PRACTICE_MS, 50, simulatedPlayer(clock, space));
    expect(await screen.findByText(/practice complete/i)).toBeInTheDocument();
    expect(backend.calls.map((c) => c.method)).not.toContain('startSession');
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(backend.started).toHaveLength(1);
  });

  it('a first-time player continues from the check-in to the practice round', async () => {
    renderPlay({ returning: false });
    await screen.findByRole('heading', { name: 'How are you today?' });
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'How to play' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(
      await screen.findByRole('heading', { name: /first, a short practice/i }),
    ).toBeInTheDocument();
  });
});

describe('Focus mode', () => {
  it('hides the header during the block, shows only a quiet hint, and no progress', async () => {
    const { clock } = renderPlay({ returning: true });
    await startFromCheckIn();
    await screen.findByText('3');
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Progress' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Player: / })).toBeNull();
    expect(screen.getByText(KEYBOARD_HINT)).toBeInTheDocument();

    const player = simulatedPlayer(clock, space);
    let progressShown = 0;
    clock.advance(WHOLE_SESSION_MS, 50, () => {
      player();
      if (screen.queryByRole('progressbar')) progressShown++;
      if (screen.queryByText(/\d+\s*(of|\/)\s*\d+|remaining|left/i)) progressShown++;
    });
    expect(progressShown).toBe(0);
    expect(await screen.findByRole('heading', { name: 'Session complete' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument(); // back after the block
  });

  it('does not re-render React for each trial', async () => {
    const { clock, renders } = renderPlay({ returning: true });
    await startFromCheckIn();
    await screen.findByText('3');
    const before = renders.count;
    // 3 countdown steps, then per probe: probe, resume, trials. Not one per trial (126).
    clock.advance(WHOLE_SESSION_MS - 2000, 50, simulatedPlayer(clock, space));
    expect(renders.count - before).toBeLessThan(30);
  });

  it('keeps the probe answer keys', async () => {
    const { backend, clock } = renderPlay({ returning: true });
    await startFromCheckIn();
    await screen.findByText('3');
    const player = simulatedPlayer(clock, space, undefined, () =>
      fireEvent.keyDown(window, { key: '2', code: 'Digit2' }),
    );
    clock.advance(WHOLE_SESSION_MS, 50, player);
    await screen.findByRole('heading', { name: 'Session complete' });
    expect(backend.submitted[0]!.body.probeAnswers).toEqual([
      'drifting',
      'drifting',
      'drifting',
      'drifting',
    ]);
  });
});

describe('Play', () => {
  it('plays a full session and submits a valid body', async () => {
    const { backend, clock } = renderPlay({ returning: true });
    await startFromCheckIn('Poor');
    await screen.findByText('3'); // countdown
    expect(backend.started).toEqual([
      { token: tokenN(1), body: { checkIn: { sleep: 'poor' }, device: 'keyboard' } },
    ]);

    // Taps on every 3 must not count: a keyboard session only listens to Space.
    const tapOnTarget = () => fireEvent.pointerDown(screen.getByTestId('tap-area'));
    clock.advance(WHOLE_SESSION_MS, 50, simulatedPlayer(clock, space, tapOnTarget));
    expect(await screen.findByRole('heading', { name: 'Session complete' })).toBeInTheDocument();

    const { id, body } = backend.submitted[0]!;
    const plan = backend.plans.get(id)!.plan;
    expect(validateSubmission({ seed: 0, ...plan }, body)).toEqual({ ok: true });
    expect(body.probeAnswers).toEqual(['on_task', 'on_task', 'on_task', 'on_task']);
    const pressed = body.rts.filter((rt) => rt !== null);
    expect(pressed).toHaveLength(112);
    expect(new Set(pressed)).toEqual(new Set([400]));
    body.rts.forEach((rt, i) => {
      if (plan.trials[i]!.isTarget) expect(rt).toBeNull();
    });
  });

  it('runs the practice round first for a new player, without touching the server', async () => {
    const { backend, clock } = renderPlay({ returning: false });
    await startFromCheckIn(undefined, 'Continue');
    await screen.findByRole('heading', { name: /first, a short practice/i });
    expectHowToPlay(/press space for every digit/i);
    expect(screen.getByText(/starts slow/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start practice' }));

    let caught = 0;
    let reminderMissing = 0;
    const player = simulatedPlayer(clock, space);
    clock.advance(PRACTICE_MS, 50, () => {
      player();
      if (screen.queryByText('Caught it')) caught++;
      const inBlock = screen.queryByTestId('stimulus') !== null;
      if (inBlock && !screen.queryByText('Press Space for every digit except 3')) reminderMissing++;
    });
    expect(caught).toBeGreaterThan(0);
    expect(reminderMissing).toBe(0);
    expect(await screen.findByText(/practice complete/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(backend.calls.map((c) => c.method)).not.toContain('startSession');
  });

  it('voids the session when the page is hidden, and submits nothing', async () => {
    const { backend, clock } = renderPlay({ returning: true });
    await startFromCheckIn();
    await screen.findByText('3');
    clock.advance(10_000, 50, simulatedPlayer(clock, space));
    clock.hide();
    expect(screen.getByRole('heading', { name: /session voided/i })).toBeInTheDocument();
    clock.advance(WHOLE_SESSION_MS);
    expect(backend.submitted).toEqual([]);
    expect(screen.queryByTestId('stimulus')).toBeNull();
  });

  it('lets the player retry a failed submit', async () => {
    const { backend, clock } = renderPlay({ returning: true });
    backend.control.failSubmitOnce = true;
    await startFromCheckIn();
    await screen.findByText('3');
    clock.advance(WHOLE_SESSION_MS, 50, simulatedPlayer(clock, space));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not reach the server/i);
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Session complete' })).toBeInTheDocument();
    expect(backend.submitted).toHaveLength(1);
  });

  it('on a touch device, counts taps and ignores the keyboard', async () => {
    const { backend, clock } = renderPlay({ returning: true, device: 'touch' });
    await screen.findByRole('heading', { name: 'How are you today?' });
    fireEvent.click(screen.getByRole('button', { name: 'How to play' }));
    expectHowToPlay(/tap the screen for every digit/i);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await screen.findByText('3');
    expect(screen.getByText('Tap for every digit except 3')).toBeInTheDocument();
    expect(backend.started[0]!.body.device).toBe('touch');

    const tap = () => fireEvent.pointerDown(screen.getByTestId('tap-area'));
    clock.advance(WHOLE_SESSION_MS, 50, simulatedPlayer(clock, tap, space)); // Space on every 3
    await screen.findByRole('heading', { name: 'Session complete' });

    const { id, body } = backend.submitted[0]!;
    const plan = backend.plans.get(id)!.plan;
    expect(body.rts.filter((rt) => rt !== null)).toHaveLength(112);
    body.rts.forEach((rt, i) => {
      if (plan.trials[i]!.isTarget) expect(rt).toBeNull();
    });
  });
});
