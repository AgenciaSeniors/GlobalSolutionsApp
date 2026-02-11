/**
 * Backend source-of-truth pricing engine.
 * Deterministic, integer-cents based.
 */

export type CurrencyCode = 'USD';

export type MoneyInput = {
  amount: number; // major units (e.g. 12.34)
  currency: CurrencyCode;
};

export type FeePolicy =
  | { type: 'none' }
  | { type: 'fixed'; amount: number }
  | { type: 'percentage'; percentage: number }
  | { type: 'mixed'; percentage: number; fixed_amount: number };

export type PriceEngineInput = {
  base: MoneyInput;
  markup: FeePolicy;
  volatility_buffer?: FeePolicy;
  gateway_fee: FeePolicy;
  gateway_fee_base?: 'pre_fee_total' | 'base_only';
};

export type PriceBreakdown = {
  currency: CurrencyCode;
  subtotal: number;
  markup_amount: number;
  volatility_buffer_amount: number;
  gateway_fee_amount: number;
  total_amount: number;
  cents: {
    subtotal: number;
    markup_amount: number;
    volatility_buffer_amount: number;
    gateway_fee_amount: number;
    total_amount: number;
  };
};

/* ───────────────────── helpers ───────────────────── */

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
}

function assertNonNegative(name: string, value: number): void {
  assertFinite(name, value);
  if (value < 0) throw new Error(`${name} must be >= 0`);
}

function toCents(amount: number): number {
  assertFinite('amount', amount);
  return Math.round(amount * 100);
}

function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

function percentOf(baseCents: number, pct: number): number {
  assertNonNegative('percentage', pct);
  return Math.round((baseCents * pct) / 100);
}

function computeFee(baseCents: number, policy: FeePolicy): number {
  switch (policy.type) {
    case 'none':
      return 0;

    case 'fixed':
      assertNonNegative('fixed fee amount', policy.amount);
      return toCents(policy.amount);

    case 'percentage':
      return percentOf(baseCents, policy.percentage);

    case 'mixed': {
      const percentagePart = percentOf(baseCents, policy.percentage);
      assertNonNegative('fixed_amount', policy.fixed_amount);
      const fixedPart = toCents(policy.fixed_amount);
      return percentagePart + fixedPart;
    }

    default: {
      const _exhaustiveCheck: never = policy;
      return _exhaustiveCheck;
    }
  }
}

/* ───────────────────── engine ───────────────────── */

export function priceEngine(input: PriceEngineInput): PriceBreakdown {
  if (input.base.currency !== 'USD') {
    throw new Error(`Unsupported currency: ${input.base.currency}`);
  }

  assertNonNegative('base.amount', input.base.amount);

  const subtotalCents = toCents(input.base.amount);
  const markupCents = computeFee(subtotalCents, input.markup);

  const bufferPolicy: FeePolicy =
    input.volatility_buffer ?? { type: 'none' };

  const bufferCents = computeFee(subtotalCents, bufferPolicy);

  const preFeeTotalCents =
    subtotalCents + markupCents + bufferCents;

  const gatewayBase =
    input.gateway_fee_base ?? 'pre_fee_total';

  const gatewayFeeBaseCents =
    gatewayBase === 'base_only'
      ? subtotalCents
      : preFeeTotalCents;

  const gatewayFeeCents = computeFee(
    gatewayFeeBaseCents,
    input.gateway_fee
  );

  const totalCents = preFeeTotalCents + gatewayFeeCents;

  return {
    currency: input.base.currency,
    subtotal: fromCents(subtotalCents),
    markup_amount: fromCents(markupCents),
    volatility_buffer_amount: fromCents(bufferCents),
    gateway_fee_amount: fromCents(gatewayFeeCents),
    total_amount: fromCents(totalCents),
    cents: {
      subtotal: subtotalCents,
      markup_amount: markupCents,
      volatility_buffer_amount: bufferCents,
      gateway_fee_amount: gatewayFeeCents,
      total_amount: totalCents,
    },
  };
}
