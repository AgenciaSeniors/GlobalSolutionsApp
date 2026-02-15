"use client";

/**
 * PaymentSelector - Module 2: Financial Infrastructure
 *
 * Client component for choosing payment gateway (Stripe or PayPal).
 * Fetches server-side pricing preview per gateway (frontend NEVER calculates prices).
 *
 * Features:
 *  - Radio buttons for Stripe / PayPal selection
 *  - Live price breakdown fetched from /api/bookings/preview
 *  - Gateway fee comparison when both prices are loaded
 *  - Renders Stripe Elements or PayPal Buttons based on selection
 */

import { useState, useEffect, useCallback } from "react";
import { CreditCard, Wallet, AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { PayPalCheckout } from "./PayPalCheckout";

export type PaymentGateway = "stripe" | "paypal";

/* ───────────────────── Types ───────────────────── */

interface PriceBreakdown {
  currency: string;
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

interface PassengerInfo {
  index: number;
  date_of_birth: string;
  type: "infant" | "child" | "adult";
  multiplier: number;
  price: number;
}

interface PricingResponse {
  gateway: PaymentGateway;
  breakdown: PriceBreakdown;
  passengers: PassengerInfo[];
  base_price: number;
}

interface PaymentSelectorProps {
  bookingId: string;
  onGatewaySelect: (gateway: PaymentGateway) => void;
  selectedGateway: PaymentGateway | null;
  onPaymentSuccess?: (gateway: PaymentGateway, referenceId: string) => void;
  onPaymentError?: (error: string) => void;
  /** If true, only Stripe is shown (PayPal not configured) */
  stripeOnly?: boolean;
  disabled?: boolean;
}

/* ───────────────────── Component ───────────────────── */

export function PaymentSelector({
  bookingId,
  onGatewaySelect,
  selectedGateway,
  onPaymentSuccess,
  onPaymentError,
  stripeOnly = false,
  disabled = false,
}: PaymentSelectorProps) {
  const [pricing, setPricing] = useState<Record<PaymentGateway, PricingResponse | null>>({
    stripe: null,
    paypal: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch pricing when gateway changes
  const fetchPricing = useCallback(
    async (gateway: PaymentGateway) => {
      // Skip if already cached
      if (pricing[gateway]) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/bookings/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            booking_id: bookingId,
            gateway,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch pricing");
        }

        const data: PricingResponse = await response.json();
        setPricing((prev) => ({ ...prev, [gateway]: data }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load pricing");
      } finally {
        setLoading(false);
      }
    },
    [bookingId, pricing]
  );

  useEffect(() => {
    if (!selectedGateway) return;
    fetchPricing(selectedGateway);
  }, [selectedGateway, fetchPricing]);

  // Pre-fetch the other gateway for comparison
  useEffect(() => {
    if (!selectedGateway || stripeOnly) return;
    const otherGateway: PaymentGateway = selectedGateway === "stripe" ? "paypal" : "stripe";
    if (!pricing[otherGateway]) {
      // Delay slightly so the primary gateway loads first
      const timer = setTimeout(() => fetchPricing(otherGateway), 500);
      return () => clearTimeout(timer);
    }
  }, [selectedGateway, pricing, stripeOnly, fetchPricing]);

  const handleGatewayChange = (gateway: PaymentGateway) => {
    if (disabled) return;
    onGatewaySelect(gateway);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);

  const currentPricing = selectedGateway ? pricing[selectedGateway] : null;

  const gatewayOptions: Array<{
    key: PaymentGateway;
    label: string;
    sublabel: string;
    feeLabel: string;
    icon: typeof CreditCard;
  }> = [
    {
      key: "stripe",
      label: "Credit / Debit Card",
      sublabel: "Powered by Stripe",
      feeLabel: "2.9% + $0.30",
      icon: CreditCard,
    },
    ...(stripeOnly
      ? []
      : [
          {
            key: "paypal" as PaymentGateway,
            label: "PayPal",
            sublabel: "Pay with PayPal account",
            feeLabel: "3.49% + $0.49",
            icon: Wallet,
          },
        ]),
  ];

  return (
    <div className="space-y-6">
      {/* ── Gateway Selection ── */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">
          Select Payment Method
        </h3>

        <div className={`grid grid-cols-1 ${!stripeOnly ? "md:grid-cols-2" : ""} gap-4`}>
          {gatewayOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selectedGateway === opt.key;

            return (
              <label
                key={opt.key}
                className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <input
                  type="radio"
                  name="payment_gateway"
                  value={opt.key}
                  checked={isSelected}
                  onChange={() => handleGatewayChange(opt.key)}
                  disabled={disabled}
                  className="sr-only"
                />
                <div className="flex items-center space-x-3 flex-1">
                  <div
                    className={`p-2 rounded-full ${
                      isSelected ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{opt.label}</p>
                    <p className="text-sm text-gray-500">{opt.sublabel}</p>
                  </div>
                </div>
                {isSelected && (
                  <div className="absolute top-4 right-4">
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  </div>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center space-x-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Calculating pricing...</span>
        </div>
      )}

      {/* ── Price Breakdown ── */}
      {currentPricing && !loading && (
        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
          <h4 className="font-semibold text-gray-900">Price Breakdown</h4>

          {/* Passengers */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">Passengers</p>
            {currentPricing.passengers.map((passenger) => (
              <div key={passenger.index} className="flex justify-between text-sm">
                <span className="text-gray-600 capitalize">
                  {passenger.type} (×{passenger.multiplier.toFixed(2)})
                </span>
                <span className="text-gray-900">{formatCurrency(passenger.price)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="text-gray-900">
                {formatCurrency(currentPricing.breakdown.subtotal)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Volatility Buffer (3%)</span>
              <span className="text-gray-900">
                {formatCurrency(currentPricing.breakdown.volatility_buffer_amount)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                Processing Fee (
                {selectedGateway === "stripe" ? "2.9% + $0.30" : "3.49% + $0.49"})
              </span>
              <span className="text-gray-900">
                {formatCurrency(currentPricing.breakdown.gateway_fee_amount)}
              </span>
            </div>

            <div className="border-t border-gray-200 pt-2 flex justify-between">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-bold text-xl text-gray-900">
                {formatCurrency(currentPricing.breakdown.total_amount)}
              </span>
            </div>
          </div>

          {/* ── Gateway Comparison ── */}
          {pricing.stripe && pricing.paypal && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                {pricing.stripe.breakdown.total_amount <
                pricing.paypal.breakdown.total_amount ? (
                  <>
                    💡 Save{" "}
                    {formatCurrency(
                      pricing.paypal.breakdown.total_amount -
                        pricing.stripe.breakdown.total_amount
                    )}{" "}
                    with Credit Card
                  </>
                ) : pricing.paypal.breakdown.total_amount <
                  pricing.stripe.breakdown.total_amount ? (
                  <>
                    💡 Save{" "}
                    {formatCurrency(
                      pricing.stripe.breakdown.total_amount -
                        pricing.paypal.breakdown.total_amount
                    )}{" "}
                    with PayPal
                  </>
                ) : (
                  <>✓ Both payment methods cost the same</>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Payment Action Area ── */}
      {selectedGateway && currentPricing && !loading && (
        <div className="space-y-4">
          {selectedGateway === "paypal" && (
            <PayPalCheckout
              bookingId={bookingId}
              onSuccess={(orderId) => {
                onPaymentSuccess?.("paypal", orderId);
              }}
              onError={(err) => {
                onPaymentError?.(err);
              }}
            />
          )}

          {/* Stripe: the parent component renders StripeElements separately */}
          {selectedGateway === "stripe" && (
            <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
              <ShieldCheck className="w-4 h-4 text-green-600" />
              <p className="text-sm text-gray-600">
                Your card details are encrypted and processed securely by Stripe.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}