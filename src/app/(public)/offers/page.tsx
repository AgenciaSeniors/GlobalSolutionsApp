/**
 * @fileoverview Exclusive offers page (calendar-first).
 * @module app/(public)/offers/page
 */
import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import OffersCalendarExplorer from '@/components/features/offers/OffersCalendarExplorer';
import { createClient } from '@/lib/supabase/server';
import type { SpecialOffer } from '@/types/models';

export const metadata: Metadata = { title: 'Ofertas Exclusivas' };

export default async function OffersPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('special_offers')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  const offers = (data as SpecialOffer[]) ?? [];

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-neutral-50 pt-[72px]">
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-12">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-700">
                🔥 Ofertas Exclusivas
              </span>
              <h1 className="mt-3 font-display text-4xl font-bold text-brand-950">
                Calendario de ofertas
              </h1>
              <p className="mt-2 text-neutral-600">
                Selecciona un día iluminado para ver las ofertas disponibles y entrar al detalle.
              </p>
            </div>

            <OffersCalendarExplorer offers={offers} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
