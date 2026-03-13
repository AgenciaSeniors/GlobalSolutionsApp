// src/lib/pdf/bookingVoucher.tsx
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';

// 🚀 Registramos la fuente Premium (Inter)
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hjp-Ek-_EeA.woff', fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  // 🚀 Aplicamos la fuente 'Inter'
  page: { padding: 30, fontFamily: 'Inter', fontSize: 10, color: '#333333' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: '2px solid #0F2545', paddingBottom: 10, marginBottom: 20 },
  logoContainer: { flexDirection: 'column' },
  logoImage: { 
    width: 200,         
    marginLeft: -30,     
    marginBottom: 8,
    marginTop: -45
  },
  brandSub: { fontSize: 9, color: '#666666' },
  headerDetails: { alignItems: 'flex-end' },
  invoiceText: { fontSize: 12, fontWeight: 700, color: '#0F2545' },
  statusText: { fontSize: 10, color: '#059669', marginTop: 4, fontWeight: 700 }, 
  
  sectionTitle: { 
    fontSize: 12, 
    fontWeight: 700, 
    backgroundColor: '#F4F7FB', 
    padding: 6, 
    paddingLeft: 10,
    marginBottom: 10, 
    color: '#0F2545',
    borderLeft: '4px solid #FF4757' 
  },
  
  table: { width: '100%', marginBottom: 20 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#0F2545', padding: 6, fontWeight: 700, fontSize: 8, color: '#ffffff' },
  tableRow: { flexDirection: 'row', borderBottom: '1px solid #e2e8f0', padding: 6, fontSize: 8, color: '#333333' },
  
  colAirline: { width: '14%' },
  colTime: { width: '17%' },
  colDateInfo: { width: '15%' },
  colFlight: { width: '12%' },
  colCity: { width: '22%' },
  colClass: { width: '10%' },
  colStatus: { width: '10%' },

  colPaxName: { width: '40%' },
  colBaggage: { width: '20%' },
  colPNR: { width: '20%' },
  colTicket: { width: '20%' },

  footer: { marginTop: 'auto', paddingTop: 10, borderTop: '2px solid #FF4757', fontSize: 8, color: '#666666', textAlign: 'justify' }
});

export interface FlightSegment {
  airline: string;
  flightNumber: string;
  date: string;
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
  cabinClass: string;
  status: string;
}

export interface Passenger {
  fullName: string;
  baggage: string;
  pnr: string;
  ticketNumber: string;
}

export interface BookingVoucherProps {
  invoiceId: string;
  issueDate: string;
  outboundFlights: FlightSegment[];
  returnFlights?: FlightSegment[];
  passengers: Passenger[];
  policies?: string; // 🚀 Prop de Políticas editables
  companyContact?: string; // Correo y teléfono de la empresa (editable desde el formulario)
}

// ─────────────────────────────────────────────────────────────────────────────
// BookingVoucherDocument — usado por /api/bookings/pdf con datos reales de DB
// ─────────────────────────────────────────────────────────────────────────────

export interface VoucherBooking {
  booking_code: string;
  airline_pnr: string | null;
  booking_status: string;
  payment_status: string;
  payment_method: string | null;
  subtotal: number;
  payment_gateway_fee: number;
  total_amount: number;
  profile: { full_name: string; email: string } | null;
  flight: {
    flight_number: string | null;
    departure_datetime: string | null;
    arrival_datetime: string | null;
    aircraft_type: string | null;
    airline: { name: string; iata_code: string } | null;
    origin_airport: { iata_code: string; name: string; city: string } | null;
    destination_airport: { iata_code: string; name: string; city: string } | null;
  } | null;
  passengers: {
    first_name: string;
    last_name: string;
    ticket_number: string | null;
    nationality: string | null;
  }[];
}

