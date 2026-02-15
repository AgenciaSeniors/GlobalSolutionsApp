import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * Chat API
 * - Paso 1: Filtro in-scope (ahorra tokens)
 * - Paso 2: Rate limit diario por user/ip
 * - Paso 3: Recorte de historial (menos tokens)
 * - Paso 4: Respuestas cortas (menos tokens)
 */

// “RAG-lite”: KB interna + reglas del negocio (hoy). Luego lo migras a pgvector.
const KB: ReadonlyArray<{ title: string; text: string }> = [
  {
    title: 'Equipaje',
    text:
      'El equipaje permitido varía según la aerolínea. Generalmente: 1 maleta de mano (8kg) y 1 maleta de bodega (23kg).',
  },
  {
    title: 'Pagos',
    text:
      'Aceptamos Stripe (tarjetas), PayPal y Zelle (manual). En Zelle la confirmación la realiza un agente.',
  },
  {
    title: 'Emisión de boletos',
    text:
      'Después del pago, la emisión del boleto se realiza en un plazo máximo de 24 horas. El cliente recibe PDF por email y en la app.',
  },
  {
    title: 'Cancelaciones',
    text:
      'Las políticas dependen de la aerolínea y la tarifa. Se gestiona desde “Mis Reservas”.',
  },
  {
    title: 'Transparencia de comisiones',
    text:
      'El desglose debe mostrarse: Precio base + margen + comisión pasarela (PayPal/Stripe) = total.',
  },
];

const BodySchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
});

function pickKBSnippets(userText: string): string {
  const q = userText.toLowerCase();
  const scored = KB.map((k) => {
    const tokens = (k.title + ' ' + k.text)
      .toLowerCase()
      .split(/\W+/)
      .filter(Boolean);
    const hits = tokens.reduce((acc, t) => (q.includes(t) ? acc + 1 : acc), 0);
    return { ...k, hits };
  })
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3);

  const top = scored.filter((s) => s.hits > 0);
  if (!top.length) return '';

  return top.map((s) => `• ${s.title}: ${s.text}`).join('\n');
}

function extractPossiblePNR(text: string): string | null {
  const m = text.toUpperCase().match(/\b[A-Z0-9]{6,10}\b/);
  return m ? m[0] : null;
}

// --------------------
// Paso 1: In-scope filter (tolerante a faltas)
// --------------------
function normalizeText(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const dp: number[] = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const temp = dp[i];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[a.length];
}

function fuzzyIncludes(text: string, needle: string, maxDistance: number): boolean {
  if (!needle) return false;
  if (text.includes(needle)) return true;

  const words = text.split(' ').filter(Boolean);
  for (const w of words) {
    if (w.length < 4 || needle.length < 4) continue;
    if (levenshtein(w, needle) <= maxDistance) return true;
  }
  return false;
}

const ALLOWED_TERMS: ReadonlyArray<string> = [
  // Marca / agencia
  'global solutions',
  'global',
  'solutions',
  'globalsolutions',
  'gsolutions',

  // Vuelos / reservas
  'vuelo',
  'vuelos',
  'buelos',
  'reserva',
  'reservas',
  'reserba',
  'resreva',
  'reservacion',
  'booking',
  'bokking',
  'pnr',
  'localizador',
  'codigo',
  'codgo',
  'locator',
  'itinerario',
  'ruta',
  'trayecto',
  'horario',
  'orario',
  'schedule',
  'ida',
  'vuelta',
  'regreso',
  'escala',
  'conexion',
  'conecxion',
  'aeropuerto',
  'airport',
  'aerolinea',
  'areolinea',
  'airline',
  'asiento',
  'seat',
  'checkin',
  'check in',

  // Pagos
  'pago',
  'pagos',
  'paypal',
  'pay pal',
  'stripe',
  'tarjeta',
  'targeta',
  'credito',
  'debito',
  'zelle',
  'zellee',
  'transferencia',
  'banco',
  'comision',
  'comicion',
  'fee',
  'cargo',
  'recibo',
  'factura',

  // Reembolsos / cambios
  'reembolso',
  'reembolo',
  'reembolzo',
  'refund',
  'devolucion',
  'cancelar',
  'cancelacion',
  'anular',
  'cambio',
  'modificar',
  'reprogramar',

  // Documentos / voucher
  'voucher',
  'vaucher',
  'baucher',
  'pdf',
  'boleto',
  'ticket',
  'tiket',
  'eticket',
  'emision',
  'emitir',

  // Equipaje
  'equipaje',
  'equipage',
  'maleta',
  'bodega',
  'carry',
  'cabina',

  // Soporte / agente
  'soporte',
  'ayuda',
  'agente',
  'agent',
  'humano',
  'representante',
  'reclamo',
  'queja',

  // Autos (si aplica)
  'auto',
  'carro',
  'alquiler',
  'renta',
  'car rental',
];

