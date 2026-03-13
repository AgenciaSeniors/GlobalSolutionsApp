/**
 * @fileoverview SEO landing: Charter flights to Cuba — FIRST MOVER content.
 * Target: "charter a Cuba" (4,000–6,000/mo), "charter Cuba desde Miami" (3,000–5,000/mo)
 * No OTA has a comprehensive charter page.
 * @module app/(public)/flights/charter-cuba/page
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Plane, Clock, DollarSign, ArrowRight, CheckCircle,
  Users, Briefcase, MapPin, Car, BookOpen,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import JsonLd from '@/components/seo/JsonLd';
import { buildFAQSchema, buildFlightRouteSchema } from '@/lib/seo/jsonld';
import { ROUTES } from '@/lib/constants/routes';

export const metadata: Metadata = {
  title: 'Vuelos Charter a Cuba — Reserva con Zelle, PIX o SPEI',
  description:
    'Reserva vuelos charter a Cuba desde Miami, Fort Lauderdale y Tampa. Compara aerolíneas charter: precios, equipaje, rutas. Paga con Zelle, PIX o SPEI.',
  alternates: { canonical: '/flights/charter-cuba' },
  keywords: [
    'charter a Cuba',
    'vuelos charter Cuba',
    'charter a Cuba desde Miami',
    'charter Cuba precio',
    'vuelos charter a La Habana',
    'charter Cuba Fort Lauderdale',
  ],
  openGraph: {
    title: 'Vuelos Charter a Cuba — Reserva con Zelle, PIX o SPEI',
    description:
      'Reserva vuelos charter a Cuba desde Miami, Fort Lauderdale y Tampa. Compara precios de aerolíneas charter.',
    url: '/flights/charter-cuba',
  },
};

const CHARTER_AIRLINES = [
  { name: 'Xael', routes: 'MIA → HAV, VRA, HOG, SCU', baggage: '64 lbs gratis', price: 'Desde $199' },
  { name: 'HavanaAir', routes: 'MIA → HAV, CMW', baggage: '64 lbs gratis', price: 'Desde $209' },
  { name: 'Cubazul', routes: 'MIA, FLL → HAV, VRA', baggage: '64 lbs gratis', price: 'Desde $189' },
  { name: 'IBC Airways', routes: 'MIA → HAV', baggage: '44 lbs incluidas', price: 'Desde $219' },
];

const CHARTER_FAQS = [
  {
    question: '¿Qué es un vuelo charter a Cuba?',
    answer:
      'Un vuelo charter es operado por compañías especializadas (no aerolíneas comerciales regulares). Ofrecen rutas directas a ciudades cubanas menos servidas, equipaje más generoso (hasta 64 lbs gratis) y precios competitivos. Son la opción preferida de la diáspora cubana.',
  },
  {
    question: '¿Cuánto cuesta un charter a Cuba desde Miami?',
    answer:
      'Los vuelos charter de Miami a La Habana van desde $189 hasta $350 dependiendo de la temporada y operador. Diciembre es el mes más caro. Los charters suelen incluir más equipaje que las aerolíneas comerciales.',
  },
  {
    question: '¿Qué aerolíneas charter vuelan a Cuba?',
    answer:
      'Las principales aerolíneas charter a Cuba son Xael, HavanaAir (World Atlantic), Cubazul e IBC Airways. Operan desde Miami (MIA) y Fort Lauderdale (FLL) hacia múltiples ciudades cubanas.',
  },
  {
    question: '¿Cuánto equipaje puedo llevar en un charter a Cuba?',
    answer:
      'La mayoría de charters permiten 64 lbs (29 kg) de equipaje documentado gratis — más que las aerolíneas comerciales que cobran por cada maleta. Algunos operadores permiten maletas adicionales por un cargo.',
  },
  {
    question: '¿Puedo comprar un charter a Cuba con Zelle?',
    answer:
      'Sí. Global Solutions Travel es la única agencia donde puedes reservar vuelos charter a Cuba pagando con Zelle, PIX, SPEI o Square. No necesitas tarjeta de crédito.',
  },
  {
    question: '¿Cuál es la diferencia entre un charter y un vuelo comercial a Cuba?',
    answer:
      'Los charters ofrecen más equipaje gratis (64 lbs vs 23 kg), vuelan a más ciudades cubanas (no solo HAV), y sus precios suelen ser más estables. Los vuelos comerciales (American Airlines, JetBlue) tienen más frecuencias y programas de millas.',
  },
];

export default function CharterCubaPage() {
  const faqSchema = buildFAQSchema(CHARTER_FAQS);
  const flightSchema = buildFlightRouteSchema({
    originCity: 'Miami',
    originCode: 'MIA',
    destinationCity: 'La Habana',
    destinationCode: 'HAV',
    lowPrice: 189,
    highPrice: 350,
    airlines: CHARTER_AIRLINES.map((a) => a.name),
  });

  return (
    <>
      <JsonLd data={[faqSchema, flightSchema]} />
      <Navbar />
      <main className="pt-[72px]">
        {/* Hero */}
        <section className="bg-gradient-to-br from-brand-600 to-brand-800 text-white py-16">
          <div className="mx-auto max-w-6xl px-6">
            <Breadcrumbs
              items={[
                { name: 'Inicio', href: '/' },
                { name: 'Vuelos', href: ROUTES.FLIGHTS },
                { name: 'Charter a Cuba', href: '/flights/charter-cuba' },
              ]}
              className="!text-white/70 mb-6 [&_a]:!text-white/70 [&_a:hover]:!text-white [&_span.font-medium]:!text-white [&_svg]:!text-white/40"
            />
            <h1 className="text-4xl font-bold md:text-5xl">Vuelos Charter a Cuba</h1>
            <p className="mt-4 text-lg text-white/85 max-w-3xl leading-relaxed">
              Los vuelos charter son la forma preferida de la diáspora cubana para viajar a Cuba.
              Más equipaje, más destinos y precios competitivos. Compara operadores y reserva con
              los métodos de pago más flexibles del mercado.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/20">
                <DollarSign className="h-5 w-5 text-white/70 mb-1" />
                <p className="text-xs text-white/60">Desde</p>
                <p className="text-lg font-bold">$189 USD</p>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/20">
                <Briefcase className="h-5 w-5 text-white/70 mb-1" />
                <p className="text-xs text-white/60">Equipaje</p>
                <p className="text-lg font-bold">64 lbs gratis</p>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/20">
                <MapPin className="h-5 w-5 text-white/70 mb-1" />
                <p className="text-xs text-white/60">Destinos</p>
                <p className="text-lg font-bold">HAV, VRA, HOG, SCU</p>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/20">
                <Users className="h-5 w-5 text-white/70 mb-1" />
                <p className="text-xs text-white/60">Operadores</p>
                <p className="text-lg font-bold">4+ charters</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-white py-10 border-b border-neutral-100">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <h2 className="text-2xl font-bold text-neutral-900">Busca tu charter a Cuba</h2>
            <p className="mt-2 text-neutral-600">Compara precios de charters y aerolíneas comerciales</p>
            <Link
              href={`${ROUTES.FLIGHTS}?from=MIA&to=HAV`}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-3.5 text-lg font-semibold text-white shadow-lg hover:bg-brand-700 transition-colors"
            >
              Buscar vuelos <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </section>

        {/* Charter Airlines Table */}
        <section className="bg-neutral-50 py-12">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-6">
              Aerolíneas charter que vuelan a Cuba
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full bg-white rounded-xl border border-neutral-200 overflow-hidden">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Aerolínea</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Rutas</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Equipaje</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Precio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {CHARTER_AIRLINES.map((airline) => (
                    <tr key={airline.name} className="hover:bg-neutral-50">
                      <td className="px-6 py-4 font-semibold text-neutral-900">{airline.name}</td>
                      <td className="px-6 py-4 text-neutral-600 text-sm">{airline.routes}</td>
                      <td className="px-6 py-4 text-neutral-600 text-sm">{airline.baggage}</td>
                      <td className="px-6 py-4 font-semibold text-green-700">{airline.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Charter vs Commercial */}
        <section className="bg-white py-12">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-6">
              Charter vs vuelo comercial a Cuba
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-2xl border-2 border-brand-200 bg-brand-50 p-6">
                <h3 className="text-lg font-bold text-brand-800 mb-4">✈️ Vuelo Charter</h3>
                <ul className="space-y-2 text-neutral-700">
                  <li className="flex items-start gap-2"><CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" /> 64 lbs de equipaje gratis</li>
                  <li className="flex items-start gap-2"><CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" /> Vuelos a ciudades provinciales (HOG, SCU, CMW, SNU)</li>
                  <li className="flex items-start gap-2"><CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" /> Precios estables todo el año</li>
                  <li className="flex items-start gap-2"><CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" /> Desde $189 ida</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-6">
                <h3 className="text-lg font-bold text-neutral-800 mb-4">🏢 Vuelo Comercial</h3>
                <ul className="space-y-2 text-neutral-700">
                  <li className="flex items-start gap-2"><CheckCircle className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" /> Más frecuencias diarias</li>
                  <li className="flex items-start gap-2"><CheckCircle className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" /> Programas de millas (AAdvantage, TrueBlue)</li>
                  <li className="flex items-start gap-2"><CheckCircle className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" /> Check-in online</li>
                  <li className="flex items-start gap-2"><CheckCircle className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" /> Desde $149 ida (variable)</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Payment Methods */}
        <section className="bg-neutral-50 py-12">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">
              Paga tu charter con Zelle, PIX o SPEI
            </h2>
            <p className="text-neutral-600 mb-6">
              Somos la única agencia donde puedes comprar vuelos charter a Cuba sin tarjeta de crédito:
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {['Zelle', 'PIX', 'SPEI', 'Square'].map((m) => (
                <div key={m} className="flex items-center gap-2 rounded-xl bg-white p-4 border border-neutral-200">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-semibold text-neutral-800">{m}</span>
                </div>
              ))}
            </div>
            <Link href={ROUTES.PAYMENT_METHODS} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
              Ver todos los métodos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white py-12">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-6">
              Preguntas frecuentes sobre vuelos charter a Cuba
            </h2>
            <div className="space-y-4">
              {CHARTER_FAQS.map((faq, i) => (
                <details key={i} className="group rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden">
                  <summary className="cursor-pointer px-6 py-4 font-semibold text-neutral-900 hover:bg-neutral-100 transition-colors">
                    {faq.question}
                  </summary>
                  <div className="px-6 pb-4 text-neutral-600 leading-relaxed">{faq.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Related Links */}
        <section className="bg-neutral-50 py-12">
          <div className="mx-auto max-w-6xl px-6 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-neutral-900 mb-4">
                <Plane className="h-5 w-5 text-brand-500" /> Rutas populares
              </h3>
              <ul className="space-y-2">
                <li><Link href={ROUTES.FLIGHTS_MIAMI_HABANA} className="text-brand-600 hover:underline">Vuelos Miami → La Habana</Link></li>
                <li><Link href={ROUTES.FLIGHTS_NYC_CUBA} className="text-brand-600 hover:underline">Vuelos Nueva York → Cuba</Link></li>
                <li><Link href={ROUTES.FLIGHTS_PANAMA_HABANA} className="text-brand-600 hover:underline">Vuelos Panamá → La Habana</Link></li>
                <li><Link href={ROUTES.FLIGHTS_CUBA} className="text-brand-600 hover:underline font-medium">Ver todas las rutas →</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-neutral-900 mb-4">
                <BookOpen className="h-5 w-5 text-brand-500" /> Guías de viaje
              </h3>
              <ul className="space-y-2">
                <li><Link href={ROUTES.GUIDE_REQUISITOS_CUBA} className="text-brand-600 hover:underline">Requisitos para viajar a Cuba</Link></li>
                <li><Link href={ROUTES.GUIDE_ADUANA_CUBA} className="text-brand-600 hover:underline">Aduana y equipaje Cuba</Link></li>
                <li><Link href={ROUTES.GUIDE_EVISA_CUBA} className="text-brand-600 hover:underline">Cómo tramitar la eVisa Cuba</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-neutral-900 mb-4">
                <Car className="h-5 w-5 text-brand-500" /> Servicios
              </h3>
              <ul className="space-y-2">
                <li><Link href={ROUTES.CARS} className="text-brand-600 hover:underline">Renta de autos en Cuba</Link></li>
                <li><Link href={ROUTES.PAYMENT_METHODS} className="text-brand-600 hover:underline">Métodos de pago</Link></li>
                <li><Link href={ROUTES.OFFERS} className="text-brand-600 hover:underline">Ofertas exclusivas</Link></li>
              </ul>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
