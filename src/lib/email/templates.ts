/**
 * @fileoverview Email templates — HTML templates for all transactional emails.
 * Inline CSS for maximum email client compatibility.
 * @module lib/email/templates
 */

const BRAND_COLOR = '#2563eb';
const BRAND_DARK = '#1e40af';
const BG_COLOR = '#f8fafc';
const APP_NAME = 'Global Solutions Travel';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/* ── Base Layout ── */
function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:${BG_COLOR};">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="text-align:center;padding:24px 0;">
      <h1 style="margin:0;font-size:24px;color:${BRAND_COLOR};letter-spacing:-0.5px;">✈️ ${APP_NAME}</h1>
    </div>
    <div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      ${content}
    </div>
    <div style="text-align:center;padding:24px 0;color:#94a3b8;font-size:12px;">
      <p style="margin:0 0 8px;">© ${new Date().getFullYear()} ${APP_NAME}. Todos los derechos reservados.</p>
      <p style="margin:0;">
        <a href="${APP_URL}" style="color:${BRAND_COLOR};text-decoration:none;">Visitar sitio web</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function button(text: string, url: string): string {
  return `<div style="text-align:center;padding:8px 0;">
    <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;font-size:14px;">${text}</a>
  </div>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;">${label}</td>
    <td style="padding:8px 12px;font-weight:600;color:#1e293b;font-size:13px;border-bottom:1px solid #f1f5f9;text-align:right;">${value}</td>
  </tr>`;
}

/* ================================================================== */
/* TEMPLATE: Booking Confirmation (after payment)                    */
/* ================================================================== */

export interface BookingConfirmationData {
  clientName: string;
  bookingCode: string;
  flightNumber: string;
  airline: string;
  origin: string;
  originCity: string;
  destination: string;
  destinationCity: string;
  departureDate: string;
  passengers: number;
  totalAmount: string;
  paymentMethod: string;
}

export function bookingConfirmationEmail(data: BookingConfirmationData): string {
  return baseLayout(`
    <div style="background:linear-gradient(135deg,${BRAND_COLOR},${BRAND_DARK});padding:32px 24px;text-align:center;">
      <p style="margin:0;font-size:40px;">🎉</p>
      <h2 style="margin:8px 0;color:#ffffff;font-size:22px;">¡Reserva Confirmada!</h2>
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;">Tu pago se procesó correctamente</p>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;color:#334155;font-size:15px;">Hola <strong>${data.clientName}</strong>,</p>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
        Tu reserva ha sido registrada exitosamente. Nuestro equipo emitirá tu boleto en las próximas <strong>24 horas</strong>.
        Recibirás un correo con tu PNR y voucher cuando esté listo.
      </p>

      <div style="text-align:center;margin:0 0 24px;">
        <p style="margin:0 0 4px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Código de Reserva</p>
        <p style="margin:0;font-size:32px;font-weight:800;color:${BRAND_COLOR};letter-spacing:3px;font-family:monospace;">${data.bookingCode}</p>
      </div>

      <div style="background:#f8fafc;border-radius:12px;padding:16px;margin:0 0 20px;">
        <table style="width:100%;border-collapse:collapse;">
          ${infoRow('Vuelo', `${data.airline} ${data.flightNumber}`)}
          ${infoRow('Ruta', `${data.originCity} (${data.origin}) → ${data.destinationCity} (${data.destination})`)}
          ${infoRow('Salida', data.departureDate)}
          ${infoRow('Pasajeros', String(data.passengers))}
          <tr>
            <td style="padding:12px 12px 8px;color:#64748b;font-size:13px;font-weight:600;">TOTAL PAGADO</td>
            <td style="padding:12px 12px 8px;font-weight:800;color:#059669;font-size:18px;text-align:right;">${data.totalAmount}</td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 4px;color:#64748b;font-size:12px;">Método de pago: <strong>${data.paymentMethod}</strong></p>

      ${button('Ver Mi Reserva', `${APP_URL}/user/dashboard/bookings`)}

      <div style="margin:24px 0 0;padding:16px;background:#fef3c7;border-radius:10px;">
        <p style="margin:0;color:#92400e;font-size:13px;">
          ⏳ <strong>Próximo paso:</strong> Nuestro equipo comprará tu boleto real con la aerolínea y te enviaremos el PNR (código de confirmación) y tu voucher en menos de 24 horas.
        </p>
      </div>
    </div>
  `);
}

