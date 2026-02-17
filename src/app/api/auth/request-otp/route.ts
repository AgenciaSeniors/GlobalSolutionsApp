import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email/resend';

// Cliente Admin (Service Role) para escribir en tablas protegidas
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function random6Digits() {
  return String(crypto.randomInt(100000, 1000000));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Normalizar email
    const email = String(body?.email ?? '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido o requerido' }, { status: 400 });
    }

    const now = new Date();

    // 2. SEGURIDAD: Rate Limit (Anti-Spam)
    // Buscamos si este email ya pidió código recientemente
    const { data: rl } = await supabaseAdmin
      .from('auth_otp_rate_limits')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (rl?.last_sent_at) {
      const lastSent = new Date(rl.last_sent_at);
      const diffMs = now.getTime() - lastSent.getTime();
      
      // Si pidió hace menos de 60 segundos, bloqueamos
      if (diffMs < 60_000) {
        const remaining = Math.ceil((60000 - diffMs) / 1000);
        return NextResponse.json(
          { error: `Por favor espera ${remaining}s antes de solicitar otro código.` },
          { status: 429 } // Too Many Requests
        );
      }
    }

    // 3. Invalidar OTPs anteriores
    // Para que no se acumulen códigos válidos viejos
    await supabaseAdmin
      .from('auth_otps')
      .update({ used_at: now.toISOString() }) // Lo marcamos como "quemado"
      .eq('email', email)
      .is('used_at', null);

    // 4. Generar nuevo código
    const code = random6Digits();
    const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString(); // 10 mins

    // Insertar el hash del código (nunca el código plano)
    const { error: insErr } = await supabaseAdmin.from('auth_otps').insert({
      email,
      code_hash: sha256(code),
      expires_at: expiresAt,
    });

    if (insErr) {
      console.error('Error guardando OTP:', insErr);
      return NextResponse.json({ error: 'Error interno guardando código.' }, { status: 500 });
    }

    // 5. Actualizar Rate Limit
    // Usamos 'upsert' para crear o actualizar en un solo paso
    await supabaseAdmin
      .from('auth_otp_rate_limits')
      .upsert({ 
        email, 
        last_sent_at: now.toISOString(),
        // Incrementamos contador si existía, si no ponemos 1 (lógica simple aquí)
        send_count: (rl?.send_count ?? 0) + 1 
      });

    // 6. Enviar Email con Resend
    const result = await sendEmail({
      to: email,
      subject: 'Tu código de acceso — Global Solutions Travel',
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
          <h2>🔐 Tu código de verificación</h2>
          <p>Usa el siguiente código para iniciar sesión en Global Solutions Travel:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; padding: 20px; background: #f4f4f5; border-radius: 8px; text-align: center; margin: 20px 0;">
            ${code}
          </div>
          <p style="font-size: 14px; color: #666;">Este código expira en 10 minutos.</p>
          <hr style="border:0; border-top:1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999;">Si no solicitaste este código, puedes ignorar este correo.</p>
        </div>
      `,
    });

    if (!result.success) {
      console.error('[request-otp] Falló envío email:', result.error);
      return NextResponse.json(
        { error: 'No se pudo enviar el email. Verifica tu dirección.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, message: 'Código enviado' });

  } catch (e: unknown) {
    console.error('[request-otp] Error critico:', e);
    const message = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}