/**
 * @fileoverview Hook to read global app settings from Supabase `app_settings` table.
 * Used by:
 *  - Checkout page (gateway fees)
 *  - Emission page (SLA hours)
 *  - Flights page (default markup, min/max guards)
 *  - PriceBreakdownCard (fee calculation)
 *
 * Settings are loaded once and cached for the component lifecycle.
 */
'use client';

import { useEffect, useState } from 'react';
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
  stripe_fee_percentage: 5.4,
  stripe_fee_fixed: 0.30,
  paypal_fee_percentage: 5.4,
  paypal_fee_fixed: 0.30,
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

const STRING_KEYS = new Set([
  'business_name',
  'business_email',
  'business_phone',
  'business_address',
  'currency',
]);

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('app_settings')
      .select('key, value')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const merged = { ...DEFAULTS };
          data.forEach((row: { key: string; value: unknown }) => {
            const k = row.key as keyof AppSettings;
            if (k in merged) {
              if (STRING_KEYS.has(k)) {
                (merged as Record<string, unknown>)[k] = String(row.value).replace(/^"|"$/g, '');
              } else {
                (merged as Record<string, unknown>)[k] = parseFloat(String(row.value)) || 0;
              }
            }
          });
          setSettings(merged);
        }
        setLoading(false);
      });
  }, []);

  /**
   * Calculate gateway fee for a given subtotal and payment method.
   */
  function calculateGatewayFee(subtotal: number, method: 'stripe' | 'paypal' | 'zelle'): number {
    const pctKey = `${method}_fee_percentage` as keyof AppSettings;
    const fixedKey = `${method}_fee_fixed` as keyof AppSettings;
    const pct = (settings[pctKey] as number) || 0;
    const fixed = (settings[fixedKey] as number) || 0;
    return subtotal * (pct / 100) + fixed;
  }

  /**
   * Calculate full price breakdown for a flight booking.
   */
  function calculatePriceBreakdown(
    basePricePerPerson: number,
    markupPct: number,
    passengers: number,
    paymentMethod: 'stripe' | 'paypal' | 'zelle',
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
    calculateGatewayFee,
    calculatePriceBreakdown,
  };
}
