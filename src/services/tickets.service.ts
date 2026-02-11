import { createClient } from '@/lib/supabase/client';

export interface Ticket {
  id: string;
  subject: string;
  message: string; // Descripción del problema
  status: 'open' | 'in_progress' | 'waiting_response' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  admin_response?: string; // Respuesta del soporte
}

export const ticketService = {
  
  // 1. Obtener mis tickets
  async getMyTickets(userId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('agent_tickets')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Ticket[];
  },

  // 2. Crear un nuevo ticket
  async createTicket(ticket: { subject: string; message: string; priority: string; created_by: string }) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('agent_tickets')
      .insert([{
        ...ticket,
        status: 'open'
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};