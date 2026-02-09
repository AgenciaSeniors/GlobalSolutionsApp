/**
 * @fileoverview Agent Ticket System — Internal communication.
 * Per spec §2.2: "Prohibido WhatsApp. Todo debe quedar registrado."
 * Agent can create tickets, view messages, communicate with admin.
 * @module app/(dashboard)/agent/dashboard/tickets/page
 */
'use client';

import { useEffect, useState, useCallback, type FormEvent } from 'react';
import Sidebar, { AGENT_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { MessageSquare, Plus, Send, AlertCircle, ChevronRight } from 'lucide-react';
import type { AgentTicket, TicketMessage, TicketCategory, TicketPriority } from '@/types/models';

const CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'booking_issue', label: 'Problema con Reserva' },
  { value: 'payment', label: 'Pago' },
  { value: 'technical', label: 'Técnico' },
  { value: 'complaint', label: 'Queja' },
  { value: 'suggestion', label: 'Sugerencia' },
];

const PRIORITIES: { value: TicketPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Baja', color: 'text-neutral-500' },
  { value: 'medium', label: 'Media', color: 'text-amber-600' },
  { value: 'high', label: 'Alta', color: 'text-orange-600' },
  { value: 'urgent', label: 'Urgente', color: 'text-red-600' },
];

