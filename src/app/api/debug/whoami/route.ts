export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

function decodeJwtPayload(jwt: string) {
  const payload = jwt.split('.')[1];
  const json = Buffer.from(payload, 'base64url').toString('utf8');
  return JSON.parse(json) as { role?: string; iss?: string; ref?: string };
}

export async function GET() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!key) return NextResponse.json({ ok: false, error: 'missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });

  const payload = decodeJwtPayload(key);
  return NextResponse.json({ ok: true, role: payload.role, ref: payload.ref, iss: payload.iss });
}
