/**
 * @fileoverview Agent Dashboard — Dashboard minimalista.
 * Solo muestra el fondo disponible, el muro de noticias y enlaces al perfil.
 * @module app/(dashboard)/agent/dashboard/page
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Sidebar, { AGENT_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/client';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { Newspaper, ArrowRight, FileText, Bell, Wallet } from 'lucide-react';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  category: string | null;
  is_pinned: boolean;
  created_at: string;
}

export default function AgentDashboardPage() {
  const supabase = createClient();
  const { user } = useAuthContext();

  const [fundData, setFundData] = useState<{
    amount: number;
    updatedAt: string | null;
  }>({ amount: 0, updatedAt: null });

  const [latestNews, setLatestNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Optimizamos ejecutando ambas consultas en paralelo
      const [profileRes, newsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('agent_fund_cents, updated_at')
          .eq('id', user.id)
          .single(),
        supabase
          .from('agent_news')
          .select('id, title, content, category, is_pinned, created_at')
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(5) // Cargamos las últimas 5 noticias para el dashboard
      ]);

      if (profileRes.data) {
        setFundData({
          amount: profileRes.data.agent_fund_cents || 0,
          updatedAt: profileRes.data.updated_at,
        });
      }

      setLatestNews(newsRes.data as NewsItem[] || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }

    setLoading(false);
  }, [user]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="flex min-h-screen">
      <Sidebar links={AGENT_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header
          title="Dashboard de Gestor"
          subtitle={`Bienvenido${user ? `, ${user.user_metadata?.full_name || 'Gestor'}` : ''}`}
        />
        <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">

          {/* ── KPI Cards (Solo Fondo) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card 
              variant="bordered"
              title={fundData.updatedAt ? `Última act: ${new Date(fundData.updatedAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}` : undefined}
            >
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl text-blue-600 bg-blue-50">
                  <Wallet className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-neutral-500 truncate">Fondo Disponible</p>
                  <p className="text-2xl font-bold text-neutral-900 truncate">
                    {loading ? '—' : `$${fundData.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* ── News + Actions ── */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            
            {/* Feed de Noticias */}
            <div className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <Newspaper className="h-5 w-5 text-brand-500" /> Noticias Recientes
                </h2>
                <Link href="/agent/dashboard/news" className="text-sm font-medium text-brand-600 hover:text-brand-800">
                  Ver todas
                </Link>
              </div>

              {loading ? (
                <Card variant="bordered"><p className="text-neutral-400 text-sm py-4">Cargando...</p></Card>
              ) : latestNews.length === 0 ? (
                <Card variant="bordered" className="text-center py-10">
                  <Bell className="mx-auto h-10 w-10 text-neutral-200 mb-2" />
                  <p className="text-sm text-neutral-500">Sin noticias recientes</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {latestNews.map(n => (
                    <Card key={n.id} variant="bordered" className={n.is_pinned ? 'border-l-4 border-l-amber-400 bg-amber-50/30' : ''}>
                      <h4 className="font-semibold text-sm text-neutral-900 line-clamp-1">{n.title}</h4>
                      <p className="mt-1 text-xs text-neutral-600 line-clamp-2">{n.content}</p>
                      <p className="mt-2 text-[10px] text-neutral-400">
                        {new Date(n.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Acciones Rápidas */}
            <div>
              <h3 className="text-sm font-semibold text-neutral-700 mb-4">Acciones Rápidas</h3>
              <div className="space-y-3">
                <Link
                  href="/agent/dashboard/news"
                  className="flex items-center gap-4 rounded-xl border border-neutral-200 px-4 py-3 text-sm hover:border-brand-300 hover:bg-brand-50/50 transition-colors"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
                    <Newspaper className="h-4 w-4 text-violet-600" />
                  </span>
                  <span className="text-neutral-700 font-medium">Muro de Noticias</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-neutral-300" />
                </Link>

                <Link
                  href="/agent/dashboard/settings"
                  className="flex items-center gap-4 rounded-xl border border-neutral-200 px-4 py-3 text-sm hover:border-brand-300 hover:bg-brand-50/50 transition-colors"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100">
                    <FileText className="h-4 w-4 text-neutral-600" />
                  </span>
                  <span className="text-neutral-700 font-medium">Mi Perfil</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-neutral-300" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}