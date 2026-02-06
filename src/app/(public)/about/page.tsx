/**
 * @fileoverview About / company page.
 * @module app/(public)/about/page
 */
import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import TrustBanner from '@/components/features/home/TrustBanner';

export const metadata: Metadata = { title: 'Sobre Nosotros' };

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="pt-[72px]">
        <section className="bg-gradient-to-b from-brand-50 to-white py-20">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <span className="text-sm font-bold uppercase tracking-widest text-brand-500">
              Nuestra Historia
            </span>
            <h1 className="mt-3 font-display text-4xl font-bold text-brand-950">
              Global Solutions Travel
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-neutral-600">
              Somos una agencia de viajes comprometida con hacer realidad tus
              sueños de viajar. Con más de 50 destinos internacionales, alianzas
              con las principales aerolíneas y un sistema de seguridad de nivel
              bancario, ofrecemos una experiencia de reserva sin igual.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-neutral-600">
              Nuestro equipo de gestores especializados está disponible 24/7
              para garantizar que cada viaje sea perfecto, desde la búsqueda
              del vuelo hasta tu regreso a casa.
            </p>
          </div>
        </section>
        <TrustBanner />
      </main>
      <Footer />
    </>
  );
}