export default function AgentTicketsPage() {
  const supabase = createClient();
  const { user } = useAuthContext();

  const [tickets, setTickets] = useState<AgentTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<AgentTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  // New ticket form
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>('general');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // CORRECCIÓN: Función envuelta en useCallback para evitar recreaciones infinitas
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('agent_tickets')
      .select('*')
      .order('created_at', { ascending: false });
    setTickets((data as AgentTicket[]) || []);
    setLoading(false);
  }, [supabase]);

  // CORRECCIÓN: fetchTickets añadido como dependencia
  useEffect(() => { 
    fetchTickets(); 
  }, [fetchTickets]);

  async function handleCreateTicket(e: FormEvent) {
    e.preventDefault();
    if (!user || !subject.trim()) return;
    setCreating(true);

    const { data: ticket, error } = await supabase
      .from('agent_tickets')
      .insert({
        ticket_code: '',
        created_by: user.id,
        subject: subject.trim(),
        category,
        priority,
      })
      .select('*')
      .single();

    if (!error && ticket) {
      // Create initial message
      await supabase.from('agent_ticket_messages').insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        message: description.trim() || subject.trim(),
      });

      setShowNew(false);
      setSubject('');
      setDescription('');
      fetchTickets();
    }
    setCreating(false);
  }

  async function openTicket(ticket: AgentTicket) {
    setSelectedTicket(ticket);
    const { data } = await supabase
      .from('agent_ticket_messages')
      .select('*, sender:profiles!sender_id(full_name, role)')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });
    setMessages((data as unknown as TicketMessage[]) || []);
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!selectedTicket || !newMessage.trim() || !user) return;
    setSending(true);

    await supabase.from('agent_ticket_messages').insert({
      ticket_id: selectedTicket.id,
      sender_id: user.id,
      message: newMessage.trim(),
    });

    setNewMessage('');
    openTicket(selectedTicket);
    setSending(false);
  }

  const statusBadge = (status: string) => {
    const map: Record<string, 'warning' | 'info' | 'success' | 'default'> = {
      open: 'warning', in_progress: 'info', waiting_response: 'warning',
      resolved: 'success', closed: 'default',
    };
    return map[status] || 'default';
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar links={AGENT_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header
          title="Sistema de Tickets"
          subtitle="Comunicación interna con Administración — Todo queda registrado"
        />
        <div className="p-8">
          {/* Warning banner */}
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>Regla de Oro:</strong> Toda comunicación laboral debe realizarse por este sistema.
              No se permite el uso de WhatsApp para temas de trabajo.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Ticket List */}
            <div className="lg:col-span-1 space-y-4">
              <Button onClick={() => setShowNew(true)} className="w-full gap-2">
                <Plus className="h-4 w-4" /> Nuevo Ticket
              </Button>

              {loading ? (
                <p className="text-neutral-500 text-sm">Cargando...</p>
              ) : tickets.length === 0 ? (
                <Card variant="bordered" className="text-center py-8">
                  <MessageSquare className="mx-auto h-10 w-10 text-neutral-300 mb-2" />
                  <p className="text-sm text-neutral-500">No tienes tickets</p>
                </Card>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {tickets.map(t => (
                    <button
                      key={t.id}
                      onClick={() => openTicket(t)}
                      className={`w-full text-left rounded-xl border p-3 transition-colors ${
                        selectedTicket?.id === t.id
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{t.subject}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">{t.ticket_code}</p>
                        </div>
                        <Badge variant={statusBadge(t.status)}>{t.status.replace('_', ' ')}</Badge>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1">
                        {new Date(t.created_at).toLocaleDateString('es')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Ticket Detail / New Ticket */}
            <div className="lg:col-span-2">
              {showNew ? (
                <Card variant="bordered">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Plus className="h-5 w-5 text-brand-600" /> Nuevo Ticket
                  </h3>
                  <form onSubmit={handleCreateTicket} className="space-y-4">
                    {/* CORRECCIÓN: Renderizado manual de label fuera del Input */}
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700">Asunto</label>
                      <Input
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        placeholder="Describe brevemente tu consulta"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-neutral-700">Categoría</label>
                        <select
                          value={category}
                          onChange={e => setCategory(e.target.value as TicketCategory)}
                          className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm"
                        >
                          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-neutral-700">Prioridad</label>
                        <select
                          value={priority}
                          onChange={e => setPriority(e.target.value as TicketPriority)}
                          className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm"
                        >
                          {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-neutral-700">Descripción</label>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={4}
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm resize-none"
                        placeholder="Detalla tu consulta o problema..."
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button type="submit" isLoading={creating}>Crear Ticket</Button>
                      <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
                    </div>
                  </form>
                </Card>
              ) : selectedTicket ? (
                <Card variant="bordered" className="flex flex-col h-[600px]">
                  {/* Ticket header */}
                  <div className="border-b border-neutral-100 pb-3 mb-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold">{selectedTicket.subject}</h3>
                      <Badge variant={statusBadge(selectedTicket.status)}>
                        {selectedTicket.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      {selectedTicket.ticket_code} · {selectedTicket.category} · {selectedTicket.priority}
                    </p>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto space-y-3 mb-3">
                    {messages.map(m => {
                      const isOwn = m.sender_id === user?.id;
                      return (
                        <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                            isOwn
                              ? 'bg-brand-600 text-white'
                              : 'bg-neutral-100 text-neutral-800'
                          }`}>
                            {!isOwn && (
                              <p className="text-xs font-semibold mb-0.5 opacity-70">
                                {(m.sender as { full_name?: string } | undefined)?.full_name || 'Admin'}
                              </p>
                            )}
                            <p>{m.message}</p>
                            <p className={`text-[10px] mt-1 ${isOwn ? 'text-brand-200' : 'text-neutral-400'}`}>
                              {new Date(m.created_at).toLocaleString('es')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Message input */}
                  {selectedTicket.status !== 'closed' && (
                    <form onSubmit={sendMessage} className="flex gap-2 border-t border-neutral-100 pt-3">
                      <input
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder="Escribe tu mensaje..."
                        className="flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                      />
                      <Button type="submit" isLoading={sending} size="sm" className="gap-1">
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  )}
                </Card>
              ) : (
                <Card variant="bordered" className="flex items-center justify-center h-[400px] text-center">
                  <div>
                    <ChevronRight className="mx-auto h-12 w-12 text-neutral-200 mb-3" />
                    <p className="text-neutral-500">Selecciona un ticket o crea uno nuevo</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}