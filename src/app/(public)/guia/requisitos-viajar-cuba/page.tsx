/**
 * @fileoverview SEO PILLAR PAGE: Requisitos para viajar a Cuba 2026.
 * Target: "requisitos para viajar a Cuba" (40K-60K/mo) — THE BIGGEST KEYWORD
 * Comprehensive guide covering passport, visa, insurance, customs, currency.
 * @module app/(public)/guia/requisitos-viajar-cuba/page
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, CheckCircle, FileText, Shield, Clock,
  Plane, BookOpen, Car, CreditCard, AlertTriangle,
  Globe, Wallet, Stamp, ClipboardCheck, Stethoscope,
  Landmark, Banknote,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import JsonLd from '@/components/seo/JsonLd';
import { buildFAQSchema, buildArticleSchema } from '@/lib/seo/jsonld';
import { ROUTES } from '@/lib/constants/routes';

export const metadata: Metadata = {
  title: 'Requisitos para Viajar a Cuba en 2026 — Guía Completa Actualizada',
  description:
    'Guía completa y actualizada de los requisitos para viajar a Cuba en 2026. Pasaporte, visa, eVisa, seguro médico obligatorio, formulario D\'Viajeros, aduana y moneda. Todo lo que necesitas saber antes de viajar.',
  alternates: { canonical: '/guia/requisitos-viajar-cuba' },
  keywords: [
    'requisitos para viajar a Cuba',
    'requisitos Cuba 2026',
    'visa Cuba',
    'tarjeta de turista Cuba',
    'eVisa Cuba',
    'seguro médico Cuba',
    'pasaporte Cuba',
    'formulario D Viajeros Cuba',
    'qué necesito para viajar a Cuba',
    'documentos para viajar a Cuba',
  ],
  openGraph: {
    title: 'Requisitos para Viajar a Cuba en 2026 — Guía Completa',
    description:
      'Todo lo que necesitas para viajar a Cuba: pasaporte, visa, seguro, formulario D\'Viajeros y más. Actualizada marzo 2026.',
    url: '/guia/requisitos-viajar-cuba',
  },
};

/* ── Data ── */

const CHECKLIST = [
  { icon: FileText, text: 'Pasaporte vigente (mínimo 6 meses de validez)' },
  { icon: Stamp, text: 'Visa o tarjeta de turista (o eVisa desde julio 2025)' },
  { icon: Stethoscope, text: 'Seguro médico obligatorio con cobertura en Cuba' },
  { icon: ClipboardCheck, text: 'Formulario D\'Viajeros completado en línea' },
];

const FAQS = [
  {
    question: '¿Qué documentos necesito para viajar a Cuba?',
    answer:
      'Necesitas cuatro documentos principales: (1) pasaporte vigente con al menos 6 meses de validez, (2) visa o tarjeta de turista (o la nueva eVisa), (3) seguro médico obligatorio con cobertura en Cuba, y (4) el formulario D\'Viajeros completado en línea antes de tu viaje.',
  },
  {
    question: '¿Necesito visa para ir a Cuba?',
    answer:
      'Sí, la mayoría de viajeros necesitan una visa o tarjeta de turista. Los ciudadanos de países como México, Rusia y algunos del Caribe no necesitan visa para estancias turísticas cortas. Desde julio de 2025, Cuba ofrece el sistema eVisa que puedes tramitar completamente en línea.',
  },
  {
    question: '¿Cuánto cuesta la visa de Cuba?',
    answer:
      'La tarjeta de turista tradicional cuesta entre $50 y $100 USD dependiendo de dónde la adquieras. La eVisa (disponible desde julio 2025) tiene un costo oficial de $29 USD cuando se tramita directamente en el portal del gobierno cubano.',
  },
  {
    question: '¿Es obligatorio el seguro médico para Cuba?',
    answer:
      'Sí, desde mayo de 2010 Cuba exige un seguro médico obligatorio a todos los visitantes extranjeros. El seguro debe cubrir gastos médicos y hospitalización durante tu estancia en Cuba. Las autoridades de migración pueden solicitar el comprobante al llegar.',
  },
  {
    question: '¿Qué es el formulario D\'Viajeros?',
    answer:
      'El formulario D\'Viajeros es una declaración electrónica obligatoria que todo viajero debe completar antes de entrar o salir de Cuba. Se llena en el portal oficial dviajeros.mitrans.gob.cu e incluye datos personales, información del vuelo y declaración de aduana. Genera un código QR que debes presentar en migración.',
  },
  {
    question: '¿Cuánto tiempo puedo quedarme en Cuba como turista?',
    answer:
      'La tarjeta de turista permite una estancia de 30 días, con posibilidad de extensión por otros 30 días más tramitando la prórroga en oficinas de inmigración en Cuba. La eVisa también permite 30 días iniciales con opción de extensión.',
  },
  {
    question: '¿Qué moneda se usa en Cuba?',
    answer:
      'Cuba usa el Peso Cubano (CUP) como moneda oficial. Los turistas pueden pagar en MLC (Moneda Libremente Convertible) en tiendas designadas. Se recomienda llevar euros o dólares canadienses para cambiar. Los dólares estadounidenses tienen un recargo del 10% al cambiarlos en bancos cubanos.',
  },
  {
    question: '¿Puedo viajar a Cuba desde Estados Unidos?',
    answer:
      'Sí, los ciudadanos y residentes de EE.UU. pueden viajar a Cuba bajo las 12 categorías autorizadas por la OFAC, que incluyen visitas familiares, actividades religiosas, proyectos humanitarios y apoyo al pueblo cubano. El turismo genérico no está oficialmente permitido, pero la categoría "Support for the Cuban People" es ampliamente utilizada.',
  },
];

