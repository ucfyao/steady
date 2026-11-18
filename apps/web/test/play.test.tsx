import { validateSubmission, type CompletedSession } from '@steady/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Profiler } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { fakeBackend, tokenN } from './support/fake-api.js';
import { fakeEnv } from './support/fake-env.js';

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
    if (el && index !== seen && text) {
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
// 3 s countdown + 81 trials × 1150 ms + 3 probes × (1 frame + 1 s) + frame slack (Spec 005)
const WHOLE_SESSION_MS = 3000 + 81 * 1200 + 3 * 1100 + 2000;
// 3 s countdown + 4 × 2000 + 4 × 1500 + 4 × 1150 ms trials, 800 ms feedback each
const PRACTICE_MS = 3000 + 4 * 2000 + 4 * 1500 + 4 * 1150 + 12 * 850 + 1000;

/** Step 1 (Spec 004): the short rules, with the 5 / 8 / 3 example. */
function expectHowItWorks(action: RegExp) {
  expect(
    screen.getByRole('heading', { name: 'Catch every digit. Hold back on 3.' }),
  ).toBeInTheDocument();
  const how = screen.getByRole('region', { name: 'How to play' });
  expect(how).toHaveTextContent(action);
  expect(how).toHaveTextContent(/3s are rare/i);
  expect(within(how).getAllByText(/^(Press|Tap)$/, { selector: 'figcaption' })).toHaveLength(2);
  expect(within(how).getByText('Hold back')).toBeInTheDocument();
}

/** "Before you start": the check-in, then Start (or Skip and start). */
async function startFromCheckIn(sleep?: string) {
  await screen.findByRole('heading', { name: /how are you today/i });
  if (sleep) fireEvent.click(screen.getByRole('radio', { name: sleep }));
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
}

const KEYBOARD_HINT = 'Space for every digit except 3';
const PRACTICE_HINT = 'Practice · Space for every digit except 3';
const STEP = /step \d of 2/i;
const countdown = () => screen.findByTestId('countdown');

describe('First time: how it works, practice, before you start', () => {
  it('walks a new player through the two steps, then the countdown', async () => {
    const { backend, clock } = renderPlay({ returning: false });

    // 1. How it works
    await screen.findByRole('heading', { name: 'Catch every digit. Hold back on 3.' });
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    expectHowItWorks(/press space as soon as you see a digit/i);
    expect(screen.getByText('12 digits · about 30 seconds · not saved')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /how are you today/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try a short practice' }));

    // Practice: the rule stays on screen; no step bar in focus mode.
    let hintMissing = 0;
    let stepShown = 0;
    const player = simulatedPlayer(clock, space);
    clock.advance(PRACTICE_MS, 50, () => {
      player();
      if (
        screen.queryByTestId('stimulus') &&
        screen.queryByTestId('hint')?.textContent !== PRACTICE_HINT
      ) {
        if (!screen.queryByTestId('countdown')) hintMissing++;
      }
      if (screen.queryByTestId('stimulus') && screen.queryByText(STEP)) stepShown++;
    });
    expect(hintMissing).toBe(0);
    expect(stepShown).toBe(0);

    // 2. Before you start: how the practice went (counted in the browser, nothing sent),
    // then the check-in and the three points, leaving in the warning colour.
    await screen.findByRole('heading', { name: 'How are you today?' });
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
    expect(screen.getByTestId('practice-line')).toHaveTextContent(
      'Practice: 2 of 2 3s held back · 10 of 10 digits caught',
    );
    expect(screen.getByRole('note', { name: 'One tip' })).toHaveTextContent(/no slips/i);
    expect(screen.getByRole('button', { name: 'Practice again' })).toBeInTheDocument();
    expect(backend.calls.map((c) => c.method)).not.toContain('startSession');
    const points = within(screen.getByRole('list', { name: 'Before you start' }))
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(points).toEqual([
      expect.stringMatching(/about two minutes, at full speed/i),
      expect.stringMatching(/where your mind was/i),
      expect.stringMatching(/leaving cancels the session/i),
    ]);
    fireEvent.click(screen.getByRole('radio', { name: 'Good' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    // 4. Countdown: a ring and a label, never a digit where the digits appear.
    const ring = await countdown();
    expect(ring).toHaveTextContent('Finger on Space');
    expect(screen.getByTestId('stimulus')).toHaveTextContent('');
    expect(screen.queryByText(STEP)).toBeNull();
    expect(backend.started[0]!.body.checkIn).toEqual({ sleep: 'good' });
  });

  it('shows one pill for each kind of practice slip', async () => {
    const { clock } = renderPlay({ returning: false });
    fireEvent.click(await screen.findByRole('button', { name: 'Try a short practice' }));

    // Trial 0 too soon, trial 1 missed, the first 3 held back, the second 3 pressed,
    // every other digit pressed after 400 ms.
    let seen = -1;
    let threes = 0;
    let pressAt: number | null = null;
    const pills = new Set<string>();
    clock.advance(PRACTICE_MS, 50, () => {
      const el = screen.queryByTestId('stimulus');
      const index = Number(el?.dataset.index ?? -1);
      const text = el?.textContent ?? '';
      if (el && index !== seen && text) {
        seen = index;
        pressAt = null;
        if (text === '3') {
          if (++threes === 2) space();
        } else if (index === 0)
          space(); // on the frame that shows it: 0 ms
        else if (index !== 1) pressAt = clock.now() + 400;
      }
      if (pressAt !== null && clock.now() >= pressAt) {
        space();
        pressAt = null;
      }
      const pill = screen.queryByTestId('feedback');
      if (pill) pills.add(pill.textContent!);
    });
    expect([...pills].sort()).toEqual(
      ['Held back ✓', 'Missed', 'That was a 3', 'Too soon', '✓ Nice'].sort(),
    );

    await screen.findByRole('heading', { name: 'How are you today?' });
    expect(screen.getByTestId('practice-line')).toHaveTextContent(
      'Practice: 1 of 2 3s held back · 8 of 10 digits caught · 1 too early',
    );
    // One slip of each kind: the tip is about the 3 (ties go to the 3).
    expect(screen.getByRole('note', { name: 'One tip' })).toHaveTextContent(
      'You pressed on one 3. That is normal: in the real check they are rare and come at full speed.',
    );
  });

  it('Practice again replays the practice round and keeps the answers', async () => {
    const { clock } = renderPlay({ returning: false });
    fireEvent.click(await screen.findByRole('button', { name: 'Try a short practice' }));
    clock.advance(PRACTICE_MS, 50, simulatedPlayer(clock, space));
    await screen.findByRole('heading', { name: 'How are you today?' });
    fireEvent.click(screen.getByRole('radio', { name: 'Good' }));
    fireEvent.click(screen.getByRole('button', { name: 'Practice again' }));
    expect(await countdown()).toBeInTheDocument();
    clock.advance(PRACTICE_MS, 50, simulatedPlayer(clock, space));
    expect(await screen.findByRole('heading', { name: 'How are you today?' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Good' })).toBeChecked();
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
  });
});

describe('Returning: before you start', () => {
  it('lands on the check-in with the three points, no step bar, and goes straight to the countdown', async () => {
    const { backend } = renderPlay({ returning: true });
    await screen.findByRole('heading', { name: 'How are you today?' });
    expect(screen.getByText(/optional/i)).toBeInTheDocument();
    expect(screen.queryByText(STEP)).toBeNull();
    expect(screen.queryByTestId('practice-line')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Practice again' })).toBeNull();
    expect(screen.getByRole('list', { name: 'Before you start' })).toHaveTextContent(
      /leaving cancels the session/i,
    );
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
    expect(screen.getByRole('button', { name: 'Skip and start' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'How to play' })).toBeInTheDocument();

    fireEvent.click(within(stress).getByRole('radio', { name: 'High' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(await countdown()).toBeInTheDocument();
    expect(backend.started[0]!.body.checkIn).toEqual({ stress: 'high' });
    expect(screen.queryByRole('region', { name: 'How to play' })).toBeNull();
  });

  it('Skip and start leaves out the answers and goes straight to the countdown', async () => {
    const { backend } = renderPlay({ returning: true });
    await screen.findByRole('heading', { name: 'How are you today?' });
    fireEvent.click(screen.getByRole('radio', { name: 'Poor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip and start' }));
    expect(await countdown()).toBeInTheDocument();
    expect(backend.started[0]!.body.checkIn).toBeNull();
  });

  it('Skip and start also clears the chosen answers for the next try', async () => {
    const { clock } = renderPlay({ returning: true });
    await screen.findByRole('heading', { name: 'How are you today?' });
    fireEvent.click(screen.getByRole('radio', { name: 'Poor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip and start' }));
    await countdown();
    clock.hide();
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    await screen.findByRole('heading', { name: 'How are you today?' });
    expect(screen.getByRole('radio', { name: 'Poor' })).not.toBeChecked();
  });

  it('How to play shows the rules and comes back with the answers kept', async () => {
    const { backend } = renderPlay({ returning: true });
    await screen.findByRole('heading', { name: 'How are you today?' });
    fireEvent.click(screen.getByRole('radio', { name: 'Good' }));
    fireEvent.click(screen.getByRole('button', { name: 'How to play' }));
    expectHowItWorks(/press space as soon as you see a digit/i);
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip practice' }));
    await screen.findByRole('heading', { name: 'How are you today?' });
    expect(screen.getByRole('radio', { name: 'Good' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(await countdown()).toBeInTheDocument();
    expect(backend.started[0]!.body.checkIn).toEqual({ sleep: 'good' });
  });

  it('How to play lets a returning player practise again before the session', async () => {
    const { backend, clock } = renderPlay({ returning: true });
    await screen.findByRole('heading', { name: 'How are you today?' });
    fireEvent.click(screen.getByRole('radio', { name: 'OK' }));
    fireEvent.click(screen.getByRole('button', { name: 'How to play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try a short practice' }));
    clock.advance(PRACTICE_MS, 50, simulatedPlayer(clock, space));
    await screen.findByRole('heading', { name: 'How are you today?' });
    expect(backend.calls.map((c) => c.method)).not.toContain('startSession');
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
    expect(screen.getByTestId('practice-line')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'OK' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(await countdown()).toBeInTheDocument();
    expect(backend.started).toHaveLength(1);
  });
});

describe('Focus mode', () => {
  it('hides the header during the block, shows only a quiet hint, and no progress', async () => {
    const { clock } = renderPlay({ returning: true });
    await startFromCheckIn();
    await countdown();
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Trends' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Player: / })).toBeNull();
    expect(screen.getByText('Starting…')).toBeInTheDocument();
    clock.advance(3100);
    expect(screen.getByTestId('hint')).toHaveTextContent(KEYBOARD_HINT);

    const player = simulatedPlayer(clock, space);
    let progressShown = 0;
    clock.advance(WHOLE_SESSION_MS, 50, () => {
      player();
      if (screen.queryByRole('progressbar')) progressShown++;
      if (screen.queryByText(/\d+\s*(of|\/)\s*\d+|remaining|left/i)) progressShown++;
    });
    expect(progressShown).toBe(0);
    // Saving: a status, not a bare line of text.
    expect(screen.getByRole('status')).toHaveTextContent('Scoring your session…');
    expect(await screen.findByRole('heading', { name: 'Session complete' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument(); // back after the block
  });

  it('counts down without any number, so no 3 appears before the trials', async () => {
    const { clock } = renderPlay({ returning: true });
    await startFromCheckIn();
    await countdown();
    // Every step of the 3 s countdown: a ring and a label, never a digit anywhere.
    for (let t = 0; t < 2900; t += 100) {
      expect(screen.getByTestId('countdown')).toHaveTextContent('Finger on Space');
      expect(document.body.textContent).not.toMatch(/[0-9]/);
      clock.advance(100);
    }
    // The trials still start on time, at 3 s.
    clock.advance(200);
    expect(screen.queryByTestId('countdown')).toBeNull();
    expect(screen.getByTestId('stimulus').textContent).toMatch(/^[0-9]$/);
  });

  it('does not re-render React for each trial', async () => {
    const { clock, renders } = renderPlay({ returning: true });
    await startFromCheckIn();
    await countdown();
    const before = renders.count;
    // 3 countdown steps, then per probe: probe, resume, trials. Not one per trial (81).
    clock.advance(WHOLE_SESSION_MS - 2000, 50, simulatedPlayer(clock, space));
    expect(renders.count - before).toBeLessThan(30);
  });

  it('keeps the probe answer keys', async () => {
    const { backend, clock } = renderPlay({ returning: true });
    await startFromCheckIn();
    await countdown();
    const player = simulatedPlayer(clock, space, undefined, () =>
      fireEvent.keyDown(window, { key: '2', code: 'Digit2' }),
    );
    clock.advance(WHOLE_SESSION_MS, 50, player);
    await screen.findByRole('heading', { name: 'Session complete' });
    expect(backend.submitted[0]!.body.probeAnswers).toEqual(['drifting', 'drifting', 'drifting']);
  });
});

describe('Play', () => {
  it('plays a full session and submits a valid body', async () => {
    const { backend, clock } = renderPlay({ returning: true });
    await startFromCheckIn('Poor');
    await countdown();
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
    expect(body.probeAnswers).toEqual(['on_task', 'on_task', 'on_task']);
    const pressed = body.rts.filter((rt) => rt !== null);
    expect(pressed).toHaveLength(72);
    expect(new Set(pressed)).toEqual(new Set([400]));
    body.rts.forEach((rt, i) => {
      if (plan.trials[i]!.isTarget) expect(rt).toBeNull();
    });
  });

  it('voids the session when the page is hidden, and submits nothing', async () => {
    const { backend, clock } = renderPlay({ returning: true });
    await startFromCheckIn();
    await countdown();
    clock.advance(10_000, 50, simulatedPlayer(clock, space));
    clock.hide();
    expect(screen.getByRole('heading', { name: 'Session voided' })).toBeInTheDocument();
    expect(screen.getByText(/leaving the page interrupts the timing/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
    clock.advance(WHOLE_SESSION_MS);
    expect(backend.submitted).toEqual([]);
    expect(screen.queryByTestId('stimulus')).toBeNull();

    // Play again: back to "before you start", and a new session can begin.
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    await startFromCheckIn();
    expect(await countdown()).toBeInTheDocument();
    expect(backend.started).toHaveLength(2);
  });

  it('a first-time player who leaves during practice starts again at step 1', async () => {
    const { clock } = renderPlay({ returning: false });
    fireEvent.click(await screen.findByRole('button', { name: 'Try a short practice' }));
    clock.advance(5000);
    clock.hide();
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
  });

  it('lets the player retry a failed submit', async () => {
    const { backend, clock } = renderPlay({ returning: true });
    backend.control.failSubmitOnce = true;
    await startFromCheckIn();
    await countdown();
    clock.advance(WHOLE_SESSION_MS, 50, simulatedPlayer(clock, space));

    const alert = await screen.findByRole('alert');
    // Spec 010: plain words by the error's kind, never the raw message.
    expect(alert).toHaveTextContent('Could not reach Steady. Check your connection and try again.');
    expect(alert).not.toHaveTextContent(/could not reach the server/i);
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Session complete' })).toBeInTheDocument();
    expect(backend.submitted).toHaveLength(1);
  });

  it('on a touch device, counts taps and ignores the keyboard', async () => {
    const { backend, clock } = renderPlay({ returning: true, device: 'touch' });
    await screen.findByRole('heading', { name: 'How are you today?' });
    fireEvent.click(screen.getByRole('button', { name: 'How to play' }));
    expectHowItWorks(/tap the screen as soon as you see a digit/i);
    fireEvent.click(screen.getByRole('button', { name: 'Skip practice' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    expect(await countdown()).toHaveTextContent('Finger on the screen');
    clock.advance(3100);
    expect(screen.getByTestId('hint')).toHaveTextContent('Tap for every digit except 3');
    expect(backend.started[0]!.body.device).toBe('touch');

    const tap = () => fireEvent.pointerDown(screen.getByTestId('tap-area'));
    clock.advance(WHOLE_SESSION_MS, 50, simulatedPlayer(clock, tap, space)); // Space on every 3
    await screen.findByRole('heading', { name: 'Session complete' });

    const { id, body } = backend.submitted[0]!;
    const plan = backend.plans.get(id)!.plan;
    expect(body.rts.filter((rt) => rt !== null)).toHaveLength(72);
    body.rts.forEach((rt, i) => {
      if (plan.trials[i]!.isTarget) expect(rt).toBeNull();
    });
  });
});

// Spec 009: a visible way out of focus mode.
describe('Stop', () => {
  const stop = () => fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
  const escape = () => fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

  it('stops the session from the button: nothing is submitted, and the page says so', async () => {
    const { backend, clock } = renderPlay({ returning: true });
    await startFromCheckIn();
    await countdown();
    clock.advance(10_000, 50, simulatedPlayer(clock, space));
    stop();
    expect(screen.getByRole('heading', { name: 'Session stopped' })).toBeInTheDocument();
    expect(screen.getByText('You stopped the session, so it was not saved.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
    clock.advance(WHOLE_SESSION_MS);
    expect(backend.submitted).toEqual([]);
    expect(screen.queryByTestId('stimulus')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    await startFromCheckIn();
    expect(await countdown()).toBeInTheDocument();
  });

  it('stops during the countdown, and with Escape', async () => {
    renderPlay({ returning: true });
    await startFromCheckIn();
    await countdown();
    escape();
    expect(screen.getByRole('heading', { name: 'Session stopped' })).toBeInTheDocument();
  });

  it('stops over a probe', async () => {
    const { backend, clock } = renderPlay({ returning: true });
    await startFromCheckIn();
    await countdown();
    const probe = () => screen.queryByRole('dialog', { name: /where was your mind/i });
    const p = simulatedPlayer(clock, space, undefined, () => {});
    while (!probe() && clock.now() < WHOLE_SESSION_MS) clock.advance(50, 50, p);
    expect(probe()).not.toBeNull();
    stop();
    expect(screen.getByRole('heading', { name: 'Session stopped' })).toBeInTheDocument();
    expect(backend.submitted).toEqual([]);
  });

  it('stops the practice, and a first-time player starts again at step 1', async () => {
    const { clock } = renderPlay({ returning: false });
    fireEvent.click(await screen.findByRole('button', { name: 'Try a short practice' }));
    clock.advance(5000);
    stop();
    expect(screen.getByRole('heading', { name: 'Practice stopped' })).toBeInTheDocument();
    expect(screen.getByText('You stopped the practice.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
  });

  it('on a touch device, a tap on Stop is not a press', async () => {
    const { backend, clock } = renderPlay({ returning: true, device: 'touch' });
    await startFromCheckIn();
    await countdown();
    clock.advance(3000 + 100); // the first digit is on screen
    expect(screen.getByTestId('stimulus').textContent).not.toBe('');
    const button = screen.getByRole('button', { name: 'Stop' });
    expect(screen.getByTestId('tap-area')).not.toContainElement(button);
    fireEvent.pointerDown(button);
    fireEvent.click(button);
    expect(screen.getByRole('heading', { name: 'Session stopped' })).toBeInTheDocument();
    expect(backend.submitted).toEqual([]);
  });

  it('Space does not stop, and leaving the page still says Session voided', async () => {
    const { clock } = renderPlay({ returning: true });
    await startFromCheckIn();
    await countdown();
    clock.advance(4000);
    screen.getByRole('button', { name: 'Stop' }).focus();
    space();
    expect(screen.getByTestId('stimulus')).toBeInTheDocument();
    clock.hide();
    expect(screen.getByRole('heading', { name: 'Session voided' })).toBeInTheDocument();
  });
});
