import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/app.js';
import { auth, newPlayer } from './support/players.js';

const lines: string[] = [];
let t: TestApp;
beforeAll(async () => {
  t = await startTestApp({ logLevel: 'info' }, { write: (line: string) => lines.push(line) });
});
afterAll(() => t?.close());

describe('request logs', () => {
  it('never contain the bearer token', async () => {
    const token = await newPlayer(t);
    lines.length = 0;
    await request(t.http).get('/api/sessions').set(auth(token)).expect(200);

    const logged = lines.join('\n');
    expect(logged).toContain('/api/sessions'); // the request was logged at all
    expect(logged).not.toContain(token);
    expect(logged).toContain('"authorization":"[Redacted]"');
  });
});
