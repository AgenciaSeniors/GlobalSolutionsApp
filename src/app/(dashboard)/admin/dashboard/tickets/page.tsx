'use client';

import { useEffect, useState, useCallback } from 'react';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { ticketService } from '@/services/tickets.service';
import type { AgentTicketWithDetails, TicketMessage } from '@/types/models';
import {
  MessageSquare, Send, ChevronDown, ChevronUp,
  UserCheck, Filter,
} from 'lucide-react';

export default function AdminTicketsPage() {
  const { user } = useAuthContext();
  const [tickets, setTickets] = useState<AgentTicketWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages] = useState<Record<string, TicketMessage[]>>({});
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ticketService.getAllTickets();
      setTickets(data);
    } catch (err) {
      console.error('Error loading tickets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  async function toggleExpand(ticketId: string) {
    if (expandedTicket === ticketId) {
      setExpandedTicket(null);
      return;
    }
    setExpandedTicket(ticketId);
    if (!ticketMessages[ticketId]) {
      try {
        const msgs = await ticketService.getTicketMessages(ticketId);
        setTicketMessages(prev => ({ ...prev, [ticketId]: msgs }));
      } catch (err) {
        console.error('Error loading messages:', err);
      }
    }
  }

  async function handleReply(ticketId: string) {
    if (!user || !replyText.trim()) return;
    setSendingReply(true);
    try {
      await ticketService.replyToTicket(ticketId, user.id, replyText.trim());
      // Also update status to in_progress if it was open
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket?.status === 'open') {
        await ticketService.updateTicketStatus(ticketId, 'in_progress');
      }
      const msgs = await ticketService.getTicketMessages(ticketId);
      setTicketMessages(prev => ({ ...prev, [ticketId]: msgs }));
      setReplyText('');
      fetchTickets();
    } catch (err) {
      console.error('Error sending reply:', err);
    } finally {
      setSendingReply(false);
    }
  }

  async function handleResolve(ticketId: string) {
    try {
      await ticketService.updateTicketStatus(ticketId, 'resolved');
      fetchTickets();
    } catch (err) {
      console.error('Error resolving ticket:', err);
    }
  }

  const filtered = filter === 'all'
    ? tickets
    : tickets.filter(t => t.status === filter);

  const priorityColor: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-amber-100 text-amber-700',
    urgent: 'bg-red-100 text-red-700',
  };

  const statusVariant: Record<string, 'warning' | 'success' | 'info' | 'default'> = {
    open: 'warning',
    in_progress: 'info',
    waiting_response: 'warning',
    resolved: 'success',
    closed: 'default',
  };

  const statusLabel: Record<string, string> = {
    open: 'Abierto',
    in_progress: 'En Proceso',
    waiting_response: 'Esperando',
    resolved: 'Resuelto',
    closed: 'Cerrado',
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Tickets de Soporte" subtitle="Comunicación interna con gestores — Sin WhatsApp" />
        <div className="p-8 space-y-6">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-gray-400" />
            {(['all', 'open', 'in_progress', 'resolved'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  filter === f ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'all' ? 'Todos' : statusLabel[f]}
                {f !== 'all' && (
                  <span className="ml-1.5 text-xs opacity-70">
                    ({tickets.filter(t => t.status === f).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-neutral-500">Cargando...</p>
          ) : filtered.length === 0 ? (
            <Card variant="bordered" className="py-12 text-center">
              <MessageSquare className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p className="font-semibold text-gray-700">No hay tickets {filter !== 'all' ? 'con este filtro' : ''}</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {filtered.map(t => {
                const isExpanded = expandedTicket === t.id;
                const msgs = ticketMessages[t.id] || [];

                return (
                  <Card key={t.id} variant="bordered">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-gray-400">{t.ticket_code}</span>
                          <h4 className="font-bold text-gray-900">{t.subject}</h4>
                          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${priorityColor[t.priority]}`}>
                            {t.priority}
                          </span>
                          <Badge variant={statusVariant[t.status] || 'warning'}>
                            {statusLabel[t.status] || t.status}
                          </Badge>
                        </div>
                        {t.description && (
                          <p className="text-sm text-gray-600">{t.description}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-400">
                          Agente: {t.creator?.full_name || 'Desconocido'}
                          {t.creator?.agent_code && ` (${t.creator.agent_code})`}
                          {' · '}{t.category}
                          {' · '}{new Date(t.created_at).toLocaleDateString('es')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        {t.status === 'in_progress' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolve(t.id)}
                            className="gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                          >
                            <UserCheck className="h-3.5 w-3.5" /> Resolver
                          </Button>
                        )}
                        <button
                          onClick={() => toggleExpand(t.id)}
                          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
                        >
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                        {msgs.length === 0 ? (
                          <p className="text-sm text-gray-400">Sin mensajes aún.</p>
                        ) : (
                          msgs.map(msg => (
                            <div
                              key={msg.id}
                              className={`rounded-lg p-3 text-sm ${
                                msg.sender?.role === 'admin'
                                  ? 'bg-brand-50 border border-brand-100 ml-8'
                                  : 'bg-gray-50 border border-gray-100 mr-8'
                              } ${msg.is_internal ? 'border-l-4 border-l-amber-300' : ''}`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-xs">
                                  {msg.sender?.full_name || 'Sistema'}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  msg.sender?.role === 'admin' ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-600'
                                }`}>
                                  {msg.sender?.role === 'admin' ? 'Admin' : 'Agente'}
                                </span>
                                {msg.is_internal && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Nota interna</span>
                                )}
                                <span className="text-[10px] text-gray-400">
                                  {new Date(msg.created_at).toLocaleString('es')}
                                </span>
                              </div>
                              <p className="text-gray-700 whitespace-pre-wrap">{msg.message}</p>
                            </div>
                          ))
                        )}

                        {t.status !== 'closed' && t.status !== 'resolved' && (
                          <div className="flex gap-2 mt-2">
                            <input
                              type="text"
                              value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              placeholder="Responder al agente..."
                              className="flex-1 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                              onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleReply(t.id);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleReply(t.id)}
                              disabled={!replyText.trim() || sendingReply}
                              isLoading={sendingReply}
                              className="gap-1"
                            >
                              <Send size={14} /> Enviar
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
