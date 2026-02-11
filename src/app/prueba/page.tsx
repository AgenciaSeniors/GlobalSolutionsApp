'use client';
import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Bell, Search, DollarSign, Users } from 'lucide-react';

export default function AgentDashboard() {
  // Simulamos noticias (luego vendrán de la tabla agent_news)
  const news = [
    {
      id: 1,
      title: "Nueva ruta a Managua",
      content: "A partir del 15 de marzo iniciamos vuelos directos con Conviasa.",
      date: "Hace 2 horas",
      type: "info"
    },
    {
      id: 2,
      title: "Cambio en comisiones",
      content: "Las ventas de American Airlines ahora comisionan al 5%.",
      date: "Ayer",
      type: "alert"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* ENCABEZADO */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#0F2545]">Panel de Agente</h1>
            <p className="text-gray-500">Bienvenido, Agente 007</p>
          </div>
          <div className="flex gap-3">
 <Button variant="primary">
  <span className="inline-flex items-center gap-2">
    <DollarSign className="w-4 h-4" />
    <span>Mis Comisiones</span>
  </span>
</Button>



          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* COLUMNA IZQUIERDA: Muro de Noticias (Agent News) */}
          <div className="md:col-span-2 space-y-6">
            <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#FF4757]" />
              Novedades Operativas
            </h2>
            
            <div className="grid gap-4">
              {news.map((item) => (
                <Card key={item.id} className="p-5 border-l-4 border-l-[#0F2545]">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-[#0F2545]">{item.title}</h3>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                      {item.date}
                    </span>
                  </div>
                  <p className="text-gray-600 mt-2 text-sm">{item.content}</p>
                </Card>
              ))}
            </div>
          </div>

          {/* COLUMNA DERECHA: Resumen Rápido */}
          <div className="space-y-6">
             <Card className="p-6 bg-[#0F2545] text-white">
                <h3 className="text-sm uppercase tracking-wider opacity-80 mb-1">Ventas del Mes</h3>
                <p className="text-3xl font-bold">$12,450</p>
                <div className="mt-4 flex items-center gap-2 text-sm text-green-300">
                   <span>+15% vs mes anterior</span>
                </div>
             </Card>

             <Card className="p-6">
                <h3 className="font-bold text-gray-700 mb-4">Accesos Directos</h3>
                <div className="space-y-2">
                   <button className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-lg flex items-center gap-3 transition">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">Gestión de Clientes</span>
                   </button>
                   <button className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-lg flex items-center gap-3 transition">
                      <Search className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">Buscar Reserva</span>
                   </button>
                </div>
             </Card>
          </div>

        </div>
      </div>
    </div>
  );
}