import { NextResponse } from 'next/server';

export function requireApiKey(req: Request) {
  const expected = process.env.API_KEY;
  if (!expected) return null;
  const got = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (got !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}
