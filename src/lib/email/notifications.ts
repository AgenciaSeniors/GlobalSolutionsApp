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
  refundEmail, type RefundEmailData,
  passwordResetEmail, type PasswordResetData
} from './templates';

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
 * Send refund processed notification.
 * Triggered when: payment_status changes to 'refunded'
 */
export async function notifyRefund(
  email: string,
  data: RefundEmailData
) {
  return sendEmail({
    to: email,
    subject: `💸 Reembolso procesado — Reserva ${data.bookingCode}`,
    html: refundEmail(data),
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
 * Send custom password reset link via Resend.
 * Triggered via API route when user requests a password reset.
 */
export async function notifyPasswordReset(
  email: string,
  data: PasswordResetData
): Promise<SendEmailResult> {
  return sendEmail({
    to: email,
    subject: `🔑 Restaurar contraseña — Global Solutions Travel`,
    html: passwordResetEmail(data),
  });
}