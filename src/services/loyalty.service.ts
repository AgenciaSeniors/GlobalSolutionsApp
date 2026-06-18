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

    // Balance is derived from transactions; profiles.loyalty_points is no longer
    // readable from the browser.
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
      points: totalEarned - totalRedeemed,
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
    // Redemption runs server-side: the `add_loyalty_points` RPC is no longer
    // callable from the browser (it would allow self-awarding points). The
    // server identifies the user from the session; `userId` is ignored there.
    void userId;
    const res = await fetch('/api/loyalty/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points, reason, referenceId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error ?? 'No se pudo procesar la redención.');
    }

    return data.balance as number;
  },
};
