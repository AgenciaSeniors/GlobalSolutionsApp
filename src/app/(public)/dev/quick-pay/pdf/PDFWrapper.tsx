'use client';

import React from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import { BookingVoucher, FlightSegment, Passenger } from '@/lib/pdf/bookingVoucher';

interface Props {
  invoiceId: string;   // <-- NUEVO
  issueDate: string;   // <-- NUEVO
  flights: FlightSegment[];
  returnFlights?: FlightSegment[];
  passengers: Passenger[];
}

export default function PDFWrapper({ invoiceId, issueDate, flights, returnFlights, passengers }: Props) {
  return (
    <PDFViewer className="w-full h-full border-none">
      <BookingVoucher 
        invoiceId={invoiceId} 
        issueDate={issueDate} 
        outboundFlights={flights} 
        returnFlights={returnFlights}
        passengers={passengers} 
      />
    </PDFViewer>
  );
}