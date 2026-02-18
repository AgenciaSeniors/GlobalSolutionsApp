'use client';

import Sidebar, { AGENT_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import QuickQuoteForm from '@/components/forms/QuickQuoteForm';

export default function AgentQuickQuotePage() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={AGENT_SIDEBAR_LINKS} />

      <div className="flex-1">
        <Header
          title="Herramientas Internas"
          subtitle="Cotizador rápido para neto + markup + comisión"
        />

        <div className="p-6 md:p-8">
          <QuickQuoteForm />
        </div>
      </div>
    </div>
  );
}
