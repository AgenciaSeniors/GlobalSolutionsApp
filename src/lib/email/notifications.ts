/**
 * @fileoverview Notification service — Orchestrates sending emails at key moments.
 * Called from API routes and server actions after booking events.
 * @module lib/email/notifications
 */

import { sendEmail, type SendEmailResult } from './resend';
import {
  bookingConfirmationEmail, type BookingConfirmationData,
  emissionCompleteEmail, type EmissionCompleteData,
  paymentReceiptEmail, type PaymentReceiptData,
  bookingCancelledEmail, type BookingCancelledData,
  reviewRequestEmail, type ReviewRequestData,
  welcomeEmail, type WelcomeEmailData,
} from './templates';

// Definimos la interfaz para el reembolso aquí mismo para ser prácticos
export interface RefundData {
  bookingCode: string;
  amount: number;
  reason: string;
  clientName: string;
}

/**
 * Send booking confirmation after successful payment.
 * Triggered when: payment_status changes to 'paid'
 */
export async function notifyBookingConfirmation(
  email: string,
  data: BookingConfirmationData
): Promise<SendEmailResult> {
  return sendEmail({
    to: email,
    subject: `✅ Reserva ${data.bookingCode} confirmada — ${data.originCity} → ${data.destinationCity}`,
    html: bookingConfirmationEmail(data),
  });
}

/**
 * Send emission complete notification with PNR and ticket numbers.
 * Triggered when: admin completes emission (booking_status → 'confirmed', PNR assigned)
 */
export async function notifyEmissionComplete(
  email: string,
  data: EmissionCompleteData
): Promise<SendEmailResult> {
  return sendEmail({
    to: email,
    subject: `✈️ ¡Boleto emitido! PNR: ${data.airlinePnr} — ${data.originCity} → ${data.destinationCity}`,
    html: emissionCompleteEmail(data),
  });
}

/**
 * Send payment receipt.
 * Triggered with: booking confirmation (can be combined or separate)
 */
export async function notifyPaymentReceipt(
  email: string,
  data: PaymentReceiptData
): Promise<SendEmailResult> {
  return sendEmail({
    to: email,
    subject: `💳 Recibo de pago — Reserva ${data.bookingCode}`,
    html: paymentReceiptEmail(data),
  });
}

/**
 * Send cancellation notification.
 * Triggered when: booking_status changes to 'cancelled'
 */
export async function notifyBookingCancelled(
  email: string,
  data: BookingCancelledData
): Promise<SendEmailResult> {
  return sendEmail({
    to: email,
    subject: `Reserva ${data.bookingCode} cancelada`,
    html: bookingCancelledEmail(data),
  });
}

/**
 * Send review request after completed trip.
 * Triggered by: cron or manual trigger after booking_status → 'completed'
 */
export async function notifyReviewRequest(
  email: string,
  data: ReviewRequestData
): Promise<SendEmailResult> {
  return sendEmail({
    to: email,
    subject: `⭐ ¿Cómo fue tu viaje a ${data.destination}? — Cuéntanos tu experiencia`,
    html: reviewRequestEmail(data),
  });
}

/**
 * Send welcome email after registration.
 * Triggered when: new user completes OTP verification
 */
export async function notifyWelcome(
  email: string,
  data: WelcomeEmailData
): Promise<SendEmailResult> {
  return sendEmail({
    to: email,
    subject: `🌍 ¡Bienvenido a Global Solutions Travel, ${data.clientName}!`,
    html: welcomeEmail(data),
  });
}

/**
 * Send refund notification.
 * NEW: Added in Phase 2 to improve transparency.
 */
export async function notifyRefund(
  email: string,
  data: RefundData
): Promise<SendEmailResult> {
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
      <h2 style="color: #059669;">💸 Reembolso Procesado</h2>
      <p>Hola <strong>${data.clientName}</strong>,</p>
      <p>Te informamos que hemos procesado un reembolso para tu reserva <strong>${data.bookingCode}</strong>.</p>
      
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Monto reembolsado:</strong> $${data.amount.toFixed(2)} USD</p>
        <p style="margin: 5px 0;"><strong>Motivo:</strong> ${data.reason}</p>
      </div>

      <p>El dinero debería aparecer en tu cuenta en un plazo de 5 a 10 días hábiles, dependiendo de tu banco.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #666;">Global Solutions Travel Team</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: `💸 Reembolso aprobado — Reserva ${data.bookingCode}`,
    html: html,
  });
}