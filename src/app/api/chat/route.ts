import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * Chat API: cost-controlled assistant for Global Solutions Travel.
 * - Step 1: in-scope filter (typo-tolerant)
 * - Step 2: daily rate limit (RPC)
 * - Step 3: shorter history (6 messages)
 * - Step 4: concise answers + max_tokens
 * - Booking ops: smart booking status responses (PNR/booking code, payment, emission, voucher)
 */

// -----------------------------
// Request schema
// -----------------------------
const BodySchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
});

// -----------------------------
// KB (RAG-lite). Later migrate to pgvector.
// -----------------------------
const KB: ReadonlyArray<{ title: string; text: string }> = [
  {
    title: 'Equipaje',
    text:
      'El equipaje permitido varía según aerolínea/tarifa. Si me dices tu aerolínea y ruta, te indico el equipaje típico.',
  },
  {
    title: 'Pagos',
    text:
      'Aceptamos Stripe (tarjetas), PayPal y Zelle (manual). En Zelle un agente confirma el pago antes de emitir.',
  },
  {
    title: 'Emisión de boletos',
    text:
      'Después del pago, la emisión puede tardar hasta 24 horas. Enviaremos el voucher/PDF por email y estará disponible en la app.',
  },
  {
    title: 'Cancelaciones y cambios',
    text:
      'Las políticas dependen de la aerolínea y tarifa. Para revisar un caso específico, necesito tu código de reserva/PNR y tu correo.',
  },
  {
    title: 'Soporte',
    text:
      'Si tu caso es urgente o complejo, puedo escalarlo a un agente. Escribe: "Hablar con un agente".',
  },
  {
    title: 'Destinos principales',
    text:
      'Operamos vuelos a Cuba (La Habana HAV, Varadero VRA, Holguín HOG, Santiago SCU), México (CDMX MEX, Cancún CUN), Panamá (PTY), España (Madrid MAD, Barcelona BCN) y USA (Miami MIA, Nueva York JFK/EWR).',
  },
  {
    title: 'Aerolíneas disponibles',
    text:
      'Trabajamos con Copa Airlines (hub en PTY), Iberia, American Airlines, JetBlue, Aeromexico, Wingo y Cubana de Aviación. La disponibilidad varía según la ruta y fecha.',
  },
  {
    title: 'Proceso de reserva',
    text:
      'Pasos: 1) Busca tu vuelo en la sección Vuelos. 2) Selecciona el vuelo. 3) Completa los datos de los pasajeros. 4) Elige tu método de pago. 5) Confirma el checkout. Recibirás el voucher en tu correo.',
  },
  {
    title: 'Tiempos de emisión según método de pago',
    text:
      'Stripe y PayPal: el pago se confirma automáticamente y la emisión del boleto toma hasta 24 horas. Zelle: un agente confirma el pago manualmente en 2–4 horas, luego procede la emisión.',
  },
  {
    title: 'Documentos requeridos para viajar',
    text:
      'Necesitas pasaporte vigente con al menos 6 meses de validez. Ciudadanos cubanos deben presentar pasaporte cubano. Algunos destinos requieren visa (ej: USA, Schengen). Consulta requisitos con tu agente.',
  },
  {
    title: 'Renta de autos',
    text:
      'Ofrecemos renta de autos en Cuba. Categorías disponibles: económico, compacto y SUV, con transmisión manual o automática. Se requiere licencia de conducir vigente y pasaporte. El seguro básico está incluido.',
  },
  {
    title: 'Escalas y conexiones frecuentes',
    text:
      'La mayoría de vuelos hacia Cuba tienen escala en Ciudad de Panamá (PTY) con Copa Airlines o en Miami (MIA). La duración total varía entre 8 y 16 horas según el origen.',
  },
  {
    title: 'Programa de lealtad',
    text:
      'Acumulas puntos automáticamente con cada reserva completada. Los puntos se pueden canjear como descuento en tu próxima reserva. Consulta tu saldo en la sección "Mi Perfil".',
  },
  {
    title: 'Política de cancelación y cambios',
    text:
      'Las políticas dependen de la aerolínea y el tipo de tarifa. Tarifas flex permiten cambios o cancelaciones con reembolso parcial. Tarifas básicas pueden ser no reembolsables. Para revisar tu caso escríbeme tu código de reserva.',
  },
  {
    title: 'Contacto y horario de atención',
    text:
      'Nuestros agentes atienden de lunes a viernes, 9am–6pm (hora de Cuba). Para urgencias puedes contactarnos por WhatsApp. Escribe "Hablar con un agente" en este chat para ser conectado de inmediato.',
  },
] as const;

