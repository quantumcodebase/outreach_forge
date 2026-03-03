import { NextResponse } from 'next/server';

export function requireApiKey(req: Request) {
  const expected = process.env.API_KEY;
  if (!expected) return NextResponse.json({ error: 'API_KEY not configured' }, { status: 401 });
  const got = req.headers.get('x-api-key');
  if (!got || got !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}
