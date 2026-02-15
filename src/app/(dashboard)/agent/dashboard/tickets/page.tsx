'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import Sidebar, { AGENT_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { ticketService } from '@/services/tickets.service';
import type { AgentTicketWithDetails, TicketMessage } from '@/types/models';
import {
  MessageSquare, Plus, AlertCircle, CheckCircle, Clock,
  Send, ChevronDown, ChevronUp, type LucideIcon,
} from 'lucide-react';

interface StatusStyle {
  label: string;
  color: string;
  icon: LucideIcon;
}

export default function AgentTicketsPage() {
  const { user } = useAuthContext();
  const [tickets, setTickets] = useState<AgentTicketWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages] = useState<Record<string, TicketMessage[]>>({});
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Create form
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('general');

  const loadTickets = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await ticketService.getMyTickets(user.id);
      setTickets(data);
    } catch (error) {
      console.error('Error cargando tickets:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadTickets();
  }, [user, loadTickets]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    try {
      await ticketService.createTicket({
        subject,
        message,
        priority,
        category,
        created_by: user.id,
      });
      setIsCreating(false);
      setSubject('');
      setMessage('');
      setPriority('medium');
      setCategory('general');
      loadTickets();
    } catch {
      alert('Error creando el ticket. Intenta de nuevo.');
    }
  }

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
      const msgs = await ticketService.getTicketMessages(ticketId);
      setTicketMessages(prev => ({ ...prev, [ticketId]: msgs }));
      setReplyText('');
    } catch (err) {
      console.error('Error sending reply:', err);
    } finally {
      setSendingReply(false);
    }
  }

  const statusStyles: Record<string, StatusStyle> = {
    open: { label: 'Abierto', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
    in_progress: { label: 'En Proceso', color: 'bg-purple-100 text-purple-700', icon: Clock },
    waiting_response: { label: 'Esperando Respuesta', color: 'bg-amber-100 text-amber-700', icon: Clock },
    resolved: { label: 'Resuelto', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    closed: { label: 'Cerrado', color: 'bg-gray-100 text-gray-600', icon: CheckCircle },
  };

  const priorityColors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-amber-100 text-amber-700',
    urgent: 'bg-red-100 text-red-700',
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={AGENT_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Soporte Operativo" subtitle="Gestiona incidencias y solicita ayuda" />

        <div className="p-8 max-w-5xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">Mis Tickets</h2>
            <Button onClick={() => setIsCreating(!isCreating)} variant={isCreating ? 'outline' : 'primary'}>
              {isCreating ? 'Cancelar' : (
                <><Plus size={18} className="mr-2" /> Nuevo Ticket</>
              )}
            </Button>
          </div>

          {isCreating && (
            <Card className="p-6 border-l-4 border-l-coral animate-fade-in-up">
              <h3 className="font-bold mb-4 text-navy">Nueva Solicitud de Soporte</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="Ej: Error al emitir reserva #999"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full p-2.5 border rounded-lg outline-none bg-white"
                    >
                      <option value="general">General</option>
                      <option value="booking_issue">Problema de Reserva</option>
                      <option value="payment">Pago</option>
                      <option value="technical">Técnico</option>
                      <option value="complaint">Queja</option>
                      <option value="suggestion">Sugerencia</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                    <select
                      value={priority}
                      onChange={e => setPriority(e.target.value)}
                      className="w-full p-2.5 border rounded-lg outline-none bg-white"
                    >
                      <option value="low">Baja (Duda general)</option>
                      <option value="medium">Media (Problema no urgente)</option>
                      <option value="high">Alta (Bloquea mi venta)</option>
                      <option value="urgent">Urgente (Pasajero en aeropuerto)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Detalles del problema</label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                    placeholder="Describe lo que sucede con el mayor detalle posible..."
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" variant="primary">Enviar Ticket</Button>
                </div>
              </form>
            </Card>
          )}

          <div className="space-y-4">
            {loading ? (
              <p className="text-gray-500 text-center py-10">Cargando tickets...</p>
            ) : tickets.length === 0 ? (
              <Card className="text-center py-12">
                <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                  <MessageSquare className="text-gray-400" />
                </div>
                <h3 className="text-gray-900 font-medium">No hay tickets abiertos</h3>
                <p className="text-gray-500 text-sm">Todo parece estar funcionando correctamente.</p>
              </Card>
            ) : (
              tickets.map((ticket) => {
                const style = statusStyles[ticket.status] || statusStyles.open;
                const Icon = style.icon;
                const isExpanded = expandedTicket === ticket.id;
                const msgs = ticketMessages[ticket.id] || [];

                return (
                  <Card key={ticket.id} className="p-5 hover:shadow-md transition">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-gray-400">{ticket.ticket_code}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${priorityColors[ticket.priority] || ''}`}>
                            {ticket.priority}
                          </span>
                          <h4 className="font-bold text-gray-800">{ticket.subject}</h4>
                        </div>
                        {ticket.description && (
                          <p className="text-sm text-gray-600 line-clamp-2">{ticket.description}</p>
                        )}
                        <p className="text-xs text-gray-400 pt-1">
                          Creado el {new Date(ticket.created_at).toLocaleDateString('es')}
                          {ticket.category && ` · ${ticket.category}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${style.color}`}>
                          <Icon size={14} />
                          {style.label}
                        </div>
                        <button
                          onClick={() => toggleExpand(ticket.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                        >
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Threaded Messages */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                        {msgs.length === 0 ? (
                          <p className="text-sm text-gray-400">Sin mensajes en este ticket.</p>
                        ) : (
                          msgs.map(msg => (
                            <div
                              key={msg.id}
                              className={`rounded-lg p-3 text-sm ${
                                msg.sender?.role === 'admin'
                                  ? 'bg-emerald-50 border border-emerald-100'
                                  : 'bg-gray-50 border border-gray-100'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-xs">
                                  {msg.sender?.full_name || 'Sistema'}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  msg.sender?.role === 'admin' ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'
                                }`}>
                                  {msg.sender?.role === 'admin' ? 'Admin' : 'Agente'}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                  {new Date(msg.created_at).toLocaleString('es')}
                                </span>
                              </div>
                              <p className="text-gray-700 whitespace-pre-wrap">{msg.message}</p>
                            </div>
                          ))
                        )}

                        {/* Reply box */}
                        {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
                          <div className="flex gap-2 mt-2">
                            <input
                              type="text"
                              value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              placeholder="Escribe tu respuesta..."
                              className="flex-1 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                              onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleReply(ticket.id);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleReply(ticket.id)}
                              disabled={!replyText.trim() || sendingReply}
                              isLoading={sendingReply}
                            >
                              <Send size={14} />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
