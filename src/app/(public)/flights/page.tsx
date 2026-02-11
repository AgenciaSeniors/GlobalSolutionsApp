'use client';

/**
 * @fileoverview Flights page — search form + results on same page (scroll).
 * @module app/(public)/flights/page
 */

import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import FlightSearchForm from '@/components/forms/FlightSearchForm';

export default function FlightsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-[72px]">
        {/* Sección del formulario */}
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

        {/* ✅ ESTE ES EL “PASO 1”: el ancla / zona a la que haremos scroll */}
        <section id="flight-results" className="bg-neutral-50 py-12">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-6 text-3xl font-extrabold text-[#0F2545]">
              Resultados de Búsqueda
            </h2>

            {/* Placeholder temporal (luego aquí metemos filtros + lista real) */}
            <div className="rounded-xl border bg-white p-6 text-sm text-neutral-600">
              Aquí van a aparecer los resultados cuando conectemos el botón “Buscar vuelo” con el scroll.
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