/* ================================================================== */
/* TEMPLATE: Emission Complete (PNR + ticket assigned)               */
/* ================================================================== */

export interface EmissionCompleteData {
  clientName: string;
  bookingCode: string;
  airlinePnr: string;
  flightNumber: string;
  airline: string;
  origin: string;
  originCity: string;
  destination: string;
  destinationCity: string;
  departureDate: string;
  passengers: { name: string; ticketNumber: string | null }[];
  voucherUrl?: string;
}

export function emissionCompleteEmail(data: EmissionCompleteData): string {
  const passengerRows = data.passengers.map(p =>
    `<tr>
      <td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #f1f5f9;">${p.name}</td>
      <td style="padding:8px 12px;font-family:monospace;font-weight:600;color:${BRAND_COLOR};font-size:13px;border-bottom:1px solid #f1f5f9;text-align:right;">${p.ticketNumber || '—'}</td>
    </tr>`
  ).join('');

  return baseLayout(`
    <div style="background:linear-gradient(135deg,#059669,#047857);padding:32px 24px;text-align:center;">
      <p style="margin:0;font-size:40px;">✅</p>
      <h2 style="margin:8px 0;color:#ffffff;font-size:22px;">¡Boleto Emitido!</h2>
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;">Tu vuelo está confirmado con la aerolínea</p>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;color:#334155;font-size:15px;">Hola <strong>${data.clientName}</strong>,</p>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
        ¡Excelentes noticias! Tu boleto ha sido emitido con la aerolínea. Aquí tienes tu confirmación:
      </p>

      <div style="text-align:center;margin:0 0 24px;background:#ecfdf5;border:2px solid #86efac;border-radius:12px;padding:20px;">
        <p style="margin:0 0 4px;color:#059669;font-size:12px;text-transform:uppercase;letter-spacing:1px;">PNR / Código de Aerolínea</p>
        <p style="margin:0;font-size:36px;font-weight:800;color:#047857;letter-spacing:4px;font-family:monospace;">${data.airlinePnr}</p>
        <p style="margin:8px 0 0;color:#64748b;font-size:11px;">Guarda este código — lo necesitarás en el aeropuerto</p>
      </div>

      <div style="background:#f8fafc;border-radius:12px;padding:16px;margin:0 0 20px;">
        <table style="width:100%;border-collapse:collapse;">
          ${infoRow('Vuelo', `${data.airline} ${data.flightNumber}`)}
          ${infoRow('Ruta', `${data.originCity} (${data.origin}) → ${data.destinationCity} (${data.destination})`)}
          ${infoRow('Salida', data.departureDate)}
          ${infoRow('Reserva', data.bookingCode)}
        </table>
      </div>

      <div style="margin:0 0 20px;">
        <p style="margin:0 0 8px;font-weight:600;color:#334155;font-size:14px;">Pasajeros & Tickets</p>
        <div style="background:#f8fafc;border-radius:12px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;">
            <tr style="background:#e2e8f0;">
              <td style="padding:8px 12px;font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;">Pasajero</td>
              <td style="padding:8px 12px;font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;text-align:right;">N° Ticket</td>
            </tr>
            ${passengerRows}
          </table>
        </div>
      </div>

      ${data.voucherUrl ? button('Descargar Voucher PDF', data.voucherUrl) : ''}
      ${button('Ver Mi Reserva', `${APP_URL}/user/dashboard/bookings`)}

      <div style="margin:24px 0 0;padding:16px;background:#eff6ff;border-radius:10px;">
        <p style="margin:0;color:#1e40af;font-size:13px;">
          💡 <strong>Consejo:</strong> Llega al aeropuerto al menos 3 horas antes para vuelos internacionales.
          Ten tu pasaporte y el PNR listos para el check-in.
        </p>
      </div>
    </div>
  `);
}

