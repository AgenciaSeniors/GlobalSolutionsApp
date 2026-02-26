'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAppSettings } from '@/hooks/useAppSettings';

type ApiErrorResponse = { error: string };

function isApiErrorResponse(x: unknown): x is ApiErrorResponse {
  return (
    typeof x === 'object' &&
    x !== null &&
    'error' in x &&
    typeof (x as Record<string, unknown>).error === 'string'
  );
}

export default function AdminMarkupPage() {
  const hook = useAppSettings();
  const { settings, loading, error } = hook;

const refetch =
  'refetch' in hook && typeof hook.refetch === 'function'
    ? hook.refetch
    : undefined;

  const [clientMarkup, setClientMarkup] = useState('10');
  const [agentMarkup, setAgentMarkup] = useState('10');
  const [hydrated, setHydrated] = useState(false);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // ✅ Hidrata inputs SOLO una vez cuando termina la carga.
  useEffect(() => {
    if (loading) return;
    if (hydrated) return;

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
    setMsg('');
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

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
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

      if (!res.ok) {
        const errMsg = isApiErrorResponse(body) ? body.error : 'Error al guardar';
        throw new Error(errMsg);
      }

      // ✅ Trae settings reales después del guardado
      if (refetch) await refetch();

      // ✅ Asegura que lo que se vea sea lo guardado, aunque el refetch tarde o falle
      setClientMarkup(String(c));
      setAgentMarkup(String(a));

      setMsg('✅ Markups guardados correctamente.');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar';
      setMsg(`❌ ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Markup" subtitle="Configura el markup para clientes y gestores" />

        <div className="p-8 max-w-3xl">
          <Card variant="bordered">
            <form onSubmit={save} className="space-y-5">
              {error ? (
                <p className="text-sm text-red-600">
                  ❌ No se pudieron cargar los settings: {error}
                </p>
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
                  disabled={loading}
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
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Este % se aplica SOLO a gestores (role=agent). No se suma al de clientes.
                </p>
              </div>

              {msg && <p className="text-sm">{msg}</p>}

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