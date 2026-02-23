// src/app/(dashboard)/admin/dashboard/emission/PDFWrapper.tsx
'use client';

import React from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import { BookingVoucher, FlightSegment, Passenger } from '@/lib/pdf/bookingVoucher';

interface Props {
  invoiceId: string;
  issueDate: string;
  flights: FlightSegment[];
  returnFlights?: FlightSegment[];
  passengers: Passenger[];
  policies?: string; // 🚀 Permite pasar las políticas al PDF
}

const PDFWrapper: React.FC<Props> = ({ invoiceId, issueDate, flights, returnFlights, passengers, policies }) => {
  return (
    <PDFViewer className="w-full h-full border-none">
      <BookingVoucher 
        invoiceId={invoiceId} 
        issueDate={issueDate} 
        outboundFlights={flights} 
        returnFlights={returnFlights} 
        passengers={passengers}
        policies={policies}
      />
    </PDFViewer>
  );
};

export default PDFWrapper;