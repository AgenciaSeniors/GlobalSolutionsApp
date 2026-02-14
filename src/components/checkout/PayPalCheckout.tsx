"use client";

/**
 * PayPalCheckout — Module 2
 *
 * Full payment flow:
 *  1. createOrder  → POST /api/payments/paypal/create-order
 *  2. User approves in PayPal popup
 *  3. onApprove    → POST /api/payments/paypal/capture-order  ← CHARGES the money
 *  4. Webhook PAYMENT.CAPTURE.COMPLETED is the safety net
 */

import { useState } from "react";
import {
  PayPalButtons,
  PayPalScriptProvider,
  usePayPalScriptReducer,
} from "@paypal/react-paypal-js";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface PayPalCheckoutProps {
  bookingId: string;
  onSuccess: (orderId: string) => void;
  onError: (error: string) => void;
}

type Status = "idle" | "creating" | "approved" | "capturing" | "success" | "error";

const PAYPAL_OPTIONS = {
  clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "test",
  currency: "USD",
  intent: "capture" as const,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/* ────────────────── Inner wrapper (needs PayPalScriptProvider) ────────────────── */

function ButtonWrapper({ bookingId, onSuccess, onError }: PayPalCheckoutProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [{ isResolved }] = usePayPalScriptReducer();

  /* Step 1 — create order on our backend */
  const createOrder = async () => {
    setStatus("creating");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/payments/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(
          isRecord(d) && typeof d.error === "string" ? d.error : "Failed to create PayPal order"
        );
      }
      const data = await res.json();
      if (!data.order_id) throw new Error("No order_id returned");
      setStatus("approved");
      return data.order_id as string;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Create order failed";
      setErrorMessage(msg);
      setStatus("error");
      onError(msg);
      throw err;
    }
  };

  /* Step 2 — user approved → CAPTURE on our backend */
  const onApprove = async (data: { orderID: string }) => {
    setStatus("capturing");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/payments/paypal/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: data.orderID, booking_id: bookingId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(
          isRecord(d) && typeof d.error === "string" ? d.error : "Capture failed"
        );
      }
      const result = await res.json();
      if (result.status === "COMPLETED" || result.already_captured) {
        setStatus("success");
        onSuccess(data.orderID);
      } else {
        throw new Error(`Capture status: ${result.status ?? "unknown"}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment capture failed";
      setErrorMessage(msg);
      setStatus("error");
      onError(msg);
    }
  };

  const onPayPalError = (err: Record<string, unknown>) => {
    console.error("PayPal error:", err);
    const msg = typeof err.message === "string" ? err.message : "PayPal checkout error";
    setErrorMessage(msg);
    setStatus("error");
    onError(msg);
  };

  const onCancel = () => {
    setStatus("idle");
    setErrorMessage("Pago cancelado por el usuario");
  };

  if (!isResolved) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading PayPal...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {status === "creating" && (
        <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          <span className="text-sm text-blue-700">Creando orden…</span>
        </div>
      )}
      {status === "capturing" && (
        <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          <span className="text-sm text-blue-700">Capturando pago…</span>
        </div>
      )}
      {status === "success" && (
        <div className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-sm text-green-700">¡Pago confirmado! Tu reserva está lista.</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700">{errorMessage}</span>
        </div>
      )}

      <div className={status === "success" || status === "capturing" ? "opacity-50 pointer-events-none" : ""}>
        <PayPalButtons
          style={{ layout: "vertical", shape: "rect", label: "paypal" }}
          createOrder={createOrder}
          onApprove={onApprove}
          onError={onPayPalError}
          onCancel={onCancel}
          disabled={status === "creating" || status === "capturing"}
        />
      </div>

      <p className="text-xs text-gray-500 text-center">
        Tu pago está protegido por PayPal. Nunca almacenamos tus datos de pago.
      </p>
    </div>
  );
}

/* ────────────────── Public export ────────────────── */

export function PayPalCheckout({ bookingId, onSuccess, onError }: PayPalCheckoutProps) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  if (!clientId) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-yellow-500" />
          <p className="text-sm text-yellow-700">PayPal no está configurado. Contacta a soporte.</p>
        </div>
      </div>
    );
  }

  return (
    <PayPalScriptProvider options={PAYPAL_OPTIONS}>
      <ButtonWrapper bookingId={bookingId} onSuccess={onSuccess} onError={onError} />
    </PayPalScriptProvider>
  );
}
