/**
 * @fileoverview Service layer for loyalty points system (Module 6).
 * Points are auto-awarded via DB triggers on booking completion and review approval.
 * This service handles read operations and manual redemption.
 * @module services/loyalty.service
 */
import { createClient } from '@/lib/supabase/client';
import type { LoyaltyTransaction } from '@/types/models';

export interface LoyaltyBalance {
  points: number;
  totalEarned: number;
  totalRedeemed: number;
  transactionCount: number;
}

export const loyaltyService = {
  /**
   * Get full transaction history for the current user.
   */
  async getTransactions(userId: string): Promise<LoyaltyTransaction[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as LoyaltyTransaction[];
  },

  /**
   * Get current balance and summary stats.
   */
  async getBalance(userId: string): Promise<LoyaltyBalance> {
    const supabase = createClient();

    // Get profile points (single source of truth)
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('loyalty_points')
      .eq('id', userId)
      .single();

    if (profileErr) throw profileErr;

    // Get transaction stats
    const { data: transactions, error: txErr } = await supabase
      .from('loyalty_transactions')
      .select('points')
      .eq('user_id', userId);

    if (txErr) throw txErr;

    const items = transactions ?? [];
    const totalEarned = items.filter(t => t.points > 0).reduce((s, t) => s + t.points, 0);
    const totalRedeemed = Math.abs(items.filter(t => t.points < 0).reduce((s, t) => s + t.points, 0));

    return {
      points: profile?.loyalty_points ?? 0,
      totalEarned,
      totalRedeemed,
      transactionCount: items.length,
    };
  },

  /**
   * Redeem points (deducts from balance).
   * Returns the new balance.
   */
  async redeemPoints(
    userId: string,
    points: number,
    reason: string,
    referenceId?: string,
  ): Promise<number> {
    const supabase = createClient();

    // Verify sufficient balance
    const { data: profile } = await supabase
      .from('profiles')
      .select('loyalty_points')
      .eq('id', userId)
      .single();

    if (!profile || profile.loyalty_points < points) {
      throw new Error('Puntos insuficientes para esta operación.');
    }

    // Call the RPC to deduct points (negative value)
    const { error } = await supabase.rpc('add_loyalty_points', {
      p_user_id: userId,
      p_points: -points,
      p_reason: reason,
      p_ref_type: 'redemption',
      p_ref_id: referenceId ?? null,
    });

    if (error) throw error;

    return profile.loyalty_points - points;
  },
};
