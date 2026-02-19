'use client';

import Sidebar, { AGENT_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import CreateRouteForm from '@/components/forms/CreateRouteForm';

export default function AgentCreateRoutePage() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={AGENT_SIDEBAR_LINKS} />

      <div className="flex-1">
        <Header title="Crear Ruta" subtitle="Elija lugar de salida y de llegada, el soporte encontrará la mejor ruta para usted." />
        <div className="p-6 md:p-8">
          <CreateRouteForm />
        </div>
      </div>
    </div>
  );
}
