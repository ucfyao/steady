import { VARIANTS, type Variant } from '@steady/core';
import { useEffect, useState } from 'react';
import { usePlayers } from '../players/usePlayers.js';
import styles from './VariantBadge.module.css';

/**
 * Development only (Spec 011): the active player's group, the variant this browser plays,
 * and a link to play each variant. The links are full page loads, because the override is
 * read once when the app opens (Spec 006 §5).
 */
export function VariantBadge({ override }: { override?: Variant }) {
  const { api } = usePlayers();
  const [group, setGroup] = useState<Variant | null>(null);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    api
      .getMe()
      .then((me) => !cancelled && setGroup(me.variant))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api]);

  const playing = override ?? group;
  return (
    <aside aria-label="Dev: version" className={styles.badge}>
      <p>Group: {group ?? '…'}</p>
      <p>
        Playing: {playing ?? '…'}
        {override && ' (override)'}
      </p>
      <p className={styles.links}>
        Play as{' '}
        {VARIANTS.map((v) => (
          <a key={v} href={`/play?variant=${v}`} aria-current={v === playing ? 'true' : undefined}>
            {v}
          </a>
        ))}
        {override && <a href="/play">Own group</a>}
      </p>
    </aside>
  );
}