function pickKBSnippets(userText: string): string {
  const q = normalizeText(userText);
  const scored = KB.map((k) => {
    const tokens = normalizeText(k.title + ' ' + k.text).split(' ').filter(Boolean);
    const hits = tokens.reduce((acc, t) => (q.includes(t) ? acc + 1 : acc), 0);
    return { ...k, hits };
  })
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3);

  const top = scored.filter((s) => s.hits > 0);
  if (!top.length) return '';
  return top.map((s) => `• ${s.title}: ${s.text}`).join('\n');
}

// -----------------------------
// In-scope filter (typo-tolerant)
// -----------------------------
function normalizeText(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const temp = dp[i];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i] = Math.min(
        dp[i] + 1, // delete
        dp[i - 1] + 1, // insert
        prev + cost, // replace
      );
      prev = temp;
    }
  }
  return dp[a.length];
}

function fuzzyIncludes(text: string, needle: string, maxDistance: number) {
  if (!needle) return false;
  if (text.includes(needle)) return true;

  const words = text.split(' ').filter(Boolean);
  for (const w of words) {
    if (w.length < 4 || needle.length < 4) continue;
    const d = levenshtein(w, needle);
    if (d <= maxDistance) return true;
  }
  return false;
}

const ALLOWED_TERMS: ReadonlyArray<string> = [
  // Marca / agencia
  'global solutions', 'global', 'solutions', 'globalsolutions', 'gsolutions',
  // Reservas / vuelos
  'vuelo', 'vuelos', 'buelos',
  'reserva', 'reservas', 'reserba', 'resreva', 'reservacion', 'reservar', 'booking', 'bokking',
  'pnr', 'localizador', 'codigo', 'codgo', 'locator',
  'itinerario', 'ruta', 'trayecto', 'horario', 'schedule',
  'salida', 'llegada', 'regreso', 'ida', 'vuelta',
  'escala', 'escalas', 'conexion', 'conecxion', 'stop',
  'aeropuerto', 'airport',
  'aerolinea', 'areolinea', 'airline',
  'iata', 'terminal', 'puerta', 'gate',
  'asiento', 'seat', 'checkin', 'check in', 'check-in',
  // Pagos
  'pago', 'pagos', 'pagar', 'paypal', 'pay pal', 'stripe', 'tarjeta', 'targeta', 'credito', 'debito',
  'zelle', 'sel', 'transferencia', 'banco', 'bank',
  'comision', 'comicion', 'fee', 'cargo', 'impuesto', 'tax', 'factura', 'recibo', 'receipt',
  // Reembolsos / cambios
  'reembolso', 'reembolo', 'reembolzo', 'refund', 'devolucion',
  'cancelar', 'cancelacion', 'anular', 'cambio', 'modificar', 'reprogramar', 'reagendar',
  // Documentos / voucher
  'voucher', 'vaucher', 'baucher', 'pdf', 'documento',
  'boleto', 'ticket', 'tiket', 'eticket', 'e ticket',
  'emision', 'emitir', 'emitido',
  // Equipaje
  'equipaje', 'equipage', 'maleta', 'valija', 'bodega', 'cabina', 'carry', 'carryon',
  // Soporte / agente
  'soporte', 'ayuda', 'asistencia', 'agente', 'agent', 'humano', 'persona', 'representante', 'reclamo', 'queja',
  // Autos
  'auto', 'carro', 'coche', 'renta', 'alquiler', 'car rental', 'vehiculo',
] as const;

function isInScope(rawText: string) {
  const t = normalizeText(rawText);

  // si parece PNR / booking_code (6-10 alfanum) lo dejamos pasar
  if (/\b[a-z0-9]{6,10}\b/.test(t)) return true;

  const quickPass = [
    'hablar con un agente',
    'hablar con alguien',
    'quiero un agente',
    'necesito ayuda con mi reserva',
    'estado de mi reserva',
    'estado de mi vuelo',
    'mi reserva',
    'mi booking',
  ].map(normalizeText);

  if (quickPass.some((p) => t.includes(p))) return true;

  for (const termRaw of ALLOWED_TERMS) {
    const term = normalizeText(termRaw);
    const maxDist = term.length >= 8 ? 2 : 1;
    if (fuzzyIncludes(t, term, maxDist)) return true;
  }

  return false;
}

