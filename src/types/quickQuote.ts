export type QuickQuoteGateway = 'stripe' | 'paypal' | 'zelle';

export interface QuickQuoteRequest {
  net_price_per_person: number;
  passengers: number;
  markup_percentage: number;
  gateway: QuickQuoteGateway;
}

export interface MoneyBreakdown {
  currency: 'USD';
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
}

export interface QuickQuoteResponse {
  currency: 'USD';
  passengers: number;
  net_price_per_person: number;
  net_subtotal: number;
  markup_percentage: number;
  gateway: QuickQuoteGateway;
  breakdown: MoneyBreakdown;
}
