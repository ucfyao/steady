import type { InputDevice } from '@steady/core';

const MASK = '⊗';

/** The rules, shown before practice and before every real session (Spec 004). */
export function HowToPlay({ device }: { device: InputDevice }) {
  const action = device === 'touch' ? 'Tap the box' : 'Press Space';
  return (
    <section className="how-to" aria-labelledby="how-to-title">
      <h2 id="how-to-title">How to play</h2>
      <ol className="how-steps">
        <li>
          A digit flashes in the box, then turns into <span className="how-mask">{MASK}</span>.
        </li>
        <li>
          <strong>{action}</strong> for every digit, as soon as you see it.
        </li>
        <li>
          <strong>But not for 3.</strong> When you see a 3, hold back.
        </li>
        <li>A press still counts while {MASK} is showing, so you have just over a second.</li>
      </ol>
      <div className="how-example" aria-hidden="true">
        <figure>
          <span className="how-digit">5</span>
          <figcaption>{device === 'touch' ? 'Tap' : 'Press'}</figcaption>
        </figure>
        <figure>
          <span className="how-digit">8</span>
          <figcaption>{device === 'touch' ? 'Tap' : 'Press'}</figcaption>
        </figure>
        <figure className="how-target">
          <span className="how-digit">3</span>
          <figcaption>Hold back</figcaption>
        </figure>
      </div>
      <p className="lead">
        3s are rare and come fast, so everyone presses on some of them by habit. That is what this
        check measures. Speed and accuracy matter equally.
      </p>
    </section>
  );
}