export default function RequisitosViajarCubaPage() {
  const faqSchema = buildFAQSchema(FAQS);
  const articleSchema = buildArticleSchema({
    title: 'Requisitos para Viajar a Cuba en 2026 — Guía Completa Actualizada',
    description:
      'Guía completa de los requisitos para viajar a Cuba: pasaporte, visa, eVisa, seguro médico, formulario D\'Viajeros, aduana y moneda.',
    path: ROUTES.GUIDE_REQUISITOS_CUBA,
    datePublished: '2026-03-13',
    dateModified: '2026-03-13',
  });

  return (
    <>
      <JsonLd data={[articleSchema, faqSchema]} />
      <Navbar />
      <main className="pt-[72px]">
        {/* ── Hero ── */}
        <section className="bg-gradient-to-br from-blue-700 to-blue-900 text-white py-16">
          <div className="mx-auto max-w-4xl px-6">
            <Breadcrumbs
              items={[
                { name: 'Inicio', href: '/' },
                { name: 'Guías', href: '/guia' },
                { name: 'Requisitos para Viajar a Cuba', href: ROUTES.GUIDE_REQUISITOS_CUBA },
              ]}
              className="!text-white/70 mb-6 [&_a]:!text-white/70 [&_a:hover]:!text-white [&_span.font-medium]:!text-white [&_svg]:!text-white/40"
            />
            <h1 className="text-4xl font-bold md:text-5xl">
              Requisitos para Viajar a Cuba en 2026
            </h1>
            <p className="mt-4 text-lg text-white/85 max-w-3xl leading-relaxed">
              Todo lo que necesitas saber antes de viajar a Cuba. Pasaporte, visa, seguro médico,
              formulario D&apos;Viajeros y más. Guía actualizada con las regulaciones vigentes.
            </p>
            <div className="mt-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-2 text-sm font-medium border border-white/20">
                <Clock className="h-4 w-4" /> Última actualización: marzo 2026
              </span>
            </div>
          </div>
        </section>

        {/* ── Quick Checklist ── */}
        <section className="bg-white py-10 border-b border-neutral-100">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-6">
              Checklist rápido: ¿Qué necesitas para viajar a Cuba?
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {CHECKLIST.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.text}
                    className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4"
                  >
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                    <span className="text-neutral-800 font-medium">{item.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Article Content ── */}
        <article className="bg-white py-12">
          <div className="mx-auto max-w-4xl px-6 space-y-12">

            {/* Pasaporte */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900">
                  1. Pasaporte vigente
                </h2>
              </div>
              <p className="text-neutral-600 leading-relaxed mb-4">
                Tu pasaporte debe tener al menos 6 meses de validez a partir de la fecha de entrada a Cuba.
                Esta es una exigencia estricta: si tu pasaporte vence dentro de los próximos 6 meses,
                las autoridades migratorias cubanas pueden negarte la entrada.
              </p>
              <p className="text-neutral-600 leading-relaxed mb-4">
                Para ciudadanos cubanos que viajan con pasaporte cubano, las reglas son diferentes:
                el pasaporte cubano debe estar vigente y habilitado para viaje. Los cubanos con doble
                nacionalidad deben salir y entrar a Cuba con su pasaporte cubano.
              </p>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <p className="flex items-start gap-2 text-amber-800 text-sm">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <span>
                    <strong>Importante:</strong> Verifica la validez de tu pasaporte antes de comprar tu vuelo.
                    La renovación puede tardar semanas dependiendo de tu país.
                  </span>
                </p>
              </div>
            </section>

            {/* Visa y tarjeta de turista */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
                  <Stamp className="h-5 w-5 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900">
                  2. Visa y tarjeta de turista
                </h2>
              </div>
              <p className="text-neutral-600 leading-relaxed mb-4">
                La tarjeta de turista (también conocida como visa de turista) es el documento más
                común para entrar a Cuba como visitante. Permite una estancia de 30 días con
                posibilidad de extender por 30 días adicionales una vez en Cuba.
              </p>
              <p className="text-neutral-600 leading-relaxed mb-4">
                Existen dos tipos de tarjeta de turista según tu origen: la tarjeta rosa (para
                viajeros que salen desde EE.UU.) y la tarjeta verde (para viajeros desde otros
                países). El costo varía entre $50 y $100 USD dependiendo de dónde la adquieras.
              </p>
              <p className="text-neutral-600 leading-relaxed">
                Puedes obtener la tarjeta de turista a través de tu aerolínea (algunas la venden
                en el mostrador de check-in), en consulados cubanos, agencias de viaje autorizadas,
                o en línea. Desde julio de 2025 también puedes tramitar la eVisa digital.
              </p>
            </section>

            {/* eVisa */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
                  <Globe className="h-5 w-5 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900">
                  3. Nuevo sistema eVisa (julio 2025)
                </h2>
              </div>
              <p className="text-neutral-600 leading-relaxed mb-4">
                Desde julio de 2025, Cuba implementó un sistema de visa electrónica (eVisa) que
                permite tramitar el permiso de entrada completamente en línea. Este sistema
                reemplaza gradualmente la tarjeta de turista en papel para muchos viajeros.
              </p>
              <p className="text-neutral-600 leading-relaxed mb-4">
                La eVisa se solicita a través del portal oficial del gobierno cubano, tiene un
                costo de $29 USD y se procesa en 72 horas hábiles. Al aprobarse, recibes un
                documento digital que puedes presentar impreso o en tu celular al llegar a Cuba.
              </p>
              <div className="rounded-xl bg-brand-50 border border-brand-200 p-4">
                <p className="flex items-start gap-2 text-brand-800 text-sm">
                  <BookOpen className="h-5 w-5 shrink-0 mt-0.5" />
                  <span>
                    <strong>Guía paso a paso:</strong>{' '}
                    <Link href={ROUTES.GUIDE_EVISA_CUBA} className="text-brand-600 underline hover:text-brand-700">
                      Cómo tramitar la eVisa Cuba paso a paso
                    </Link>
                  </span>
                </p>
              </div>
            </section>

            {/* Seguro médico */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                  <Stethoscope className="h-5 w-5 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900">
                  4. Seguro médico obligatorio
                </h2>
              </div>
              <p className="text-neutral-600 leading-relaxed mb-4">
                Cuba exige un seguro médico de viaje obligatorio a todos los visitantes extranjeros
                desde mayo de 2010. El seguro debe incluir cobertura médica y hospitalización
                durante toda tu estancia en el país.
              </p>
              <p className="text-neutral-600 leading-relaxed mb-4">
                Las autoridades migratorias pueden solicitar tu póliza de seguro al llegar al
                aeropuerto. Si no cuentas con un seguro válido, deberás adquirir uno de la
                aseguradora estatal cubana Asistur en el aeropuerto antes de pasar por migración,
                lo cual puede resultar más costoso.
              </p>
              <p className="text-neutral-600 leading-relaxed">
                Asegúrate de que tu póliza sea emitida por una compañía reconocida en Cuba.
                Algunas aseguradoras estadounidenses no tienen convenio con Cuba, por lo que
                es recomendable verificar antes de viajar.
              </p>
            </section>

            {/* Formulario D'Viajeros */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
                  <ClipboardCheck className="h-5 w-5 text-orange-600" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900">
                  5. Formulario D&apos;Viajeros
                </h2>
              </div>
              <p className="text-neutral-600 leading-relaxed mb-4">
                El formulario D&apos;Viajeros es una declaración electrónica obligatoria que
                sustituye los formularios de papel que antes se llenaban en el avión. Debe
                completarse en línea antes de llegar a Cuba a través del portal oficial
                dviajeros.mitrans.gob.cu.
              </p>
              <p className="text-neutral-600 leading-relaxed mb-4">
                El formulario incluye tu información personal, datos del vuelo, dirección de
                hospedaje en Cuba y declaración de aduana (artículos que llevas, moneda en
                efectivo, etc.). Al completarlo, genera un código QR que debes presentar
                impreso o en pantalla ante las autoridades de migración y aduana.
              </p>
              <p className="text-neutral-600 leading-relaxed">
                Recomendamos completar el formulario al menos 72 horas antes de tu vuelo para
                evitar problemas de última hora con el portal.
              </p>
            </section>

            {/* Aduana y equipaje */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50">
                  <Shield className="h-5 w-5 text-teal-600" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900">
                  6. Aduana y equipaje
                </h2>
              </div>
              <p className="text-neutral-600 leading-relaxed mb-4">
                Las regulaciones aduaneras cubanas permiten importar artículos personales y
                misceláneas con límites específicos. El equipaje permitido varía según la
                aerolínea: las comerciales permiten 23 kg y los charters hasta 64 lbs (29 kg).
              </p>
              <p className="text-neutral-600 leading-relaxed mb-4">
                Los artículos importados como misceláneas tienen un valor libre de impuesto
                limitado. Todo lo que exceda ese valor se grava con tasas aduaneras que
                pueden ser significativas. Es importante conocer las regulaciones antes
                de empacar.
              </p>
              <div className="rounded-xl bg-brand-50 border border-brand-200 p-4">
                <p className="flex items-start gap-2 text-brand-800 text-sm">
                  <BookOpen className="h-5 w-5 shrink-0 mt-0.5" />
                  <span>
                    <strong>Guía detallada:</strong>{' '}
                    <Link href={ROUTES.GUIDE_ADUANA_CUBA} className="text-brand-600 underline hover:text-brand-700">
                      Aduana Cuba — Equipaje permitido y regulaciones 2026
                    </Link>
                  </span>
                </p>
              </div>
            </section>

            {/* Moneda y dinero */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-50">
                  <Banknote className="h-5 w-5 text-yellow-600" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900">
                  7. Moneda y dinero en Cuba
                </h2>
              </div>
              <p className="text-neutral-600 leading-relaxed mb-4">
                La moneda oficial de Cuba es el Peso Cubano (CUP). Desde la unificación
                monetaria de 2021, ya no existe el CUC (peso convertible). Los turistas
                pueden cambiar divisas en las CADECA (casas de cambio) y bancos cubanos.
              </p>
              <p className="text-neutral-600 leading-relaxed mb-4">
                Las divisas más recomendadas para llevar a Cuba son euros, dólares canadienses
                o libras esterlinas. Los dólares estadounidenses tienen un recargo del 10% al
                cambiarlos en instituciones bancarias cubanas, lo que los hace menos convenientes.
              </p>
              <p className="text-neutral-600 leading-relaxed">
                Para compras en tiendas MLC (Moneda Libremente Convertible), necesitas una
                tarjeta bancaria internacional vinculada a una cuenta en divisas. Las tarjetas
                emitidas por bancos estadounidenses generalmente no funcionan en Cuba debido
                a las sanciones. Tarjetas de bancos europeos, canadienses o latinoamericanos
                suelen funcionar sin problemas.
              </p>
            </section>
          </div>
        </article>

        {/* ── CTA ── */}
        <section className="bg-gradient-to-r from-brand-50 to-brand-100 py-12">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-2xl font-bold text-neutral-900">
              Ya tienes tus requisitos, ahora busca tu vuelo
            </h2>
            <p className="mt-2 text-neutral-600 max-w-xl mx-auto">
              Compara precios de vuelos a Cuba desde todas las ciudades. Más de 60 aerolíneas,
              charters y comerciales. Paga con Zelle, PIX o SPEI.
            </p>
            <Link
              href={ROUTES.FLIGHTS_CUBA}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-3.5 text-lg font-semibold text-white shadow-lg hover:bg-brand-700 transition-colors"
            >
              <Plane className="h-5 w-5" /> Buscar vuelos a Cuba
            </Link>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="bg-white py-12">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-6">
              Preguntas frecuentes sobre los requisitos para viajar a Cuba
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
                  <Link href={ROUTES.GUIDE_ADUANA_CUBA} className="text-brand-600 hover:underline">
                    Aduana y equipaje Cuba 2026
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
                  <Link href={ROUTES.FLIGHTS_MIAMI_HABANA} className="text-brand-600 hover:underline">
                    Miami → La Habana
                  </Link>
                </li>
                <li>
                  <Link href={ROUTES.FLIGHTS_CHARTER_CUBA} className="text-brand-600 hover:underline">
                    Vuelos charter a Cuba
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
