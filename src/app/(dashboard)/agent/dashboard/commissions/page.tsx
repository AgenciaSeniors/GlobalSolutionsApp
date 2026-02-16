'use client';

import { useEffect, useState, useCallback } from 'react';
import Sidebar, { AGENT_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { commissionService, type Commission, type CommissionSummary } from '@/services/commission.service';
import { DollarSign, Clock, CheckCircle, Wallet, TrendingUp } from 'lucide-react';

export default function AgentCommissionsPage() {
  const { user } = useAuthContext();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [items, stats] = await Promise.all([
        commissionService.getMyCommissions(user.id),
        commissionService.getAgentSummary(user.id),
      ]);
      setCommissions(items);
      setSummary(stats);
    } catch (err) {
      console.error('Error loading commissions:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const statusConfig: Record<string, { label: string; variant: 'warning' | 'success' | 'info' | 'default' }> = {
    pending: { label: 'Pendiente', variant: 'warning' },
    approved: { label: 'Aprobada', variant: 'info' },
    paid: { label: 'Pagada', variant: 'success' },
    cancelled: { label: 'Cancelada', variant: 'default' },
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={AGENT_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Mis Comisiones" subtitle="Seguimiento de comisiones por reservas confirmadas" />

        <div className="p-6 md:p-8 space-y-6">
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 border border-emerald-100 bg-emerald-50/30">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-xs text-gray-500">Total Ganado</p>
                    <p className="text-xl font-bold text-emerald-700">{formatCurrency(summary.totalEarned)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border border-amber-100 bg-amber-50/30">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-xs text-gray-500">Pendiente</p>
                    <p className="text-xl font-bold text-amber-700">{formatCurrency(summary.pendingAmount)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border border-blue-100 bg-blue-50/30">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-500">Aprobada</p>
                    <p className="text-xl font-bold text-blue-700">{formatCurrency(summary.approvedAmount)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border border-green-100 bg-green-50/30">
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-xs text-gray-500">Pagada</p>
                    <p className="text-xl font-bold text-green-700">{formatCurrency(summary.paidAmount)}</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Commission Table */}
          {loading ? (
            <p className="text-gray-500 text-center py-10">Cargando comisiones...</p>
          ) : commissions.length === 0 ? (
            <Card className="text-center py-16">
              <DollarSign className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Sin comisiones aún</h3>
              <p className="text-gray-500 text-sm mt-1">
                Las comisiones se generan automáticamente cuando tus reservas son confirmadas.
              </p>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Reserva</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Base</th>
                    <th className="px-4 py-3">Tasa</th>
                    <th className="px-4 py-3">Comisión</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {commissions.map(c => {
                    const cfg = statusConfig[c.status] || statusConfig.pending;
                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-bold text-brand-600">
                          {c.booking?.booking_code || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {c.booking?.profile?.full_name || 'Sin nombre'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {formatCurrency(c.base_amount)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{c.commission_rate}%</td>
                        <td className="px-4 py-3 font-bold text-emerald-700">
                          {formatCurrency(c.commission_amount)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(c.created_at).toLocaleDateString('es')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Info Box */}
          <Card variant="bordered" className="border-blue-200 bg-blue-50/30">
            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-blue-800 text-sm">¿Cómo funcionan las comisiones?</p>
                <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                  Se genera una comisión del 5% automáticamente cuando tu reserva es confirmada (emitida).
                  El administrador revisa y aprueba las comisiones pendientes. Una vez aprobadas, serán
                  incluidas en el próximo ciclo de pago.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
