/**
 * @fileoverview SEO hub: Vuelos a Cuba — TOPICAL AUTHORITY ANCHOR.
 * Target: "vuelos a Cuba" (18K-22K/mo), "vuelos baratos a Cuba" (12K-15K/mo)
 * Hub page linking to all Cuba route pages, destinations, guides, and services.
 * @module app/(public)/flights/cuba/page
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Plane, ArrowRight, CheckCircle, MapPin, DollarSign,
  Globe, Car, BookOpen, CreditCard, Shield, Clock,
  Palmtree, Building2,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import JsonLd from '@/components/seo/JsonLd';
import { buildFAQSchema } from '@/lib/seo/jsonld';
import { ROUTES } from '@/lib/constants/routes';

export const metadata: Metadata = {
  title: 'Vuelos a Cuba — Compara Precios de 60+ Aerolíneas',
  description:
    'Encuentra vuelos baratos a Cuba desde Miami, Panamá, México, Cancún y Nueva York. Compara 60+ aerolíneas, charters y vuelos comerciales. Paga con Zelle, PIX, SPEI o Square.',
  alternates: { canonical: '/flights/cuba' },
  keywords: [
    'vuelos a Cuba',
    'vuelos baratos a Cuba',
    'pasajes a Cuba',
    'vuelos a La Habana',
    'vuelos a Cuba baratos',
    'vuelos Cuba desde Miami',
    'vuelos Cuba desde México',
    'vuelos Cuba desde Panamá',
    'charter a Cuba',
    'vuelos Cuba 2026',
  ],
  openGraph: {
    title: 'Vuelos a Cuba — Compara Precios de 60+ Aerolíneas',
    description:
      'Compara vuelos a Cuba desde todas las ciudades. Charters y comerciales. Paga con Zelle, PIX o SPEI.',
    url: '/flights/cuba',
  },
};

/* ── Data ── */

const ROUTE_CARDS = [
  {
    href: ROUTES.FLIGHTS_MIAMI_HABANA,
    origin: 'Miami',
    destination: 'La Habana',
    price: 149,
    code: 'MIA → HAV',
    duration: '1h 15min',
    flag: '🇺🇸',
  },
  {
    href: ROUTES.FLIGHTS_PANAMA_HABANA,
    origin: 'Panamá',
    destination: 'La Habana',
    price: 189,
    code: 'PTY → HAV',
    duration: '3h 30min',
    flag: '🇵🇦',
  },
  {
    href: ROUTES.FLIGHTS_CHARTER_CUBA,
    origin: 'Charter',
    destination: 'Cuba',
    price: 189,
    code: 'MIA → HAV, VRA, HOG',
    duration: 'Directos',
    flag: '✈️',
  },
  {
    href: ROUTES.FLIGHTS_NYC_CUBA,
    origin: 'Nueva York',
    destination: 'Cuba',
    price: 249,
    code: 'JFK → HAV',
    duration: '3h 30min',
    flag: '🇺🇸',
  },
  {
    href: ROUTES.FLIGHTS_CANCUN_HABANA,
    origin: 'Cancún',
    destination: 'La Habana',
    price: 159,
    code: 'CUN → HAV',
    duration: '1h 05min',
    flag: '🇲🇽',
  },
  {
    href: ROUTES.FLIGHTS_MEXICO_CUBA,
    origin: 'México',
    destination: 'Cuba',
    price: 199,
    code: 'MEX → HAV',
    duration: '3h 00min',
    flag: '🇲🇽',
  },
];

