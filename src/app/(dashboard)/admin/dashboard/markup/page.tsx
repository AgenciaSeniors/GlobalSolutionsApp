'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { useAppSettings } from '@/hooks/useAppSettings';

export default function AdminMarkupPage() {
  const supabase = createClient();
  const { settings } = useAppSettings();

  const [clientMarkup, setClientMarkup] = useState('');
  const [agentMarkup, setAgentMarkup] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setClientMarkup(String(settings.default_markup_percentage ?? 10));
    setAgentMarkup(String(settings.agent_markup_percentage ?? settings.default_markup_percentage ?? 10));
  }, [settings]);

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

      const now = new Date().toISOString();

      const { error: e1 } = await supabase.from('app_settings').upsert({
        key: 'default_markup_percentage',
        value: c,
        updated_at: now,
      });
      if (e1) throw e1;

      const { error: e2 } = await supabase.from('app_settings').upsert({
        key: 'agent_markup_percentage',
        value: a,
        updated_at: now,
      });
      if (e2) throw e2;

      setMsg('✅ Markups guardados.');
    } catch (err: any) {
      setMsg(`❌ ${err?.message ?? 'Error al guardar'}`);
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
              <div>
                <label className="block text-sm font-semibold text-neutral-700">Markup Clientes (%)</label>
                <input
                  className="mt-2 w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                  type="number"
                  step="0.5"
                  min={min}
                  max={max}
                  value={clientMarkup}
                  onChange={(e) => setClientMarkup(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700">Markup Gestores (%)</label>
                <input
                  className="mt-2 w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                  type="number"
                  step="0.5"
                  min={min}
                  max={max}
                  value={agentMarkup}
                  onChange={(e) => setAgentMarkup(e.target.value)}
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Este % se aplica SOLO a gestores (role=agent). No se suma al de clientes.
                </p>
              </div>

              {msg && <p className="text-sm">{msg}</p>}

              <Button type="submit" isLoading={saving}>Guardar</Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}