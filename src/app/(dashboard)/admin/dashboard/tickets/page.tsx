/**
 * @fileoverview Admin Tickets — Respond to agent internal support tickets.
 * Per spec §2.2: No WhatsApp, everything logged in platform.
 */
'use client';

import { useEffect, useState } from 'react';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { MessageSquare, Send } from 'lucide-react';
import type { AgentTicket as AgentTicketBase } from '@/types/models';



type AgentTicket = AgentTicketBase & {
  subject?: string | null;
  priority?: string | null;
  message?: string | null;
  admin_response?: string | null;
  agent?: (AgentTicketBase extends { agent: infer A } ? A : unknown) & {
    agent_code?: string | null;
    full_name?: string | null;
    email?: string | null;
  } | null;
  created_at?: string | null;
};

export default function AdminTicketsPage() {
  const supabase = createClient();
  const [tickets, setTickets] = useState<AgentTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);
  const [response, setResponse] = useState('');

  useEffect(() => { fetchTickets(); }, []);

  async function fetchTickets() {
    setLoading(true);
    const { data } = await supabase
      .from('agent_tickets')
      .select('*, agent:profiles!agent_id(full_name, email, agent_code)')
      .order('created_at', { ascending: false });
    setTickets((data as unknown as AgentTicket[]) || []);
    setLoading(false);
  }

  async function handleRespond(id: string) {
    if (!response.trim()) return;
    await supabase.from('agent_tickets').update({
      admin_response: response.trim(),
      status: 'resolved',
      responded_at: new Date().toISOString(),
    }).eq('id', id);
    setResponding(null);
    setResponse('');
    fetchTickets();
  }

  const priorityColor: Record<string, string> = {
    low: 'bg-neutral-100 text-neutral-600',
    normal: 'bg-blue-100 text-blue-700',
    high: 'bg-amber-100 text-amber-700',
    urgent: 'bg-red-100 text-red-700',
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Tickets de Soporte" subtitle="Comunicación interna con gestores — Sin WhatsApp" />
        <div className="p-8">
          {loading ? <p className="text-neutral-500">Cargando...</p> : (
            <div className="space-y-4">
              {tickets.map(t => (
                <Card key={t.id} variant="bordered">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h4 className="font-bold">{t.subject}</h4>
                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${priorityColor[t.priority]}`}>
                          {t.priority}
                        </span>
                        <Badge variant={t.status === 'open' ? 'warning' : t.status === 'resolved' ? 'success' : 'info'}>
                          {t.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-neutral-600">{t.message}</p>
                      <p className="mt-1 text-xs text-neutral-400">
                        Agente: {t.agent?.full_name} ({t.agent?.agent_code}) · {new Date(t.created_at ?? Date.now()).toLocaleDateString('es')}
                      </p>
                      {t.admin_response && (
                        <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm">
                          <p className="mb-1 text-xs font-semibold text-emerald-700">Respuesta del Admin:</p>
                          <p className="text-emerald-800">{t.admin_response}</p>
                        </div>
                      )}
                    </div>
                    {t.status === 'open' && (
                      <div>
                        {responding === t.id ? (
                          <div className="ml-4 space-y-2">
                            <textarea
                              value={response} onChange={e => setResponse(e.target.value)}
                              className="w-64 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                              rows={3} placeholder="Escribe tu respuesta..."
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleRespond(t.id)} className="gap-1">
                                <Send className="h-3 w-3" /> Responder
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setResponding(null)}>Cancelar</Button>
                            </div>
                          </div>
                        ) : (
                          <Button size="sm" onClick={() => setResponding(t.id)} className="gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5" /> Responder
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
