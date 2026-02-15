import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// “RAG-lite”: KB interna + reglas del negocio (hoy). Luego lo migras a pgvector.
const KB: Array<{ title: string; text: string }> = [
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
  // scoring simple por keywords (hoy). Suficiente para “RAG con KB de FAQs”.
  const scored = KB.map((k) => {
    const tokens = (k.title + ' ' + k.text).toLowerCase().split(/\W+/).filter(Boolean);
    const hits = tokens.reduce((acc, t) => (q.includes(t) ? acc + 1 : acc), 0);
    return { ...k, hits };
  })
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3);

  const top = scored.filter((s) => s.hits > 0);
  if (!top.length) return '';

  return top
    .map((s) => `• ${s.title}: ${s.text}`)
    .join('\n');
}

function extractPossiblePNR(text: string): string | null {
  // PNR/booking_code suele ser alfanumérico 6-10. Ajusta si ya tienes formato fijo.
  const m = text.toUpperCase().match(/\b[A-Z0-9]{6,10}\b/);
  return m ? m[0] : null;
}

async function openaiChatCompletion(args: {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
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

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const { conversationId, message } = parsed.data;

  // auth (para consulta PNR segura)
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  // cargar últimos mensajes de la conversación (si existe) para contexto
  let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (conversationId) {
    const { data } = await supabase
      .from('chat_messages')
      .select('sender_type,message,created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(12);

    history =
      (data ?? [])
        .map((m) => ({
          role: m.sender_type === 'user' ? 'user' : 'assistant',
          content: m.message,
        })) || [];
  }

  // PNR lookup (si detectamos algo que parece código)
  const maybePNR = extractPossiblePNR(message);
  let pnrInfo = '';
  if (maybePNR && user) {
    // busca por booking_code o airline_pnr SOLO de ese usuario (seguro)
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

  const system =
    `Eres el asistente de Global Solutions Travel.\n` +
    `Reglas:\n` +
    `- Responde en español, claro y con pasos.\n` +
    `- NO inventes políticas. Si no hay info suficiente, pide al usuario el dato faltante o sugiere escalar a un agente.\n` +
    `- Si el usuario pide hablar con un agente o hay conflicto, sugiere escalar.\n` +
    (kbSnippets ? `\n[BASE DE CONOCIMIENTO]\n${kbSnippets}\n` : '') +
    (pnrInfo ? `\n${pnrInfo}\n` : '');

  const assistantText = await openaiChatCompletion({
    system,
    messages: [...history, { role: 'user', content: message }],
  });

  return NextResponse.json({
    reply: assistantText,
    detectedPNR: maybePNR ?? null,
    hasUser: Boolean(user),
  });
}
