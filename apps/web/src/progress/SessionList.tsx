import { PROGRESS_CONFIG, type CompletedSession } from '@steady/core';
import { useState } from 'react';
import { Link } from 'react-router';
import { METRICS } from '../metrics/metrics.js';
import { sessionWhen } from './lastCheck.js';
import styles from './SessionList.module.css';

const LATEST = 10;

/**
 * Every session, newest first, each a link to its Results (Spec 004). Only the latest 10
 * until the player asks for all of them.
 */
export function SessionList({ sessions }: { sessions: CompletedSession[] }) {
  const [all, setAll] = useState(false);
  const { commissionRate: held, medianGoRtMs: rt } = METRICS;
  const rows = sessions.map((s, i) => ({ s, n: i + 1 })).reverse();
  const shown = all ? rows : rows.slice(0, LATEST);

  return (
    <>
      <ol className={styles.list}>
        {shown.map(({ s, n }) => (
          <li key={s.id}>
            <Link to={`/results/${s.id}`} className={styles.row}>
              <span className={styles.when}>
                <span className={styles.session}>Session {n}</span>
                <span className={styles.date}>{sessionWhen(s.completedAt)}</span>
                {n <= PROGRESS_CONFIG.practiceSessions && (
                  <span className={styles.tag}>Not counted</span>
                )}
              </span>
              <span className={styles.stat}>
                <span className={styles.number}>
                  {held.format(held.show(s.score.commissionRate))}
                </span>
                <span className={styles.label}>{held.name}</span>
              </span>
              <span className={styles.stat}>
                <span className={styles.number}>
                  {s.score.medianGoRtMs === null ? '—' : rt.format(s.score.medianGoRtMs)}
                </span>
                <span className={styles.label}>{rt.name}</span>
              </span>
              <span className={styles.chevron} aria-hidden="true">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {rows.length > LATEST && (
        <button type="button" className={styles.more} onClick={() => setAll((a) => !a)}>
          {all ? `Show only the latest ${LATEST}` : `Show all ${rows.length} sessions`}
        </button>
      )}
    </>
  );
}
