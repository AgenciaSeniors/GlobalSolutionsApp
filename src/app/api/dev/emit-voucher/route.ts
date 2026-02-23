// src/app/api/dev/emit-voucher/route.ts
import { NextResponse } from 'next/server';
import { notifyEmissionComplete } from '@/lib/email/notifications';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, clientName, invoiceId, pdfUrl, passengers, flights } = body;

    // 🔧 Mapeamos tus pasajeros al formato que espera tu plantilla de EmissionComplete
    const mappedPassengers = passengers.map((p: any) => ({
      name: p.fullName,
      ticketNumber: p.ticketNumber
    }));

    // 🔧 Usamos tu servicio de notificación existente
    const result = await notifyEmissionComplete(email, {
      clientName: clientName,
      bookingCode: invoiceId,
      airlinePnr: passengers[0]?.pnr || 'N/A', // Usamos el PNR del primer pasajero
      flightNumber: flights[0]?.flightNumber || 'N/A',
      airline: flights[0]?.airline || 'N/A',
      origin: flights[0]?.origin || '',
      originCity: flights[0]?.origin || '',
      destination: flights[0]?.destination || '',
      destinationCity: flights[0]?.destination || '',
      departureDate: flights[0]?.date || '',
      passengers: mappedPassengers,
      voucherUrl: pdfUrl
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}