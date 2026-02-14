"use client";

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

type CheckoutStatus = "idle" | "creating" | "created" | "capturing" | "success" | "error";

// PayPal configuration options
const PAYPAL_OPTIONS = {
  clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "test",
  currency: "USD",
  intent: "capture" as const,
};

function PayPalButtonWrapper({
  bookingId,
  onSuccess,
  onError,
}: PayPalCheckoutProps) {
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [{ isResolved }] = usePayPalScriptReducer();

  const createOrder = async () => {
    setStatus("creating");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/payments/paypal/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          booking_id: bookingId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create PayPal order");
      }

      const data = await response.json();
      
      if (!data.order_id) {
        throw new Error("No order ID received from server");
      }

      setStatus("created");
      return data.order_id;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create order";
      setErrorMessage(message);
      setStatus("error");
      onError(message);
      throw err; // Re-throw to let PayPal SDK know it failed
    }
  };

  const onApprove = async (data: { orderID: string }) => {
    setStatus("capturing");
    setErrorMessage(null);

    try {
      // The webhook will handle the actual payment confirmation
      // But we can verify the order was created successfully
      setStatus("success");
      onSuccess(data.orderID);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment approval failed";
      setErrorMessage(message);
      setStatus("error");
      onError(message);
    }
  };

  const onPayPalError = (err: Record<string, unknown>) => {
    console.error("PayPal error:", err);
    const message = typeof err.message === "string" ? err.message : "PayPal checkout error";
    setErrorMessage(message);
    setStatus("error");
    onError(message);
  };

  const onCancel = () => {
    setStatus("idle");
    setErrorMessage("Payment cancelled by user");
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
      {/* Status Messages */}
      {status === "creating" && (
        <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          <span className="text-sm text-blue-700">Creating order...</span>
        </div>
      )}

      {status === "capturing" && (
        <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          <span className="text-sm text-blue-700">Processing payment...</span>
        </div>
      )}

      {status === "success" && (
        <div className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-sm text-green-700">
            Payment initiated! Please wait for confirmation...
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700">{errorMessage}</span>
        </div>
      )}

      {/* PayPal Buttons */}
      <div className={status === "success" ? "opacity-50 pointer-events-none" : ""}>
        <PayPalButtons
          style={{
            layout: "vertical",
            shape: "rect",
            label: "paypal",
          }}
          createOrder={createOrder}
          onApprove={onApprove}
          onError={onPayPalError}
          onCancel={onCancel}
          disabled={status === "creating" || status === "capturing"}
        />
      </div>

      {/* Security Note */}
      <p className="text-xs text-gray-500 text-center">
        Your payment is secured by PayPal. We never store your payment details.
      </p>
    </div>
  );
}

export function PayPalCheckout({
  bookingId,
  onSuccess,
  onError,
}: PayPalCheckoutProps) {
  // Check if PayPal is configured
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  if (!clientId) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-yellow-500" />
          <p className="text-sm text-yellow-700">
            PayPal is not configured. Please contact support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PayPalScriptProvider options={PAYPAL_OPTIONS}>
      <PayPalButtonWrapper
        bookingId={bookingId}
        onSuccess={onSuccess}
        onError={onError}
      />
    </PayPalScriptProvider>
  );
}
