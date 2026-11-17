/**
 * Reads `#token=…` from an import link (printed by `pnpm seed:demo`). The token is in the hash,
 * so the browser never sends it to a server or writes it to a request log. The name is on the
 * server (Spec 013), so an old link's `name=` is ignored.
 */
export function parseImportHash(hash: string): { token: string } | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token');
  return token ? { token } : null;
}
