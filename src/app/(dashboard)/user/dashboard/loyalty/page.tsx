'use client';

import { useEffect, useState, useCallback } from 'react';
import Sidebar, { USER_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { loyaltyService, type LoyaltyBalance } from '@/services/loyalty.service';
import type { LoyaltyTransaction } from '@/types/models';
import {
  Sparkles, Trophy, TrendingDown,
  Star, Plane, Gift, ArrowUp, ArrowDown,
} from 'lucide-react';


export default function UserLoyaltyPage() {
  const { user } = useAuthContext();
  const [balance, setBalance] = useState<LoyaltyBalance | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [bal, txs] = await Promise.all([
        loyaltyService.getBalance(user.id),
        loyaltyService.getTransactions(user.id),
      ]);
      setBalance(bal);
      setTransactions(txs);
    } catch (err) {
      console.error('Error loading loyalty data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getTier = (pts: number) => {
    if (pts >= 5000) return { name: 'Platino', emoji: '💎', color: 'from-purple-500 to-indigo-600', progress: 100, next: null, need: 0 };
    if (pts >= 2000) return { name: 'Oro', emoji: '🥇', color: 'from-amber-400 to-amber-600', progress: ((pts - 2000) / 3000) * 100, next: 'Platino', need: 5000 - pts };
    if (pts >= 500) return { name: 'Plata', emoji: '🥈', color: 'from-gray-400 to-gray-500', progress: ((pts - 500) / 1500) * 100, next: 'Oro', need: 2000 - pts };
    return { name: 'Bronce', emoji: '🥉', color: 'from-orange-400 to-orange-600', progress: (pts / 500) * 100, next: 'Plata', need: 500 - pts };
  };

  const getTypeIcon = (refType: string | null) => {
    switch (refType) {
      case 'review': return <Star className="h-4 w-4 text-amber-500" />;
      case 'booking': return <Plane className="h-4 w-4 text-blue-500" />;
      case 'promo': return <Gift className="h-4 w-4 text-purple-500" />;
      case 'redemption': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Sparkles className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTypeLabel = (refType: string | null) => {
    switch (refType) {
      case 'review': return 'Reseña';
      case 'booking': return 'Reserva';
      case 'promo': return 'Promoción';
      case 'redemption': return 'Canje';
      default: return 'Otro';
    }
  };

  const tier = getTier(balance?.points ?? 0);

  return (
    <div className="flex min-h-screen">
      <Sidebar links={USER_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Puntos de Lealtad" subtitle="Gana puntos con cada viaje y reseña" />

        <div className="p-6 md:p-8 space-y-6 max-w-4xl">
          {loading ? (
            <Card className="p-6 text-gray-500">Cargando tu programa de lealtad...</Card>
          ) : (
            <>
              {/* Hero Card - Points + Tier */}
              <Card className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${tier.color} text-white p-8`}>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <Trophy className="h-8 w-8" />
                    <div>
                      <p className="text-sm opacity-80">Tu nivel actual</p>
                      <p className="text-2xl font-bold">{tier.emoji} {tier.name}</p>
                    </div>
                  </div>

                  <div className="text-5xl font-bold mb-2">
                    {(balance?.points ?? 0).toLocaleString()}
                    <span className="text-xl font-normal opacity-80 ml-2">puntos</span>
                  </div>

                  {tier.next && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span>Progreso hacia {tier.next}</span>
                        <span className="font-bold">{tier.need.toLocaleString()} pts restantes</span>
                      </div>
                      <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(tier.progress, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Decorative circles */}
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
                <div className="absolute -right-5 bottom-0 h-24 w-24 rounded-full bg-white/5" />
              </Card>


              {/* How to Earn */}
              <Card variant="bordered" className="border-amber-200 bg-amber-50/20">
                <h3 className="font-bold text-amber-800 flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5" /> ¿Cómo ganar puntos?
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 rounded-lg bg-white p-3 border border-amber-100">
                    <Plane className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-gray-800">Viaja</p>
                      <p className="text-xs text-gray-500">1 punto por cada $5 gastados</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-white p-3 border border-amber-100">
                    <Star className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-gray-800">Escribe reseñas</p>
                      <p className="text-xs text-gray-500">25 pts texto, 50 pts con fotos</p>
                    </div>
                  </div>
        
                </div>
              </Card>

              {/* Tier Guide */}
              <Card variant="bordered">
                <h3 className="font-bold text-navy mb-4 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" /> Niveles del Programa
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { name: 'Bronce', emoji: '🥉', range: '0 - 499', color: 'bg-orange-50 border-orange-200' },
                    { name: 'Plata', emoji: '🥈', range: '500 - 1,999', color: 'bg-gray-50 border-gray-200' },
                    { name: 'Oro', emoji: '🥇', range: '2,000 - 4,999', color: 'bg-amber-50 border-amber-200' },
                    { name: 'Platino', emoji: '💎', range: '5,000+', color: 'bg-purple-50 border-purple-200' },
                  ].map(t => (
                    <div key={t.name} className={`rounded-xl border p-3 text-center ${t.color} ${tier.name === t.name ? 'ring-2 ring-coral' : ''}`}>
                      <p className="text-2xl mb-1">{t.emoji}</p>
                      <p className="font-bold text-sm">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.range} pts</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Transaction History */}
              <div>
                <h3 className="font-bold text-navy mb-4">Historial de Transacciones</h3>
                {transactions.length === 0 ? (
                  <Card variant="bordered" className="text-center py-12">
                    <Sparkles className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                    <p className="font-semibold text-gray-700">Sin transacciones aún</p>
                    <p className="text-sm text-gray-500 mt-1">Completa un viaje o deja una reseña para empezar a ganar puntos.</p>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {transactions.map(tx => (
                      <Card key={tx.id} className="p-4 border border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50">
                            {getTypeIcon(tx.reference_type)}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-gray-800">{tx.reason}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                {getTypeLabel(tx.reference_type)}
                              </Badge>
                              <span className="text-[11px] text-gray-400">
                                {new Date(tx.created_at).toLocaleDateString('es', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className={`flex items-center gap-1 font-bold text-sm ${
                          tx.points > 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          {tx.points > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                          {tx.points > 0 ? '+' : ''}{tx.points} pts
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
