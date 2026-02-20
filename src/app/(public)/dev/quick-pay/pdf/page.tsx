// src/app/(public)/dev/quick-pay/pdf/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer'; 
import { BookingVoucher } from '@/lib/pdf/bookingVoucher';
// 🔧 AQUÍ ESTÁ EL FIX: Importamos el cliente exacto que usa tu AuthProvider
import { createClient } from '@/lib/supabase/client';
import type { FlightSegment, Passenger } from '@/lib/pdf/bookingVoucher';

const DynamicPDFWrapper = dynamic(
  () => import('./PDFWrapper'),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center text-slate-500 font-bold animate-pulse">Cargando Motor de PDF...</div> }
);

export default function PDFGeneratorPage() {
  // 🔧 Inicializamos el cliente oficial que hereda tu sesión
  const [supabase] = useState(() => createClient());

  // Control para evitar el error de SSR en Next.js con el botón de descarga
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  // ESTADOS DE DATOS GENERALES
  const [invoiceId, setInvoiceId] = useState('GS-2026-001');
  const [issueDate, setIssueDate] = useState('20 FEB 2026');
  const [clientEmail, setClientEmail] = useState('');
  const [isEmitting, setIsEmitting] = useState(false);

  // ESTADOS DE TABLAS
  const [passengers, setPassengers] = useState<Passenger[]>([
    { fullName: 'HECTOR GARCIA', passport: 'P223751', baggage: '1x23kg', pnr: 'ABCDEF', ticketNumber: '123456789' }
  ]);

  const [flights, setFlights] = useState<FlightSegment[]>([
    { airline: 'American Airlines', flightNumber: 'AA 821', date: '15 MAY 2026', origin: 'MIA', destination: 'HAV', departure: '10:00 AM', arrival: '11:00 AM', cabinClass: 'Económica', status: 'HK' }
  ]);

  const [returnFlights, setReturnFlights] = useState<FlightSegment[]>([]);

  // Lógica de actualización
  const updatePassenger = (index: number, field: keyof Passenger, value: string) => {
    const newPax = [...passengers];
    newPax[index] = { ...newPax[index], [field]: value.toUpperCase() };
    setPassengers(newPax);
  };
  const updateFlight = (index: number, field: keyof FlightSegment, value: string, isReturn: boolean = false) => {
    const targetArray = isReturn ? [...returnFlights] : [...flights];
    targetArray[index] = { ...targetArray[index], [field]: value.toUpperCase() };
    isReturn ? setReturnFlights(targetArray) : setFlights(targetArray);
  };
  const addPassenger = () => setPassengers([...passengers, { fullName: '', passport: '', baggage: '1x23kg', pnr: '', ticketNumber: '' }]);
  const removePassenger = (index: number) => setPassengers(passengers.filter((_, i) => i !== index));
  const addFlight = (isReturn: boolean = false) => {
    const newFlight = { airline: '', flightNumber: '', date: '', origin: '', destination: '', departure: '', arrival: '', cabinClass: 'Económica', status: 'HK' };
    isReturn ? setReturnFlights([...returnFlights, newFlight]) : setFlights([...flights, newFlight]);
  };
  const removeFlight = (index: number, isReturn: boolean = false) => {
    isReturn ? setReturnFlights(returnFlights.filter((_, i) => i !== index)) : setFlights(flights.filter((_, i) => i !== index));
  };

  // Función maestra de emisión
  const handleEmit = async () => {
    setIsEmitting(true);
    try {
      if (!clientEmail) {
        alert("⚠️ Por favor, ingresa el correo del cliente para poder notificarle.");
        setIsEmitting(false);
        return;
      }

      const safeName = passengers[0]?.fullName?.replace(/\s+/g, '_') || 'Cliente';
      const fileName = `${invoiceId}_${safeName}_${Date.now()}.pdf`;

      const doc = <BookingVoucher 
        invoiceId={invoiceId} 
        issueDate={issueDate} 
        outboundFlights={flights} 
        returnFlights={returnFlights} 
        passengers={passengers} 
      />;
      
      const blob = await pdf(doc).toBlob();

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('vouchers')
        .upload(fileName, blob, { contentType: 'application/pdf' });

      if (uploadError) throw new Error("Error subiendo el PDF: " + uploadError.message);

      const { data: { publicUrl } } = supabase.storage
        .from('vouchers')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('vouchers')
        .insert([{
          invoice_id: invoiceId,
          issue_date: issueDate,
          client_email: clientEmail,
          passengers: passengers,
          outbound_flights: flights,
          return_flights: returnFlights,
          pdf_url: publicUrl,
          status: 'emitted'
        }]);

      if (dbError) throw new Error("Error en base de datos: " + dbError.message);

      alert(`✅ ¡Boleto emitido exitosamente!\n\nEl PDF ya está en la nube y registrado para enviar a:\n${clientEmail}`);
      window.open(publicUrl, '_blank');

    } catch (err: any) {
      alert("❌ Ocurrió un error: " + err.message);
    } finally {
      setIsEmitting(false);
    }
  };

  const inputClass = "w-full text-xs p-1.5 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase placeholder:lowercase";

  return (
    <div className="flex h-screen bg-slate-100 p-4 gap-4">
      
      {/* PANEL IZQUIERDO */}
      <div className="w-1/2 lg:w-2/5 bg-white p-5 rounded-xl shadow-md overflow-y-auto border border-slate-200 custom-scrollbar flex flex-col">
        <div className="flex-grow">
          <h1 className="text-xl font-bold text-[#0F2545] mb-4 border-b-2 border-[#FF4757] pb-2">Panel de Emisión de Voucher</h1>
          
          {/* DATOS GENERALES */}
          <div className="mb-6 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <h2 className="text-sm font-bold text-slate-700 mb-2">📄 Datos del Servicio</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[10px] font-bold text-slate-500 mb-1">NÚMERO DE RECIBO</label><input type="text" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value.toUpperCase())} className={inputClass} /></div>
              <div><label className="block text-[10px] font-bold text-slate-500 mb-1">FECHA DE EMISIÓN</label><input type="text" value={issueDate} onChange={(e) => setIssueDate(e.target.value.toUpperCase())} className={inputClass} /></div>
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Email para Notificación al Cliente *</label>
                <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={`${inputClass} !lowercase`} placeholder="cliente@correo.com" />
              </div>
            </div>
          </div>

          {/* PASAJEROS */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-slate-700">👤 Pasajeros</h2>
              <button onClick={addPassenger} className="text-xs bg-[#0F2545] text-white px-2 py-1 rounded hover:bg-[#1a3a6c] transition-colors">+ Añadir</button>
            </div>
            {passengers.map((pax, index) => (
              <div key={`pax-${index}`} className="bg-white border border-slate-200 p-3 rounded-lg mb-3 shadow-sm relative">
                <button onClick={() => removePassenger(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 font-bold text-xs">✕</button>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="col-span-2"><label className="block text-[10px] font-bold text-slate-500">NOMBRE COMPLETO</label><input type="text" value={pax.fullName} onChange={(e) => updatePassenger(index, 'fullName', e.target.value)} className={inputClass} /></div>
                  <div><label className="block text-[10px] font-bold text-slate-500">PASAPORTE</label><input type="text" value={pax.passport} onChange={(e) => updatePassenger(index, 'passport', e.target.value)} className={inputClass} /></div>
                  <div><label className="block text-[10px] font-bold text-slate-500">LOCALIZADOR (PNR)</label><input type="text" value={pax.pnr} onChange={(e) => updatePassenger(index, 'pnr', e.target.value)} className={inputClass} /></div>
                </div>
              </div>
            ))}
          </div>

          {/* VUELOS DE IDA */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-slate-700">✈️ Itinerario de Ida</h2>
              <button onClick={() => addFlight(false)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">+ Añadir Escala</button>
            </div>
            {flights.map((flight, index) => (
              <div key={`flight-out-${index}`} className="bg-blue-50 border border-blue-100 p-3 rounded-lg mb-3 relative">
                <button onClick={() => removeFlight(index, false)} className="absolute top-2 right-2 text-red-500 font-bold text-xs">✕</button>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="col-span-2"><label className="text-[9px] font-bold text-slate-400">AEROLÍNEA</label><input type="text" value={flight.airline} onChange={(e) => updateFlight(index, 'airline', e.target.value, false)} className={inputClass} /></div>
                  <div><label className="text-[9px] font-bold text-slate-400">VUELO</label><input type="text" value={flight.flightNumber} onChange={(e) => updateFlight(index, 'flightNumber', e.target.value, false)} className={inputClass} /></div>
                  <div className="col-span-3"><label className="text-[9px] font-bold text-slate-400">FECHA</label><input type="text" value={flight.date} onChange={(e) => updateFlight(index, 'date', e.target.value, false)} className={inputClass} /></div>
                  <div><label className="text-[9px] font-bold text-slate-400">ORIGEN</label><input type="text" value={flight.origin} onChange={(e) => updateFlight(index, 'origin', e.target.value, false)} className={inputClass} /></div>
                  <div><label className="text-[9px] font-bold text-slate-400">DESTINO</label><input type="text" value={flight.destination} onChange={(e) => updateFlight(index, 'destination', e.target.value, false)} className={inputClass} /></div>
                  <div><label className="text-[9px] font-bold text-slate-400">CLASE</label><input type="text" value={flight.cabinClass} onChange={(e) => updateFlight(index, 'cabinClass', e.target.value, false)} className={inputClass} /></div>
                  <div><label className="text-[9px] font-bold text-slate-400">SALIDA</label><input type="text" value={flight.departure} onChange={(e) => updateFlight(index, 'departure', e.target.value, false)} className={inputClass} /></div>
                  <div><label className="text-[9px] font-bold text-slate-400">LLEGADA</label><input type="text" value={flight.arrival} onChange={(e) => updateFlight(index, 'arrival', e.target.value, false)} className={inputClass} /></div>
                  <div><label className="text-[9px] font-bold text-slate-400">ESTADO</label><input type="text" value={flight.status} onChange={(e) => updateFlight(index, 'status', e.target.value, false)} className={inputClass} /></div>
                </div>
              </div>
            ))}
          </div>

          {/* VUELOS DE REGRESO */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-slate-700">🛬 Itinerario de Regreso</h2>
              <button onClick={() => addFlight(true)} className="text-xs bg-orange-500 text-white px-2 py-1 rounded hover:bg-orange-600">+ Añadir Regreso</button>
            </div>
            {returnFlights.map((flight, index) => (
              <div key={`flight-ret-${index}`} className="bg-orange-50 border border-orange-100 p-3 rounded-lg mb-3 relative">
                <button onClick={() => removeFlight(index, true)} className="absolute top-2 right-2 text-red-500 font-bold text-xs">✕</button>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="col-span-2"><label className="text-[9px] font-bold text-slate-400">AEROLÍNEA</label><input type="text" value={flight.airline} onChange={(e) => updateFlight(index, 'airline', e.target.value, true)} className={inputClass} /></div>
                  <div><label className="text-[9px] font-bold text-slate-400">VUELO</label><input type="text" value={flight.flightNumber} onChange={(e) => updateFlight(index, 'flightNumber', e.target.value, true)} className={inputClass} /></div>
                  <div className="col-span-3"><label className="text-[9px] font-bold text-slate-400">FECHA</label><input type="text" value={flight.date} onChange={(e) => updateFlight(index, 'date', e.target.value, true)} className={inputClass} /></div>
                  <div><label className="text-[9px] font-bold text-slate-400">ORIGEN</label><input type="text" value={flight.origin} onChange={(e) => updateFlight(index, 'origin', e.target.value, true)} className={inputClass} /></div>
                  <div><label className="text-[9px] font-bold text-slate-400">DESTINO</label><input type="text" value={flight.destination} onChange={(e) => updateFlight(index, 'destination', e.target.value, true)} className={inputClass} /></div>
                  <div><label className="text-[9px] font-bold text-slate-400">CLASE</label><input type="text" value={flight.cabinClass} onChange={(e) => updateFlight(index, 'cabinClass', e.target.value, true)} className={inputClass} /></div>
                  <div><label className="text-[9px] font-bold text-slate-400">SALIDA</label><input type="text" value={flight.departure} onChange={(e) => updateFlight(index, 'departure', e.target.value, true)} className={inputClass} /></div>
                  <div><label className="text-[9px] font-bold text-slate-400">LLEGADA</label><input type="text" value={flight.arrival} onChange={(e) => updateFlight(index, 'arrival', e.target.value, true)} className={inputClass} /></div>
                  <div><label className="text-[9px] font-bold text-slate-400">ESTADO</label><input type="text" value={flight.status} onChange={(e) => updateFlight(index, 'status', e.target.value, true)} className={inputClass} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BOTÓN DE ACCIÓN ÚNICO */}
        <div className="mt-6 pt-4 border-t border-slate-200">
          <button 
            onClick={handleEmit}
            disabled={isEmitting}
            className="w-full bg-[#FF4757] hover:bg-[#e03d4b] text-white font-bold py-4 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
          >
            {isEmitting ? '☁️ Procesando y Subiendo a la Nube...' : '🚀 EMITIR Y NOTIFICAR AL CLIENTE'}
          </button>
          
          {isClient && (
            <div className="mt-3 text-center">
              <PDFDownloadLink
                document={<BookingVoucher invoiceId={invoiceId} issueDate={issueDate} outboundFlights={flights} returnFlights={returnFlights} passengers={passengers} />}
                fileName={`${invoiceId}_${passengers[0]?.fullName || 'Voucher'}.pdf`}
              >
                {({ loading }) => (
                  <span className="text-[10px] text-slate-500 hover:text-[#0F2545] underline cursor-pointer">
                    {loading ? 'Preparando archivo local...' : 'Descargar una copia manual al equipo'}
                  </span>
                )}
              </PDFDownloadLink>
            </div>
          )}
        </div>
      </div>

      {/* PANEL DERECHO */}
      <div className="w-1/2 lg:w-3/5 bg-slate-800 rounded-xl shadow-lg overflow-hidden border-4 border-slate-700">
        <DynamicPDFWrapper 
          invoiceId={invoiceId}
          issueDate={issueDate}
          flights={flights} 
          returnFlights={returnFlights} 
          passengers={passengers} 
        />
      </div>

    </div>
  );
}