/* ================================================================== */
/* TEMPLATE: Payment Receipt                                         */
/* ================================================================== */

export interface PaymentReceiptData {
  clientName: string;
  bookingCode: string;
  subtotal: string;
  gatewayFee: string;
  total: string;
  paymentMethod: string;
  paidAt: string;
}

export function paymentReceiptEmail(data: PaymentReceiptData): string {
  return baseLayout(`
    <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:32px 24px;text-align:center;">
      <p style="margin:0;font-size:40px;">💳</p>
      <h2 style="margin:8px 0;color:#ffffff;font-size:22px;">Recibo de Pago</h2>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;color:#334155;font-size:15px;">Hola <strong>${data.clientName}</strong>,</p>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px;">Aquí tienes el resumen de tu pago:</p>

      <div style="background:#f8fafc;border-radius:12px;padding:16px;margin:0 0 20px;">
        <table style="width:100%;border-collapse:collapse;">
          ${infoRow('Reserva', data.bookingCode)}
          ${infoRow('Subtotal', data.subtotal)}
          ${infoRow('Comisión de pasarela', data.gatewayFee)}
          <tr>
            <td style="padding:12px;color:#334155;font-size:14px;font-weight:700;border-top:2px solid #e2e8f0;">TOTAL</td>
            <td style="padding:12px;font-weight:800;color:#059669;font-size:20px;text-align:right;border-top:2px solid #e2e8f0;">${data.total}</td>
          </tr>
          ${infoRow('Método', data.paymentMethod)}
          ${infoRow('Fecha', data.paidAt)}
        </table>
      </div>

      ${button('Ver Mi Reserva', `${APP_URL}/user/dashboard/bookings`)}
    </div>
  `);
}

/* ================================================================== */
/* TEMPLATE: Booking Cancelled                                       */
/* ================================================================== */

export interface BookingCancelledData {
  clientName: string;
  bookingCode: string;
  reason?: string;
}

export function bookingCancelledEmail(data: BookingCancelledData): string {
  return baseLayout(`
    <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:32px 24px;text-align:center;">
      <p style="margin:0;font-size:40px;">❌</p>
      <h2 style="margin:8px 0;color:#ffffff;font-size:22px;">Reserva Cancelada</h2>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;color:#334155;font-size:15px;">Hola <strong>${data.clientName}</strong>,</p>
      <p style="margin:0 0 16px;color:#64748b;font-size:14px;line-height:1.6;">
        Tu reserva <strong>${data.bookingCode}</strong> ha sido cancelada.
        ${data.reason ? ` Motivo: ${data.reason}` : ''}
      </p>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px;">
        Si pagaste con tarjeta, el reembolso se procesará en 5-10 días hábiles.
        Si tienes dudas, no dudes en contactarnos.
      </p>
      ${button('Buscar Otro Vuelo', `${APP_URL}/flights`)}
    </div>
  `);
}

/* ================================================================== */
/* TEMPLATE: Refund Processed                                        */
/* ================================================================== */

export interface RefundEmailData {
  clientName: string;
  bookingCode: string;
  refundAmount: string;     // Ej: "$120.00"
  reason?: string;          // Ej: "customer_request" | "flight_cancelled"
  processedAt?: string;     // Ej: "17 feb 2026, 14:30"
}

