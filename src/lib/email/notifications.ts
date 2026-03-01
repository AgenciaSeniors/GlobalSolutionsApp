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
export async function notifyAgentApproved(email: string, data: { name: string }) {
  try {
    // 1. Importamos la función sendEmail que es la que realmente exporta tu archivo
    const { sendEmail } = await import('./resend');

    // 2. Usamos sendEmail directamente con los parámetros que ya tienes configurados
    const result = await sendEmail({
      to: email,
      subject: '¡Felicidades! Tu solicitud de Gestor ha sido aprobada 🎉',
      html: `
        <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #10b981; margin: 0;">¡Felicidades, ${data.name}!</h1>
          </div>
          <p style="font-size: 16px; line-height: 1.5;">Nos complace informarte que tu solicitud para convertirte en <strong>Gestor</strong> ha sido evaluada y <strong>aprobada exitosamente</strong>.</p>
          <p style="font-size: 16px; line-height: 1.5;">A partir de este momento, tienes acceso a todas las herramientas exclusivas: panel de control de ventas, comisiones, muro de noticias y gestión de clientes.</p>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://globalsolutionstravel.com'}/agent/dashboard" 
               style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Entrar a Mi Perfil de Gestor
            </a>
          </div>
          
          <p style="font-size: 14px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            Si tienes alguna duda, responde a este correo y nuestro equipo de soporte te ayudará.
            <br><br>
            Atentamente,<br>
            <strong>El equipo de Global Solutions Travel</strong>
          </p>
        </div>
      `
    });

    return { success: true, id: result.id };
  } catch (error) {
    console.error('[Email Error] Failed to send agent_approved email:', error);
    return { success: false, error };
  }
}
export async function notifyAgentRejected(email: string, data: { name: string }) {
  try {
    const { sendEmail } = await import('./resend');

    const result = await sendEmail({
      to: email,
      subject: 'Actualización sobre tu solicitud de Gestor - Global Solutions Travel',
      html: `
        <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #64748b;">Hola, ${data.name}</h2>
          <p style="font-size: 16px; line-height: 1.5;">Gracias por tu interés en unirte a nuestro equipo de gestores.</p>
          <p style="font-size: 16px; line-height: 1.5;">Tras revisar tu perfil, lamentamos informarte que <strong>no podemos aprobar tu solicitud en este momento</strong>.</p>
          <p style="font-size: 16px; line-height: 1.5;">Esto no impide que sigas disfrutando de nuestros servicios como cliente o que puedas volver a solicitarlo en el futuro si tu situación cambia.</p>
          <p style="font-size: 14px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            Atentamente,<br>
            <strong>El equipo de Global Solutions Travel</strong>
          </p>
        </div>
      `
    });

    return { success: true, id: result.id };
  } catch (error) {
    console.error('[Email Error] Failed to send agent_rejected email:', error);
    return { success: false, error };
  }
}