/**
 * @fileoverview Layout for all authenticated dashboard routes.
 *               Renders the sidebar + main content area.
 * @module app/(dashboard)/layout
 */
import type { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-neutral-50">
      {/* Sidebar is rendered by each role's page for now */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