const docStyles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Inter', fontSize: 10, color: '#333333' },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: '2px solid #0F2545', paddingBottom: 12, marginBottom: 16 },
  logoContainer: { flexDirection: 'column' },
  logoImage: { width: 180, marginLeft: -10, marginBottom: 6, marginTop: -20 },
  brandSub: { fontSize: 9, color: '#666666' },
  headerDetails: { alignItems: 'flex-end' },
  invoiceText: { fontSize: 13, fontWeight: 700, color: '#0F2545' },
  statusText: { fontSize: 10, marginTop: 4, fontWeight: 700 },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statusBadge: { backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: 4, paddingLeft: 8, paddingRight: 8, fontSize: 9, fontWeight: 700 },
  methodBadge: { backgroundColor: '#F0FDF4', color: '#166534', padding: 4, paddingLeft: 8, paddingRight: 8, fontSize: 9, fontWeight: 700 },
  sectionTitle: { fontSize: 11, fontWeight: 700, backgroundColor: '#F4F7FB', padding: 6, paddingLeft: 10, marginBottom: 8, marginTop: 10, color: '#0F2545', borderLeft: '4px solid #FF4757' },
  infoBox: { backgroundColor: '#F9FAFB', padding: 10, marginBottom: 4 },
  infoLabel: { fontSize: 8, color: '#6B7280' },
  infoValue: { fontSize: 10, fontWeight: 700, color: '#111827' },
  flightCard: { backgroundColor: '#F0F4FF', padding: 12, marginBottom: 4 },
  flightRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  airportBlock: { alignItems: 'flex-start', flex: 1 },
  iataCode: { fontSize: 22, fontWeight: 700, color: '#0F2545' },
  cityName: { fontSize: 9, color: '#4B5563', marginBottom: 4 },
  flightTime: { fontSize: 13, fontWeight: 700, color: '#111827' },
  flightDate: { fontSize: 8, color: '#6B7280' },
  arrowBlock: { alignItems: 'center', flex: 1 },
  arrowText: { fontSize: 18, color: '#FF4757' },
  flightNumberText: { fontSize: 9, color: '#374151', marginTop: 4 },
  aircraftText: { fontSize: 8, color: '#9CA3AF' },
  table: { width: '100%', marginBottom: 4 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#0F2545', padding: 6, fontWeight: 700, fontSize: 8, color: '#ffffff' },
  tableRow: { flexDirection: 'row', borderBottom: '1px solid #E5E7EB', padding: 6, fontSize: 8, color: '#374151' },
  summaryBox: { backgroundColor: '#F9FAFB', padding: 12, marginTop: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totalRow: { borderTop: '1px solid #D1D5DB', paddingTop: 6, marginTop: 4 },
  summaryLabel: { fontSize: 9, color: '#4B5563' },
  summaryValue: { fontSize: 9, color: '#111827' },
  footer: { marginTop: 'auto', paddingTop: 10, borderTop: '2px solid #FF4757', fontSize: 8, color: '#666666', textAlign: 'justify' },
});

