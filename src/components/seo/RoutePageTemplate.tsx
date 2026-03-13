/**
 * @fileoverview Reusable route landing page template for SEO.
 * Server component. Renders full page with hero, airlines, FAQ, JSON-LD.
 * @module components/seo/RoutePageTemplate
 */
import Link from 'next/link';
import {
  Plane, Clock, DollarSign, Building2, ArrowRight, Car,
  CreditCard, BookOpen, MapPin, CheckCircle,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import JsonLd from '@/components/seo/JsonLd';
import { buildFAQSchema, buildFlightRouteSchema } from '@/lib/seo/jsonld';
import { ROUTES } from '@/lib/constants/routes';
import type { RoutePageData } from '@/lib/seo/routes-data';

interface RoutePageTemplateProps {
  route: RoutePageData;
}

export default function RoutePageTemplate({ route }: RoutePageTemplateProps) {
  const faqSchema = buildFAQSchema(route.faqs);
  const flightSchema = buildFlightRouteSchema({
    originCity: route.originCity,
    originCode: route.originCode,
    destinationCity: route.destinationCity,
    destinationCode: route.destinationCode,
    lowPrice: route.estimatedLowPrice,
    highPrice: route.estimatedHighPrice,
    airlines: route.airlines,
  });

  return (
    <>
      <JsonLd data={[faqSchema, flightSchema]} />
      <Navbar />
      <main className="pt-[72px]">
        {/* ── Hero ── */}
        <section className="bg-gradient-to-br from-brand-600 to-brand-800 text-white py-16">
          <div className="mx-auto max-w-6xl px-6">
            <Breadcrumbs
              items={[
                { name: 'Inicio', href: '/' },
                { name: 'Vuelos', href: ROUTES.FLIGHTS },
                { name: `${route.originCity} → ${route.destinationCity}`, href: `/flights/${route.slug}` },
              ]}
              className="!text-white/70 mb-6 [&_a]:!text-white/70 [&_a:hover]:!text-white [&_span.font-medium]:!text-white [&_svg]:!text-white/40"
            />
            <h1 className="text-4xl font-bold md:text-5xl">{route.h1}</h1>
            <p className="mt-4 text-lg text-white/85 max-w-3xl leading-relaxed">
              {route.introText}
            </p>

            {/* Quick facts */}
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <QuickFact
                icon={DollarSign}
                label="Desde"
                value={`$${route.estimatedLowPrice} USD`}
              />
              <QuickFact
                icon={Clock}
                label="Duración"
                value={route.flightDuration}
              />
              <QuickFact
                icon={Plane}
                label="Vuelo directo"
                value={route.directFlights ? 'Sí' : 'Con escala'}
              />
              <QuickFact
                icon={Building2}
                label="Aerolíneas"
                value={`${route.airlines.length} opciones`}
              />
            </div>
          </div>
        </section>

        {/* ── Search CTA ── */}
        <section className="bg-white py-10 border-b border-neutral-100">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <h2 className="text-2xl font-bold text-neutral-900">
              Busca tu vuelo {route.originCity} → {route.destinationCity}
            </h2>
            <p className="mt-2 text-neutral-600">
              Compara precios de {route.airlines.length} aerolíneas en segundos
            </p>
            <Link
              href={`${ROUTES.FLIGHTS}?from=${route.originCode}&to=${route.destinationCode}`}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-3.5 text-lg font-semibold text-white shadow-lg hover:bg-brand-700 transition-colors"
            >
              Buscar vuelos <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </section>

        {/* ── Airlines ── */}
        <section className="bg-neutral-50 py-12">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-6">
              Aerolíneas que operan {route.originCode} → {route.destinationCode}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {route.airlines.map((airline) => (
                <div
                  key={airline}
                  className="flex items-center gap-3 rounded-xl bg-white p-4 border border-neutral-200 shadow-sm"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                    <Plane className="h-5 w-5 text-brand-500" />
                  </div>
                  <span className="font-semibold text-neutral-900">{airline}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Route Info ── */}
        <section className="bg-white py-12">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-6">
              Información del vuelo
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-neutral-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <MapPin className="h-6 w-6 text-brand-500" />
                  <h3 className="text-lg font-bold">Origen</h3>
                </div>
                <p className="text-neutral-600">
                  <strong>{route.originCity}</strong> ({route.originCode}), {route.originCountry}
                </p>
              </div>
              <div className="rounded-2xl border border-neutral-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <MapPin className="h-6 w-6 text-brand-500" />
                  <h3 className="text-lg font-bold">Destino</h3>
                </div>
                <p className="text-neutral-600">
                  <strong>{route.destinationCity}</strong> ({route.destinationCode}), {route.destinationCountry}
                </p>
              </div>
            </div>

            {/* Price range */}
            <div className="mt-8 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-2">Rango de precios</h3>
              <p className="text-neutral-600">
                Los vuelos de {route.originCity} a {route.destinationCity} van desde{' '}
                <strong className="text-green-700">${route.estimatedLowPrice} USD</strong> hasta{' '}
                <strong className="text-neutral-800">${route.estimatedHighPrice} USD</strong> dependiendo de la temporada,
                aerolínea y anticipación de compra.
              </p>
            </div>
          </div>
        </section>

        {/* ── Payment Methods ── */}
        <section className="bg-neutral-50 py-12">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">
              Métodos de pago aceptados
            </h2>
            <p className="text-neutral-600 mb-6">
              Somos la única agencia que acepta estos métodos para comprar vuelos a Cuba:
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {['Zelle', 'PIX', 'SPEI', 'Square'].map((method) => (
                <div
                  key={method}
                  className="flex items-center gap-2 rounded-xl bg-white p-4 border border-neutral-200"
                >
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-semibold text-neutral-800">{method}</span>
                </div>
              ))}
            </div>
            <Link
              href={ROUTES.PAYMENT_METHODS}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
            >
              Ver todos los métodos de pago <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="bg-white py-12">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-6">
              Preguntas frecuentes: Vuelos {route.originCity} → {route.destinationCity}
            </h2>
            <div className="space-y-4">
              {route.faqs.map((faq, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden"
                >
                  <summary className="cursor-pointer px-6 py-4 font-semibold text-neutral-900 hover:bg-neutral-100 transition-colors">
                    {faq.question}
                  </summary>
                  <div className="px-6 pb-4 text-neutral-600 leading-relaxed">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Related Links ── */}
        <section className="bg-neutral-50 py-12">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {/* Related routes */}
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-neutral-900 mb-4">
                  <Plane className="h-5 w-5 text-brand-500" /> Otras rutas a Cuba
                </h3>
                <ul className="space-y-2">
                  {route.relatedRoutes.map((slug) => (
                    <li key={slug}>
                      <Link
                        href={`/flights/${slug}`}
                        className="text-brand-600 hover:underline capitalize"
                      >
                        Vuelos {slug.replace(/-/g, ' ')}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link href={ROUTES.FLIGHTS_CUBA} className="text-brand-600 hover:underline font-medium">
                      Ver todas las rutas a Cuba →
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Guides */}
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-neutral-900 mb-4">
                  <BookOpen className="h-5 w-5 text-brand-500" /> Guías de viaje
                </h3>
                <ul className="space-y-2">
                  <li>
                    <Link href={ROUTES.GUIDE_REQUISITOS_CUBA} className="text-brand-600 hover:underline">
                      Requisitos para viajar a Cuba
                    </Link>
                  </li>
                  <li>
                    <Link href={ROUTES.GUIDE_ADUANA_CUBA} className="text-brand-600 hover:underline">
                      Aduana y equipaje Cuba
                    </Link>
                  </li>
                  <li>
                    <Link href={ROUTES.GUIDE_EVISA_CUBA} className="text-brand-600 hover:underline">
                      Cómo tramitar la eVisa Cuba
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Services */}
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-neutral-900 mb-4">
                  <Car className="h-5 w-5 text-brand-500" /> Servicios
                </h3>
                <ul className="space-y-2">
                  <li>
                    <Link href={ROUTES.CARS} className="text-brand-600 hover:underline">
                      Renta de autos en Cuba
                    </Link>
                  </li>
                  <li>
                    <Link href={ROUTES.PAYMENT_METHODS} className="text-brand-600 hover:underline">
                      Métodos de pago
                    </Link>
                  </li>
                  <li>
                    <Link href={ROUTES.OFFERS} className="text-brand-600 hover:underline">
                      Ofertas exclusivas
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

/* ── Quick Fact card ── */
function QuickFact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/20">
      <Icon className="h-5 w-5 text-white/70 mb-1" />
      <p className="text-xs text-white/60">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
