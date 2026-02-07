/**
 * @fileoverview PDF Generation endpoint for booking vouchers.
 * Per spec §6.2: System generates PDF with official GST template,
 * containing PNR, ticket numbers, flight details, passenger data.
 * Sent to client within 24h of payment.
 * @module app/api/bookings/pdf/route
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Generates HTML for the booking PDF voucher.
 * In production, use a library like puppeteer or @react-pdf/renderer.
 * This returns structured HTML that can be converted to PDF.
 */
function generateVoucherHTML(booking: Record<string, unknown>): string {
  const flight = booking.flight as Record<string, unknown> | null;
  const passengers = booking.passengers as Array<Record<string, unknown>> || [];
  const profile = booking.profile as Record<string, unknown> | null;
  const airline = flight?.airline as Record<string, unknown> | null;
  const origin = flight?.origin_airport as Record<string, unknown> | null;
  const destination = flight?.destination_airport as Record<string, unknown> | null;

  const passengersRows = passengers.map((p, i) => `
    <tr>
      <td style="padding:8px;border:1px solid #e5e7eb;">${i + 1}</td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${p.first_name} ${p.last_name}</td>
      <td style="padding:8px;border:1px solid #e5e7eb;font-family:monospace;">${p.ticket_number || 'Pendiente'}</td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${p.nationality}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Voucher ${booking.booking_code}</title></head>
<body style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1a1a2e;">
  <!-- Header -->
  <div style="text-align:center;border-bottom:3px solid #1e3a8a;padding-bottom:20px;margin-bottom:30px;">
    <h1 style="color:#1e3a8a;margin:0;font-size:28px;">✈️ GLOBAL SOLUTIONS TRAVEL</h1>
    <p style="color:#6b7280;margin:5px 0 0;">Confirmación de Reserva / E-Ticket Voucher</p>
  </div>

  <!-- Booking Info -->
  <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
    <div>
      <p style="margin:2px 0;"><strong>Código de Reserva (Interno):</strong></p>
      <p style="font-size:24px;font-family:monospace;color:#1e3a8a;margin:0;">${booking.booking_code}</p>
    </div>
    <div style="text-align:right;">
      <p style="margin:2px 0;"><strong>PNR Aerolínea:</strong></p>
      <p style="font-size:24px;font-family:monospace;color:#059669;margin:0;">${booking.airline_pnr || 'PENDIENTE'}</p>
    </div>
  </div>

  <div style="background:#f0f9ff;border-radius:8px;padding:15px;margin-bottom:20px;">
    <p style="margin:4px 0;"><strong>Cliente:</strong> ${profile?.full_name || 'N/A'}</p>
    <p style="margin:4px 0;"><strong>Email:</strong> ${profile?.email || 'N/A'}</p>
    <p style="margin:4px 0;"><strong>Fecha de Emisión:</strong> ${new Date().toLocaleDateString('es', { day:'numeric', month:'long', year:'numeric' })}</p>
    <p style="margin:4px 0;"><strong>Estado:</strong> ${booking.booking_status === 'confirmed' ? '✅ EMITIDO' : '⏳ PROCESANDO'}</p>
  </div>

  <!-- Flight Details -->
  <h2 style="color:#1e3a8a;border-bottom:1px solid #e5e7eb;padding-bottom:8px;">Detalle del Vuelo</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr>
      <td style="padding:8px;width:50%;"><strong>Aerolínea:</strong><br/>${airline?.name || 'N/A'} (${airline?.iata_code || ''})</td>
      <td style="padding:8px;"><strong>Número de Vuelo:</strong><br/>${flight?.flight_number || 'N/A'}</td>
    </tr>
    <tr>
      <td style="padding:8px;"><strong>Origen:</strong><br/>${origin?.city || ''} (${origin?.iata_code || ''}) — ${origin?.name || ''}</td>
      <td style="padding:8px;"><strong>Destino:</strong><br/>${destination?.city || ''} (${destination?.iata_code || ''}) — ${destination?.name || ''}</td>
    </tr>
    <tr>
      <td style="padding:8px;"><strong>Salida:</strong><br/>${flight?.departure_datetime ? new Date(flight.departure_datetime as string).toLocaleString('es') : 'N/A'}</td>
      <td style="padding:8px;"><strong>Llegada:</strong><br/>${flight?.arrival_datetime ? new Date(flight.arrival_datetime as string).toLocaleString('es') : 'N/A'}</td>
    </tr>
    <tr>
      <td style="padding:8px;"><strong>Tipo de Aeronave:</strong><br/>${flight?.aircraft_type || 'Por confirmar'}</td>
      <td style="padding:8px;"><strong>Equipaje:</strong><br/>Consultar política de ${airline?.name || 'la aerolínea'}</td>
    </tr>
  </table>

  <!-- Passengers -->
  <h2 style="color:#1e3a8a;border-bottom:1px solid #e5e7eb;padding-bottom:8px;">Pasajeros</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <thead>
      <tr style="background:#f8fafc;">
        <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">#</th>
        <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Nombre Completo</th>
        <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Nº Ticket</th>
        <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Nacionalidad</th>
      </tr>
    </thead>
    <tbody>${passengersRows}</tbody>
  </table>

  <!-- Payment -->
  <h2 style="color:#1e3a8a;border-bottom:1px solid #e5e7eb;padding-bottom:8px;">Resumen de Pago</h2>
  <table style="width:100%;margin-bottom:20px;">
    <tr><td style="padding:4px;">Subtotal (vuelo × ${passengers.length} pasajeros):</td><td style="text-align:right;">$${(booking.subtotal as number)?.toFixed(2)}</td></tr>
    <tr><td style="padding:4px;">Comisión pasarela (${booking.payment_method}):</td><td style="text-align:right;">$${(booking.payment_gateway_fee as number)?.toFixed(2)}</td></tr>
    <tr style="font-size:18px;font-weight:bold;border-top:2px solid #1e3a8a;">
      <td style="padding:8px 4px;">TOTAL PAGADO:</td>
      <td style="text-align:right;color:#059669;padding:8px 4px;">$${(booking.total_amount as number)?.toFixed(2)}</td>
    </tr>
  </table>

  <!-- Footer -->
  <div style="border-top:2px solid #1e3a8a;padding-top:15px;margin-top:30px;text-align:center;color:#6b7280;font-size:12px;">
    <p><strong>Global Solutions Travel</strong> — Tu viaje, nuestra pasión</p>
    <p>Este documento es tu comprobante de reserva. Preséntalo junto con tu pasaporte al momento del check-in.</p>
    <p>Generado automáticamente el ${new Date().toLocaleString('es')}</p>
  </div>
</body>
</html>
  `;
}

export async function GET(request: NextRequest) {
  const bookingId = request.nextUrl.searchParams.get('id');
  if (!bookingId) {
    return NextResponse.json({ error: 'Missing booking id' }, { status: 400 });
  }

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select(`
      *, 
      profile:profiles!user_id(full_name, email),
      flight:flights(
        flight_number, departure_datetime, arrival_datetime, aircraft_type,
        airline:airlines(name, iata_code),
        origin_airport:airports!origin_airport_id(iata_code, name, city),
        destination_airport:airports!destination_airport_id(iata_code, name, city)
      ),
      passengers:booking_passengers(first_name, last_name, ticket_number, nationality)
    `)
    .eq('id', bookingId)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const html = generateVoucherHTML(booking);

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="voucher-${booking.booking_code}.html"`,
    },
  });
}
