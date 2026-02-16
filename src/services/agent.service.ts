/**
 * @fileoverview Service for agent business logic (Module 5).
 * Dashboard stats, recent bookings, commission summary.
 * @module services/agent.service
 */
import { createClient } from '@/lib/supabase/client';

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
  commissionPending: number;
  commissionTotal: number;
}

export interface AgentBookingSnippet {
  id: string;
  booking_code: string;
  status: string;
  total_amount: number;
  created_at: string;
  passenger_name: string;
  route: string;
}

export const agentService = {
  /**
   * All dashboard metrics in one efficient call.
   */
  async getDashboardStats(agentId: string): Promise<AgentDashboardStats> {
    const supabase = createClient();
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Parallel fetch bookings, tickets, and commissions
    const [bookingsRes, ticketsRes, commissionsRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, booking_status, total_amount, created_at, user_id')
        .eq('assigned_agent_id', agentId),
      supabase
        .from('agent_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', agentId)
        .not('status', 'in', '("closed","resolved")'),
      supabase
        .from('agent_commissions')
        .select('commission_amount, status')
        .eq('agent_id', agentId),
    ]);

    const bookingsData = bookingsRes.data || [];
    const commissions = commissionsRes.data || [];

    const pendingEmission = bookingsData.filter(b => b.booking_status === 'pending_emission').length;
    const confirmed = bookingsData.filter(b => b.booking_status === 'confirmed').length;
    const completed = bookingsData.filter(b => b.booking_status === 'completed').length;
    const cancelled = bookingsData.filter(b => b.booking_status === 'cancelled').length;

    const thisMonthBookings = bookingsData.filter(b => b.created_at >= firstDayOfMonth);
    const monthRevenue = thisMonthBookings.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

    const uniqueClients = new Set(bookingsData.map(b => b.user_id).filter(Boolean));

    const commissionPending = commissions
      .filter(c => c.status === 'pending')
      .reduce((s, c) => s + Number(c.commission_amount), 0);
    const commissionTotal = commissions
      .reduce((s, c) => s + Number(c.commission_amount), 0);

    return {
      totalAssigned: bookingsData.length,
      pendingEmission,
      confirmed,
      completed,
      cancelled,
      monthRevenue,
      monthBookings: thisMonthBookings.length,
      clientsServed: uniqueClients.size,
      openTickets: ticketsRes.count || 0,
      commissionPending,
      commissionTotal,
    };
  },

  /**
   * Last 5 assigned bookings for quick reference.
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

    type RecentBookingRow = {
      id: string;
      booking_code: string;
      booking_status: string;
      total_amount: number | null;
      created_at: string;
      profiles?: { full_name?: string | null } | null;
      flights?: {
        origin_airport?: { iata_code?: string | null } | null;
        destination_airport?: { iata_code?: string | null } | null;
      } | null;
    };

    return (data as unknown as RecentBookingRow[]).map((b) => ({
      id: b.id,
      booking_code: b.booking_code,
      status: b.booking_status,
      total_amount: b.total_amount ?? 0,
      created_at: b.created_at,
      passenger_name: b.profiles?.full_name || 'Cliente Desconocido',
      route: b.flights
        ? `${b.flights.origin_airport?.iata_code} ➝ ${b.flights.destination_airport?.iata_code}`
        : 'Ruta no disponible',
    }));
  },
};
