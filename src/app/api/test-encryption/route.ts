import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  console.log('🔍 Iniciando Test de Encriptación (Intento Final)...');

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Cliente Admin
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });

    // 1. BUSCAR USUARIO
    const { data: { users }, error: userError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (userError || !users || users.length === 0) {
      throw new Error('No hay usuarios. Regístrate en la app primero.');
    }
    const realUserId = users[0].id;

    // 2. CREAR RESERVA PADRE
    const flightId = '00000000-0000-0000-0000-000000000001';
    
    // Limpieza previa
    await supabaseAdmin.from('bookings').delete().eq('flight_id', flightId);

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        user_id: realUserId,
        flight_id: flightId,
        booking_code: 'TEST-002', // Cambié el código por si acaso
        subtotal: 100,
        total_amount: 100,
        booking_status: 'confirmed', // << CAMBIO CLAVE: 'confirmed' en lugar de 'pending'
        payment_status: 'pending'    // Este suele aceptar 'pending'
      })
      .select()
      .single();

    if (bookingError) {
      if (bookingError.message.includes('flight_id')) {
        throw new Error('Vuelo de prueba no encontrado. Ejecuta el SQL de vuelo.');
      }
      throw new Error(`Error reserva: ${bookingError.message}`);
    }

    console.log('✅ Reserva creada:', booking.id);

    // 3. INSERTAR PASAJERO ENCRIPTADO
    const { error: rpcError } = await supabaseAdmin.rpc('insert_encrypted_passenger', {
      p_booking_id: booking.id,
      p_first_name: "James",
      p_last_name: "Bond",
      p_date_of_birth: "1980-01-01",
      p_nationality: "UK",
      p_passport_number: "TOP-SECRET-007", 
      p_passport_expiry_date: "2030-01-01",
      p_secret_key: serviceKey
    });

    if (rpcError) throw new Error(`Error RPC: ${rpcError.message}`);

    return NextResponse.json({ 
      success: true, 
      message: '¡PRUEBA EXITOSA!',
      details: 'Pasaporte guardado y encriptado.',
      checkDb: 'Revisa la tabla booking_passengers en Supabase.'
    });

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}