// -----------------------------
// Rate limit (Step 2) via RPC
// -----------------------------
function dayKeyUTC() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getClientIp(req: Request) {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  return 'unknown';
}

const RateLimitResultSchema = z.object({
  allowed: z.boolean(),
  count: z.number().int(),
});

async function checkDailyRateLimit(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string | null;
  req: Request;
}) {
  const { supabase, userId, req } = params;

  const MAX_PER_DAY_GUEST = 5;
  const MAX_PER_DAY_USER = 25;

  const ip = getClientIp(req);
  const key = userId ? `u:${userId}:${dayKeyUTC()}` : `ip:${ip}:${dayKeyUTC()}`;
  const limit = userId ? MAX_PER_DAY_USER : MAX_PER_DAY_GUEST;

  // Prefer RPC (security definer) to avoid RLS issues.
  const { data, error } = await supabase.rpc('increment_chat_rate_limit', {
    p_key: key,
    p_limit: limit,
  });

  if (error) {
    // If RPC isn't configured yet, fail "open" but do NOT break chat.
    // You can lock it down by adding the RPC from README.
    return { ok: true, allowed: true, count: 0, key, note: 'rpc_missing_or_denied' as const };
  }

  const parsed = RateLimitResultSchema.safeParse(Array.isArray(data) ? data[0] : data);
  if (!parsed.success) {
    return { ok: true, allowed: true, count: 0, key, note: 'rpc_bad_shape' as const };
  }

  return { ok: true, allowed: parsed.data.allowed, count: parsed.data.count, key, note: null };
}

// -----------------------------
// Booking ops (Phase 2 recommendation)
// -----------------------------
function extractPossibleCode(text: string): string | null {
  const t = text.toUpperCase();
  // supports "GST-XXXX" too
  const gst = t.match(/\bGST-[A-Z0-9]{3,8}\b/);
  if (gst) return gst[0];

  const m = t.match(/\b[A-Z0-9]{6,10}\b/);
  return m ? m[0] : null;
}

function looksLikeBookingIntent(message: string) {
  const t = normalizeText(message);
  const intentTerms = [
    'estado de mi reserva',
    'mi reserva',
    'mi booking',
    'mi vuelo',
    'pnr',
    'localizador',
    'codigo de reserva',
    'voucher',
    'emitido',
    'emision',
    'pago',
    'reembolso',
    'cancelacion',
    'cancelar',
  ].map(normalizeText);

  return intentTerms.some((k) => t.includes(k));
}

const BookingRowSchema = z.object({
  booking_code: z.string(),
  airline_pnr: z.string().nullable().optional(),
  booking_status: z.string().nullable().optional(),
  payment_status: z.string().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  total_amount: z.union([z.number(), z.string()]).optional(),
  currency: z.string().nullable().optional(),
  created_at: z.string().optional(),
  emitted_at: z.string().nullable().optional(),
  voucher_pdf_url: z.string().nullable().optional(),
  refunded_at: z.string().nullable().optional(),
  refund_amount: z.union([z.number(), z.string()]).nullable().optional(),
});

type BookingRow = z.infer<typeof BookingRowSchema>;

function formatMoney(amount: BookingRow['total_amount'], currency: string | null | undefined) {
  const cur = currency ?? 'USD';
  const n = typeof amount === 'number' ? amount : (amount ? Number(amount) : NaN);
  if (!Number.isFinite(n)) return null;
  return `${cur} ${n.toFixed(2)}`;
}

