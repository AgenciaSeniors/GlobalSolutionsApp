/**
 * @fileoverview Flights page — search form + exclusive offers.
 * @module app/(public)/flights/page
 */
import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import FlightSearchForm from '@/components/forms/FlightSearchForm';

export const metadata: Metadata = { title: 'Buscar Vuelos' };

export default function FlightsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-[72px]">
        <section className="bg-white py-20">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-12 text-center">
              <span className="text-sm font-bold uppercase tracking-widest text-brand-500">
                Búsqueda de Vuelos
              </span>
              <h1 className="mt-2 font-display text-4xl font-bold text-brand-950">
                Encuentra tu vuelo ideal
              </h1>
            </div>
            <FlightSearchForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
