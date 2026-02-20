// src/lib/pdf/bookingVoucher.tsx
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Helvetica', fontSize: 10, color: '#333333' },
  
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
  invoiceText: { fontSize: 12, fontWeight: 'bold', color: '#0F2545' },
  statusText: { fontSize: 10, color: '#059669', marginTop: 4, fontWeight: 'bold' }, 
  
  sectionTitle: { 
    fontSize: 12, 
    fontWeight: 'bold', 
    backgroundColor: '#F4F7FB', 
    padding: 6, 
    paddingLeft: 10,
    marginBottom: 10, 
    color: '#0F2545',
    borderLeft: '4px solid #FF4757' 
  },
  
  table: { width: '100%', marginBottom: 20 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#0F2545', padding: 6, fontWeight: 'bold', fontSize: 8, color: '#ffffff' },
  tableRow: { flexDirection: 'row', borderBottom: '1px solid #e2e8f0', padding: 6, fontSize: 8, color: '#333333' },
  
  colAirline: { width: '14%' },
  colTime: { width: '17%' },
  colDateInfo: { width: '15%' },
  colFlight: { width: '12%' },
  colCity: { width: '22%' },
  colClass: { width: '10%' },
  colStatus: { width: '10%' },

  // 🔧 FIX: Redistribuimos el ancho de las columnas de pasajeros sin el pasaporte
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
  // 🔧 FIX: Eliminamos 'passport' de la interfaz
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
}

export const BookingVoucher = ({ invoiceId, issueDate, outboundFlights, returnFlights, passengers }: BookingVoucherProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image src="/brand/logo.png" style={styles.logoImage} />
          <Text style={styles.brandSub}>support@globalsolutions.travel | +1 (305) 555-0100</Text>
        </View>
        <View style={styles.headerDetails}>
          <Text style={styles.invoiceText}>Recibo: {invoiceId}</Text>
          <Text style={styles.brandSub}>Fecha de emisión: {issueDate}</Text>
          <Text style={styles.statusText}>ESTADO: CONFIRMADO TICKET</Text>
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
            <Text style={[styles.colPaxName, { fontWeight: 'bold' }]}>{pax.fullName}</Text>
            <Text style={styles.colBaggage}>{pax.baggage}</Text>
            <Text style={[styles.colPNR, { fontWeight: 'bold', color: '#0F2545' }]}>{pax.pnr}</Text>
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
              <Text style={{ fontWeight: 'bold', color: '#0F2545', marginBottom: 4 }}>{flight.departure}</Text>
              <Text style={{ fontSize: 7, color: '#666666' }}>Llegada:</Text>
              <Text style={{ fontWeight: 'bold', color: '#0F2545' }}>{flight.arrival}</Text>
            </View>
            <Text style={[styles.colDateInfo, { fontWeight: 'bold' }]}>{flight.date}</Text>
            <Text style={styles.colFlight}>{flight.flightNumber}</Text>
            <View style={styles.colCity}>
              <Text style={{ fontSize: 7, color: '#666666' }}>Origen:</Text>
              <Text style={{ fontWeight: 'bold', color: '#0F2545', marginBottom: 4 }}>{flight.origin}</Text>
              <Text style={{ fontSize: 7, color: '#666666' }}>Destino:</Text>
              <Text style={{ fontWeight: 'bold', color: '#0F2545' }}>{flight.destination}</Text>
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
                  <Text style={{ fontWeight: 'bold', color: '#0F2545', marginBottom: 4 }}>{flight.departure}</Text>
                  <Text style={{ fontSize: 7, color: '#666666' }}>Llegada:</Text>
                  <Text style={{ fontWeight: 'bold', color: '#0F2545' }}>{flight.arrival}</Text>
                </View>
                <Text style={[styles.colDateInfo, { fontWeight: 'bold' }]}>{flight.date}</Text>
                <Text style={styles.colFlight}>{flight.flightNumber}</Text>
                <View style={styles.colCity}>
                  <Text style={{ fontSize: 7, color: '#666666' }}>Origen:</Text>
                  <Text style={{ fontWeight: 'bold', color: '#0F2545', marginBottom: 4 }}>{flight.origin}</Text>
                  <Text style={{ fontSize: 7, color: '#666666' }}>Destino:</Text>
                  <Text style={{ fontWeight: 'bold', color: '#0F2545' }}>{flight.destination}</Text>
                </View>
                <Text style={styles.colClass}>{flight.cabinClass}</Text>
                <Text style={styles.colStatus}>{flight.status}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <View style={styles.footer}>
        <Text style={{ fontWeight: 'bold', marginBottom: 4, color: '#0F2545' }}>Políticas y Condiciones</Text>
        <Text>1. Boletos No Reembolsables, No Transferibles.</Text>
        <Text>2. Presentar formularios migratorios (D'Viajeros, E-Ticket) obligatorios según el destino.</Text>
        <Text>3. Llegar al aeropuerto con al menos 3 horas de antelación para vuelos internacionales.</Text>
      </View>

    </Page>
  </Document>
);