export const BookingVoucherDocument = ({ booking }: { booking: VoucherBooking }) => {
  const fmtDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  };
  const fmtTime = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };
  const fmtMoney = (v: number) => `$${Number(v).toFixed(2)}`;

  const payStatusMap: Record<string, string> = { paid: 'PAGADO', pending: 'PENDIENTE', refunded: 'REEMBOLSADO', failed: 'FALLIDO' };
  const bkStatusMap: Record<string, string> = { confirmed: 'CONFIRMADO', pending: 'PENDIENTE', cancelled: 'CANCELADO', completed: 'COMPLETADO' };
  const pmtMap: Record<string, string> = { zelle: 'Zelle', pix: 'PIX', spei: 'SPEI', square: 'Tarjeta (Square)', cash: 'Efectivo' };

  const issueDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const isPaid = booking.payment_status === 'paid';

  return (
    <Document>
      <Page size="A4" style={docStyles.page}>

        {/* Header */}
        <View style={docStyles.header}>
          <View style={docStyles.logoContainer}>
            <Image src="/brand/logo.png" style={docStyles.logoImage} />
            <Text style={docStyles.brandSub}>info@globalsolutiontravel.com</Text>
          </View>
          <View style={docStyles.headerDetails}>
            <Text style={docStyles.invoiceText}>Código: {booking.booking_code}</Text>
            <Text style={docStyles.brandSub}>Emitido: {issueDate}</Text>
            {booking.airline_pnr ? <Text style={[docStyles.brandSub, { marginTop: 3 }]}>PNR: {booking.airline_pnr}</Text> : null}
            <Text style={[docStyles.statusText, { color: isPaid ? '#059669' : '#D97706' }]}>
              {payStatusMap[booking.payment_status] ?? booking.payment_status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Status badges */}
        <View style={docStyles.statusRow}>
          <Text style={docStyles.statusBadge}>
            RESERVA: {bkStatusMap[booking.booking_status] ?? booking.booking_status.toUpperCase()}
          </Text>
          {booking.payment_method ? (
            <Text style={docStyles.methodBadge}>
              {pmtMap[booking.payment_method] ?? booking.payment_method.toUpperCase()}
            </Text>
          ) : null}
        </View>

        {/* Client */}
        {booking.profile ? (
          <>
            <Text style={docStyles.sectionTitle}>DATOS DEL CLIENTE</Text>
            <View style={docStyles.infoBox}>
              <Text style={docStyles.infoLabel}>Nombre</Text>
              <Text style={docStyles.infoValue}>{booking.profile.full_name}</Text>
              <Text style={[docStyles.infoLabel, { marginTop: 6 }]}>Correo</Text>
              <Text style={docStyles.infoValue}>{booking.profile.email}</Text>
            </View>
          </>
        ) : null}

        {/* Flight */}
        {booking.flight ? (
          <>
            <Text style={docStyles.sectionTitle}>ITINERARIO DE VUELO</Text>
            <View style={docStyles.flightCard}>
              <View style={docStyles.flightRow}>
                <View style={docStyles.airportBlock}>
                  <Text style={docStyles.iataCode}>{booking.flight.origin_airport?.iata_code ?? '—'}</Text>
                  <Text style={docStyles.cityName}>{booking.flight.origin_airport?.city ?? booking.flight.origin_airport?.name ?? '—'}</Text>
                  <Text style={docStyles.flightTime}>{fmtTime(booking.flight.departure_datetime)}</Text>
                  <Text style={docStyles.flightDate}>{fmtDate(booking.flight.departure_datetime)}</Text>
                </View>
                <View style={docStyles.arrowBlock}>
                  <Text style={docStyles.arrowText}>✈</Text>
                  <Text style={docStyles.flightNumberText}>
                    {booking.flight.airline?.name ?? ''}{booking.flight.flight_number ? ` · ${booking.flight.flight_number}` : ''}
                  </Text>
                  {booking.flight.aircraft_type ? <Text style={docStyles.aircraftText}>{booking.flight.aircraft_type}</Text> : null}
                </View>
                <View style={[docStyles.airportBlock, { alignItems: 'flex-end' }]}>
                  <Text style={docStyles.iataCode}>{booking.flight.destination_airport?.iata_code ?? '—'}</Text>
                  <Text style={docStyles.cityName}>{booking.flight.destination_airport?.city ?? booking.flight.destination_airport?.name ?? '—'}</Text>
                  <Text style={docStyles.flightTime}>{fmtTime(booking.flight.arrival_datetime)}</Text>
                  <Text style={docStyles.flightDate}>{fmtDate(booking.flight.arrival_datetime)}</Text>
                </View>
              </View>
            </View>
          </>
        ) : null}

        {/* Passengers */}
        {booking.passengers.length > 0 ? (
          <>
            <Text style={docStyles.sectionTitle}>PASAJEROS</Text>
            <View style={docStyles.table}>
              <View style={docStyles.tableHeader}>
                <Text style={{ width: '30%' }}>NOMBRE</Text>
                <Text style={{ width: '30%' }}>APELLIDO</Text>
                <Text style={{ width: '20%' }}>NACIONALIDAD</Text>
                <Text style={{ width: '20%' }}>Nº TICKET</Text>
              </View>
              {booking.passengers.map((p, i) => (
                <View key={`pax-${i}`} style={docStyles.tableRow}>
                  <Text style={{ width: '30%', fontWeight: 700 }}>{p.first_name}</Text>
                  <Text style={{ width: '30%', fontWeight: 700 }}>{p.last_name}</Text>
                  <Text style={{ width: '20%' }}>{p.nationality ?? '—'}</Text>
                  <Text style={{ width: '20%' }}>{p.ticket_number ?? '—'}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Financial */}
        <Text style={docStyles.sectionTitle}>RESUMEN FINANCIERO</Text>
        <View style={docStyles.summaryBox}>
          <View style={docStyles.summaryRow}>
            <Text style={docStyles.summaryLabel}>Subtotal</Text>
            <Text style={docStyles.summaryValue}>{fmtMoney(booking.subtotal)}</Text>
          </View>
          {booking.payment_gateway_fee > 0 ? (
            <View style={docStyles.summaryRow}>
              <Text style={docStyles.summaryLabel}>Cargo por procesamiento</Text>
              <Text style={docStyles.summaryValue}>{fmtMoney(booking.payment_gateway_fee)}</Text>
            </View>
          ) : null}
          <View style={[docStyles.summaryRow, docStyles.totalRow]}>
            <Text style={[docStyles.summaryLabel, { fontWeight: 700, color: '#0F2545', fontSize: 11 }]}>TOTAL</Text>
            <Text style={[docStyles.summaryValue, { fontWeight: 700, color: '#0F2545', fontSize: 11 }]}>{fmtMoney(booking.total_amount)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={docStyles.footer}>
          <Text style={{ fontWeight: 700, marginBottom: 4, color: '#0F2545' }}>Políticas y Condiciones</Text>
          <Text>
            {'1. Boletos No Reembolsables, No Transferibles.\n2. Presentar formularios migratorios (D\'Viajeros, E-Ticket) obligatorios según el destino.\n3. Llegar al aeropuerto con al menos 3 horas de antelación para vuelos internacionales.'}
          </Text>
        </View>

      </Page>
    </Document>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BookingVoucher (legacy) — estructura manual de vuelos
// ─────────────────────────────────────────────────────────────────────────────

export const BookingVoucher = ({ invoiceId, issueDate, outboundFlights, returnFlights, passengers, policies, companyContact }: BookingVoucherProps) => (
  <Document>
    <Page size="A4" style={styles.page}>

      <View style={styles.header}>
        <View style={styles.logoContainer}>
          {/* Usamos el logo de public/brand/logo.png */}
          <Image src="/brand/logo.png" style={styles.logoImage} />
          <Text style={styles.brandSub}>{companyContact ?? 'support@globalsolutions.travel | +1 (305) 555-0100'}</Text>
        </View>
        <View style={styles.headerDetails}>
          <Text style={styles.invoiceText}>Recibo: {invoiceId}</Text>
          <Text style={styles.brandSub}>Fecha de emisión: {issueDate}</Text>
          <Text style={styles.statusText}>ESTADO: CONFIRMADO</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>INFORMACIÓN DE PASAJEROS</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.colPaxName}>PASAJERO</Text>
          <Text style={styles.colBaggage}>EQUIPAJE</Text>
          <Text style={styles.colPNR}>LOCALIZADOR</Text>
          <Text style={styles.colTicket}>NÚMERO TICKET</Text>
        </View>
        {passengers.map((pax, index) => (
          <View key={`pax-${index}`} style={styles.tableRow}>
            <Text style={[styles.colPaxName, { fontWeight: 700 }]}>{pax.fullName}</Text>
            <Text style={styles.colBaggage}>{pax.baggage}</Text>
            <Text style={[styles.colPNR, { fontWeight: 700, color: '#0F2545' }]}>{pax.pnr}</Text>
            <Text style={styles.colTicket}>{pax.ticketNumber}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>ITINERARIO DE VUELOS - IDA</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.colAirline}>AEROLÍNEA</Text>
          <Text style={styles.colTime}>HORA (SAL / LLE)</Text>
          <Text style={styles.colDateInfo}>FECHA</Text>
          <Text style={styles.colFlight}>VUELO</Text>
          <Text style={styles.colCity}>ORIGEN / DESTINO</Text>
          <Text style={styles.colClass}>CLASE</Text>
          <Text style={styles.colStatus}>ESTADO</Text>
        </View>
        {outboundFlights.map((flight, index) => (
          <View key={`flight-out-${index}`} style={styles.tableRow}>
            <Text style={styles.colAirline}>{flight.airline}</Text>
            <View style={styles.colTime}>
              <Text style={{ fontSize: 7, color: '#666666' }}>Salida:</Text>
              <Text style={{ fontWeight: 700, color: '#0F2545', marginBottom: 4 }}>{flight.departure}</Text>
              <Text style={{ fontSize: 7, color: '#666666' }}>Llegada:</Text>
              <Text style={{ fontWeight: 700, color: '#0F2545' }}>{flight.arrival}</Text>
            </View>
            <Text style={[styles.colDateInfo, { fontWeight: 700 }]}>{flight.date}</Text>
            <Text style={styles.colFlight}>{flight.flightNumber}</Text>
            <View style={styles.colCity}>
              <Text style={{ fontSize: 7, color: '#666666' }}>Origen:</Text>
              <Text style={{ fontWeight: 700, color: '#0F2545', marginBottom: 4 }}>{flight.origin}</Text>
              <Text style={{ fontSize: 7, color: '#666666' }}>Destino:</Text>
              <Text style={{ fontWeight: 700, color: '#0F2545' }}>{flight.destination}</Text>
            </View>
            <Text style={styles.colClass}>{flight.cabinClass}</Text>
            <Text style={styles.colStatus}>{flight.status}</Text>
          </View>
        ))}
      </View>

      {returnFlights && returnFlights.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>ITINERARIO DE VUELOS - REGRESO</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.colAirline}>AEROLÍNEA</Text>
              <Text style={styles.colTime}>HORA (SAL / LLE)</Text>
              <Text style={styles.colDateInfo}>FECHA</Text>
              <Text style={styles.colFlight}>VUELO</Text>
              <Text style={styles.colCity}>ORIGEN / DESTINO</Text>
              <Text style={styles.colClass}>CLASE</Text>
              <Text style={styles.colStatus}>ESTADO</Text>
            </View>
            {returnFlights.map((flight, index) => (
              <View key={`flight-ret-${index}`} style={styles.tableRow}>
                <Text style={styles.colAirline}>{flight.airline}</Text>
                <View style={styles.colTime}>
                  <Text style={{ fontSize: 7, color: '#666666' }}>Salida:</Text>
                  <Text style={{ fontWeight: 700, color: '#0F2545', marginBottom: 4 }}>{flight.departure}</Text>
                  <Text style={{ fontSize: 7, color: '#666666' }}>Llegada:</Text>
                  <Text style={{ fontWeight: 700, color: '#0F2545' }}>{flight.arrival}</Text>
                </View>
                <Text style={[styles.colDateInfo, { fontWeight: 700 }]}>{flight.date}</Text>
                <Text style={styles.colFlight}>{flight.flightNumber}</Text>
                <View style={styles.colCity}>
                  <Text style={{ fontSize: 7, color: '#666666' }}>Origen:</Text>
                  <Text style={{ fontWeight: 700, color: '#0F2545', marginBottom: 4 }}>{flight.origin}</Text>
                  <Text style={{ fontSize: 7, color: '#666666' }}>Destino:</Text>
                  <Text style={{ fontWeight: 700, color: '#0F2545' }}>{flight.destination}</Text>
                </View>
                <Text style={styles.colClass}>{flight.cabinClass}</Text>
                <Text style={styles.colStatus}>{flight.status}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* 🚀 Políticas Dinámicas */}
      <View style={styles.footer}>
        <Text style={{ fontWeight: 700, marginBottom: 4, color: '#0F2545' }}>Políticas y Condiciones</Text>
        <Text>
          {policies || "1. Boletos No Reembolsables, No Transferibles.\n2. Presentar formularios migratorios (D'Viajeros, E-Ticket) obligatorios según el destino.\n3. Llegar al aeropuerto con al menos 3 horas de antelación para vuelos internacionales."}
        </Text>
      </View>

    </Page>
  </Document>
);