function formatBookingResponse(booking: BookingRow) {
  const bookingCode = booking.booking_code;
  const pnr = booking.airline_pnr ?? null;
  const bookingStatus = booking.booking_status ?? 'pending_emission';
  const paymentStatus = booking.payment_status ?? 'pending';
  const paid = paymentStatus === 'paid';
  const emitted = Boolean(booking.emitted_at) || Boolean(booking.voucher_pdf_url);
  const money = formatMoney(booking.total_amount, booking.currency);

  const lines: string[] = [];

  lines.push(`✅ **Estado de tu reserva**`);
  lines.push(`• Código: **${bookingCode}**`);
  if (pnr) lines.push(`• PNR aerolínea: **${pnr}**`);

  lines.push(`• Pago: **${paymentStatus}**${money ? ` (${money})` : ''}`);
  lines.push(`• Reserva: **${bookingStatus}**`);

  // Next steps logic
  if (!paid) {
    lines.push('');
    lines.push('Siguiente paso: completa el **pago** para poder emitir el boleto.');
    lines.push('Si necesitas ayuda con el pago, dime si usarás **Stripe**, **PayPal** o **Zelle**.');
  } else if (bookingStatus === 'pending_emission' && !emitted) {
    lines.push('');
    lines.push('Tu pago está confirmado ✅. La **emisión** puede tardar hasta **24 horas**.');
    lines.push('Te avisaremos cuando esté listo tu voucher/PDF.');
  } else if (emitted) {
    lines.push('');
    lines.push('Tu boleto/voucher está disponible ✅.');
    if (booking.voucher_pdf_url) lines.push(`• Voucher: ${booking.voucher_pdf_url}`);
    lines.push('Si no lo ves en tu correo, confirma que el email esté correcto en tu perfil.');
  } else if (bookingStatus === 'cancelled') {
    lines.push('');
    lines.push('Esta reserva aparece como **cancelada**. Si deseas revisar opciones, puedo pasarte con un agente.');
  } else if (bookingStatus === 'refunded') {
    lines.push('');
    const refundAmount = booking.refund_amount ? formatMoney(booking.refund_amount, booking.currency) : null;
    lines.push(`El reembolso está marcado como **procesado**${refundAmount ? ` por **${refundAmount}**` : ''}.`);
    lines.push('Si necesitas el comprobante, dime y lo gestionamos con un agente.');
  }

  lines.push('');
  lines.push('Si quieres, escribe: **"Hablar con un agente"**.');

  return lines.join('\n');
}

