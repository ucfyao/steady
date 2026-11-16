/**
 * Reads `#token=…&name=…` from an import link (printed by `pnpm seed:demo`). The token is in
 * the hash, so the browser never sends it to a server or writes it to a request log.
 */
export function parseImportHash(hash: string): { token: string; name: string } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const token = params.get('token');
  if (!token) return null;
  return { token, name: params.get('name') ?? '' };
}