export function refundEmail(data: RefundEmailData): string {
  const reasonText =
    data.reason === 'flight_cancelled'
      ? 'Vuelo cancelado por la aerolínea'
      : data.reason === 'customer_request'
        ? 'Solicitud del cliente'
        : (data.reason ?? '—');

  const processedAt =
    data.processedAt ??
    new Date().toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

  return baseLayout(`
    <div style="background:linear-gradient(135deg,#059669,#047857);padding:32px 24px;text-align:center;">
      <p style="margin:0;font-size:40px;">💸</p>
      <h2 style="margin:8px 0;color:#ffffff;font-size:22px;">Reembolso procesado</h2>
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;">Tu devolución fue registrada correctamente</p>
    </div>

    <div style="padding:24px;">
      <p style="margin:0 0 16px;color:#334155;font-size:15px;">Hola <strong>${data.clientName}</strong>,</p>
      <p style="margin:0 0 18px;color:#64748b;font-size:14px;line-height:1.6;">
        Te confirmamos que hemos procesado el reembolso de tu reserva <strong>${data.bookingCode}</strong>.
      </p>

      <div style="background:#f8fafc;border-radius:12px;padding:16px;margin:0 0 18px;">
        <table style="width:100%;border-collapse:collapse;">
          ${infoRow('Reserva', data.bookingCode)}
          ${infoRow('Monto reembolsado', data.refundAmount)}
          ${infoRow('Motivo', reasonText)}
          ${infoRow('Procesado el', processedAt)}
        </table>
      </div>

      <div style="margin:0 0 18px;padding:14px;background:#ecfdf5;border-radius:10px;border:1px solid #bbf7d0;">
        <p style="margin:0;color:#065f46;font-size:13px;line-height:1.5;">
          ⏳ <strong>Importante:</strong> dependiendo de tu banco o tarjeta, el reembolso puede reflejarse en 5–10 días hábiles.
        </p>
      </div>

      ${button('Ver Mis Reservas', `${APP_URL}/user/dashboard/bookings`)}

      <p style="margin:18px 0 0;color:#94a3b8;font-size:12px;text-align:center;">
        Si tienes dudas, responde este correo y te ayudamos.
      </p>
    </div>
  `);
}

/* ================================================================== */
/* TEMPLATE: Review Request (after completed trip)                   */
/* ================================================================== */

export interface ReviewRequestData {
  clientName: string;
  bookingCode: string;
  destination: string;
}

export function reviewRequestEmail(data: ReviewRequestData): string {
  return baseLayout(`
    <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:32px 24px;text-align:center;">
      <p style="margin:0;font-size:40px;">⭐</p>
      <h2 style="margin:8px 0;color:#ffffff;font-size:22px;">¿Cómo fue tu viaje?</h2>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;color:#334155;font-size:15px;">Hola <strong>${data.clientName}</strong>,</p>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
        ¡Esperamos que hayas disfrutado tu viaje a <strong>${data.destination}</strong>!
        Tu opinión es muy valiosa para nosotros y para futuros viajeros.
        Además, <strong>ganas puntos de lealtad</strong> por cada reseña.
      </p>
      ${button('Dejar Mi Reseña', `${APP_URL}/user/dashboard/reviews`)}
      <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;text-align:center;">
        Reserva: ${data.bookingCode}
      </p>
    </div>
  `);
}

/* ================================================================== */
/* TEMPLATE: Welcome (after registration)                            */
/* ================================================================== */

export interface WelcomeEmailData {
  clientName: string;
}

export function welcomeEmail(data: WelcomeEmailData): string {
  return baseLayout(`
    <div style="background:linear-gradient(135deg,${BRAND_COLOR},${BRAND_DARK});padding:32px 24px;text-align:center;">
      <p style="margin:0;font-size:40px;">🌍</p>
      <h2 style="margin:8px 0;color:#ffffff;font-size:22px;">¡Bienvenido a ${APP_NAME}!</h2>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;color:#334155;font-size:15px;">Hola <strong>${data.clientName}</strong>,</p>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
        Tu cuenta ha sido creada exitosamente. Ahora puedes buscar vuelos, reservar con los mejores precios
        y acumular puntos de lealtad con cada viaje.
      </p>
      <div style="background:#f8fafc;border-radius:12px;padding:16px;margin:0 0 24px;">
        <p style="margin:0 0 8px;font-weight:600;color:#334155;font-size:14px;">Lo que puedes hacer:</p>
        <p style="margin:4px 0;color:#64748b;font-size:13px;">✈️ Buscar y reservar vuelos al mejor precio</p>
        <p style="margin:4px 0;color:#64748b;font-size:13px;">🔥 Acceder a ofertas exclusivas</p>
        <p style="margin:4px 0;color:#64748b;font-size:13px;">⭐ Ganar puntos de lealtad por cada compra</p>
        <p style="margin:4px 0;color:#64748b;font-size:13px;">📄 Recibir vouchers y PNR por email</p>
      </div>
      ${button('Explorar Vuelos', `${APP_URL}/flights`)}
    </div>
  `);
}