async function lookupBooking(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  code: string;
}): Promise<BookingRow | null> {
  const { supabase, userId, code } = params;

  const { data, error } = await supabase
    .from('bookings')
    .select('booking_code,airline_pnr,booking_status,payment_status,payment_method,total_amount,currency,created_at,emitted_at,voucher_pdf_url,refunded_at,refund_amount')
    .eq('user_id', userId)
    .or(`booking_code.eq.${code},airline_pnr.eq.${code}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const parsed = BookingRowSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

async function listRecentBookings(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  limit: number;
}): Promise<BookingRow[]> {
  const { supabase, userId, limit } = params;

  const { data } = await supabase
    .from('bookings')
    .select('booking_code,airline_pnr,booking_status,payment_status,payment_method,total_amount,currency,created_at,emitted_at,voucher_pdf_url,refunded_at,refund_amount')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data || !Array.isArray(data)) return [];

  const out: BookingRow[] = [];
  for (const row of data) {
    const parsed = BookingRowSchema.safeParse(row);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

function formatRecentBookings(list: BookingRow[]) {
  if (!list.length) return 'No encontré reservas recientes en tu cuenta.';
  const lines: string[] = [];
  lines.push('Encontré estas reservas recientes:');
  for (const b of list) {
    lines.push(`• **${b.booking_code}** — pago: ${b.payment_status ?? 'pending'} — estado: ${b.booking_status ?? 'pending_emission'}`);
  }
  lines.push('');
  lines.push('Escribe el **código** (por ejemplo, GST-XXXX) o el **PNR** para ver el detalle.');
  return lines.join('\n');
}

// -----------------------------
// OpenAI call (Chat Completions)
// -----------------------------
async function openaiChatCompletion(args: {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens: number;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: args.maxTokens,
      messages: [{ role: 'system', content: args.system }, ...args.messages],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${errText}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = json.choices?.[0]?.message?.content?.trim();
  return content || 'Lo siento, no pude generar respuesta en este momento.';
}

// -----------------------------
// Route handler
// -----------------------------
export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const { conversationId, message } = parsed.data;

  // Step 1: do not spend tokens out of scope
  if (!isInScope(message)) {
    return NextResponse.json({
      reply:
        'Solo puedo ayudarte con temas de Global Solutions Travel: vuelos, reservas/PNR, pagos, reembolsos, equipaje, vouchers y soporte. ' +
        'Cuéntame tu duda relacionada con tu viaje o tu reserva.',
    });
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  // Step 2: daily rate limit (before LLM)
  const rl = await checkDailyRateLimit({ supabase, userId: user?.id ?? null, req });
  if (!rl.allowed) {
    return NextResponse.json({
      reply: 'Has alcanzado el límite diario de mensajes. Escribe “Hablar con un agente” para escalar.',
    });
  }

  // Booking intent: if user asks about booking and is logged in, answer without LLM when possible
  const code = extractPossibleCode(message);
  if (user && looksLikeBookingIntent(message)) {
    if (code) {
      const booking = await lookupBooking({ supabase, userId: user.id, code });
      if (booking) {
        return NextResponse.json({ reply: formatBookingResponse(booking) });
      }
      return NextResponse.json({
        reply:
          `No encontré una reserva con el código/PNR **${code}** en tu cuenta. ` +
          'Verifica el código o dime el correo con el que reservaste.',
      });
    }

    const recent = await listRecentBookings({ supabase, userId: user.id, limit: 3 });
    if (recent.length === 1) {
      return NextResponse.json({ reply: formatBookingResponse(recent[0]) });
    }
    if (recent.length > 1) {
      return NextResponse.json({ reply: formatRecentBookings(recent) });
    }

    // No bookings found; fall through to LLM (maybe they need general help)
  }

  // Step 3: shorter history (6 messages)
  let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (conversationId) {
    const { data } = await supabase
      .from('chat_messages')
      .select('sender_type,message,created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(6);

    history =
      (data ?? []).map((m) => ({
        role: m.sender_type === 'user' ? 'user' : 'assistant',
        content: m.message,
      })) ?? [];
  }

  const kbSnippets = pickKBSnippets(message);

  // Step 4: concise responses
  const system =
    `Eres el asistente oficial de Global Solutions Travel.\n` +
    `Objetivo: ayudar con vuelos, reservas/PNR, pagos, reembolsos, equipaje, emisión, vouchers, destinos y aerolíneas.\n` +
    `Reglas:\n` +
    `1) Responde SIEMPRE en español, claro y con pasos.\n` +
    `2) No inventes políticas. Si falta info, pide el dato faltante.\n` +
    `3) Si el caso requiere verificación (pago/emisión/reembolso/cambio), pide PNR o código de reserva y correo.\n` +
    `4) Mantén la respuesta en máximo 120 palabras salvo que el usuario pida detalle.\n` +
    `5) Cuando respondas sobre destinos o aerolíneas, menciona datos concretos del KB si están disponibles.\n` +
    `6) Si el usuario pregunta por precios, explica que varían según fecha/disponibilidad y ofrécele ir al buscador de vuelos en la sección Vuelos.\n` +
    (kbSnippets ? `\n[BASE DE CONOCIMIENTO]\n${kbSnippets}\n` : '');

  let assistantText = '';

  // Si no hay crédito/API key de OpenAI, responder solo con la KB local
  const openaiEnabled = !!(process.env.OPENAI_API_KEY?.startsWith('sk-'));

  if (!openaiEnabled) {
    assistantText = kbSnippets
      ? `Aquí tienes información relevante:\n\n${kbSnippets}\n\n¿Necesitas más ayuda? Puedes escribir "Hablar con un agente" o usar el botón de WhatsApp.`
      : 'Por el momento el asistente IA avanzado no está disponible. ¿Deseas hablar con un agente? Haz clic en "Hablar con un Agente".';
  } else {
    try {
      assistantText = await openaiChatCompletion({
        system,
        messages: [...history, { role: 'user', content: message }],
        maxTokens: 220,
      });
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e);
      // If no credit/quota: fall back to KB (no 500)
      if (raw.includes('429') || raw.includes('insufficient_quota')) {
        assistantText =
          'Ahora mismo el asistente IA no tiene cuota/crédito para responder con IA avanzada.\n\n' +
          (kbSnippets ? `Esto es lo más relevante según nuestra base de conocimiento:\n${kbSnippets}\n\n` : '') +
          'Si necesitas, escribe "Hablar con un agente" para escalar.';
      } else {
        // Don't leak internals to client; return a friendly message
        assistantText = 'Ocurrió un error procesando tu solicitud. Intenta de nuevo o escribe "Hablar con un agente".';
      }
    }
  }

  return NextResponse.json({ reply: assistantText });
}
