import { NextResponse } from 'next/server';

export async function GET() {
  // Mock temporal para cumplir el checklist de Luis
  const mockAgentBookings = [
    { 
      id: '1', 
      customer: 'Luis Manuel (Prueba)', 
      flight: 'HAV-IST', 
      status: 'pending_emission',
      created_at: new Date().toISOString() 
    },
    { 
      id: '2', 
      customer: 'Agencia Seniors', 
      flight: 'MIA-MAD', 
      status: 'confirmed',
      created_at: new Date().toISOString() 
    }
  ];
  
  return NextResponse.json(mockAgentBookings);
}
