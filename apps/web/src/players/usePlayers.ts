import { useContext } from 'react';
import { PlayersContext, type PlayersContextValue } from './PlayersProvider.js';

export function usePlayers(): PlayersContextValue {
  const ctx = useContext(PlayersContext);
  if (!ctx) throw new Error('usePlayers must be used inside <PlayersProvider>');
  return ctx;
}
