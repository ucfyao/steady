import { validateSubmission, type CompletedSession } from '@steady/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
  render(
    <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
      <MemoryRouter initialEntries={['/play']}>
        <AppRoutes playEnv={clock.env} />
      </MemoryRouter>
    </PlayersProvider>,
  );
  return { backend, clock };
}

/**
 * A simulated player: presses 400 ms after every digit except 3, answers every probe
 * "On task" on the next frame. `press` decides how a press is made.
 */
function simulatedPlayer(
  clock: ReturnType<typeof fakeEnv>,
  press: () => void,
  onTarget?: () => void,
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
    if (probe) fireEvent.click(within(probe).getByRole('button', { name: 'On task' }));
  };
}

const space = () => fireEvent.keyDown(window, { code: 'Space', key: ' ' });
// 3 s countdown + 126 trials × 1150 ms + 4 probes × (1 frame + 1 s) + frame slack
const WHOLE_SESSION_MS = 3000 + 126 * 1200 + 4 * 1100 + 2000;

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

async function startFromCheckIn(sleep?: string) {
  await screen.findByRole('heading', { name: /how are you today/i });
  if (sleep) fireEvent.click(screen.getByRole('radio', { name: sleep }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('Play', () => {
  it('plays a full session and submits a valid body', async () => {
    const { backend, clock } = renderPlay({ returning: true });
    await startFromCheckIn('Poor');
    await screen.findByRole('heading', { name: 'Ready?' });
    expectHowToPlay(/press space for every digit/i);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
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
    await startFromCheckIn();
    await screen.findByRole('heading', { name: /first, a short practice/i });
    expectHowToPlay(/press space for every digit/i);
    expect(screen.getByText(/starts slow/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start practice' }));

    let caught = 0;
    let reminderMissing = 0;
    const player = simulatedPlayer(clock, space);
    // 3 s countdown + 6 × 2000 + 6 × 1500 + 6 × 1150 ms trials, 800 ms feedback each
    const practiceMs = 3000 + 6 * 2000 + 6 * 1500 + 6 * 1150 + 18 * 850 + 1000;
    clock.advance(practiceMs, 50, () => {
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
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
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
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
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
    await startFromCheckIn();
    await screen.findByRole('heading', { name: 'Ready?' });
    expectHowToPlay(/tap the box for every digit/i);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await screen.findByText('3');
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
