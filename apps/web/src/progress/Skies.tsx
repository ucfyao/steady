import type { CompletedSession } from '@steady/core';
import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { dawnPercent } from '../game/dawn.js';
import styles from './Skies.module.css';

const LATEST = 12;

/**
 * "Your skies" (Spec 007 §3): one small sky per game session, newest first, tinted by the
 * dawn it reached, each a link to its Results. Only the latest 12 until the player asks.
 */
export function Skies({ sessions }: { sessions: CompletedSession[] }) {
  const [all, setAll] = useState(false);
  const skies = sessions
    .map((s, i) => ({ s, n: i + 1 }))
    .filter(({ s }) => s.variant === 'game')
    .reverse();
  if (skies.length === 0) return null;
  const shown = all ? skies : skies.slice(0, LATEST);

  return (
    <section aria-label="Your skies" className={styles.block}>
      <h2>Your skies</h2>
      <ol className={styles.grid}>
        {shown.map(({ s, n }) => {
          const dawn = dawnPercent(s.score);
          return (
            <li key={s.id}>
              <Link
                to={`/results/${s.id}`}
                className={styles.sky}
                aria-label={`Session ${n}: dawn ${dawn}%, ${s.score.points} points`}
                style={{ '--dawn': dawn / 100 } as CSSProperties}
              >
                <span className={styles.tile} aria-hidden="true" />
                <span className={styles.dawn}>{dawn}%</span>
                <span className={styles.points}>{s.score.points} pts</span>
              </Link>
            </li>
          );
        })}
      </ol>
      {skies.length > LATEST && (
        <button type="button" className={styles.more} onClick={() => setAll((a) => !a)}>
          {all ? `Show only the latest ${LATEST}` : `Show all ${skies.length}`}
        </button>
      )}
    </section>
  );
}
