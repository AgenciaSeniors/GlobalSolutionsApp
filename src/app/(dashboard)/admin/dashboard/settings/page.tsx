/**
 * @fileoverview Admin Settings — Global business configuration.
 *
 * Controls:
 *  - Default markup percentage for new flights
 *  - Min/max markup guardrails
 *  - Payment gateway fee structure (Stripe, PayPal, Zelle)
 *  - Emission SLA timers
 *  - Business identity (name, email, phone)
 *  - Loyalty program settings
 *
 * All values stored in `app_settings` table as key-value JSONB.
 */
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import {
  DollarSign,
  Clock,
  Building,
  CreditCard,
  TrendingUp,
  Save,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

/* ---------- Types ---------- */
interface SettingsMap {
  [key: string]: string;
}

/* ---------- Setting Groups ---------- */
const MARKUP_KEYS = [
  { key: 'default_markup_percentage', label: 'Markup por defecto (%)', type: 'number', step: '0.5', min: '0', max: '100' },
  { key: 'min_markup_percentage', label: 'Markup mínimo permitido (%)', type: 'number', step: '0.5', min: '0', max: '100' },
  { key: 'max_markup_percentage', label: 'Markup máximo permitido (%)', type: 'number', step: '0.5', min: '0', max: '100' },
];

const STRIPE_KEYS = [
  { key: 'stripe_fee_percentage', label: 'Comisión Stripe (%)', type: 'number', step: '0.01', min: '0' },
  { key: 'stripe_fee_fixed', label: 'Cargo fijo Stripe ($)', type: 'number', step: '0.01', min: '0' },
];

const PAYPAL_KEYS = [
  { key: 'paypal_fee_percentage', label: 'Comisión PayPal (%)', type: 'number', step: '0.01', min: '0' },
  { key: 'paypal_fee_fixed', label: 'Cargo fijo PayPal ($)', type: 'number', step: '0.01', min: '0' },
];

const ZELLE_KEYS = [
  { key: 'zelle_fee_percentage', label: 'Comisión Zelle (%)', type: 'number', step: '0.01', min: '0' },
  { key: 'zelle_fee_fixed', label: 'Cargo fijo Zelle ($)', type: 'number', step: '0.01', min: '0' },
];

const SLA_KEYS = [
  { key: 'emission_sla_hours', label: 'SLA emisión (horas)', type: 'number', step: '1', min: '1' },
  { key: 'emission_warning_hours', label: 'Alerta urgente a las (horas)', type: 'number', step: '1', min: '1' },
  { key: 'review_request_delay_days', label: 'Solicitar reseña después de (días)', type: 'number', step: '1', min: '0' },
  { key: 'loyalty_points_per_dollar', label: 'Puntos fidelidad por $1', type: 'number', step: '1', min: '0' },
];

const BUSINESS_KEYS = [
  { key: 'business_name', label: 'Nombre del Negocio', type: 'text' },
  { key: 'business_email', label: 'Email de Contacto', type: 'email' },
  { key: 'business_phone', label: 'Teléfono', type: 'text' },
  { key: 'business_address', label: 'Dirección', type: 'text' },
  { key: 'currency', label: 'Moneda', type: 'text' },
];

/* ---------- Component ---------- */
export default function AdminSettingsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<SettingsMap>({});
  const [original, setOriginal] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchSettings() {
    setLoading(true);
    const { data } = await supabase.from('app_settings').select('key, value');
    const map: SettingsMap = {};
    (data || []).forEach((row: { key: string; value: string }) => {
      // Remove surrounding quotes from JSONB strings
      const val = typeof row.value === 'string' ? row.value.replace(/^"|"$/g, '') : String(row.value);
      map[row.key] = val;
    });
    setSettings(map);
    setOriginal({ ...map });
    setLoading(false);
  }

  function updateSetting(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSuccess('');
  }

  function hasChanges(): boolean {
    return Object.keys(settings).some((k) => settings[k] !== original[k]);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Validate markup min < max
      const min = parseFloat(settings.min_markup_percentage || '0');
      const max = parseFloat(settings.max_markup_percentage || '100');
      const def = parseFloat(settings.default_markup_percentage || '10');
      if (min >= max) {
        throw new Error('El markup mínimo debe ser menor que el máximo');
      }
      if (def < min || def > max) {
        throw new Error(`El markup por defecto (${def}%) debe estar entre ${min}% y ${max}%`);
      }

      // Build list of changed settings with proper types
      const changed = Object.keys(settings).filter((k) => settings[k] !== original[k]);
      if (changed.length === 0) {
        setSuccess('No hay cambios que guardar.');
        return;
      }

      const numKeys = [...MARKUP_KEYS, ...STRIPE_KEYS, ...PAYPAL_KEYS, ...ZELLE_KEYS, ...SLA_KEYS];
      const payload = changed.map((key) => {
        const isNum = numKeys.some((nk) => nk.key === key);
        return { key, value: isNum ? (parseFloat(settings[key]) || 0) : settings[key] };
      });

      // Use server API route (bypasses RLS via service role)
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: payload }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error || 'Error al guardar configuración');
      }

      setOriginal({ ...settings });
      setSuccess(`✅ ${changed.length} configuración${changed.length > 1 ? 'es' : ''} guardada${changed.length > 1 ? 's' : ''} exitosamente`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Render helpers ---------- */
  function renderGroup(
    title: string,
    description: string,
    icon: React.ReactNode,
    keys: { key: string; label: string; type: string; step?: string; min?: string; max?: string }[],
    borderColor: string,
  ) {
    return (
      <Card variant="bordered" className="overflow-hidden">
        <div className={`-m-6 mb-4 border-b-2 ${borderColor} px-6 py-4`}>
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <h3 className="font-bold text-neutral-800">{title}</h3>
              <p className="text-xs text-neutral-500">{description}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {keys.map(({ key, label, type, step, min, max }) => (
            <div key={key}>
              <label className="mb-1.5 block text-sm font-semibold text-neutral-700">
                {label}
              </label>
              <input
                type={type}
                step={step}
                min={min}
                max={max}
                value={settings[key] || ''}
                onChange={(e) => updateSetting(key, e.target.value)}
                className={`w-full rounded-xl border-2 px-4 py-2.5 text-sm transition-colors focus:border-brand-500 focus:outline-none ${
                  settings[key] !== original[key]
                    ? 'border-brand-300 bg-brand-50/50'
                    : 'border-neutral-200 bg-neutral-50'
                }`}
              />
              {settings[key] !== original[key] && (
                <p className="mt-1 text-xs text-brand-600">
                  Modificado (era: {original[key]})
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar links={ADMIN_SIDEBAR_LINKS} />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-neutral-500">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  /* ---------- Markup preview ---------- */
  const previewBase = 1000;
  const previewMarkup = parseFloat(settings.default_markup_percentage || '10');
  const previewFinal = previewBase * (1 + previewMarkup / 100);
  const previewStripe = previewFinal * (parseFloat(settings.stripe_fee_percentage || '5.4') / 100) + parseFloat(settings.stripe_fee_fixed || '0.30');
  const previewPaypal = previewFinal * (parseFloat(settings.paypal_fee_percentage || '5.4') / 100) + parseFloat(settings.paypal_fee_fixed || '0.30');
  const previewZelle = previewFinal * (parseFloat(settings.zelle_fee_percentage || '0') / 100) + parseFloat(settings.zelle_fee_fixed || '0');

  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1 overflow-auto">
        <Header
          title="Configuración del Sistema"
          subtitle="Markup, comisiones, SLA y datos del negocio"
        />
        <div className="p-6 lg:p-8">
          {/* Status messages */}
          {success && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
              <CheckCircle className="h-5 w-5" /> {success}
            </div>
          )}
          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              <AlertTriangle className="h-5 w-5" /> {error}
            </div>
          )}

          <form onSubmit={handleSave}>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {/* Markup Engine */}
              {renderGroup(
                'Motor de Markup',
                'Controla las ganancias por vuelo: Precio Final = Base × (1 + Markup%)',
                <TrendingUp className="h-6 w-6 text-emerald-600" />,
                MARKUP_KEYS,
                'border-emerald-200 bg-emerald-50',
              )}

              {/* Price Preview */}
              <Card variant="bordered" className="overflow-hidden">
                <div className="-m-6 mb-4 border-b-2 border-blue-200 bg-blue-50 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-6 w-6 text-blue-600" />
                    <div>
                      <h3 className="font-bold text-neutral-800">Vista previa de precios</h3>
                      <p className="text-xs text-neutral-500">
                        Simulación con un vuelo base de $1,000 y 1 pasajero
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Precio base aerolínea:</span>
                    <span className="font-mono">${previewBase.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">+ Markup ({previewMarkup}%):</span>
                    <span className="font-mono font-medium text-emerald-600">
                      +${(previewFinal - previewBase).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-sm font-bold">
                    <span>Precio al cliente:</span>
                    <span className="font-mono text-brand-600">${previewFinal.toFixed(2)}</span>
                  </div>
                  <hr />
                  <p className="text-xs font-semibold uppercase text-neutral-400">Si paga con...</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Stripe:</span>
                    <span className="font-mono">
                      Total ${(previewFinal + previewStripe).toFixed(2)}{' '}
                      <span className="text-xs text-red-500">(fee: ${previewStripe.toFixed(2)})</span>
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">PayPal:</span>
                    <span className="font-mono">
                      Total ${(previewFinal + previewPaypal).toFixed(2)}{' '}
                      <span className="text-xs text-red-500">(fee: ${previewPaypal.toFixed(2)})</span>
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Zelle:</span>
                    <span className="font-mono">
                      Total ${(previewFinal + previewZelle).toFixed(2)}{' '}
                      <span className="text-xs text-emerald-600">(fee: $0.00)</span>
                    </span>
                  </div>
                  <hr />
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-neutral-700">Tu ganancia neta (Stripe):</span>
                    <span className="font-mono font-bold text-emerald-600">
                      ${(previewFinal - previewBase).toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-neutral-400">
                    * La comisión de pasarela la asume el cliente, no reduce tu ganancia.
                  </p>
                </div>
              </Card>

              {/* Stripe Fees */}
              {renderGroup(
                'Comisión Stripe',
                'Porcentaje + cargo fijo por transacción con tarjeta',
                <CreditCard className="h-6 w-6 text-violet-600" />,
                STRIPE_KEYS,
                'border-violet-200 bg-violet-50',
              )}

              {/* PayPal Fees */}
              {renderGroup(
                'Comisión PayPal',
                'Porcentaje + cargo fijo por transacción PayPal',
                <CreditCard className="h-6 w-6 text-blue-600" />,
                PAYPAL_KEYS,
                'border-blue-200 bg-blue-50',
              )}

              {/* Zelle Fees */}
              {renderGroup(
                'Comisión Zelle',
                'Transferencia manual — típicamente sin comisión',
                <CreditCard className="h-6 w-6 text-emerald-600" />,
                ZELLE_KEYS,
                'border-emerald-200 bg-emerald-50',
              )}

              {/* SLA & Operations */}
              {renderGroup(
                'Operaciones & SLA',
                'Tiempos de emisión, alertas y programa de fidelidad',
                <Clock className="h-6 w-6 text-amber-600" />,
                SLA_KEYS,
                'border-amber-200 bg-amber-50',
              )}

              {/* Business Identity */}
              {renderGroup(
                'Datos del Negocio',
                'Aparece en PDFs, vouchers, emails y facturas',
                <Building className="h-6 w-6 text-neutral-600" />,
                BUSINESS_KEYS,
                'border-neutral-200 bg-neutral-50',
              )}
            </div>

            {/* Save bar */}
            <div className="sticky bottom-0 mt-8 flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-lg">
              <div>
                {hasChanges() ? (
                  <Badge variant="warning">Cambios sin guardar</Badge>
                ) : (
                  <Badge variant="success">Todo guardado</Badge>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={fetchSettings}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-4 w-4" /> Recargar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={saving}
                  disabled={!hasChanges()}
                  className="gap-1.5"
                >
                  <Save className="h-4 w-4" /> Guardar Cambios
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
