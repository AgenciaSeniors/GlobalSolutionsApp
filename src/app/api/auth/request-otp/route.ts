import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // server only
);

const resend = new Resend(process.env.RESEND_API_KEY!);

function hash(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export async function POST(req: Request) {
  const { email } = await req.json();

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
  const codeHash = hash(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  // guardar OTP (y opcional: invalidar anteriores)
  await supabaseAdmin
    .from('auth_otps')
    .update({ consumed_at: new Date().toISOString() })
    .eq('email', email)
    .is('consumed_at', null);

  const { error: dbErr } = await supabaseAdmin.from('auth_otps').insert({
    email,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  // enviar email
  const { error: mailErr } = await resend.emails.send({
    from: 'Global Solutions Travel <onboarding@resend.dev>',
    to: email,
    subject: 'Tu código de verificación (6 dígitos)',
    text: `Tu código es: ${code}\n\nExpira en 10 minutos.`,
  });

  if (mailErr) {
    return NextResponse.json({ error: mailErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
