// src/lib/email/resend.ts
/**
 * @fileoverview Resend email client — handles all transactional emails.
 * Uses Resend API directly (no SDK needed) for zero-dependency integration.
 * Falls back gracefully if RESEND_API_KEY is not set.
 *
 * 🔧 FIX: Interfaz consistente → { success: boolean, id?, error?: string }
 * Los consumidores deben checar `result.success` (no `result.ok`).
 */

const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Global Solutions Travel <onboarding@resend.dev>';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  /** Optional tag for categorization (e.g. 'booking', 'otp', 'emission') */
  tag?: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Send an email via Resend API.
 * Returns { success: false } if API key is missing (dev mode).
 *
 * ⚠️ Para desarrollo: si RESEND_API_KEY no está configurada, el email
 * se skipea pero el OTP sigue en DB. Puedes verificarlo con:
 * SELECT code_hash FROM auth_otps WHERE email = 'X' ORDER BY created_at DESC LIMIT 1;
 * (necesitarás hashear tu código manualmente para comparar)
 *
 * 💡 Para dominio verificado en producción:
 * 1. Agregar dominio en dashboard.resend.com → Domains
 * 2. Configurar registros DNS (SPF, DKIM, DMARC)
 * 3. Cambiar RESEND_FROM_EMAIL a tu dominio verificado
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  if (!RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not configured — email skipped:', options.subject);
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Email] DEV MODE: OTP code is in auth_otps table. Check DB directly.');
      return { success: true, id: 'dev-mode-skipped' };
    }
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  // Warn about sandbox domain — emails from onboarding@resend.dev go to spam
  if (FROM_EMAIL.includes('resend.dev')) {
    console.warn(
      '[Email] WARNING: Sending from resend.dev sandbox domain. Emails will likely go to spam. ' +
      'Verify your own domain at dashboard.resend.com and set RESEND_FROM_EMAIL to your verified address.'
    );
  }

  try {
    // Build Resend payload with deliverability best practices
    const payload: Record<string, unknown> = {
      from: FROM_EMAIL,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      // Unique ID per email prevents threading/spam grouping
      headers: {
        'X-Entity-Ref-ID': `gst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    };

    if (options.replyTo) payload.reply_to = options.replyTo;

    // Resend tags help with categorization and analytics
    if (options.tag) {
      payload.tags = [{ name: 'category', value: options.tag }];
    }

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.error('[Email] Resend API error:', error);
      return { success: false, error: error.message || `HTTP ${response.status}` };
    }

    const data = await response.json();
    console.log('[Email] Sent successfully:', data.id);
    return { success: true, id: data.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Email] Send failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send multiple emails in parallel. Returns results for each.
 */
export async function sendBulkEmails(emails: SendEmailOptions[]): Promise<SendEmailResult[]> {
  return Promise.all(emails.map(sendEmail));
}