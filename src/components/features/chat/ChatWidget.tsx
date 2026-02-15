/**
 * @fileoverview Floating chat widget with AI chatbot + human escalation.
 * Per spec §7.1:
 *   Level 1: AI chatbot for quick FAQs (luggage, schedules)
 *   Level 2: "Hablar con un Agente" button escalates to human
 * @module components/features/chat/ChatWidget
 */
'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { MessageCircle, X, Send, User, Bot, Headphones, Minimize2 } from 'lucide-react';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { createClient } from '@/lib/supabase/client';

interface Message {
  id: string;
  sender: 'user' | 'bot' | 'agent';
  text: string;
  time: string;
}

interface ChatMessagePayload {
  message: string;
  sender_type: 'user' | 'bot' | 'agent';
}

// Simple FAQ knowledge base (Level 1)
const FAQ_RESPONSES: Record<string, string> = {
  equipaje: 'El equipaje permitido varía según la aerolínea. Generalmente incluye: 1 maleta de mano (8kg) y 1 maleta de bodega (23kg). Consulta los detalles al seleccionar tu vuelo.',
  horario: 'Puedes ver los horarios de todos los vuelos disponibles en la sección de búsqueda. Los horarios se muestran en hora local de cada ciudad.',
  pago: 'Aceptamos Stripe (tarjetas), PayPal y Zelle (transferencia manual). En Zelle el pago se confirma en 2-4 horas por un agente.',
  cancelar: 'Para cancelar una reserva, dirígete a "Mis Reservas" en tu panel. Las políticas de cancelación dependen de la aerolínea y la tarifa contratada.',
  precio: 'Nuestros precios incluyen el costo base del vuelo + margen de agencia. La comisión de la pasarela de pago se muestra por separado antes de pagar.',
  documento: 'Necesitas tu pasaporte vigente (con al menos 6 meses de validez). Algunos destinos requieren visa. Consulta con tu agente para más detalles.',
  boleto: 'Después del pago, tu boleto se emite en un plazo máximo de 24 horas. Recibirás el PDF por correo electrónico y en la app.',
  oferta: 'Las ofertas exclusivas tienen fechas limitadas. Visita la sección "Ofertas" para ver los destinos con descuento y sus fechas disponibles.',
  auto: 'Ofrecemos renta de autos en Cuba. Puedes elegir entre económicos, compactos y SUVs con diferentes opciones de transmisión.',
  reserva: 'Puedes buscar vuelos sin cuenta, pero para reservar necesitas registrarte. El proceso toma menos de 2 minutos con verificación por email.',
};

function getAIResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase();

  for (const [keyword, response] of Object.entries(FAQ_RESPONSES)) {
    if (lower.includes(keyword)) return response;
  }

  // Default response
  return '¡Gracias por tu mensaje! No encontré una respuesta específica. ¿Te gustaría hablar con un agente humano? Haz clic en "Hablar con un Agente" para ser conectado.';
}

