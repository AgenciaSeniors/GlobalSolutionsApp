/**
 * @fileoverview Agent News Wall — Private community intranet.
 * Per spec §2.2: Exclusive panel not visible to clients.
 * Agents see admin updates, promotions, alerts.
 */
'use client';

import { useEffect, useState } from 'react';
import Sidebar, { AGENT_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { Pin, Bell, Megaphone, AlertTriangle, Gift } from 'lucide-react';
import type { AgentNews } from '@/types/models';

export default function AgentNewsPage() {
  const supabase = createClient();
  const [news, setNews] = useState<AgentNews[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('agent_news')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
      setNews((data as AgentNews[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  const catIcons: Record<string, typeof Bell> = {
    update: Megaphone,
    promo: Gift,
    alert: AlertTriangle,
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar links={AGENT_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Muro de Noticias" subtitle="Comunidad privada Global Solutions — Sin WhatsApp" />
        <div className="p-8">
          <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <strong>Recordatorio:</strong> Toda comunicación laboral debe realizarse a través de esta plataforma.
            El uso de WhatsApp para temas laborales está prohibido.
          </div>

          {loading ? <p className="text-neutral-500">Cargando noticias...</p> : (
            <div className="space-y-4">
              {news.map(n => {
                const Icon = catIcons[n.category || 'update'] || Megaphone;
                return (
                  <Card key={n.id} variant="bordered" className={n.is_pinned ? 'border-l-4 border-l-amber-400 bg-amber-50/30' : ''}>
                    <div className="flex gap-4">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50">
                        <Icon className="h-5 w-5 text-brand-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {n.is_pinned && <Pin className="h-4 w-4 text-amber-500" />}
                          <h3 className="font-bold text-neutral-900">{n.title}</h3>
                        </div>
                        <p className="mt-1 text-sm text-neutral-600 whitespace-pre-wrap">{n.content}</p>
                        <p className="mt-2 text-xs text-neutral-400">
                          {new Date(n.created_at).toLocaleDateString('es', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
