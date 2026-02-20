/**
 * @fileoverview Agent News Feed — Read-only view of the intranet wall.
 * Agents can view pinned and recent news published by admins.
 */
'use client';

import Sidebar, { AGENT_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import { Pin, Megaphone } from 'lucide-react';
import { useAgentNews } from '@/hooks/useAgentNews';

export default function AgentNewsPage() {
  // ✅ Hook SIEMPRE dentro del componente
  const { items: news, loading, error } = useAgentNews(50);

  const catColors: Record<string, string> = {
    update: 'bg-blue-100 text-blue-700',
    promo: 'bg-emerald-100 text-emerald-700',
    alert: 'bg-red-100 text-red-700',
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar links={AGENT_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Noticias" subtitle="Actualizaciones y comunicados importantes" />
        <div className="p-8">
          {error && (
            <p className="text-red-600 text-sm mb-3">
              Error cargando noticias: {error}
            </p>
          )}

          {loading ? (
            <p className="text-neutral-500">Cargando noticias...</p>
          ) : news.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 rounded-full bg-neutral-100 p-4">
                <Megaphone className="h-8 w-8 text-neutral-400" />
              </div>
              <h3 className="text-lg font-medium text-neutral-900">No hay noticias recientes</h3>
              <p className="text-neutral-500">Mantente atento a nuevas actualizaciones.</p>
            </Card>
          ) : (
            <div className="space-y-4 max-w-4xl">
              {news.map((n) => (
                <Card
                  key={n.id}
                  variant="bordered"
                  className={n.is_pinned ? 'border-l-4 border-l-amber-400 shadow-sm bg-amber-50/10' : ''}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {n.is_pinned && <Pin className="h-4 w-4 text-amber-500 fill-amber-500" />}
                        {n.category && (
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                              catColors[n.category] || 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {n.category}
                          </span>
                        )}
                        <span className="text-xs text-neutral-400">
                          {new Date(n.created_at).toLocaleDateString('es', {
                            day: 'numeric',
                            month: 'long',
                          })}
                        </span>
                      </div>
                    </div>

                    <h4 className="text-lg font-bold text-neutral-900">{n.title}</h4>
                    <p className="text-sm text-neutral-600 whitespace-pre-wrap leading-relaxed">
                      {n.content}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}