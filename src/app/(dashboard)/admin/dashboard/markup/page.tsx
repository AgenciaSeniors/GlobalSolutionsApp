'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAppSettings } from '@/hooks/useAppSettings';

export default function AdminMarkupPage() {
  const { settings, loading, error, refetch } = useAppSettings();

  const [clientMarkup, setClientMarkup] = useState('10');
  const [agentMarkup, setAgentMarkup] = useState('10');
  const [hydrated, setHydrated] = useState(false);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Hydrate inputs once when settings finish loading
  useEffect(() => {
    if (loading || hydrated) return;

    setClientMarkup(String(settings.default_markup_percentage ?? 10));
    setAgentMarkup(
      String(settings.agent_markup_percentage ?? settings.default_markup_percentage ?? 10),
    );
    setHydrated(true);
  }, [loading, hydrated, settings]);

  const min = settings.min_markup_percentage ?? 0;
  const max = settings.max_markup_percentage ?? 100;

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSaving(true);

    try {
      const c = Number(clientMarkup);
      const a = Number(agentMarkup);

      if (!Number.isFinite(c) || c < min || c > max) {
        throw new Error(`Markup clientes debe estar entre ${min}% y ${max}%.`);
      }
      if (!Number.isFinite(a) || a < min || a > max) {
        throw new Error(`Markup gestores debe estar entre ${min}% y ${max}%.`);
      }

      console.log('[Markup] Saving:', { default_markup_percentage: c, agent_markup_percentage: a });

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: [
            { key: 'default_markup_percentage', value: c },
            { key: 'agent_markup_percentage', value: a },
          ],
        }),
      });

      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      console.log('[Markup] Response:', res.status, body);

      if (!res.ok) {
        const errMsg =
          typeof body === 'object' && body !== null && 'error' in body
            ? String((body as Record<string, unknown>).error)
            : `Error del servidor (${res.status})`;
        throw new Error(errMsg);
      }

      // Check server verification
      const verification =
        typeof body === 'object' && body !== null && 'verification' in body
          ? (body as Record<string, unknown>).verification as Record<string, unknown>
          : null;

      if (verification) {
        console.log('[Markup] Server verification:', verification);
        const dbClient = verification.default_markup_percentage;
        const dbAgent = verification.agent_markup_percentage;
        if (dbClient !== c || dbAgent !== a) {
          console.error('[Markup] MISMATCH! Sent:', { c, a }, 'DB has:', { dbClient, dbAgent });
          throw new Error(
            `Los valores no se guardaron correctamente. BD tiene: clientes=${dbClient}%, gestores=${dbAgent}%`,
          );
        }
      }

      // Refresh settings from DB — reset hydrated so hook values flow into inputs
      setHydrated(false);
      await refetch();

      setMsg({ type: 'success', text: `Markups guardados: Clientes ${c}%, Gestores ${a}%.` });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar';
      console.error('[Markup] Save error:', errorMessage);
      setMsg({ type: 'error', text: errorMessage });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1 overflow-auto">
        <Header title="Markup" subtitle="Configura el markup para clientes y gestores" />

        <div className="p-8 max-w-3xl">
          <Card variant="bordered">
            <form onSubmit={save} className="space-y-5">
              {error ? (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  No se pudieron cargar los settings: {error}
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-semibold text-neutral-700">
                  Markup Clientes (%)
                </label>
                <input
                  className="mt-2 w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                  type="number"
                  step="0.5"
                  min={min}
                  max={max}
                  value={clientMarkup}
                  onChange={(e) => setClientMarkup(e.target.value)}
                  disabled={loading || saving}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700">
                  Markup Gestores (%)
                </label>
                <input
                  className="mt-2 w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                  type="number"
                  step="0.5"
                  min={min}
                  max={max}
                  value={agentMarkup}
                  onChange={(e) => setAgentMarkup(e.target.value)}
                  disabled={loading || saving}
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Este % se aplica SOLO a gestores (role=agent). No se suma al de clientes.
                </p>
              </div>

              {msg && (
                <div
                  className={`rounded-lg border p-3 text-sm font-medium ${
                    msg.type === 'success'
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  {msg.type === 'success' ? '✅ ' : '❌ '}
                  {msg.text}
                </div>
              )}

              <Button type="submit" isLoading={saving} disabled={loading}>
                Guardar
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