/* ================================================================== */
/* TEMPLATE: Password Reset (Global Solutions Branding)              */
/* ================================================================== */

export interface PasswordResetData {
  resetLink: string;
}

export function passwordResetEmail(data: PasswordResetData): string {
  return baseLayout(`
    <div style="background:linear-gradient(135deg,${BRAND_COLOR},${BRAND_DARK});padding:32px 24px;text-align:center;">
      <p style="margin:0;font-size:40px;">🔒</p>
      <h2 style="margin:8px 0;color:#ffffff;font-size:22px;">Restablecer Contraseña</h2>
    </div>
    
    <div style="padding:32px 24px;">
      <p style="margin:0 0 16px;color:#334155;font-size:16px;line-height:1.5;">
        Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong>${APP_NAME}</strong>.
      </p>
      
      <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.5;">
        Haz clic en el siguiente botón para crear una nueva contraseña. Este enlace es válido por 24 horas.
      </p>
      
      ${button('Restablecer mi contraseña', data.resetLink)}
      
      <div style="margin:24px 0; word-break: break-all; text-align: center;">
        <p style="margin:0; color:#94a3b8; font-size:12px;">O copia y pega este enlace en tu navegador:</p>
        <a href="${data.resetLink}" style="color:${BRAND_COLOR}; font-size:12px; text-decoration:underline;">
          ${data.resetLink}
        </a>
      </div>

      <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;" />
      
      <div style="background:#f8fafc; padding:16px; border-radius:8px; border-left:4px solid #cbd5e1;">
        <p style="margin:0;color:#475569;font-size:13px;line-height:1.5;">
          <strong>¿No solicitaste este cambio?</strong><br/>
          Si no intentaste recuperar tu contraseña, puedes ignorar este correo de forma segura. Tu cuenta está protegida y tu contraseña actual seguirá funcionando.
        </p>
      </div>
    </div>
  `);
}

/* ================================================================== */
/* TEMPLATE: Payment Processing (Expectation Management)             */
/* ================================================================== */

export interface PaymentProcessingData {
  clientName: string;
  bookingCode: string;
}

export function paymentProcessingEmail(data: PaymentProcessingData): string {
  return baseLayout(`
    <div style="background:linear-gradient(135deg,#0F2545,#1e3a8a);padding:32px 24px;text-align:center;">
      <p style="margin:0;font-size:40px;">💳</p>
      <h2 style="margin:8px 0;color:#ffffff;font-size:22px;">¡Pago Confirmado!</h2>
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;">Hemos recibido tu pago exitosamente</p>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;color:#334155;font-size:15px;">Hola <strong>${data.clientName}</strong>,</p>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
        Queremos confirmarte que el pago de tu reserva <strong>${data.bookingCode}</strong> ha sido procesado correctamente por nuestro sistema.
      </p>

      <div style="margin:24px 0;padding:20px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;">
        <h3 style="margin:0 0 8px;color:#b45309;font-size:15px;">⏳ ¿Qué sucede ahora?</h3>
        <p style="margin:0;color:#78350f;font-size:14px;line-height:1.5;">
          Tu reserva ha pasado a nuestro <strong>Centro de Emisiones</strong>. Nuestro equipo de agentes está emitiendo tu boleto electrónico oficial con la aerolínea. 
          <br/><br/>
          Te enviaremos tu Voucher PDF a este mismo correo en un plazo de <strong>24 a 48 horas</strong>.
        </p>
      </div>

      <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">
        Agradecemos tu confianza en Global Solutions Travel. Si tienes alguna duda urgente, puedes revisar el estado de tu viaje en tu panel de usuario.
      </p>
    </div>
  `);
}