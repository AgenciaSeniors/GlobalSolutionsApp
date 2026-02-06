/**
 * @fileoverview Exclusive offers page.
 * @module app/(public)/offers/page
 */
import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ExclusiveOfferCard from '@/components/features/flights/ExclusiveOfferCard';

export const metadata: Metadata = { title: 'Ofertas Exclusivas' };

const OFFERS = [
  { destination: 'Estambul, Turquía', route: 'HAV → IST', airline: 'Turkish Airlines', duration: '14h 30m', originalPrice: 1250, offerPrice: 849, availableSeats: 3, gradient: 'bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800' },
  { destination: 'Madrid, España', route: 'HAV → MAD', airline: 'Iberia', duration: '9h 15m', originalPrice: 980, offerPrice: 699, availableSeats: 7, gradient: 'bg-gradient-to-br from-orange-500 via-red-600 to-rose-700' },
  { destination: 'Cancún, México', route: 'HAV → CUN', airline: 'Viva Aerobus', duration: '2h 45m', originalPrice: 450, offerPrice: 299, availableSeats: 12, gradient: 'bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700' },
  { destination: 'Panamá City', route: 'HAV → PTY', airline: 'Copa Airlines', duration: '3h 30m', originalPrice: 620, offerPrice: 449, availableSeats: 5, gradient: 'bg-gradient-to-br from-amber-500 via-yellow-600 to-orange-600' },
];

export default function OffersPage() {
  return (
    <>
      <Navbar />
      <main className="pt-[72px]">
        <section className="bg-neutral-50 py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-12">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-700">
                🔥 Ofertas Exclusivas
              </span>
              <h1 className="mt-3 font-display text-4xl font-bold text-brand-950">
                Destinos imperdibles
              </h1>
              <p className="mt-2 text-neutral-600">
                Precios especiales por tiempo limitado. ¡No te los pierdas!
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {OFFERS.map((o) => (
                <ExclusiveOfferCard key={o.destination} {...o} />
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
