import type { Variant } from '@steady/core';
import { usePlayers } from '../players/usePlayers.js';
import { useDevTools } from './devTools.js';

const NONE: Partial<Record<string, Variant>> = {};

/**
 * Development only (Spec 011): each profile's own group, keyed by profile id, from that
 * player's `GET /api/me` (read with the names, Spec 013). Empty when the tools are off; a group
 * that cannot be read is left out.
 */
export function usePlayerGroups(): Partial<Record<string, Variant>> {
  const on = useDevTools();
  const { groups } = usePlayers();
  return import.meta.env.DEV && on ? groups : NONE;
}
