/**
 * @fileoverview SEO FIRST MOVER: eVisa Cuba — Cómo Tramitarla Paso a Paso.
 * Target: "eVisa Cuba como tramitar" — FIRST MOVER content.
 * Most content online is outdated since the eVisa system launched July 2025.
 * @module app/(public)/guia/evisa-cuba-como-tramitar/page
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, CheckCircle, AlertTriangle, Plane, BookOpen,
  Car, Clock, Globe, FileText, CreditCard, Monitor,
  CircleDot, HelpCircle, Stamp, Shield,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import JsonLd from '@/components/seo/JsonLd';
import { buildFAQSchema, buildArticleSchema, buildHowToSchema } from '@/lib/seo/jsonld';
import { ROUTES } from '@/lib/constants/routes';

export const metadata: Metadata = {
  title: 'eVisa Cuba — Cómo Tramitarla Paso a Paso en 2026',
  description:
    'Guía paso a paso para tramitar la eVisa de Cuba en 2026. Requisitos, costo ($29 USD), tiempo de procesamiento, errores comunes y diferencias con la tarjeta de turista. Sistema actualizado julio 2025.',
  alternates: { canonical: '/guia/evisa-cuba-como-tramitar' },
  keywords: [
    'eVisa Cuba',
    'eVisa Cuba como tramitar',
    'visa electrónica Cuba',
    'eVisa Cuba 2026',
    'eVisa Cuba paso a paso',
    'visa Cuba online',
    'tarjeta de turista Cuba vs eVisa',
    'costo eVisa Cuba',
    'requisitos eVisa Cuba',
    'visa digital Cuba',
  ],
  openGraph: {
    title: 'eVisa Cuba — Cómo Tramitarla Paso a Paso en 2026',
    description:
      'Tramita la eVisa de Cuba en línea. Guía paso a paso, requisitos, costo y errores comunes. Sistema actualizado julio 2025.',
    url: '/guia/evisa-cuba-como-tramitar',
  },
};

/* ── Data ── */

const STEPS = [
  {
    title: 'Accede al portal oficial de eVisa',
    description:
      'Ingresa al portal oficial del gobierno cubano para solicitudes de eVisa. Asegúrate de usar únicamente el sitio oficial para evitar fraudes. El portal está disponible en español, inglés y francés.',
  },
  {
    title: 'Crea una cuenta o inicia sesión',
    description:
      'Regístrate con tu correo electrónico y crea una contraseña segura. Si ya tienes una cuenta de una solicitud anterior, puedes iniciar sesión directamente. Recibirás un correo de verificación que debes confirmar.',
  },
  {
    title: 'Completa el formulario de solicitud',
    description:
      'Llena el formulario con tus datos personales (nombre completo tal como aparece en el pasaporte, fecha de nacimiento, nacionalidad), datos del pasaporte (número, fecha de emisión y vencimiento), información del viaje (fechas, vuelo, dirección de hospedaje en Cuba) y datos de contacto.',
  },
  {
    title: 'Sube los documentos requeridos',
    description:
      'Sube una foto digital de la página de datos de tu pasaporte (clara y legible), una foto tipo pasaporte reciente (fondo blanco, cara descubierta) y comprobante de seguro médico con cobertura en Cuba. Los archivos deben estar en formato JPG o PNG, máximo 2 MB cada uno.',
  },
  {
    title: 'Realiza el pago de $29 USD',
    description:
      'Paga la tarifa de procesamiento de $29 USD con tarjeta de crédito o débito internacional (Visa, Mastercard). El sistema genera un recibo de pago que debes guardar. El pago es no reembolsable una vez procesada la solicitud.',
  },
  {
    title: 'Recibe tu eVisa aprobada',
    description:
      'El tiempo de procesamiento es de 72 horas hábiles. Recibirás un correo electrónico con tu eVisa aprobada en formato PDF. Puedes presentarla impresa o en tu celular al llegar a Cuba. La eVisa tiene validez de 30 días desde la fecha de entrada.',
  },
];

const HOWTO_STEPS = STEPS.map((step) => ({
  name: step.title,
  text: step.description,
}));

const VISA_COMPARISON = [
  { feature: 'Formato', evisa: 'Digital (PDF)', tarjeta: 'Papel físico' },
  { feature: 'Costo', evisa: '$29 USD', tarjeta: '$50-$100 USD' },
  { feature: 'Trámite', evisa: 'En línea', tarjeta: 'Presencial o correo' },
  { feature: 'Tiempo', evisa: '72 horas hábiles', tarjeta: '1-15 días' },
  { feature: 'Validez', evisa: '30 días', tarjeta: '30 días' },
  { feature: 'Extensión', evisa: 'Sí, 30 días más', tarjeta: 'Sí, 30 días más' },
  { feature: 'Disponible desde', evisa: 'Julio 2025', tarjeta: 'Siempre' },
];