export default function ChatWidget() {
  const { user } = useAuthContext();
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      sender: 'bot',
      text: '¡Hola! 👋 Soy el asistente virtual de Global Solutions Travel. ¿En qué puedo ayudarte? Puedo responder preguntas sobre equipaje, horarios, pagos, ofertas y más.',
      time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'bot' | 'waiting' | 'agent'>('bot');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


useEffect(() => {
  if (mode !== 'agent' || !conversationId) return;

  const channel = supabase
    .channel(`chat:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        const m = payload.new as ChatMessagePayload;
        if (!m?.message || !m?.sender_type) return;
        if (m.sender_type === 'agent') {
          addMessage('agent', String(m.message));
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [mode, conversationId, supabase]);

async function ensureConversation(): Promise<string | null> {
  if (!user) return null;
  if (conversationId) return conversationId;

  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({
      user_id: user.id,
      status: 'bot',
      subject: messages.find(m => m.sender === 'user')?.text || 'Solicitud de soporte',
    })
    .select('id')
    .single();

  if (error || !data?.id) return null;
  setConversationId(data.id);
  return data.id;
}

async function persistMessage(args: { convId: string; sender_type: 'user' | 'bot' | 'agent'; message: string }) {
  await supabase.from('chat_messages').insert({
    conversation_id: args.convId,
    sender_type: args.sender_type,
    sender_id: args.sender_type === 'user' ? user?.id : null,
    message: args.message,
    metadata: args.sender_type === 'bot' ? { provider: 'openai' } : null,
  });
}


  function addMessage(sender: Message['sender'], text: string) {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      sender,
      text,
      time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
    }]);
  }


async function handleSend(e: FormEvent) {
  e.preventDefault();
  if (!input.trim() || isSending) return;

  const userText = input.trim();
  addMessage('user', userText);
  setInput('');

  if (mode === 'waiting') return;

  setIsSending(true);
  try {
    const convId = await ensureConversation();

    // Persist user message (if logged-in and conversation created)
    if (convId) {
      await persistMessage({ convId, sender_type: 'user', message: userText });
    }

    if (mode === 'bot') {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId ?? undefined, message: userText }),
      });

      const j = await r.json().catch(() => null);
      const reply =
        j?.reply ? String(j.reply) : getAIResponse(userText); // fallback local

      addMessage('bot', reply);

      if (convId) {
        await persistMessage({ convId, sender_type: 'bot', message: reply });
      }
    } else if (mode === 'agent') {
      // En modo agente, el mensaje del usuario ya quedó guardado.
      // El agente responderá por Realtime (chat_messages sender_type='agent').
      if (!convId) {
        addMessage('bot', 'Para hablar con un agente necesitas iniciar sesión.');
      }
    }
  } catch {
    addMessage('bot', 'Hubo un problema procesando tu mensaje. ¿Deseas hablar con un agente?');
  } finally {
    setIsSending(false);
  }
}


async function handleEscalate() {
  setMode('waiting');
  addMessage('bot', 'Conectándote con un agente humano. Por favor espera un momento...');

  if (!user) {
    addMessage('bot', 'Para conectar con un agente necesitas iniciar sesión.');
    setMode('bot');
    return;
  }

  try {
    const convId = await ensureConversation();
    if (!convId) {
      addMessage('bot', 'No pude abrir la conversación. Intenta nuevamente.');
      setMode('bot');
      return;
    }

    await supabase.from('chat_conversations').update({ status: 'waiting_agent' }).eq('id', convId);

    addMessage('bot', 'Listo ✅. En cuanto un agente responda, lo verás aquí en tiempo real.');
    setMode('agent');
  } catch {
    addMessage('bot', 'No pude conectarte con un agente ahora mismo. Intenta más tarde.');
    setMode('bot');
  }
}

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 hover:bg-brand-700 transition-all hover:scale-105"
        aria-label="Abrir chat"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 w-[380px] rounded-2xl bg-white shadow-2xl border border-neutral-200 overflow-hidden transition-all ${isMinimized ? 'h-14' : 'h-[520px]'} flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between bg-brand-600 px-4 py-3 cursor-pointer"
           onClick={() => setIsMinimized(!isMinimized)}>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            {mode === 'agent' ? <Headphones className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
          </div>
          <div>
            <p className="font-semibold text-white text-sm">
              {mode === 'agent' ? 'Agente en línea' : 'Asistente Virtual'}
            </p>
            <p className="text-xs text-brand-200">
              {mode === 'waiting' ? 'Conectando...' : mode === 'agent' ? 'Conectado' : 'En línea'}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className="rounded-lg p-1 hover:bg-white/10">
            <Minimize2 className="h-4 w-4 text-white" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="rounded-lg p-1 hover:bg-white/10">
            <X className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                  msg.sender === 'user'
                    ? 'bg-brand-600 text-white'
                    : msg.sender === 'agent'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    : 'bg-white text-neutral-800 border border-neutral-200'
                }`}>
                  {msg.sender !== 'user' && (
                    <div className="flex items-center gap-1 mb-1">
                      {msg.sender === 'bot'
                        ? <Bot className="h-3 w-3 text-brand-400" />
                        : <User className="h-3 w-3 text-emerald-500" />
                      }
                      <span className="text-[10px] font-semibold opacity-60">
                        {msg.sender === 'bot' ? 'Asistente IA' : 'Agente'}
                      </span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <p className={`text-[10px] mt-1 ${msg.sender === 'user' ? 'text-brand-200' : 'text-neutral-400'}`}>
                    {msg.time}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Escalation button */}
          {mode === 'bot' && (
            <div className="px-4 py-2 border-t border-neutral-100 bg-white">
              <button
                onClick={handleEscalate}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200"
              >
                <Headphones className="h-4 w-4" />
                Hablar con un Agente
              </button>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-neutral-100 bg-white">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={mode === 'waiting' ? 'Esperando agente...' : 'Escribe tu mensaje...'}
              disabled={mode === 'waiting' || isSending}
              className="flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={mode === 'waiting' || isSending || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white disabled:opacity-50 hover:bg-brand-700 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