function isInScope(rawText: string): boolean {
  const t = normalizeText(rawText);

  // Si parece PNR/booking_code (6-10 alfanum) lo dejamos pasar
  if (/\b[a-z0-9]{6,10}\b/.test(t)) return true;

  const quickPass = [
    'hablar con un agente',
    'hablar con alguien',
    'quiero un agente',
    'necesito ayuda con mi reserva',
    'estado de mi reserva',
    'estado de mi vuelo',
  ].map(normalizeText);

  if (quickPass.some((p) => t.includes(p))) return true;

  for (const termRaw of ALLOWED_TERMS) {
    const term = normalizeText(termRaw);
    const maxDist = term.length >= 8 ? 2 : 1;
    if (fuzzyIncludes(t, term, maxDist)) return true;
  }

  return false;
}

// --------------------
// Paso 2: Rate limit diario (por user o por IP)
// - Recomendado: implementado via RPC security definer para evitar RLS issues
// --------------------

interface RateLimitResult {
  allowed: boolean;
  count: number;
}

function dayKeyUTC(): string {
  // YYYY-MM-DD (UTC). Si prefieres America/New_York, lo cambiamos.
  return new Date().toISOString().slice(0, 10);
}

function getIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0]?.trim() || 'unknown';
  return 'unknown';
}

function parseRateLimitResult(value: unknown): RateLimitResult | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const allowed = v.allowed;
  const count = v.count;
  if (typeof allowed !== 'boolean') return null;
  if (typeof count !== 'number') return null;
  return { allowed, count };
}

async function enforceRateLimit(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  key: string;
  limit: number;
}): Promise<RateLimitResult> {
  // RPC must exist in DB. See README update for SQL.
  const { data, error } = await args.supabase.rpc('increment_chat_rate_limit', {
    p_key: args.key,
    p_limit: args.limit,
  });

  if (error) {
    // Si falla el rate-limit, preferimos NO romper el chat.
    // Permitimos, pero registramos el error en server logs.
    console.error('[api/chat] rate limit rpc error', error);
    return { allowed: true, count: 0 };
  }

  // supabase puede devolver: objeto o array de objetos según función
  const normalized: unknown = Array.isArray(data) ? data[0] : data;
  const parsed = parseRateLimitResult(normalized);
  if (!parsed) {
    console.error('[api/chat] rate limit rpc returned unexpected shape', data);
    return { allowed: true, count: 0 };
  }

  return parsed;
}

// --------------------
// OpenAI
// --------------------

type ChatRole = 'user' | 'assistant';
interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface OpenAIChatCompletionArgs {
  system: string;
  messages: ReadonlyArray<ChatMessage>;
  maxOutputTokens?: number;
}

