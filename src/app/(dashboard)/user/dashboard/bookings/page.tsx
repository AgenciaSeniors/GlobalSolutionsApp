// src/app/(dashboard)/user/dashboard/bookings/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Sidebar, { USER_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/client';
import { Plane, Calendar, Download, User as UserIcon, Clock, CheckCircle, XCircle } from 'lucide-react';

// Función para desempacar arreglos de Supabase
function norm(val: any) {
  if (Array.isArray(val)) return val[0] || null;
  return val;
}

const STATUS_CONFIG: Record<string, { bg: string, text: string, label: string, icon: any }> = {
  pending_emission: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Procesando Emisión', icon: Clock },
  completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Boleto Listo', icon: CheckCircle },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelada', icon: XCircle },
};

export default function UserBookingsPage() {
  const [supabase] = useState(() => createClient());
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMyBookings() {
      setLoading(true);
      
      // 1. Obtenemos al usuario que tiene la sesión iniciada
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (!user || authError) {
        setLoading(false);
        return;
      }

      // 2. Buscamos SOLO sus reservas con los mismos alias seguros que usamos en el admin
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, 
          booking_code, 
          booking_status, 
          payment_status, 
          total_amount, 
          created_at, 
          voucher_pdf_url,
          flight:flights!bookings_flight_id_fkey(
            flight_number, 
            departure_datetime,
            airline:airlines!flights_airline_id_fkey(name),
            origin:airports!flights_origin_airport_id_fkey(iata_code, city),
            dest:airports!flights_destination_airport_id_fkey(iata_code, city)
          ),
          passengers:booking_passengers!booking_passengers_booking_id_fkey(id, first_name, last_name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error al cargar reservas del usuario:", error.message);
      } else {
        setBookings(data || []);
      }
      setLoading(false);
    }

    fetchMyBookings();
  }, [supabase]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar links={USER_SIDEBAR_LINKS} />
      <div className="flex-1 overflow-auto">
        <Header title="Mis Viajes" subtitle="Historial de reservas y boletos electrónicos" />
        
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
          {loading ? (
            <div className="flex justify-center items-center py-20 text-slate-500">
              <div className="animate-spin text-3xl mr-3">⏳</div> Cargando tu historial...
            </div>
          ) : bookings.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <Plane className="mx-auto h-16 w-16 text-slate-200 mb-4" />
              <h3 className="text-xl font-bold text-[#0F2545]">Aún no tienes viajes</h3>
              <p className="text-slate-500 mt-2">¿Listo para tu próxima aventura? Explora nuestras ofertas y reserva tu primer vuelo.</p>
              <button 
                onClick={() => window.location.href = '/flights'}
                className="mt-6 bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Buscar Vuelos
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {bookings.map((booking) => {
                const flight = norm(booking.flight);
                const airline = flight ? norm(flight.airline) : null;
                const origin = flight ? norm(flight.origin) : null;
                const dest = flight ? norm(flight.dest) : null;
                
                // Determinamos el estado visual
                const statusStr = booking.booking_status || 'pending_payment';
                const statusInfo = STATUS_CONFIG[statusStr] || { bg: 'bg-slate-100', text: 'text-slate-800', label: 'Pendiente', icon: Clock };
                const StatusIcon = statusInfo.icon;

                // Verificamos si tiene boleto listo para descargar
                const isReadyToDownload = booking.booking_status === 'completed' && booking.voucher_pdf_url;

                return (
                  <div key={booking.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row">
                    
                    {/* Información del Vuelo */}
                    <div className="p-6 flex-1 flex flex-col justify-center">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg font-bold text-brand-600">{booking.booking_code}</span>
                          <span className={`${statusInfo.bg} ${statusInfo.text} text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1`}>
                            <StatusIcon className="h-3 w-3" /> {statusInfo.label}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-slate-700">${booking.total_amount?.toFixed(2)}</span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                          <Plane className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-[#0F2545] text-lg">
                            {flight ? `${origin?.city || origin?.iata_code} → ${dest?.city || dest?.iata_code}` : 'Vuelo Personalizado'}
                          </h4>
                          <p className="text-sm text-slate-500 flex items-center gap-4 mt-1">
                            <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {new Date(booking.created_at).toLocaleDateString()}</span>
                            <span className="flex items-center gap-1"><UserIcon className="h-4 w-4" /> {Array.isArray(booking.passengers) ? booking.passengers.length : 0} Pasajero(s)</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Área de Acción (Botón de Descarga) */}
                    <div className="bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 p-6 flex flex-col justify-center items-center text-center w-full md:w-64">
                      {isReadyToDownload ? (
                        <>
                          <div className="text-green-600 mb-2">
                            <CheckCircle className="h-8 w-8 mx-auto" />
                          </div>
                          <p className="text-sm font-bold text-slate-700 mb-4">¡Tu boleto está listo!</p>
                          <a 
                            href={booking.voucher_pdf_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-full bg-[#FF4757] hover:bg-[#e03d4b] text-white py-3 px-4 rounded-xl text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2"
                          >
                            <Download className="h-4 w-4" /> Descargar PDF
                          </a>
                        </>
                      ) : statusStr === 'pending_emission' ? (
                        <>
                          <div className="text-yellow-500 mb-2 animate-pulse">
                            <Clock className="h-8 w-8 mx-auto" />
                          </div>
                          <p className="text-sm font-bold text-slate-700">Emitiendo boleto...</p>
                          <p className="text-xs text-slate-500 mt-1">Te notificaremos por correo cuando el PDF esté disponible.</p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-500">Estamos gestionando tu reserva.</p>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}