/**
 * @fileoverview Admin — Create new car page.
 * @author Dev B
 */
'use client';

import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import CarForm from '@/components/features/cars/CarForm';

export default function NewCarPage() {
  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Nuevo Auto" />
        <div className="p-6">
          <CarForm mode="create" />
        </div>
      </div>
    </div>
  );
}