async function openaiChatCompletion(args: OpenAIChatCompletionArgs): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const body = {
    model,
    temperature: 0.2,
    max_tokens: args.maxOutputTokens ?? 280,
    messages: [{ role: 'system', content: args.system }, ...args.messages],
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const { conversationId, message } = parsed.data;

  // Paso 1: filtro anti-gasto (no llamamos al modelo si no es tema de la agencia)
  if (!isInScope(message)) {
    return NextResponse.json({
      reply:
        'Solo puedo ayudarte con temas de Global Solutions Travel (vuelos, reservas/PNR, pagos, reembolsos, equipaje, vouchers y soporte). ' +
        'Cuéntame tu duda relacionada con tu viaje o tu reserva.',
      detectedPNR: null,
      hasUser: false,
      limited: false,
    });
  }

  const supabase = await createClient();

  // auth (para consulta PNR segura)
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  // Paso 2: rate limit diario (IP para guest; user_id para autenticados)
  const MAX_PER_DAY_GUEST = 5;
  const MAX_PER_DAY_USER = 25;

  const ip = getIp(req);
  const rateKey = user
    ? `u:${user.id}:${dayKeyUTC()}`
    : `ip:${ip}:${dayKeyUTC()}`;

  const rateLimit = await enforceRateLimit({
    supabase,
    key: rateKey,
    limit: user ? MAX_PER_DAY_USER : MAX_PER_DAY_GUEST,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({
      reply:
        "Has alcanzado el límite diario de mensajes. Puedes intentar mañana o escribir 'Hablar con un agente' para escalar.",
      detectedPNR: null,
      hasUser: Boolean(user),
      limited: true,
    });
  }

  // Paso 3: cargar solo últimos mensajes para contexto (reduce tokens)
  let history: ChatMessage[] = [];
  if (conversationId) {
    const { data } = await supabase
      .from('chat_messages')
      .select('sender_type,message,created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(6);

    const rows = (data ?? []) as Array<{
      sender_type: string;
      message: string;
    }>;

    history = rows.map((m) => ({
      role: m.sender_type === 'user' ? 'user' : 'assistant',
      content: m.message,
    }));
  }

  // PNR lookup (si detectamos algo que parece código)
  const maybePNR = extractPossiblePNR(message);
  let pnrInfo = '';
  if (maybePNR && user) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('booking_code,airline_pnr,booking_status,payment_status,created_at')
      .eq('user_id', user.id)
      .or(`booking_code.eq.${maybePNR},airline_pnr.eq.${maybePNR}`)
      .maybeSingle();

    if (booking) {
      pnrInfo =
        `\n\n[ESTADO RESERVA]\n` +
        `booking_code: ${booking.booking_code}\n` +
        `airline_pnr: ${booking.airline_pnr ?? 'pendiente'}\n` +
        `booking_status: ${booking.booking_status}\n` +
        `payment_status: ${booking.payment_status}\n`;
    }
  }

  const kbSnippets = pickKBSnippets(message);

  // Paso 4: respuestas cortas
  const system =
    `Eres el asistente de Global Solutions Travel.\n` +
    `Reglas:\n` +
    `- Responde en español, claro y con pasos.\n` +
    `- Responde en máximo 120 palabras (salvo que el usuario pida detalle).\n` +
    `- NO inventes políticas. Si no hay info suficiente, pide el dato faltante o sugiere escalar a un agente.\n` +
    `- Si el usuario pide hablar con un agente o hay conflicto, sugiere escalar.\n` +
    (kbSnippets ? `\n[BASE DE CONOCIMIENTO]\n${kbSnippets}\n` : '') +
    (pnrInfo ? `\n${pnrInfo}\n` : '');

  let assistantText = '';
  try {
    assistantText = await openaiChatCompletion({
      system,
      messages: [...history, { role: 'user', content: message }],
      maxOutputTokens: 260,
    });
  } catch (e: unknown) {
    const raw = String(e instanceof Error ? e.message : e);

    // Si no hay crédito/cuota, no rompemos el chat: respondemos con KB.
    if (raw.includes('429') || raw.includes('insufficient_quota')) {
      assistantText =
        'Ahora mismo el asistente IA no tiene cuota/crédito para responder con IA avanzada.\n\n' +
        (kbSnippets
          ? `Esto es lo más relevante según nuestra base de conocimiento:\n${kbSnippets}\n\n`
          : '') +
        "Si necesitas, escribe 'Hablar con un agente' para escalar.";
    } else {
      // Error inesperado
      console.error('[api/chat] unexpected error', e);
      return NextResponse.json(
        { error: 'Internal error' },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    reply: assistantText,
    detectedPNR: maybePNR ?? null,
    hasUser: Boolean(user),
    limited: false,
    rateCount: rateLimit.count,
  });
}
