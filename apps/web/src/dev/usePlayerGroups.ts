import type { Variant } from '@steady/core';
import { useEffect, useState } from 'react';
import { usePlayers } from '../players/usePlayers.js';
import { useDevTools } from './devTools.js';

/**
 * Development only (Spec 011): each profile's own group, keyed by profile id, from that
 * player's `GET /api/me`. Empty when the tools are off; a group that cannot be read is left out.
 */
export function usePlayerGroups(): Partial<Record<string, Variant>> {
  const on = useDevTools();
  const { profiles, apiFor } = usePlayers();
  const [groups, setGroups] = useState<Partial<Record<string, Variant>>>({});

  useEffect(() => {
    if (!import.meta.env.DEV || !on) return;
    let cancelled = false;
    for (const p of profiles) {
      apiFor(p.id)
        ?.getMe()
        .then((me) => !cancelled && setGroups((g) => ({ ...g, [p.id]: me.variant })))
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [on, profiles, apiFor]);

  return groups;
}
