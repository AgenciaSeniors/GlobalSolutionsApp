// src/app/(dashboard)/admin/dashboard/emission/page.tsx
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { pdf } from '@react-pdf/renderer';
import { BookingVoucher } from '@/lib/pdf/bookingVoucher';
import { createClient } from '@/lib/supabase/client';
import { Clock, Plane, ArrowRight, User, Calendar, Search, Edit, CheckCircle, FileText } from 'lucide-react';
import type { FlightSegment, Passenger } from '@/lib/pdf/bookingVoucher';

const DynamicPDFWrapper = dynamic(
  () => import('./PDFWrapper'),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center text-slate-500 font-bold animate-pulse">Cargando Motor de PDF...</div> }
);

type OneOrMany<T> = T | T[];

function norm<T>(val: OneOrMany<T> | null | undefined): T | null {
  if (!val) return null;
  if (Array.isArray(val)) return val[0] ?? null;
  return val;
}

type ProfileRow = { full_name: string | null; email: string | null };
type AirlineRow = { name: string | null };
type FlightRow = {
  flight_number: string | null;
  airline: OneOrMany<AirlineRow> | null;
};

type PendingBookingRow = {
  id: string;
  booking_code: string | null;
  created_at: string;
  payment_status: string | null;
  profile: OneOrMany<ProfileRow> | null;
  flight: OneOrMany<FlightRow> | null;
};

type VoucherRow = {
  id: string;
  created_at: string;
  invoice_id: string | null;
  client_email: string | null;
  passengers: Passenger[] | null;
  pdf_url: string | null;
  outbound_flights?: FlightSegment[] | null;
  return_flights?: FlightSegment[] | null;
  issue_date?: string | null;
};

type BookingPassengerRow = {
  first_name: string | null;
  last_name: string | null;
  ticket_number: string | null;
};

type AirportRow = { iata_code: string | null };
type FlightDetailsRow = {
  departure_datetime: string;
  arrival_datetime: string;
  flight_number: string | null;
  airline: OneOrMany<AirlineRow> | null;
  origin: OneOrMany<AirportRow> | null;
  dest: OneOrMany<AirportRow> | null;
};

