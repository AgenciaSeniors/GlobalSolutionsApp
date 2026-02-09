/**
 * @fileoverview Email module — Public API.
 * @module lib/email
 */
export { sendEmail, sendBulkEmails, type SendEmailOptions, type SendEmailResult } from './resend';
export {
  bookingConfirmationEmail, type BookingConfirmationData,
  emissionCompleteEmail, type EmissionCompleteData,
  paymentReceiptEmail, type PaymentReceiptData,
  bookingCancelledEmail, type BookingCancelledData,
  reviewRequestEmail, type ReviewRequestData,
  welcomeEmail, type WelcomeEmailData,
} from './templates';
export {
  notifyBookingConfirmation,
  notifyEmissionComplete,
  notifyPaymentReceipt,
  notifyBookingCancelled,
  notifyReviewRequest,
  notifyWelcome,
} from './notifications';