const DESTINATIONS = [
  {
    city: 'La Habana',
    code: 'HAV',
    description:
      'Capital de Cuba y destino principal. Aeropuerto José Martí con vuelos directos desde Miami, Nueva York, Panamá, Cancún y Ciudad de México.',
    highlight: 'Destino #1',
  },
  {
    city: 'Varadero',
    code: 'VRA',
    description:
      'La playa más famosa del Caribe. Vuelos charter directos desde Miami y conexiones vía La Habana. Ideal para turismo de sol y playa.',
    highlight: 'Playa #1',
  },
  {
    city: 'Holguín',
    code: 'HOG',
    description:
      'Tercer aeropuerto de Cuba. Acceso a playas del norte de Oriente como Guardalavaca. Vuelos charter desde Miami.',
    highlight: 'Oriente',
  },
  {
    city: 'Santiago de Cuba',
    code: 'SCU',
    description:
      'Segunda ciudad de Cuba, cuna de la música y la cultura afrocubana. Vuelos charter directos desde Miami.',
    highlight: 'Cultural',
  },
];

const FAQS = [
  {
    question: '¿Cuánto cuesta un vuelo a Cuba?',
    answer:
      'Los vuelos a Cuba varían entre $149 y $600 USD dependiendo de la ciudad de origen, temporada y tipo de vuelo. Miami es la ruta más económica (desde $149), seguida de Cancún ($159) y Panamá ($189). Diciembre es el mes más caro; septiembre y octubre ofrecen los mejores precios.',
  },
  {
    question: '¿Qué aerolíneas vuelan a Cuba?',
    answer:
      'Vuelan a Cuba aerolíneas comerciales como American Airlines, JetBlue, Southwest, Copa Airlines, Aeromexico, Cubana de Aviación y Viva Aerobus. También hay operadores charter especializados como Xael, HavanaAir, Cubazul e IBC Airways que ofrecen más equipaje y rutas a ciudades provinciales.',
  },
  {
    question: '¿Necesito visa para viajar a Cuba?',
    answer:
      'Sí. Todos los visitantes necesitan una visa o tarjeta de turista para entrar a Cuba. Desde julio de 2025, Cuba ofrece el sistema eVisa que permite tramitarla completamente en línea. También necesitas pasaporte vigente con al menos 6 meses de validez y seguro médico obligatorio.',
  },
  {
    question: '¿Puedo pagar mi vuelo a Cuba con Zelle?',
    answer:
      'Sí. Global Solutions Travel es la única agencia de viajes que acepta Zelle, PIX, SPEI y Square para comprar vuelos a Cuba. No necesitas tarjeta de crédito. El proceso es simple: selecciona tu vuelo, solicita la reserva y envía el pago. Confirmación en 2-4 horas.',
  },
  {
    question: '¿Cuál es la mejor época para viajar a Cuba?',
    answer:
      'La mejor época es de noviembre a abril (temporada seca). Los vuelos más baratos se encuentran en septiembre-octubre. Diciembre y enero son los meses más caros por la alta demanda de la diáspora cubana. Para playas, de diciembre a mayo ofrece el mejor clima.',
  },
  {
    question: '¿Hay vuelos directos a Cuba desde mi ciudad?',
    answer:
      'Hay vuelos directos a La Habana desde Miami (1h 15min), Nueva York (3h 30min), Cancún (1h 05min), Ciudad de México (3h), y Ciudad de Panamá (3h 30min). Desde otras ciudades puedes conectar vía Miami, Panamá o Cancún. Los charters ofrecen vuelos directos a Varadero, Holguín y Santiago de Cuba.',
  },
];

