// src/app/(dashboard)/admin/dashboard/emission/page.tsx
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer'; 
import { BookingVoucher } from '@/lib/pdf/bookingVoucher';
import { createClient } from '@/lib/supabase/client';
import { Clock, Plane, ArrowRight, User, Calendar } from 'lucide-react';
import type { FlightSegment, Passenger } from '@/lib/pdf/bookingVoucher';

const DynamicPDFWrapper = dynamic(
  () => import('./PDFWrapper'),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center text-slate-500 font-bold animate-pulse">Cargando Motor de PDF...</div> }
);

// Función auxiliar para desempacar arreglos de Supabase
function norm(val: any) {
  if (Array.isArray(val)) return val[0] || null;
  return val;
}

// ==========================================
// COMPONENTE 1: LA BANDEJA DE PENDIENTES
// ==========================================
function PendingEmissionsList() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPending() {
      // 🚀 FIX: Usando los nombres EXACTOS de las Foreign Keys de tu base de datos
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, 
          booking_code, 
          created_at, 
          payment_status, 
          booking_status,
          profile:profiles!bookings_user_id_fkey(full_name, email),
          flight:flights!bookings_flight_id_fkey(
            flight_number, 
            airline:airlines!flights_airline_id_fkey(name)
          )
        `)
        .eq('booking_status', 'pending_emission')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("❌ Error buscando pendientes:", error.message);
      }

      // Filtro a prueba de balas para los estados 'paid' con espacios
      const validBookings = (data || []).filter(b => String(b.payment_status).trim() === 'paid');
      
      setPending(validBookings);
      setLoading(false);
    }
    fetchPending();
  }, [supabase, router]);

  return (
    <div className="p-6 lg:p-8 w-full max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0F2545] flex items-center gap-2">
          <Clock className="text-brand-600" /> Emisiones Pendientes
        </h1>
        <p className="text-slate-500 mt-1">Selecciona una reserva pagada para generar y enviar su boleto.</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-slate-500">
          <div className="animate-spin text-3xl mr-3">⏳</div> Buscando reservas...
        </div>
      ) : pending.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Plane className="mx-auto h-16 w-16 text-slate-200 mb-4" />
          <h3 className="text-lg font-bold text-slate-700">¡Todo al día!</h3>
          <p className="text-slate-500 mt-1">No hay boletos pendientes por emitir en este momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pending.map((booking) => {
            const profile = norm(booking.profile);
            const flight = norm(booking.flight);
            const airline = flight ? norm(flight.airline) : null;

            return (
              <div key={booking.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded">Pendiente</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> 
                      {new Date(booking.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-mono text-lg font-bold text-brand-600 mb-2">{booking.booking_code}</h3>
                  
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-slate-600 flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400" />
                      <span className="truncate">{profile?.full_name || 'Cliente sin nombre'}</span>
                    </p>
                    <p className="text-sm text-slate-600 flex items-center gap-2">
                      <Plane className="h-4 w-4 text-slate-400" />
                      <span className="truncate">
                        {flight ? `${airline?.name || 'Aerolínea'} - ${flight.flight_number}` : 'Vuelo Manual / Sin Asignar'}
                      </span>
                    </p>
                  </div>
                </div>
                
                <button 
                  onClick={() => router.push(`/admin/dashboard/emission?id=${booking.id}`)}
                  className="w-full bg-[#0F2545] hover:bg-brand-700 text-white py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors mt-4"
                >
                  Generar Boleto <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==========================================
// COMPONENTE 2: EL FORMULARIO PDF
// ==========================================
function EmissionForm({ bookingId }: { bookingId: string }) {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  
  const [isClient, setIsClient] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isEmitting, setIsEmitting] = useState(false);

  const [invoiceId, setInvoiceId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [flights, setFlights] = useState<FlightSegment[]>([]);
  const [returnFlights, setReturnFlights] = useState<FlightSegment[]>([]);

  useEffect(() => {
    setIsClient(true);
    const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    setIssueDate(today);

    async function loadBookingData() {
      setIsLoadingData(true);
      try {
        // 🚀 FIX: Aplicamos las mismas Foreign Keys aquí para no tener problemas al cargar el PDF
        const { data: booking, error } = await supabase
          .from('bookings')
          .select(`
            *,
            passengers:booking_passengers!booking_passengers_booking_id_fkey(*),
            flight:flights!bookings_flight_id_fkey(
              *,
              airline:airlines!flights_airline_id_fkey(name),
              origin:airports!flights_origin_airport_id_fkey(iata_code),
              dest:airports!flights_destination_airport_id_fkey(iata_code)
            )
          `)
          .eq('id', bookingId)
          .single();

        if (error || !booking) throw new Error("No se encontró la reserva");

        if (booking.user_id) {
          const { data: profile } = await supabase.from('profiles').select('email').eq('id', booking.user_id).single();
          if (profile) setClientEmail(profile.email);
        }

        setInvoiceId(booking.booking_code || '');

        const mappedPassengers = Array.isArray(booking.passengers) ? booking.passengers : [];
        if (mappedPassengers.length > 0) {
          const loadedPax = mappedPassengers.map((p: any) => ({
            fullName: `${p.first_name} ${p.last_name}`.toUpperCase(),
            pnr: booking.airline_pnr || '',
            ticketNumber: p.ticket_number || '',
            baggage: '1x23kg'
          }));
          setPassengers(loadedPax);
        } else {
          setPassengers([{ fullName: '', baggage: '1x23kg', pnr: '', ticketNumber: '' }]);
        }

        const flightData = norm(booking.flight);
        if (flightData) {
          const dObj = new Date(flightData.departure_datetime);
          const aObj = new Date(flightData.arrival_datetime);
          
          setFlights([{
            airline: norm(flightData.airline)?.name || '',
            flightNumber: flightData.flight_number || '',
            date: dObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
            origin: norm(flightData.origin)?.iata_code || '',
            destination: norm(flightData.dest)?.iata_code || '',
            departure: dObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            arrival: aObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            cabinClass: 'ECONÓMICA',
            status: 'HK'
          }]);
        } else {
           setFlights([{ airline: '', flightNumber: '', date: '', origin: '', destination: '', departure: '', arrival: '', cabinClass: 'ECONÓMICA', status: 'HK' }]);
        }
      } catch (err) {
        console.error("Error cargando reserva:", err);
      } finally {
        setIsLoadingData(false);
      }
    }

    loadBookingData();
  }, [bookingId, supabase]);

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
  const addPassenger = () => setPassengers([...passengers, { fullName: '', baggage: '1x23kg', pnr: '', ticketNumber: '' }]);
  const removePassenger = (index: number) => setPassengers(passengers.filter((_, i) => i !== index));
  const addFlight = (isReturn: boolean = false) => {
    const newFlight = { airline: '', flightNumber: '', date: '', origin: '', destination: '', departure: '', arrival: '', cabinClass: 'Económica', status: 'HK' };
    isReturn ? setReturnFlights([...returnFlights, newFlight]) : setFlights([...flights, newFlight]);
  };
  const removeFlight = (index: number, isReturn: boolean = false) => {
    isReturn ? setReturnFlights(returnFlights.filter((_, i) => i !== index)) : setFlights(flights.filter((_, i) => i !== index));
  };

  const handleEmit = async () => {
    setIsEmitting(true);
    try {
      if (!clientEmail) {
        alert("⚠️ Por favor, ingresa el correo del cliente.");
        setIsEmitting(false);
        return;
      }

      const safeName = passengers[0]?.fullName?.replace(/\s+/g, '_') || 'Cliente';
      const fileName = `${invoiceId}_${safeName}_${Date.now()}.pdf`;

      const doc = <BookingVoucher invoiceId={invoiceId} issueDate={issueDate} outboundFlights={flights} returnFlights={returnFlights} passengers={passengers} />;
      const blob = await pdf(doc).toBlob();

      const { error: uploadError } = await supabase.storage.from('vouchers').upload(fileName, blob, { contentType: 'application/pdf' });
      if (uploadError) throw new Error("Error subiendo el PDF: " + uploadError.message);

      const { data: { publicUrl } } = supabase.storage.from('vouchers').getPublicUrl(fileName);

      const { error: dbError } = await supabase.from('vouchers').insert([{
        invoice_id: invoiceId, issue_date: issueDate, client_email: clientEmail, passengers, outbound_flights: flights, return_flights: returnFlights, pdf_url: publicUrl, status: 'emitted'
      }]);
      if (dbError) throw new Error("Error en base de datos: " + dbError.message);

      await supabase.from('bookings').update({ 
        booking_status: 'completed', 
        voucher_pdf_url: publicUrl,
        emitted_at: new Date().toISOString()
      }).eq('id', bookingId);

      const mailRes = await fetch('/api/dev/emit-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clientEmail, clientName: passengers[0]?.fullName || 'Cliente', invoiceId, pdfUrl: publicUrl, passengers, flights })
      });

      const mailData = await mailRes.json();
      if (!mailRes.ok) {
        alert(`✅ Boleto guardado, pero el correo falló: ${mailData.error}`);
      } else {
        alert(`✅ ¡Boleto emitido y notificado exitosamente!`);
      }

      window.open(publicUrl, '_blank');
      router.push('/admin/dashboard/emission');

    } catch (err: any) {
      alert("❌ Ocurrió un error: " + err.message);
    } finally {
      setIsEmitting(false);
    }
  };

  const inputClass = "w-full text-xs p-1.5 border border-slate-300 rounded focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none uppercase placeholder:lowercase";

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-120px)] w-full gap-6 p-4">
      <div className="w-full lg:w-2/5 bg-white p-5 rounded-xl shadow-sm border border-slate-200 overflow-y-auto custom-scrollbar flex flex-col relative">
        
        <button onClick={() => router.push('/admin/dashboard/emission')} className="text-xs font-bold text-slate-500 hover:text-brand-600 mb-4 flex items-center gap-1">
          ← Volver a Bandeja
        </button>

        {isLoadingData && (
          <div className="absolute inset-0 bg-white/90 z-10 flex flex-col items-center justify-center rounded-xl">
            <div className="animate-spin text-4xl mb-2">⏳</div>
            <p className="font-bold text-[#0F2545]">Importando datos...</p>
          </div>
        )}

        <div className="flex-grow">
          <h1 className="text-xl font-bold text-[#0F2545] mb-4 border-b-2 border-[#FF4757] pb-2">Emisión de Voucher</h1>
          
          <div className="mb-6 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <h2 className="text-sm font-bold text-slate-700 mb-2">📄 Datos del Servicio</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[10px] font-bold text-slate-500 mb-1">NÚMERO DE RECIBO</label><input type="text" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value.toUpperCase())} className={inputClass} /></div>
              <div><label className="block text-[10px] font-bold text-slate-500 mb-1">FECHA DE EMISIÓN</label><input type="text" value={issueDate} onChange={(e) => setIssueDate(e.target.value.toUpperCase())} className={inputClass} /></div>
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Email para Notificación *</label>
                <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={`${inputClass} !lowercase`} />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-slate-700">👤 Pasajeros</h2>
              <button onClick={addPassenger} className="text-xs bg-[#0F2545] text-white px-2 py-1 rounded hover:bg-[#1a3a6c]">+ Añadir</button>
            </div>
            {passengers.map((pax, index) => (
              <div key={`pax-${index}`} className="bg-white border border-slate-200 p-3 rounded-lg mb-3 relative">
                <button onClick={() => removePassenger(index)} className="absolute top-2 right-2 text-red-500 font-bold text-xs">✕</button>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="col-span-2"><label className="block text-[10px] font-bold text-slate-500">NOMBRE COMPLETO</label><input type="text" value={pax.fullName} onChange={(e) => updatePassenger(index, 'fullName', e.target.value)} className={inputClass} /></div>
                  <div><label className="block text-[10px] font-bold text-slate-500">PNR</label><input type="text" value={pax.pnr} onChange={(e) => updatePassenger(index, 'pnr', e.target.value)} className={inputClass} /></div>
                  <div><label className="block text-[10px] font-bold text-slate-500 text-brand-600">NÚMERO DE TICKET</label><input type="text" value={pax.ticketNumber} onChange={(e) => updatePassenger(index, 'ticketNumber', e.target.value)} className={inputClass} placeholder="Requerido" /></div>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-slate-700">✈️ Vuelo de Ida</h2>
              <button onClick={() => addFlight(false)} className="text-xs bg-brand-600 text-white px-2 py-1 rounded">+ Escala</button>
            </div>
            {flights.map((flight, index) => (
              <div key={`flight-out-${index}`} className="bg-slate-50 border border-slate-200 p-3 rounded-lg mb-3 relative">
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
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200">
          <button onClick={handleEmit} disabled={isEmitting || isLoadingData} className="w-full bg-[#FF4757] hover:bg-[#e03d4b] text-white font-bold py-4 rounded-lg shadow-lg flex justify-center disabled:opacity-50 text-sm">
            {isEmitting ? '☁️ Subiendo...' : '🚀 EMITIR Y NOTIFICAR'}
          </button>
        </div>
      </div>

      <div className="w-full lg:w-3/5 bg-slate-800 rounded-xl shadow-lg overflow-hidden border border-slate-300">
        {!isLoadingData && <DynamicPDFWrapper invoiceId={invoiceId} issueDate={issueDate} flights={flights} returnFlights={returnFlights} passengers={passengers} />}
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE PRINCIPAL (Ruteador Automático)
// ==========================================
function EmissionRouter() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('id');

  if (!bookingId) {
    return <PendingEmissionsList />;
  }

  return <EmissionForm bookingId={bookingId} />;
}

export default function EmissionPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Cargando Módulo...</div>}>
      <EmissionRouter />
    </Suspense>
  );
}