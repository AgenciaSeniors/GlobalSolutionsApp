'use client';

import Sidebar, { USER_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import CreateRouteForm from '@/components/forms/CreateRouteForm';

export default function UserCreateRoutePage() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={USER_SIDEBAR_LINKS} />

      <div className="flex-1">
        <Header
          title="Panel de Cliente"
          subtitle="Crear ruta y consultar al soporte"
        />

        <div className="p-6 md:p-8">
          <CreateRouteForm />
        </div>
      </div>
    </div>
  );
}
