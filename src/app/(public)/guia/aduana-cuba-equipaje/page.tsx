/**
 * @fileoverview SEO guide: Aduana Cuba y Equipaje Permitido 2026.
 * Target: "aduana Cuba" (10K-18K/mo) + "equipaje permitido Cuba" (8K-15K/mo)
 * Comprehensive customs and baggage guide for Cuba travelers.
 * @module app/(public)/guia/aduana-cuba-equipaje/page
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, CheckCircle, AlertTriangle, Plane, BookOpen,
  Car, Shield, Package, Scale, Ban, Gift, Clock,
  Briefcase, DollarSign, CalendarDays,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import JsonLd from '@/components/seo/JsonLd';
import { buildFAQSchema, buildArticleSchema } from '@/lib/seo/jsonld';
import { ROUTES } from '@/lib/constants/routes';

export const metadata: Metadata = {
  title: 'Aduana Cuba y Equipaje Permitido 2026 — Guía Completa',
  description:
    'Guía completa de la aduana de Cuba y equipaje permitido en 2026. Tabla de equipaje por aerolínea, artículos prohibidos, misceláneas permitidas, límites libres de impuesto y tarifas de exceso de equipaje.',
  alternates: { canonical: '/guia/aduana-cuba-equipaje' },
  keywords: [
    'aduana Cuba',
    'equipaje permitido Cuba',
    'aduana Cuba 2026',
    'qué puedo llevar a Cuba',
    'artículos prohibidos Cuba',
    'misceláneas Cuba',
    'equipaje Cuba aerolínea',
    'exceso de equipaje Cuba',
    'regulaciones aduana Cuba',
    'límite libre de impuesto Cuba',
  ],
  openGraph: {
    title: 'Aduana Cuba y Equipaje Permitido 2026 — Guía Completa',
    description:
      'Todo sobre aduana y equipaje en Cuba: artículos permitidos, tabla por aerolínea, misceláneas, impuestos y regulaciones 2026.',
    url: '/guia/aduana-cuba-equipaje',
  },
};

/* ── Data ── */

const BAGGAGE_TABLE = [
  { airline: 'American Airlines', type: 'Comercial', checked: '23 kg (50 lbs)', carry: '10 kg', extra: '$40-$75 USD', notes: 'Primera maleta incluida en algunas tarifas' },
  { airline: 'JetBlue', type: 'Comercial', checked: '23 kg (50 lbs)', carry: '10 kg', extra: '$35-$65 USD', notes: 'Blue Basic no incluye maleta documentada' },
  { airline: 'Southwest', type: 'Comercial', checked: '2x 23 kg gratis', carry: '10 kg', extra: '$75 USD', notes: '2 maletas gratis en todas las tarifas' },
  { airline: 'Copa Airlines', type: 'Comercial', checked: '23 kg (50 lbs)', carry: '10 kg', extra: '$50-$80 USD', notes: 'Varía por clase y tarifa' },
  { airline: 'Aeromexico', type: 'Comercial', checked: '23 kg (50 lbs)', carry: '10 kg', extra: '$50-$70 USD', notes: 'Tarifa Básica no incluye equipaje' },
  { airline: 'Xael Charter', type: 'Charter', checked: '64 lbs (29 kg)', carry: '1 personal', extra: '$1-$3/lb', notes: 'Más equipaje incluido que comerciales' },
  { airline: 'HavanaAir', type: 'Charter', checked: '64 lbs (29 kg)', carry: '1 personal', extra: '$1-$3/lb', notes: 'Peso total de todas las maletas' },
  { airline: 'Cubazul', type: 'Charter', checked: '64 lbs (29 kg)', carry: '1 personal', extra: '$2-$3/lb', notes: 'Maletas adicionales disponibles' },
];

const PROHIBITED_ITEMS = [
  'Drogas y estupefacientes (penas severas)',
  'Armas de fuego y municiones (sin permiso especial)',
  'Material explosivo o inflamable',
  'Material pornográfico',
  'Equipos de comunicación por satélite (sin autorización)',
  'GPS profesionales y drones (requieren permiso)',
  'Animales vivos (sin certificación sanitaria)',
  'Publicaciones contra la seguridad del Estado',
];

const MISCELLANEOUS_ITEMS = [
  'Ropa, calzado y artículos de aseo personal (uso propio, sin límite razonable)',
  'Medicamentos (con receta médica, cantidades personales)',
  'Alimentos enlatados y no perecederos (hasta 10 kg)',
  'Artículos electrónicos personales (1 laptop, 1 tablet, 1 celular)',
  'Cámara de fotos o video (1 por persona)',
  'Artículos deportivos personales',
  'Libros, revistas y material impreso (no prohibido)',
  'Juguetes y regalos (dentro del valor libre de impuesto)',
];

