/**
 * @fileoverview Servicio para lógica de negocio del Agente (Módulo 5)
 * Maneja estadísticas, recuperación de reservas asignadas y tickets.
 */
import { createClient } from '@/lib/supabase/client';
import { type Database } from '@/types/database.types';

// Tipos para las respuestas
export interface AgentDashboardStats {
  totalAssigned: number;
  pendingEmission: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  monthRevenue: number;
  monthBookings: number;
  clientsServed: number;
  openTickets: number;
}

export interface AgentBookingSnippet {
  id: string;
  booking_code: string;
  status: string;
  total_amount: number;
  created_at: string;
  passenger_name: string; // Tomado del perfil o contacto
  route: string; // "HAV - MIA"
}

export const agentService = {
  
  /**
   * Obtiene todas las métricas clave para el Dashboard en una sola llamada eficiente.
   */
  async getDashboardStats(agentId: string): Promise<AgentDashboardStats> {
    const supabase = createClient();
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // 1. Obtener todas las reservas asignadas a este agente
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, booking_status, total_amount, created_at, user_id')
      .eq('assigned_agent_id', agentId);

    if (error) {
      console.error('Error fetching agent stats:', error);
      throw error;
    }

    // 2. Obtener tickets abiertos (Soporte)
    const { count: openTickets } = await supabase
      .from('agent_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', agentId)
      .neq('status', 'closed'); // Contamos todo lo que NO esté cerrado

    const bookingsData = bookings || [];

    // 3. Cálculos en memoria (Más rápido que hacer 5 consultas SQL separadas)
    
    // Filtros
    const pendingEmission = bookingsData.filter(b => b.booking_status === 'pending_emission').length;
    const confirmed = bookingsData.filter(b => b.booking_status === 'confirmed').length;
    const completed = bookingsData.filter(b => b.booking_status === 'completed').length;
    const cancelled = bookingsData.filter(b => b.booking_status === 'cancelled').length;
    
    // Ventas del mes actual
    const thisMonthBookings = bookingsData.filter(b => b.created_at >= firstDayOfMonth);
    const monthRevenue = thisMonthBookings.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
    
    // Clientes únicos atendidos
    const uniqueClients = new Set(bookingsData.map(b => b.user_id).filter(Boolean));

    return {
      totalAssigned: bookingsData.length,
      pendingEmission,
      confirmed,
      completed,
      cancelled,
      monthRevenue,
      monthBookings: thisMonthBookings.length,
      clientsServed: uniqueClients.size,
      openTickets: openTickets || 0,
    };
  },

  /**
   * Obtiene las últimas 5 reservas para la lista rápida
   */
  async getRecentBookings(agentId: string): Promise<AgentBookingSnippet[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, 
        booking_code, 
        booking_status, 
        total_amount, 
        created_at,
        profiles!user_id(full_name),
        flights!flight_id(
          origin_airport:airports!origin_airport_id(iata_code),
          destination_airport:airports!destination_airport_id(iata_code)
        )
      `)
      .eq('assigned_agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    // Transformar datos para que el componente los consuma fácil
    return (data || []).map((b: any) => ({
      id: b.id,
      booking_code: b.booking_code,
      status: b.booking_status,
      total_amount: b.total_amount,
      created_at: b.created_at,
      passenger_name: b.profiles?.full_name || 'Cliente Desconocido',
      route: b.flights 
        ? `${b.flights.origin_airport?.iata_code} ➝ ${b.flights.destination_airport?.iata_code}`
        : 'Ruta no disponible'
    }));
  }
};