import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

export type VoucherPassenger = {
  first_name: string;
  last_name: string;
  nationality?: string | null;
  ticket_number?: string | null;
};

export type VoucherFlight = {
  flight_number?: string | null;
  departure_datetime?: string | null;
  arrival_datetime?: string | null;
  aircraft_type?: string | null;
  airline?: { name?: string | null; iata_code?: string | null } | null;
  origin_airport?: { iata_code?: string | null; city?: string | null; name?: string | null } | null;
  destination_airport?: { iata_code?: string | null; city?: string | null; name?: string | null } | null;
};

export type VoucherProfile = {
  full_name?: string | null;
  email?: string | null;
};

export type VoucherBooking = {
  booking_code: string;
  airline_pnr?: string | null;
  booking_status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  subtotal?: number | string | null;
  payment_gateway_fee?: number | string | null;
  total_amount?: number | string | null;
  flight?: VoucherFlight | null;
  passengers?: VoucherPassenger[] | null;
  profile?: VoucherProfile | null;
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: 'Helvetica' },
  title: { fontSize: 20, marginBottom: 8, fontWeight: 700 },
  subtitle: { fontSize: 12, marginBottom: 18, color: '#444' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  section: { marginTop: 14, padding: 12, borderWidth: 1, borderColor: '#DDD', borderRadius: 6 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginBottom: 8 },
  label: { color: '#666' },
  value: { fontWeight: 700 },
  divider: { height: 1, backgroundColor: '#EEE', marginVertical: 10 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#DDD', paddingBottom: 6, marginBottom: 6 },
  th: { fontWeight: 700 },
  colName: { width: '46%' },
  colNat: { width: '18%' },
  colTicket: { width: '36%' },
  muted: { color: '#666' },
});

function formatMoney(v: number | string | null | undefined): string {
  const n = typeof v === 'string' ? Number(v) : (v ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(safe);
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function BookingVoucherDocument({ booking }: { booking: VoucherBooking }) {
  const flight = booking.flight ?? null;
  const passengers = booking.passengers ?? [];
  const profile = booking.profile ?? null;

  const origin = flight?.origin_airport;
  const dest = flight?.destination_airport;
  const airline = flight?.airline;

  const originLabel = origin?.iata_code ? `${origin.iata_code} · ${origin.city ?? ''}`.trim() : '—';
  const destLabel = dest?.iata_code ? `${dest.iata_code} · ${dest.city ?? ''}`.trim() : '—';
  const airlineLabel = airline?.name ? `${airline.name}${airline.iata_code ? ` (${airline.iata_code})` : ''}` : '—';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Voucher de Reserva</Text>
        <Text style={styles.subtitle}>Global Solutions Travel · Documento informativo para su viaje</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos de la reserva</Text>
          <View style={styles.row}>
            <Text>
              <Text style={styles.label}>Código: </Text>
              <Text style={styles.value}>{booking.booking_code}</Text>
            </Text>
            <Text>
              <Text style={styles.label}>PNR: </Text>
              <Text style={styles.value}>{booking.airline_pnr ?? '—'}</Text>
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text>
              <Text style={styles.label}>Estado: </Text>
              <Text style={styles.value}>{booking.booking_status ?? '—'}</Text>
            </Text>
            <Text>
              <Text style={styles.label}>Pago: </Text>
              <Text style={styles.value}>{booking.payment_status ?? '—'}</Text>
            </Text>
          </View>

          <View style={styles.row}>
            <Text>
              <Text style={styles.label}>Método: </Text>
              <Text style={styles.value}>{booking.payment_method ?? '—'}</Text>
            </Text>
            <Text>
              <Text style={styles.label}>Total: </Text>
              <Text style={styles.value}>{formatMoney(booking.total_amount)}</Text>
            </Text>
          </View>

          {profile?.email ? (
            <Text style={{ marginTop: 8 }}>
              <Text style={styles.label}>Cliente: </Text>
              <Text style={styles.value}>{profile.full_name ?? '—'}</Text>
              <Text style={styles.muted}> · {profile.email}</Text>
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vuelo</Text>
          <Text>
            <Text style={styles.label}>Aerolínea: </Text>
            <Text style={styles.value}>{airlineLabel}</Text>
          </Text>
          <Text>
            <Text style={styles.label}>Número de vuelo: </Text>
            <Text style={styles.value}>{flight?.flight_number ?? '—'}</Text>
          </Text>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text>
              <Text style={styles.label}>Origen: </Text>
              <Text style={styles.value}>{originLabel}</Text>
            </Text>
            <Text>
              <Text style={styles.label}>Destino: </Text>
              <Text style={styles.value}>{destLabel}</Text>
            </Text>
          </View>

          <View style={{ marginTop: 6 }}>
            <Text>
              <Text style={styles.label}>Salida: </Text>
              <Text style={styles.value}>{formatDateTime(flight?.departure_datetime)}</Text>
            </Text>
            <Text>
              <Text style={styles.label}>Llegada: </Text>
              <Text style={styles.value}>{formatDateTime(flight?.arrival_datetime)}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pasajeros</Text>

          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colName]}>Nombre</Text>
            <Text style={[styles.th, styles.colNat]}>Nac.</Text>
            <Text style={[styles.th, styles.colTicket]}>Ticket</Text>
          </View>

          {passengers.length === 0 ? (
            <Text style={styles.muted}>—</Text>
          ) : (
            passengers.map((p, idx) => (
              <View key={`${p.first_name}-${p.last_name}-${idx}`} style={{ flexDirection: 'row', marginBottom: 4 }}>
                <Text style={styles.colName}>{`${p.first_name} ${p.last_name}`}</Text>
                <Text style={styles.colNat}>{p.nationality ?? '—'}</Text>
                <Text style={styles.colTicket}>{p.ticket_number ?? '—'}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Importes</Text>
          <View style={styles.row}>
            <Text>
              <Text style={styles.label}>Subtotal: </Text>
              <Text style={styles.value}>{formatMoney(booking.subtotal)}</Text>
            </Text>
            <Text>
              <Text style={styles.label}>Fee gateway: </Text>
              <Text style={styles.value}>{formatMoney(booking.payment_gateway_fee)}</Text>
            </Text>
          </View>
          <View style={{ marginTop: 6 }}>
            <Text>
              <Text style={styles.label}>Total pagado: </Text>
              <Text style={styles.value}>{formatMoney(booking.total_amount)}</Text>
            </Text>
          </View>
        </View>

        <Text style={{ marginTop: 18, fontSize: 9, color: '#666' }}>
          Nota: Este voucher es informativo. Para cambios o reemisiones, contacte a su agente.
        </Text>
      </Page>
    </Document>
  );
}