const DUTY_FREE_ITEMS = [
  { item: 'Artículos personales', limit: 'Sin límite razonable', note: 'Ropa, aseo, uso propio' },
  { item: 'Misceláneas (importación)', limit: 'Hasta $500 USD libres', note: 'Se aplica arancel sobre el excedente' },
  { item: 'Tabaco', limit: '20 cigarros o 50 puros', note: 'Para uso personal' },
  { item: 'Alcohol', limit: '3 litros', note: 'Bebidas alcohólicas' },
  { item: 'Medicamentos', limit: 'Cantidades personales', note: 'Con receta médica' },
  { item: 'Efectivo', limit: 'Hasta $5,000 USD sin declarar', note: 'Más de $5,000 requiere declaración' },
];

const FAQS = [
  {
    question: '¿Cuánto equipaje puedo llevar a Cuba?',
    answer:
      'Depende de tu aerolínea. Las aerolíneas comerciales como American Airlines permiten una maleta de 23 kg (50 lbs). Los charters como Xael y HavanaAir permiten 64 lbs (29 kg) de equipaje documentado. Southwest Airlines incluye 2 maletas de 23 kg gratis. Además, la aduana cubana permite importar misceláneas con un valor libre de impuesto de hasta $500 USD.',
  },
  {
    question: '¿Qué artículos están prohibidos en la aduana de Cuba?',
    answer:
      'Están prohibidos: drogas y estupefacientes, armas de fuego sin permiso, material explosivo, pornografía, equipos de comunicación satelital sin autorización, drones sin permiso, y publicaciones contra la seguridad del Estado. Las infracciones pueden resultar en decomiso, multas o sanciones penales.',
  },
  {
    question: '¿Cuánto puedo importar libre de impuesto a Cuba?',
    answer:
      'Puedes importar misceláneas con un valor libre de impuesto de hasta $500 USD. Los artículos personales (ropa, aseo, electrónicos personales) no cuentan dentro de este límite. Todo lo que exceda los $500 USD se grava con tarifas aduaneras que pueden alcanzar el 100% del valor.',
  },
  {
    question: '¿Puedo llevar electrodomésticos a Cuba?',
    answer:
      'Sí, pero cuentan como misceláneas y se gravan si exceden el valor libre de impuesto ($500 USD). Los artículos más comunes son: televisores (hasta 1 por persona), aires acondicionados (split con permiso), microondas, ollas de presión eléctricas y licuadoras. Los equipos deben ser de uso personal o familiar.',
  },
  {
    question: '¿Qué pasa si llevo exceso de equipaje?',
    answer:
      'El exceso de equipaje se cobra por la aerolínea antes del vuelo (entre $35 y $80 USD por pieza extra) y por la aduana cubana si las misceláneas exceden el valor libre de impuesto. Es importante pesar y valorar todo antes de viajar para evitar costos inesperados.',
  },
  {
    question: '¿Hay regulaciones especiales de aduana en diciembre?',
    answer:
      'Sí. Durante la temporada alta de diciembre-enero, la aduana cubana puede aplicar controles más estrictos debido al alto volumen de viajeros y misceláneas. Los tiempos de espera en aduana pueden ser mayores. Se recomienda declarar todo correctamente en el formulario D\'Viajeros para agilizar el proceso.',
  },
];

