'use client';

import { useEffect, useState, FormEvent } from 'react';
import Sidebar, { AGENT_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { ticketService, Ticket } from '@/services/tickets.service';
import { MessageSquare, Plus, AlertCircle, CheckCircle, Clock } from 'lucide-react';

export default function AgentTicketsPage() {
  const { user } = useAuthContext();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  // Formulario
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('medium');

  // Cargar tickets al iniciar
  useEffect(() => {
    if (user) loadTickets();
  }, [user]);

  async function loadTickets() {
    if (!user) return;
    try {
      setLoading(true);
      const data = await ticketService.getMyTickets(user.id);
      setTickets(data);
    } catch (error) {
      console.error("Error cargando tickets:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    try {
      await ticketService.createTicket({
        subject,
        message,
        priority,
        created_by: user.id
      });
      // Reset y recargar
      setIsCreating(false);
      setSubject('');
      setMessage('');
      loadTickets(); // Recargar la lista para ver el nuevo
    } catch (error) {
      alert('Error creando el ticket. Intenta de nuevo.');
    }
  }

  // Diccionario de estilos para los estados
  const statusStyles: any = {
    open: { label: 'Abierto', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
    in_progress: { label: 'En Proceso', color: 'bg-purple-100 text-purple-700', icon: Clock },
    closed: { label: 'Resuelto', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={AGENT_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Soporte Operativo" subtitle="Gestiona incidencias y solicita ayuda" />

        <div className="p-8 max-w-5xl mx-auto space-y-6">
          
          {/* Cabecera con Botón de Crear */}
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">Mis Tickets</h2>
            <Button onClick={() => setIsCreating(!isCreating)} variant={isCreating ? 'outline' : 'primary'}>
              {isCreating ? 'Cancelar' : (
                <><Plus size={18} className="mr-2" /> Nuevo Ticket</>
              )}
            </Button>
          </div>

          {/* FORMULARIO DE CREACIÓN (Solo se ve si das click a Nuevo Ticket) */}
          {isCreating && (
            <Card className="p-6 border-l-4 border-l-brand-500 animate-fade-in-up">
              <h3 className="font-bold mb-4">Nueva Solicitud de Soporte</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
                  <input 
                    type="text" 
                    required 
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="Ej: Error al emitir reserva #999"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                      <select 
                        value={priority}
                        onChange={e => setPriority(e.target.value)}
                        className="w-full p-2 border rounded-lg outline-none bg-white"
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
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="Describe lo que sucede..."
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" variant="primary">Enviar Ticket</Button>
                </div>
              </form>
            </Card>
          )}

          {/* LISTA DE TICKETS */}
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
                
                return (
                  <Card key={ticket.id} className="p-5 hover:shadow-md transition">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                            ticket.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {ticket.priority}
                          </span>
                          <h4 className="font-bold text-gray-800">{ticket.subject}</h4>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">{ticket.message}</p>
                        <p className="text-xs text-gray-400 pt-2">
                          Creado el {new Date(ticket.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${style.color}`}>
                        <Icon size={14} />
                        {style.label}
                      </div>
                    </div>
                  </Card>
                )
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
}