const COMMON_ERRORS = [
  {
    error: 'Nombre no coincide con el pasaporte',
    solution: 'Escribe tu nombre exactamente como aparece en tu pasaporte, incluyendo segundos nombres y apellidos.',
  },
  {
    error: 'Foto del pasaporte borrosa',
    solution: 'Toma la foto con buena iluminación, sin reflejos. Asegúrate de que todos los datos sean legibles.',
  },
  {
    error: 'Pago rechazado',
    solution: 'Verifica que tu tarjeta permita transacciones internacionales. Algunas tarjetas estadounidenses pueden ser bloqueadas.',
  },
  {
    error: 'Correo de verificación no llega',
    solution: 'Revisa tu carpeta de spam. Si no aparece en 15 minutos, solicita reenvío desde el portal.',
  },
  {
    error: 'Pasaporte vence en menos de 6 meses',
    solution: 'El sistema rechaza pasaportes con menos de 6 meses de vigencia. Renueva tu pasaporte antes de solicitar la eVisa.',
  },
];

const FAQS = [
  {
    question: '¿Qué es la eVisa de Cuba?',
    answer:
      'La eVisa de Cuba es una visa electrónica lanzada en julio de 2025 que reemplaza gradualmente la tarjeta de turista en papel. Se tramita completamente en línea, cuesta $29 USD y se procesa en 72 horas hábiles. Permite una estancia de 30 días con posibilidad de extensión.',
  },
  {
    question: '¿Quién necesita la eVisa para Cuba?',
    answer:
      'La mayoría de viajeros internacionales necesitan la eVisa o la tarjeta de turista para entrar a Cuba. Ciudadanos de algunos países como México, Rusia y varias naciones del Caribe están exentos para estancias turísticas cortas. Ciudadanos cubanos con pasaporte cubano vigente no necesitan visa.',
  },
  {
    question: '¿Cuánto cuesta la eVisa de Cuba?',
    answer:
      'La eVisa de Cuba tiene un costo oficial de $29 USD, significativamente más económica que la tarjeta de turista tradicional que cuesta entre $50 y $100 USD. El pago se realiza con tarjeta de crédito o débito internacional al momento de la solicitud.',
  },
  {
    question: '¿Cuánto tarda en procesarse la eVisa?',
    answer:
      'El procesamiento estándar de la eVisa es de 72 horas hábiles (3 días laborales). En temporada alta (diciembre-enero) puede tomar hasta 5 días hábiles. Se recomienda solicitarla al menos 2 semanas antes del viaje para tener margen.',
  },
  {
    question: '¿Puedo usar la eVisa en lugar de la tarjeta de turista?',
    answer:
      'Sí. La eVisa es completamente válida como documento de entrada a Cuba y es aceptada en todos los puntos migratorios. Puedes presentarla impresa o en formato digital en tu celular. Ambos documentos (eVisa y tarjeta de turista) siguen siendo válidos simultáneamente.',
  },
];

