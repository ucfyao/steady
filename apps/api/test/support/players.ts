import request from 'supertest';
import type { TestApp } from './app.js';

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function newPlayer(t: TestApp): Promise<string> {
  const res = await request(t.http).post('/api/players').expect(201);
  return res.body.token as string;
}