export default function FlightsCubaPage() {
  const faqSchema = buildFAQSchema(FAQS);

  return (
    <>
      <JsonLd data={faqSchema} />
      <Navbar />
      <main className="pt-[72px]">
        {/* ── Hero ── */}
        <section className="bg-gradient-to-br from-brand-600 to-brand-800 text-white py-16">
          <div className="mx-auto max-w-6xl px-6">
            <Breadcrumbs
              items={[
                { name: 'Inicio', href: '/' },
                { name: 'Vuelos', href: ROUTES.FLIGHTS },
                { name: 'Cuba', href: ROUTES.FLIGHTS_CUBA },
              ]}
              className="!text-white/70 mb-6 [&_a]:!text-white/70 [&_a:hover]:!text-white [&_span.font-medium]:!text-white [&_svg]:!text-white/40"
            />
            <h1 className="text-4xl font-bold md:text-5xl">
              Vuelos a Cuba — Compara y Reserva al Mejor Precio
            </h1>
            <p className="mt-4 text-lg text-white/85 max-w-3xl leading-relaxed">
              Compara vuelos a Cuba desde todas las ciudades principales. Más de 60 aerolíneas entre
              comerciales y charters. Encuentra el mejor precio para La Habana, Varadero, Holguín y
              Santiago de Cuba. Paga con Zelle, PIX, SPEI o Square — sin tarjeta de crédito.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/20">
                <Plane className="h-5 w-5 text-white/70 mb-1" />
                <p className="text-xs text-white/60">Aerolíneas</p>
                <p className="text-lg font-bold">60+</p>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/20">
                <DollarSign className="h-5 w-5 text-white/70 mb-1" />
                <p className="text-xs text-white/60">Desde</p>
                <p className="text-lg font-bold">$149 USD</p>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/20">
                <MapPin className="h-5 w-5 text-white/70 mb-1" />
                <p className="text-xs text-white/60">Destinos</p>
                <p className="text-lg font-bold">HAV, VRA, HOG, SCU</p>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/20">
                <Globe className="h-5 w-5 text-white/70 mb-1" />
                <p className="text-xs text-white/60">Orígenes</p>
                <p className="text-lg font-bold">6 ciudades</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Route Cards Grid ── */}
        <section className="bg-white py-12">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">
              Rutas populares a Cuba
            </h2>
            <p className="text-neutral-600 mb-8">
              Selecciona tu ciudad de origen para ver precios, aerolíneas y detalles de cada ruta.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ROUTE_CARDS.map((route) => (
                <Link
                  key={route.href}
                  href={route.href}
                  className="group rounded-2xl border border-neutral-200 p-6 hover:border-brand-300 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{route.flag}</span>
                    <span className="text-xs font-medium text-neutral-500 bg-neutral-100 rounded-full px-3 py-1">
                      {route.code}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-neutral-900 group-hover:text-brand-600 transition-colors">
                    {route.origin} → {route.destination}
                  </h3>
                  <div className="mt-2 flex items-center gap-4 text-sm text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {route.duration}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xl font-bold text-green-700">
                      Desde ${route.price}
                    </p>
                    <ArrowRight className="h-5 w-5 text-neutral-400 group-hover:text-brand-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Search CTA ── */}
        <section className="bg-gradient-to-r from-brand-50 to-brand-100 py-12">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <h2 className="text-2xl font-bold text-neutral-900">
              Busca tu vuelo a Cuba ahora
            </h2>
            <p className="mt-2 text-neutral-600 max-w-xl mx-auto">
              Compara precios de vuelos comerciales y charters en segundos.
              Encuentra la mejor opción para tu viaje.
            </p>
            <Link
              href={`${ROUTES.FLIGHTS}?to=HAV`}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-3.5 text-lg font-semibold text-white shadow-lg hover:bg-brand-700 transition-colors"
            >
              Buscar vuelos a Cuba <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </section>

        {/* ── Destinations ── */}
        <section className="bg-white py-12">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">
              Destinos en Cuba
            </h2>
            <p className="text-neutral-600 mb-8">
              Cuba cuenta con varios aeropuertos internacionales. Estos son los principales
              destinos a los que puedes volar directamente.
            </p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {DESTINATIONS.map((dest) => (
                <div
                  key={dest.code}
                  className="rounded-2xl border border-neutral-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                      <MapPin className="h-6 w-6 text-brand-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-neutral-900">{dest.city}</h3>
                      <span className="text-sm text-neutral-500">Aeropuerto {dest.code}</span>
                    </div>
                    <span className="ml-auto text-xs font-semibold text-brand-600 bg-brand-50 rounded-full px-3 py-1">
                      {dest.highlight}
                    </span>
                  </div>
                  <p className="text-neutral-600 text-sm leading-relaxed">
                    {dest.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Payment Methods ── */}
        <section className="bg-neutral-50 py-12">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">
              Paga tu vuelo a Cuba sin tarjeta de crédito
            </h2>
            <p className="text-neutral-600 mb-6">
              Somos la única agencia de viajes que acepta estos métodos de pago para vuelos a Cuba.
              Sin intermediarios, sin comisiones ocultas.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { name: 'Zelle', country: 'EE.UU.' },
                { name: 'PIX', country: 'Brasil' },
                { name: 'SPEI', country: 'México' },
                { name: 'Square', country: 'Internacional' },
              ].map((method) => (
                <div
                  key={method.name}
                  className="flex flex-col items-center gap-2 rounded-xl bg-white p-5 border border-neutral-200 text-center"
                >
                  <CheckCircle className="h-6 w-6 text-green-500" />
                  <span className="font-bold text-neutral-900">{method.name}</span>
                  <span className="text-xs text-neutral-500">{method.country}</span>
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
              Preguntas frecuentes sobre vuelos a Cuba
            </h2>
            <div className="space-y-4">
              {FAQS.map((faq, i) => (
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
          <div className="mx-auto max-w-6xl px-6 grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Guides */}
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-neutral-900 mb-4">
                <BookOpen className="h-5 w-5 text-brand-500" /> Guías de viaje a Cuba
              </h3>
              <ul className="space-y-2">
                <li>
                  <Link href={ROUTES.GUIDE_REQUISITOS_CUBA} className="text-brand-600 hover:underline">
                    Requisitos para viajar a Cuba 2026
                  </Link>
                </li>
                <li>
                  <Link href={ROUTES.GUIDE_ADUANA_CUBA} className="text-brand-600 hover:underline">
                    Aduana y equipaje permitido Cuba
                  </Link>
                </li>
                <li>
                  <Link href={ROUTES.GUIDE_EVISA_CUBA} className="text-brand-600 hover:underline">
                    Cómo tramitar la eVisa Cuba
                  </Link>
                </li>
              </ul>
            </div>

            {/* Routes */}
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-neutral-900 mb-4">
                <Plane className="h-5 w-5 text-brand-500" /> Todas las rutas
              </h3>
              <ul className="space-y-2">
                <li>
                  <Link href={ROUTES.FLIGHTS_MIAMI_HABANA} className="text-brand-600 hover:underline">
                    Miami → La Habana
                  </Link>
                </li>
                <li>
                  <Link href={ROUTES.FLIGHTS_PANAMA_HABANA} className="text-brand-600 hover:underline">
                    Panamá → La Habana
                  </Link>
                </li>
                <li>
                  <Link href={ROUTES.FLIGHTS_CHARTER_CUBA} className="text-brand-600 hover:underline">
                    Vuelos charter a Cuba
                  </Link>
                </li>
                <li>
                  <Link href={ROUTES.FLIGHTS_NYC_CUBA} className="text-brand-600 hover:underline">
                    Nueva York → Cuba
                  </Link>
                </li>
                <li>
                  <Link href={ROUTES.FLIGHTS_CANCUN_HABANA} className="text-brand-600 hover:underline">
                    Cancún → La Habana
                  </Link>
                </li>
                <li>
                  <Link href={ROUTES.FLIGHTS_MEXICO_CUBA} className="text-brand-600 hover:underline">
                    México → Cuba
                  </Link>
                </li>
              </ul>
            </div>

            {/* Services */}
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-neutral-900 mb-4">
                <Car className="h-5 w-5 text-brand-500" /> Servicios en Cuba
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
        </section>
      </main>
      <Footer />
    </>
  );
}
