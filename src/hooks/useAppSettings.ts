'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface AppSettings {
  default_markup_percentage: number;
  min_markup_percentage: number;
  max_markup_percentage: number;
  stripe_fee_percentage: number;
  stripe_fee_fixed: number;
  paypal_fee_percentage: number;
  paypal_fee_fixed: number;
  zelle_fee_percentage: number;
  zelle_fee_fixed: number;
  emission_sla_hours: number;
  emission_warning_hours: number;
  review_request_delay_days: number;
  loyalty_points_per_dollar: number;
  business_name: string;
  business_email: string;
  business_phone: string;
  business_address: string;
  currency: string;
  agent_markup_percentage: number;
}

const DEFAULTS: AppSettings = {
  default_markup_percentage: 10,
  min_markup_percentage: 5,
  max_markup_percentage: 50,
  stripe_fee_percentage: 2.9,
  stripe_fee_fixed: 0.3,
  paypal_fee_percentage: 3.49,
  paypal_fee_fixed: 0.49,
  zelle_fee_percentage: 0,
  zelle_fee_fixed: 0,
  emission_sla_hours: 24,
  emission_warning_hours: 12,
  review_request_delay_days: 1,
  loyalty_points_per_dollar: 1,
  business_name: 'Global Solutions Travel',
  business_email: 'admin@globalsolutionstravel.com',
  business_phone: '+1 (305) 555-0100',
  business_address: 'Miami, FL, USA',
  currency: 'USD',
  agent_markup_percentage: 10,
};

type AppSettingKey = keyof AppSettings;

type StringKey =
  | 'business_name'
  | 'business_email'
  | 'business_phone'
  | 'business_address'
  | 'currency';

type NumberKey = Exclude<AppSettingKey, StringKey>;

const STRING_KEYS: ReadonlySet<StringKey> = new Set<StringKey>([
  'business_name',
  'business_email',
  'business_phone',
  'business_address',
  'currency',
]);

function parseNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const cleaned = value.replace(/^"|"$/g, '').trim();
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }

  return undefined;
}

function parseString(value: unknown): string {
  return String(value ?? '').replace(/^"|"$/g, '');
}

function setSetting<K extends AppSettingKey>(obj: AppSettings, key: K, value: AppSettings[K]) {
  obj[key] = value;
}

type FeeMethod = 'stripe' | 'paypal' | 'zelle';
type FeePctKey = `${FeeMethod}_fee_percentage`;
type FeeFixedKey = `${FeeMethod}_fee_fixed`;

export function useAppSettings() {
  const supabase = useMemo(() => createClient(), []);

  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: sbError } = await supabase.from('app_settings').select('key, value');

    if (sbError) {
      console.error('Error loading app_settings:', sbError);
      setSettings(DEFAULTS);
      setError(sbError.message);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setSettings(DEFAULTS);
      setLoading(false);
      return;
    }

    const merged: AppSettings = { ...DEFAULTS };

    for (const row of data as Array<{ key: string; value: unknown }>) {
      const key = row.key as AppSettingKey;
      if (!(key in merged)) continue;

      if (STRING_KEYS.has(key as StringKey)) {
        const v = parseString(row.value);
        setSetting(merged, key as StringKey, v);
      } else {
        const v = parseNumberOrUndefined(row.value);
        if (v !== undefined) {
          setSetting(merged, key as NumberKey, v);
        }
      }
    }

    setSettings(merged);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  function calculateGatewayFee(subtotal: number, method: FeeMethod): number {
    const pctKey = `${method}_fee_percentage` as FeePctKey;
    const fixedKey = `${method}_fee_fixed` as FeeFixedKey;

    const pct = settings[pctKey] ?? 0;
    const fixed = settings[fixedKey] ?? 0;

    return subtotal * (pct / 100) + fixed;
  }

  function calculatePriceBreakdown(
    basePricePerPerson: number,
    markupPct: number,
    passengers: number,
    paymentMethod: FeeMethod,
  ) {
    const pricePerPerson = basePricePerPerson * (1 + markupPct / 100);
    const markupPerPerson = pricePerPerson - basePricePerPerson;
    const subtotal = pricePerPerson * passengers;
    const gatewayFee = calculateGatewayFee(subtotal, paymentMethod);
    const total = subtotal + gatewayFee;

    return {
      basePricePerPerson,
      markupPerPerson,
      pricePerPerson,
      passengers,
      subtotal,
      gatewayFee,
      total,
      markupPct,
      paymentMethod,
    };
  }

  return {
    settings,
    loading,
    error,
    refetch,
    calculateGatewayFee,
    calculatePriceBreakdown,
  };
}