type BookingWithRelations = {
  booking_code: string | null;
  user_id: string | null;
  airline_pnr: string | null;
  passengers: BookingPassengerRow[] | null;
  flight: OneOrMany<FlightDetailsRow> | null;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

// ==========================================
// COMPONENTE 1: EL CENTRO DE EMISIONES
// ==========================================
function EmissionsDashboard() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [pending, setPending] = useState<PendingBookingRow[]>([]);
  const [history, setHistory] = useState<VoucherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      if (activeTab === 'pending') {
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            id, booking_code, created_at, payment_status, booking_status,
            profile:profiles!bookings_user_id_fkey(full_name, email),
            flight:flights!bookings_flight_id_fkey(flight_number, airline:airlines!flights_airline_id_fkey(name))
          `)
          .eq('booking_status', 'pending_emission')
          .order('created_at', { ascending: false });
        
        if (error) console.error("Error buscando pendientes:", error.message);
        const validBookings = ((data as PendingBookingRow[]) || []).filter(b => String(b.payment_status).trim() === 'paid');
        setPending(validBookings);
      } else {
        const { data, error } = await supabase
          .from('vouchers')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) console.error("Error buscando historial:", error.message);
        setHistory((data as VoucherRow[]) || []);
      }
      setLoading(false);
    }
    fetchData();
  }, [activeTab, supabase]);

  const filteredHistory = history.filter(v => (v.invoice_id?.toLowerCase().includes(searchQuery.toLowerCase())) || (v.client_email?.toLowerCase().includes(searchQuery.toLowerCase())));

  return (
    <div className="p-6 lg:p-8 w-full max-w-6xl mx-auto">
      {/* 🚀 NUEVO BOTÓN PARA VOLVER AL PANEL PRINCIPAL */}
      <button 
        onClick={() => router.push('/admin/dashboard')} 
        className="text-xs font-bold text-slate-500 mb-6 flex items-center gap-1 hover:text-brand-600 transition-colors"
      >
        ← Volver al Panel Principal
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F2545] flex items-center gap-2"><Plane className="text-brand-600" /> Centro de Emisiones</h1>
        <p className="text-slate-500 mt-1">Gestiona los boletos pendientes o re-emite los ya enviados.</p>
      </div>

      <div className="flex gap-6 mb-6 border-b border-slate-200">
        <button className={`pb-3 font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'pending' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-slate-500'}`} onClick={() => setActiveTab('pending')}><Clock className="h-4 w-4" /> Pendientes</button>
        <button className={`pb-3 font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'history' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-slate-500'}`} onClick={() => setActiveTab('history')}><CheckCircle className="h-4 w-4" /> Historial</button>
      </div>

      {activeTab === 'history' && (
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input type="text" placeholder="Buscar por Código o Email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 text-sm shadow-sm" />
        </div>
      )}

      {loading ? (<div className="flex justify-center items-center py-20 text-slate-500">Cargando...</div>) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeTab === 'pending' ? pending.map((booking) => (
            <div key={booking.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
              <div><h3 className="font-mono text-lg font-bold text-brand-600 mb-2">{booking.booking_code}</h3><p className="text-sm text-slate-600">{norm(booking.profile)?.full_name}</p></div>
              <button onClick={() => router.push(`/admin/dashboard/emission?id=${booking.id}`)} className="w-full bg-[#0F2545] text-white py-2.5 rounded-lg mt-4 text-sm font-medium transition-colors hover:bg-brand-700">Generar Boleto <ArrowRight className="ml-1 inline h-4 w-4" /></button>
            </div>
          )) : filteredHistory.map((voucher) => (
            <div key={voucher.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
              <div><h3 className="font-mono text-lg font-bold text-brand-600 mb-2">{voucher.invoice_id}</h3><p className="text-sm text-slate-600 truncate">{voucher.client_email}</p></div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => voucher.pdf_url && window.open(voucher.pdf_url, '_blank')} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-xs font-bold transition-colors">
                  Ver PDF
                </button>
                <button onClick={() => router.push(`/admin/dashboard/emission?vid=${voucher.id}`)} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1">
                  <Edit className="h-3 w-3" /> Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// COMPONENTE 2: EL FORMULARIO PDF Y EDITOR
// ==========================================
function EmissionForm({ bookingId, voucherId }: { bookingId?: string, voucherId?: string }) {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isEmitting, setIsEmitting] = useState(false);
  
  const [invoiceId, setInvoiceId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [flights, setFlights] = useState<FlightSegment[]>([]);
  const [returnFlights, setReturnFlights] = useState<FlightSegment[]>([]);
  
  // 🚀 ESTADO PARA LAS POLÍTICAS
  const [policies, setPolicies] = useState(DEFAULT_POLICIES);

  useEffect(() => {
    const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    setIssueDate(today);

    async function loadData() {
      setIsLoadingData(true);
      try {
        if (voucherId) {
          const { data } = await supabase.from('vouchers').select('*').eq('id', voucherId).single();
          if (data) {
            const voucher = data as VoucherRow;
            setInvoiceId(voucher.invoice_id || '');
            setClientEmail(voucher.client_email || '');
            setPassengers(voucher.passengers || [{ fullName: '', baggage: '1x23kg', pnr: '', ticketNumber: '' }]);
            setFlights(voucher.outbound_flights || [{ airline: '', flightNumber: '', date: '', origin: '', destination: '', departure: '', arrival: '', cabinClass: 'ECONÓMICA', status: 'HK' }]);
            setReturnFlights(voucher.return_flights || []);
          }
        } 
        // 🚀 MODO NUEVO: Cargamos desde la reserva virgen
        else if (bookingId) {
          const { data: booking, error } = await supabase
            .from('bookings')
            .select(`
              *,
              passengers:booking_passengers!booking_passengers_booking_id_fkey(*),
              flight:flights!bookings_flight_id_fkey(*, airline:airlines!flights_airline_id_fkey(name), origin:airports!flights_origin_airport_id_fkey(iata_code), dest:airports!flights_destination_airport_id_fkey(iata_code))
            `)
            .eq('id', bookingId)
            .single();

          if (error) throw error;

          const bookingData = booking as BookingWithRelations;

          if (bookingData.user_id) {
            const { data: profile } = await supabase.from('profiles').select('email').eq('id', bookingData.user_id).single();
            if (profile) setClientEmail(profile.email);
          }

          setInvoiceId(bookingData.booking_code || '');

          const mappedPassengers = Array.isArray(bookingData.passengers) ? bookingData.passengers : [];
          if (mappedPassengers.length > 0) {
            setPassengers(mappedPassengers.map((p: BookingPassengerRow) => ({
              fullName: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim().toUpperCase(),
              pnr: bookingData.airline_pnr || '',
              ticketNumber: p.ticket_number || '',
              baggage: '1x23kg'
            })));
          } else {
            setPassengers([{ fullName: '', baggage: '1x23kg', pnr: '', ticketNumber: '' }]);
          }

          const flightData = norm(bookingData.flight);
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
        }
      } catch (e) {
         console.error(e);
      } finally { setIsLoadingData(false); }
    }
    loadData();
  }, [bookingId, voucherId, supabase]);

  const updatePassenger = (index: number, field: keyof Passenger, value: string) => {
    const newPax = [...passengers];
    newPax[index] = { ...newPax[index], [field]: value.toUpperCase() };
    setPassengers(newPax);
  };
  const updateFlight = (index: number, field: keyof FlightSegment, value: string, isReturn: boolean = false) => {
    const targetArray = isReturn ? [...returnFlights] : [...flights];
    targetArray[index] = { ...targetArray[index], [field]: value.toUpperCase() };
    if (isReturn) {
      setReturnFlights(targetArray);
    } else {
      setFlights(targetArray);
    }
  };
  const addPassenger = () => setPassengers([...passengers, { fullName: '', baggage: '1x23kg', pnr: '', ticketNumber: '' }]);
  const removePassenger = (index: number) => setPassengers(passengers.filter((_, i) => i !== index));
  const addFlight = (isReturn: boolean = false) => {
    const newFlight = { airline: '', flightNumber: '', date: '', origin: '', destination: '', departure: '', arrival: '', cabinClass: 'Económica', status: 'HK' };
    if (isReturn) {
      setReturnFlights([...returnFlights, newFlight]);
    } else {
      setFlights([...flights, newFlight]);
    }
  };
  const removeFlight = (index: number, isReturn: boolean = false) => {
    if (isReturn) {
      setReturnFlights(returnFlights.filter((_, i) => i !== index));
    } else {
      setFlights(flights.filter((_, i) => i !== index));
    }
  };

  const handleEmit = async () => {
    setIsEmitting(true);
    try {
      if (!clientEmail) {
        alert("⚠️ Es obligatorio colocar el email del cliente.");
        setIsEmitting(false);
        return;
      }

      const doc = <BookingVoucher invoiceId={invoiceId} issueDate={issueDate} outboundFlights={flights} returnFlights={returnFlights} passengers={passengers} policies={policies} />;
      const blob = await pdf(doc).toBlob();
      const fileName = `${invoiceId}_${Date.now()}.pdf`;
      
      const { error: uploadError } = await supabase.storage.from('vouchers').upload(fileName, blob, { contentType: 'application/pdf' });
      if (uploadError) throw new Error("Fallo al subir PDF: " + uploadError.message);

      const { data: { publicUrl } } = supabase.storage.from('vouchers').getPublicUrl(fileName);

      const payload = { 
        invoice_id: invoiceId, 
        issue_date: issueDate,
        client_email: clientEmail, 
        passengers, 
        outbound_flights: flights, 
        return_flights: returnFlights, 
        pdf_url: publicUrl, 
        status: 'emitted' 
      };
      
      if (voucherId) {
          const { error: dbErr } = await supabase.from('vouchers').update(payload).eq('id', voucherId);
          if (dbErr) throw new Error("Error DB Voucher: " + dbErr.message);
      } else {
          const { error: dbErr } = await supabase.from('vouchers').insert([payload]);
          if (dbErr) throw new Error("Error DB Voucher: " + dbErr.message);
      }

      const { error: updateErr } = await supabase.from('bookings').update({ booking_status: 'completed', voucher_pdf_url: publicUrl, emitted_at: new Date().toISOString() }).eq('booking_code', invoiceId);
      if (updateErr) throw new Error("Error DB Booking: " + updateErr.message);

      const emailRes = await fetch('/api/dev/emit-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clientEmail, clientName: passengers[0]?.fullName, invoiceId, pdfUrl: publicUrl, passengers, flights })
      });

      if (!emailRes.ok) {
        console.error("Error mandando correo, pero el PDF se guardó.");
      }

      alert("✅ ¡Boleto emitido y guardado con éxito!");
      router.push('/admin/dashboard/emission');

    } catch (err: unknown) {
      alert("❌ Ocurrió un error: " + getErrorMessage(err));
    } finally {
      setIsEmitting(false);
    }
  };

  const inputClass = "w-full text-xs p-1.5 border border-slate-300 rounded focus:border-brand-500 outline-none uppercase placeholder:lowercase";

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-120px)] w-full gap-6 p-4">
      <div className="w-full lg:w-2/5 bg-white p-5 rounded-xl border border-slate-200 overflow-y-auto custom-scrollbar relative">
        {isLoadingData && (
            <div className="absolute inset-0 bg-white/80 z-10 flex flex-col items-center justify-center">
                <div className="animate-spin text-3xl mb-2">⏳</div>
                <p className="font-bold text-slate-500">Cargando datos...</p>
            </div>
        )}
        
        <button onClick={() => router.push('/admin/dashboard/emission')} className="text-xs font-bold text-slate-500 mb-4">← Volver al Centro</button>
        <h1 className="text-xl font-bold mb-4">{voucherId ? '✏️ Editar Voucher' : '🚀 Emitir Voucher'}</h1>
        
        {/* FORMULARIOS RÁPIDOS */}
        <div className="grid grid-cols-2 gap-3 mb-6 bg-slate-50 p-3 rounded-lg">
            <div><label className="block text-[10px] font-bold text-slate-500 mb-1">RECIBO</label><input type="text" value={invoiceId} className={inputClass} readOnly /></div>
            <div><label className="block text-[10px] font-bold text-slate-500 mb-1">FECHA</label><input type="text" value={issueDate} className={inputClass} readOnly /></div>
            <div className="col-span-2"><label className="block text-[10px] font-bold text-slate-500 mb-1">EMAIL CLIENTE *</label><input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={`${inputClass} !lowercase`} required /></div>
        </div>

        {/* 🚀 TEXTAREA PARA POLÍTICAS */}
        <div className="mb-6 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
            <label className="flex items-center gap-2 text-[10px] font-bold text-yellow-700 mb-2 uppercase"><FileText className="h-3 w-3" /> Políticas del Boleto</label>
            <textarea 
                value={policies} 
                onChange={(e) => setPolicies(e.target.value)}
                className="w-full border p-2 bg-white rounded text-xs text-slate-600 h-24 outline-yellow-400"
            />
        </div>

        <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-slate-700">👤 Pasajeros</h2>
              <button onClick={addPassenger} className="text-xs bg-[#0F2545] text-white px-2 py-1 rounded">+ Añadir</button>
            </div>
            {passengers.map((pax, index) => (
              <div key={`pax-${index}`} className="bg-white border border-slate-200 p-3 rounded-lg mb-3 relative">
                <button onClick={() => removePassenger(index)} className="absolute top-2 right-2 text-red-500 font-bold text-xs">✕</button>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="col-span-2"><label className="block text-[10px] font-bold text-slate-500">NOMBRE</label><input type="text" value={pax.fullName} onChange={(e) => updatePassenger(index, 'fullName', e.target.value)} className={inputClass} /></div>
                  <div><label className="block text-[10px] font-bold text-slate-500">PNR</label><input type="text" value={pax.pnr} onChange={(e) => updatePassenger(index, 'pnr', e.target.value)} className={inputClass} /></div>
                    <div><label className="block text-[10px] font-bold text-brand-600">NÚMERO DE TICKET</label><input type="text" value={pax.ticketNumber} onChange={(e) => updatePassenger(index, 'ticketNumber', e.target.value)} className={inputClass} placeholder="Requerido" /></div>
                </div>
              </div>
            ))}
        </div>

        {/* ✈️ VUELO DE IDA */}
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

        {/* ✈️ VUELO DE RETORNO */}
        <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-slate-700">✈️ Vuelo de Retorno (Opcional)</h2>
              <button onClick={() => addFlight(true)} className="text-xs bg-[#0F2545] hover:bg-[#1a3f7a] transition-colors text-white px-2 py-1 rounded">+ Añadir Retorno</button>
            </div>
            {returnFlights.map((flight, index) => (
              <div key={`flight-ret-${index}`} className="bg-slate-50 border border-slate-200 p-3 rounded-lg mb-3 relative">
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

        <button onClick={handleEmit} disabled={isEmitting} className="w-full bg-[#FF4757] text-white py-4 rounded-xl font-bold disabled:opacity-50 mt-4">
            {isEmitting ? 'PROCESANDO...' : 'EMITIR Y NOTIFICAR'}
        </button>
      </div>

      <div className="w-full lg:w-3/5 bg-slate-800 rounded-xl overflow-hidden">
        <DynamicPDFWrapper invoiceId={invoiceId} issueDate={issueDate} flights={flights} returnFlights={returnFlights} passengers={passengers} policies={policies} />
      </div>
    </div>
  );
}

function EmissionRouter() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('id');
  const voucherId = searchParams.get('vid');
  if (!bookingId && !voucherId) return <EmissionsDashboard />;
  return <EmissionForm bookingId={bookingId || undefined} voucherId={voucherId || undefined} />;
}

export default function EmissionPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Cargando Módulo...</div>}>
      <EmissionRouter />
    </Suspense>
  );
}