export default function AduanaCubaEquipajePage() {
  const faqSchema = buildFAQSchema(FAQS);
  const articleSchema = buildArticleSchema({
    title: 'Aduana Cuba y Equipaje Permitido 2026 — Guía Completa',
    description:
      'Guía completa de la aduana de Cuba: equipaje por aerolínea, artículos prohibidos, misceláneas, impuestos y regulaciones.',
    path: ROUTES.GUIDE_ADUANA_CUBA,
    datePublished: '2026-03-13',
    dateModified: '2026-03-13',
  });

  return (
    <>
      <JsonLd data={[articleSchema, faqSchema]} />
      <Navbar />
      <main className="pt-[72px]">
        {/* ── Hero ── */}
        <section className="bg-gradient-to-br from-teal-700 to-teal-900 text-white py-16">
          <div className="mx-auto max-w-4xl px-6">
            <Breadcrumbs
              items={[
                { name: 'Inicio', href: '/' },
                { name: 'Guías', href: '/guia' },
                { name: 'Aduana y Equipaje Cuba', href: ROUTES.GUIDE_ADUANA_CUBA },
              ]}
              className="!text-white/70 mb-6 [&_a]:!text-white/70 [&_a:hover]:!text-white [&_span.font-medium]:!text-white [&_svg]:!text-white/40"
            />
            <h1 className="text-4xl font-bold md:text-5xl">
              Aduana Cuba: Equipaje Permitido y Regulaciones 2026
            </h1>
            <p className="mt-4 text-lg text-white/85 max-w-3xl leading-relaxed">
              Todo lo que necesitas saber sobre la aduana cubana: equipaje permitido por aerolínea,
              artículos prohibidos, misceláneas, límites libres de impuesto y tarifas de exceso.
            </p>
            <div className="mt-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-2 text-sm font-medium border border-white/20">
                <Clock className="h-4 w-4" /> Última actualización: marzo 2026
              </span>
            </div>
          </div>
        </section>

        {/* ── Baggage Table ── */}
        <section className="bg-white py-12">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">
              Equipaje permitido por aerolínea
            </h2>
            <p className="text-neutral-600 mb-6">
              Cada aerolínea tiene sus propias reglas de equipaje. Los charters suelen ofrecer más
              peso incluido que las aerolíneas comerciales.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full bg-white rounded-xl border border-neutral-200 overflow-hidden text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-neutral-700">Aerolínea</th>
                    <th className="px-4 py-3 text-left font-semibold text-neutral-700">Tipo</th>
                    <th className="px-4 py-3 text-left font-semibold text-neutral-700">Documentado</th>
                    <th className="px-4 py-3 text-left font-semibold text-neutral-700">Mano</th>
                    <th className="px-4 py-3 text-left font-semibold text-neutral-700">Exceso</th>
                    <th className="px-4 py-3 text-left font-semibold text-neutral-700 hidden lg:table-cell">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {BAGGAGE_TABLE.map((row) => (
                    <tr key={row.airline} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-semibold text-neutral-900">{row.airline}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          row.type === 'Charter'
                            ? 'bg-brand-50 text-brand-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{row.checked}</td>
                      <td className="px-4 py-3 text-neutral-600">{row.carry}</td>
                      <td className="px-4 py-3 text-neutral-600">{row.extra}</td>
                      <td className="px-4 py-3 text-neutral-500 text-xs hidden lg:table-cell">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              * Precios y políticas pueden variar por temporada y tarifa. Verifica con tu aerolínea antes de viajar.
            </p>
          </div>
        </section>

        {/* ── Article Content ── */}
        <article className="bg-neutral-50 py-12">
          <div className="mx-auto max-w-4xl px-6 space-y-12">

            {/* Artículos prohibidos */}
            <section className="rounded-2xl bg-white border border-neutral-200 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                  <Ban className="h-5 w-5 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900">
                  Artículos prohibidos
                </h2>
              </div>
              <p className="text-neutral-600 leading-relaxed mb-4">
                La aduana cubana tiene una lista estricta de artículos cuya importación está
                prohibida o requiere permisos especiales. Violar estas regulaciones puede
                resultar en decomiso, multas considerables o sanciones penales.
              </p>
              <ul className="space-y-2">
                {PROHIBITED_ITEMS.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                    <span className="text-neutral-700">{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Misceláneas permitidas */}
            <section className="rounded-2xl bg-white border border-neutral-200 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
                  <Package className="h-5 w-5 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900">
                  Misceláneas permitidas
                </h2>
              </div>
              <p className="text-neutral-600 leading-relaxed mb-4">
                Las misceláneas son artículos que no son de uso personal pero se permiten importar
                a Cuba. Estos artículos están sujetos a los límites de valor libre de impuesto
                y aranceles aduaneros cuando exceden dichos límites.
              </p>
              <ul className="space-y-2">
                {MISCELLANEOUS_ITEMS.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <span className="text-neutral-700">{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Items libres de impuesto */}
            <section className="rounded-2xl bg-white border border-neutral-200 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-50">
                  <Gift className="h-5 w-5 text-yellow-600" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900">
                  Items libres de impuesto
                </h2>
              </div>
              <p className="text-neutral-600 leading-relaxed mb-4">
                Cuba permite ciertos artículos y cantidades libres de impuesto para cada viajero.
                Conocer estos límites puede ahorrarte costos significativos en la aduana.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="pb-3 text-left font-semibold text-neutral-700">Artículo</th>
                      <th className="pb-3 text-left font-semibold text-neutral-700">Límite</th>
                      <th className="pb-3 text-left font-semibold text-neutral-700">Nota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {DUTY_FREE_ITEMS.map((row) => (
                      <tr key={row.item}>
                        <td className="py-3 font-medium text-neutral-800">{row.item}</td>
                        <td className="py-3 text-neutral-600">{row.limit}</td>
                        <td className="py-3 text-neutral-500 text-xs">{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Exceso de equipaje */}
            <section className="rounded-2xl bg-white border border-neutral-200 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
                  <Scale className="h-5 w-5 text-orange-600" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900">
                  Exceso de equipaje y tarifas
                </h2>
              </div>
              <p className="text-neutral-600 leading-relaxed mb-4">
                El exceso de equipaje se cobra en dos niveles: primero por la aerolínea
                (por peso o pieza adicional) y luego por la aduana cubana si las misceláneas
                exceden el valor libre de impuesto.
              </p>
              <p className="text-neutral-600 leading-relaxed mb-4">
                Las aerolíneas comerciales cobran entre $35 y $80 USD por maleta extra,
                dependiendo de la ruta y temporada. Los charters cobran entre $1 y $3 USD
                por libra de exceso, lo que puede ser más económico si solo necesitas
                algunas libras adicionales.
              </p>
              <p className="text-neutral-600 leading-relaxed">
                La aduana cubana aplica aranceles progresivos sobre el valor de las misceláneas
                que exceden los $500 USD libres. Las tasas pueden alcanzar el 100% del valor
                declarado en los tramos más altos. Declarar correctamente en el formulario
                D&apos;Viajeros es esencial para evitar problemas y demoras.
              </p>
            </section>

            {/* Regulaciones estacionales */}
            <section className="rounded-2xl bg-white border border-neutral-200 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                  <CalendarDays className="h-5 w-5 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900">
                  Regulaciones estacionales
                </h2>
              </div>
              <p className="text-neutral-600 leading-relaxed mb-4">
                Las regulaciones aduaneras cubanas pueden variar durante ciertas temporadas.
                En diciembre y enero, cuando hay mayor volumen de viajeros (especialmente
                la diáspora cubana), la aduana puede aplicar controles más rigurosos.
              </p>
              <p className="text-neutral-600 leading-relaxed mb-4">
                Durante la temporada alta, los tiempos de espera en la aduana del aeropuerto
                José Martí (HAV) pueden superar las 2-3 horas. Se recomienda planificar
                conexiones con tiempo suficiente y declarar todo correctamente para agilizar
                el proceso.
              </p>
              <p className="text-neutral-600 leading-relaxed">
                Cuba también puede emitir regulaciones temporales que modifiquen los límites
                de importación. Es recomendable verificar las regulaciones vigentes con tu
                agencia de viajes antes de cada viaje.
              </p>
            </section>
          </div>
        </article>

        {/* ── CTA ── */}
        <section className="bg-gradient-to-r from-brand-50 to-brand-100 py-12">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-2xl font-bold text-neutral-900">
              Ya conoces las regulaciones, ahora busca tu vuelo
            </h2>
            <p className="mt-2 text-neutral-600 max-w-xl mx-auto">
              Compara precios de vuelos a Cuba y elige la aerolínea con el equipaje que necesitas.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={ROUTES.FLIGHTS_CUBA}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-3.5 text-lg font-semibold text-white shadow-lg hover:bg-brand-700 transition-colors"
              >
                <Plane className="h-5 w-5" /> Buscar vuelos a Cuba
              </Link>
              <Link
                href={ROUTES.GUIDE_REQUISITOS_CUBA}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-brand-700 border border-brand-200 shadow hover:bg-brand-50 transition-colors"
              >
                <BookOpen className="h-5 w-5" /> Requisitos para viajar
              </Link>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="bg-white py-12">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-6">
              Preguntas frecuentes sobre aduana y equipaje en Cuba
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
          <div className="mx-auto max-w-4xl px-6 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-neutral-900 mb-4">
                <BookOpen className="h-5 w-5 text-brand-500" /> Más guías
              </h3>
              <ul className="space-y-2">
                <li>
                  <Link href={ROUTES.GUIDE_REQUISITOS_CUBA} className="text-brand-600 hover:underline">
                    Requisitos para viajar a Cuba
                  </Link>
                </li>
                <li>
                  <Link href={ROUTES.GUIDE_EVISA_CUBA} className="text-brand-600 hover:underline">
                    Cómo tramitar la eVisa Cuba
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-neutral-900 mb-4">
                <Plane className="h-5 w-5 text-brand-500" /> Vuelos a Cuba
              </h3>
              <ul className="space-y-2">
                <li>
                  <Link href={ROUTES.FLIGHTS_CUBA} className="text-brand-600 hover:underline font-medium">
                    Ver todas las rutas a Cuba
                  </Link>
                </li>
                <li>
                  <Link href={ROUTES.FLIGHTS_CHARTER_CUBA} className="text-brand-600 hover:underline">
                    Vuelos charter (más equipaje)
                  </Link>
                </li>
                <li>
                  <Link href={ROUTES.FLIGHTS_MIAMI_HABANA} className="text-brand-600 hover:underline">
                    Miami → La Habana
                  </Link>
                </li>
              </ul>
            </div>
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
              </ul>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