export default function EvisaCubaPage() {
  const faqSchema = buildFAQSchema(FAQS);
  const articleSchema = buildArticleSchema({
    title: 'eVisa Cuba — Cómo Tramitarla Paso a Paso en 2026',
    description:
      'Guía paso a paso para tramitar la eVisa de Cuba. Requisitos, costo, tiempo y errores comunes.',
    path: ROUTES.GUIDE_EVISA_CUBA,
    datePublished: '2026-03-13',
    dateModified: '2026-03-13',
  });
  const howToSchema = buildHowToSchema({
    name: 'Cómo tramitar la eVisa de Cuba',
    description:
      'Guía paso a paso para solicitar la visa electrónica (eVisa) de Cuba en línea. Costo: $29 USD. Procesamiento: 72 horas.',
    steps: HOWTO_STEPS,
  });

  return (
    <>
      <JsonLd data={[articleSchema, howToSchema, faqSchema]} />
      <Navbar />
      <main className="pt-[72px]">
        {/* ── Hero ── */}
        <section className="bg-gradient-to-br from-indigo-700 to-indigo-900 text-white py-16">
          <div className="mx-auto max-w-4xl px-6">
            <Breadcrumbs
              items={[
                { name: 'Inicio', href: '/' },
                { name: 'Guías', href: '/guia' },
                { name: 'eVisa Cuba', href: ROUTES.GUIDE_EVISA_CUBA },
              ]}
              className="!text-white/70 mb-6 [&_a]:!text-white/70 [&_a:hover]:!text-white [&_span.font-medium]:!text-white [&_svg]:!text-white/40"
            />
            <h1 className="text-4xl font-bold md:text-5xl">
              eVisa Cuba: Cómo Tramitarla Paso a Paso
            </h1>
            <p className="mt-4 text-lg text-white/85 max-w-3xl leading-relaxed">
              Guía completa para solicitar la nueva visa electrónica de Cuba. Desde julio de 2025,
              puedes tramitar tu visa completamente en línea por solo $29 USD.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-2 text-sm font-medium border border-white/20">
                <Globe className="h-4 w-4" /> Sistema actualizado julio 2025
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-2 text-sm font-medium border border-white/20">
                <Clock className="h-4 w-4" /> Última actualización: marzo 2026
              </span>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/20 text-center">
                <p className="text-xs text-white/60">Costo</p>
                <p className="text-xl font-bold">$29 USD</p>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/20 text-center">
                <p className="text-xs text-white/60">Procesamiento</p>
                <p className="text-xl font-bold">72 horas</p>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/20 text-center">
                <p className="text-xs text-white/60">Validez</p>
                <p className="text-xl font-bold">30 días</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── What is eVisa ── */}
        <section className="bg-white py-12 border-b border-neutral-100">
          <div className="mx-auto max-w-4xl px-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                <Globe className="h-5 w-5 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-neutral-900">
                ¿Qué es la eVisa de Cuba?
              </h2>
            </div>
            <p className="text-neutral-600 leading-relaxed mb-4">
              La eVisa de Cuba es un sistema de visa electrónica implementado por el gobierno
              cubano en julio de 2025 para modernizar y simplificar el proceso de entrada al
              país. Reemplaza gradualmente la tarjeta de turista tradicional en papel que los
              viajeros debían obtener presencialmente o por correo.
            </p>
            <p className="text-neutral-600 leading-relaxed">
              Con la eVisa, todo el proceso se realiza en línea: solicitud, pago y recepción
              del documento. Al ser aprobada, recibes un PDF digital que puedes presentar
              impreso o en tu celular al llegar a Cuba. Es más económica ($29 USD vs $50-$100
              de la tarjeta tradicional) y más rápida de obtener.
            </p>
          </div>
        </section>

        {/* ── Who needs eVisa ── */}
        <section className="bg-neutral-50 py-12">
          <div className="mx-auto max-w-4xl px-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
                <HelpCircle className="h-5 w-5 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-neutral-900">
                ¿Quién necesita la eVisa?
              </h2>
            </div>
            <p className="text-neutral-600 leading-relaxed mb-4">
              La mayoría de turistas internacionales necesitan la eVisa (o la tarjeta de turista)
              para visitar Cuba. Sin embargo, existen excepciones para ciudadanos de ciertos países
              que tienen acuerdos de exención de visa con Cuba.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-6">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <h3 className="font-bold text-neutral-900 mb-2">Necesitan eVisa / tarjeta de turista</h3>
                <ul className="space-y-1.5 text-sm text-neutral-700">
                  <li className="flex items-start gap-2">
                    <CircleDot className="h-4 w-4 text-red-500 mt-0.5 shrink-0" /> Ciudadanos de Estados Unidos
                  </li>
                  <li className="flex items-start gap-2">
                    <CircleDot className="h-4 w-4 text-red-500 mt-0.5 shrink-0" /> Ciudadanos de la Unión Europea
                  </li>
                  <li className="flex items-start gap-2">
                    <CircleDot className="h-4 w-4 text-red-500 mt-0.5 shrink-0" /> Ciudadanos de Canadá
                  </li>
                  <li className="flex items-start gap-2">
                    <CircleDot className="h-4 w-4 text-red-500 mt-0.5 shrink-0" /> Ciudadanos de Brasil
                  </li>
                  <li className="flex items-start gap-2">
                    <CircleDot className="h-4 w-4 text-red-500 mt-0.5 shrink-0" /> Ciudadanos de Colombia
                  </li>
                  <li className="flex items-start gap-2">
                    <CircleDot className="h-4 w-4 text-red-500 mt-0.5 shrink-0" /> La mayoría de países del mundo
                  </li>
                </ul>
              </div>
              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <h3 className="font-bold text-neutral-900 mb-2">Exentos de visa (turismo corto)</h3>
                <ul className="space-y-1.5 text-sm text-neutral-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Ciudadanos de México
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Ciudadanos de Rusia
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Ciudadanos de Serbia
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Ciudadanos de Montenegro
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Varios países del Caribe (CARICOM)
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Cubanos con pasaporte cubano vigente
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Step-by-Step Guide ── */}
        <section className="bg-white py-12">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-8">
              Cómo tramitar la eVisa: paso a paso
            </h2>
            <div className="space-y-6">
              {STEPS.map((step, i) => (
                <div
                  key={i}
                  className="flex gap-4 md:gap-6"
                >
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white font-bold text-lg">
                      {i + 1}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="w-0.5 flex-1 bg-brand-200 mt-2" />
                    )}
                  </div>
                  <div className="pb-6">
                    <h3 className="text-lg font-bold text-neutral-900">{step.title}</h3>
                    <p className="mt-2 text-neutral-600 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Cost and Processing ── */}
        <section className="bg-neutral-50 py-12">
          <div className="mx-auto max-w-4xl px-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
                <CreditCard className="h-5 w-5 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-neutral-900">
                Costo y tiempo de procesamiento
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mt-6">
              <div className="rounded-2xl bg-white border border-neutral-200 p-6 text-center">
                <CreditCard className="h-8 w-8 text-green-600 mx-auto mb-3" />
                <p className="text-sm text-neutral-500">Costo oficial</p>
                <p className="text-3xl font-bold text-neutral-900">$29 USD</p>
                <p className="text-xs text-neutral-500 mt-1">Pago con tarjeta internacional</p>
              </div>
              <div className="rounded-2xl bg-white border border-neutral-200 p-6 text-center">
                <Clock className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                <p className="text-sm text-neutral-500">Procesamiento</p>
                <p className="text-3xl font-bold text-neutral-900">72 hrs</p>
                <p className="text-xs text-neutral-500 mt-1">Días hábiles (hasta 5 en temporada alta)</p>
              </div>
              <div className="rounded-2xl bg-white border border-neutral-200 p-6 text-center">
                <Shield className="h-8 w-8 text-purple-600 mx-auto mb-3" />
                <p className="text-sm text-neutral-500">Validez</p>
                <p className="text-3xl font-bold text-neutral-900">30 días</p>
                <p className="text-xs text-neutral-500 mt-1">Extensible por 30 días más en Cuba</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Common Errors ── */}
        <section className="bg-white py-12">
          <div className="mx-auto max-w-4xl px-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <h2 className="text-2xl font-bold text-neutral-900">
                Errores comunes al tramitar la eVisa
              </h2>
            </div>
            <p className="text-neutral-600 leading-relaxed mb-6">
              Estos son los errores más frecuentes que causan rechazo o demora en la solicitud
              de la eVisa. Evítalos para que tu trámite sea rápido y sin complicaciones.
            </p>
            <div className="space-y-4">
              {COMMON_ERRORS.map((item) => (
                <div
                  key={item.error}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 md:p-5"
                >
                  <p className="font-semibold text-neutral-900 flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
                    {item.error}
                  </p>
                  <p className="mt-2 text-neutral-600 text-sm ml-7">
                    <strong className="text-green-700">Solución:</strong> {item.solution}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── eVisa vs Tarjeta de Turista ── */}
        <section className="bg-neutral-50 py-12">
          <div className="mx-auto max-w-4xl px-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <Stamp className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-neutral-900">
                eVisa vs tarjeta de turista: ¿Cuál elegir?
              </h2>
            </div>
            <p className="text-neutral-600 leading-relaxed mb-6">
              Ambos documentos son válidos para entrar a Cuba como turista. Aquí te ayudamos
              a decidir cuál te conviene más según tu situación.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full bg-white rounded-xl border border-neutral-200 overflow-hidden text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-neutral-700">Característica</th>
                    <th className="px-4 py-3 text-left font-semibold text-indigo-700">eVisa</th>
                    <th className="px-4 py-3 text-left font-semibold text-neutral-700">Tarjeta de turista</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {VISA_COMPARISON.map((row) => (
                    <tr key={row.feature} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-800">{row.feature}</td>
                      <td className="px-4 py-3 text-indigo-700 font-medium">{row.evisa}</td>
                      <td className="px-4 py-3 text-neutral-600">{row.tarjeta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-neutral-600 text-sm">
              <strong>Nuestra recomendación:</strong> Si tienes acceso a una tarjeta de crédito
              internacional, la eVisa es más económica y conveniente. Si prefieres un documento
              físico o tu tarjeta no funciona en el portal, la tarjeta de turista sigue siendo
              una opción válida.
            </p>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="bg-gradient-to-r from-brand-50 to-brand-100 py-12">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-2xl font-bold text-neutral-900">
              Ya tienes tu visa, busca tu vuelo
            </h2>
            <p className="mt-2 text-neutral-600 max-w-xl mx-auto">
              Con tu eVisa lista, el siguiente paso es encontrar el mejor vuelo a Cuba.
              Compara precios de 60+ aerolíneas y paga con Zelle, PIX o SPEI.
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
              Preguntas frecuentes sobre la eVisa de Cuba
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
                  <Link href={ROUTES.GUIDE_ADUANA_CUBA} className="text-brand-600 hover:underline">
                    Aduana y equipaje Cuba
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
