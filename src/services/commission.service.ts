/**
 * @fileoverview Service layer for agent commissions (Module 5).
 * Commissions are auto-generated via DB trigger when booking is confirmed.
 * @module services/commission.service
 */
import { createClient } from '@/lib/supabase/client';

export interface Commission {
  id: string;
  agent_id: string;
  booking_id: string;
  commission_rate: number;
  base_amount: number;
  commission_amount: number;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  booking?: {
    booking_code: string;
    total_amount: number;
    booking_status: string;
    profile?: { full_name: string } | null;
  } | null;
}

export interface CommissionSummary {
  totalEarned: number;
  pendingAmount: number;
  approvedAmount: number;
  paidAmount: number;
  totalCount: number;
}

export const commissionService = {
  /**
   * Get commissions for the logged-in agent.
   */
  async getMyCommissions(agentId: string): Promise<Commission[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('agent_commissions')
      .select(`
        *,
        booking:bookings!booking_id(
          booking_code,
          total_amount,
          booking_status,
          profile:profiles!user_id(full_name)
        )
      `)
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as Commission[];
  },

  /**
   * Get all commissions (admin view).
   */
  async getAllCommissions(): Promise<(Commission & { agent?: { full_name: string; agent_code: string | null } })[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('agent_commissions')
      .select(`
        *,
        agent:profiles!agent_id(full_name, agent_code),
        booking:bookings!booking_id(
          booking_code,
          total_amount,
          booking_status,
          profile:profiles!user_id(full_name)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as (Commission & { agent?: { full_name: string; agent_code: string | null } })[];
  },

  /**
   * Get summary stats for a single agent.
   */
  async getAgentSummary(agentId: string): Promise<CommissionSummary> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('agent_commissions')
      .select('commission_amount, status')
      .eq('agent_id', agentId);

    if (error) throw error;

    const items = data ?? [];
    return {
      totalEarned: items.reduce((s, c) => s + Number(c.commission_amount), 0),
      pendingAmount: items.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.commission_amount), 0),
      approvedAmount: items.filter(c => c.status === 'approved').reduce((s, c) => s + Number(c.commission_amount), 0),
      paidAmount: items.filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.commission_amount), 0),
      totalCount: items.length,
    };
  },

  /**
   * Approve a pending commission (admin only).
   */
  async approveCommission(commissionId: string, adminId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('agent_commissions')
      .update({
        status: 'approved',
        approved_by: adminId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', commissionId)
      .eq('status', 'pending');

    if (error) throw error;
  },

  /**
   * Mark commission as paid (admin only).
   */
  async markAsPaid(commissionId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('agent_commissions')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', commissionId)
      .eq('status', 'approved');

    if (error) throw error;
  },
};
