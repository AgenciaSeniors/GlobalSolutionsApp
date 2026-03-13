/**
 * @fileoverview SEO landing: Payment methods — ZERO OTA COMPETITION.
 * Target: "comprar vuelos con Zelle" (1K–3K/mo LOW),
 *         "agencia que acepte PIX" (500–1,500 VERY LOW),
 *         "comprar vuelos con SPEI" (500–1,500 VERY LOW)
 * @module app/(public)/metodos-de-pago/page
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, CheckCircle, Shield, Clock, Globe,
  Plane, Car, Banknote, CreditCard, Smartphone,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import JsonLd from '@/components/seo/JsonLd';
import { buildFAQSchema, buildHowToSchema } from '@/lib/seo/jsonld';
import { ROUTES } from '@/lib/constants/routes';

export const metadata: Metadata = {
  title: 'Métodos de Pago — Compra Vuelos con Zelle, PIX, SPEI y Square',
  description:
    'La única agencia de viajes donde puedes comprar vuelos y rentar autos con Zelle, PIX, SPEI y Square. Sin tarjeta de crédito. Pago seguro con confirmación inmediata.',
  alternates: { canonical: '/metodos-de-pago' },
  keywords: [
    'comprar vuelos con Zelle',
    'agencia de viajes con Zelle',
    'agencia que acepte PIX',
    'pagar vuelos con SPEI',
    'agencia de viajes con PIX',
    'vuelos sin tarjeta de crédito',
    'comprar vuelos con SPEI',
  ],
  openGraph: {
    title: 'Compra Vuelos con Zelle, PIX, SPEI y Square',
    description: 'La única agencia de viajes con métodos de pago alternativos para vuelos a Cuba y el mundo.',
    url: '/metodos-de-pago',
  },
};

const PAYMENT_METHODS = [
  {
    name: 'Zelle',
    icon: Smartphone,
    countries: 'Estados Unidos',
    description:
      'Transferencia bancaria instantánea entre cuentas de bancos estadounidenses. Sin comisiones. El método preferido por la diáspora cubana en EE.UU.',
    steps: [
      'Selecciona tu vuelo o auto y solicita la reserva',
      'Recibe las instrucciones de pago por WhatsApp',
      'Envía el pago por Zelle al correo indicado',
      'Recibe tu confirmación en 2-4 horas',
    ],
    ideal: 'Cubanos y latinos en EE.UU. que prefieren no usar tarjeta de crédito',
  },
  {
    name: 'PIX',
    icon: Banknote,
    countries: 'Brasil',
    description:
      'Sistema de pago instantáneo del Banco Central de Brasil. Disponible 24/7, sin comisiones. Ideal para la creciente comunidad cubana en Brasil.',
    steps: [
      'Selecciona tu vuelo y solicita reserva',
      'Recibe el código PIX por WhatsApp',
      'Escanea el QR o copia la clave PIX en tu app bancaria',
      'Pago confirmado en segundos, reserva procesada en 2-4 horas',
    ],
    ideal: 'Viajeros brasileños y cubanos residentes en Brasil (22,288 solicitudes de asilo en 2024)',
  },
  {
    name: 'SPEI',
    icon: Banknote,
    countries: 'México',
    description:
      'Sistema de Pagos Electrónicos Interbancarios de México. Transferencia electrónica segura entre cualquier banco mexicano.',
    steps: [
      'Selecciona tu vuelo y solicita reserva',
      'Recibe la CLABE interbancaria por WhatsApp',
      'Realiza la transferencia SPEI desde tu banca en línea',
      'Confirmación en 2-4 horas hábiles',
    ],
    ideal: 'Viajeros mexicanos que buscan vuelos a Cuba, Cancún y destinos internacionales',
  },
  {
    name: 'Square',
    icon: CreditCard,
    countries: 'Internacional',
    description:
      'Procesador de pagos con tarjeta de crédito/débito. Visa, Mastercard, American Express. Seguridad PCI DSS nivel 1.',
    steps: [
      'Selecciona tu vuelo y solicita reserva',
      'Recibe un enlace de pago seguro por WhatsApp o email',
      'Ingresa los datos de tu tarjeta en la pasarela Square',
      'Pago procesado inmediatamente, reserva confirmada en 2-4 horas',
    ],
    ideal: 'Viajeros internacionales que prefieren pagar con tarjeta de crédito o débito',
  },
];

const FAQS = [
  {
    question: '¿Puedo comprar vuelos a Cuba con Zelle?',
    answer:
      'Sí. Global Solutions Travel es la única agencia de viajes que acepta Zelle para comprar vuelos a Cuba. El proceso es simple: selecciona tu vuelo, solicita la reserva y envía el pago por Zelle. Confirmación en 2-4 horas.',
  },
  {
    question: '¿Es seguro pagar vuelos con PIX?',
    answer:
      'Sí. PIX es el sistema de pago oficial del Banco Central de Brasil. Es seguro, instantáneo y sin comisiones. Nosotros verificamos cada pago antes de procesar la reserva.',
  },
  {
    question: '¿Qué agencias de viajes aceptan SPEI?',
    answer:
      'Global Solutions Travel acepta SPEI para vuelos internacionales y renta de autos. Ninguna agencia de viajes online importante (Kayak, Expedia, Despegar) acepta SPEI como método de pago.',
  },
  {
    question: '¿Por qué no aceptan Stripe o PayPal?',
    answer:
      'Ofrecemos métodos de pago directos (Zelle, PIX, SPEI, Square) que eliminan intermediarios y reducen comisiones. Esto nos permite ofrecer mejores precios a nuestros clientes.',
  },
  {
    question: '¿Cuánto tiempo tarda la confirmación del pago?',
    answer:
      'Una vez recibido el pago, la confirmación de tu reserva se procesa en 2-4 horas. Un agente te contactará por WhatsApp con todos los detalles de tu vuelo o auto.',
  },
  {
    question: '¿Puedo pagar vuelos sin tarjeta de crédito?',
    answer:
      'Sí. Con Zelle, PIX y SPEI no necesitas tarjeta de crédito. Solo necesitas una cuenta bancaria en EE.UU. (Zelle), Brasil (PIX) o México (SPEI).',
  },
];

export default function MetodosDePagoPage() {
  const faqSchema = buildFAQSchema(FAQS);
  const howToSchema = buildHowToSchema({
    name: 'Cómo comprar vuelos con Zelle',
    description: 'Paso a paso para comprar vuelos a Cuba pagando con Zelle',
    steps: PAYMENT_METHODS[0].steps.map((text, i) => ({
      name: `Paso ${i + 1}`,
      text,
    })),
  });

  return (
    <>
      <JsonLd data={[faqSchema, howToSchema]} />
      <Navbar />
      <main className="pt-[72px]">
        {/* Hero */}
        <section className="bg-gradient-to-br from-green-600 to-emerald-800 text-white py-16">
          <div className="mx-auto max-w-6xl px-6">
            <Breadcrumbs
              items={[
                { name: 'Inicio', href: '/' },
                { name: 'Métodos de Pago', href: '/metodos-de-pago' },
              ]}
              className="!text-white/70 mb-6 [&_a]:!text-white/70 [&_a:hover]:!text-white [&_span.font-medium]:!text-white [&_svg]:!text-white/40"
            />
            <h1 className="text-4xl font-bold md:text-5xl">
              Compra Vuelos con Zelle, PIX, SPEI y Square
            </h1>
            <p className="mt-4 text-lg text-white/85 max-w-3xl leading-relaxed">
              Somos la única agencia de viajes que acepta estos métodos de pago.
              Sin tarjeta de crédito, sin intermediarios, con confirmación segura.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/20">
                <Shield className="h-5 w-5 text-white/70 mb-1" />
                <p className="text-xs text-white/60">Seguridad</p>
                <p className="text-lg font-bold">AES-256</p>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/20">
                <Clock className="h-5 w-5 text-white/70 mb-1" />
                <p className="text-xs text-white/60">Confirmación</p>
                <p className="text-lg font-bold">2-4 horas</p>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/20">
                <Globe className="h-5 w-5 text-white/70 mb-1" />
                <p className="text-xs text-white/60">Países</p>
                <p className="text-lg font-bold">USA, MX, BR+</p>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/20">
                <Banknote className="h-5 w-5 text-white/70 mb-1" />
                <p className="text-xs text-white/60">Comisiones</p>
                <p className="text-lg font-bold">$0</p>
              </div>
            </div>
          </div>
        </section>

        {/* Payment Methods */}
        <section className="bg-white py-12">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-8">
              Nuestros métodos de pago
            </h2>
            <div className="space-y-8">
              {PAYMENT_METHODS.map((method) => {
                const Icon = method.icon;
                return (
                  <div
                    key={method.name}
                    className="rounded-2xl border border-neutral-200 p-6 md:p-8"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                        <Icon className="h-6 w-6 text-brand-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-neutral-900">{method.name}</h3>
                        <p className="text-sm text-neutral-500">Disponible en: {method.countries}</p>
                      </div>
                    </div>
                    <p className="text-neutral-600 mb-4">{method.description}</p>
                    <p className="text-sm text-neutral-500 mb-4">
                      <strong>Ideal para:</strong> {method.ideal}
                    </p>

                    {/* Steps */}
                    <h4 className="font-semibold text-neutral-800 mb-3">Cómo funciona:</h4>
                    <ol className="space-y-2">
                      {method.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                            {i + 1}
                          </span>
                          <span className="text-neutral-600">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-brand-50 to-brand-100 py-12">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <h2 className="text-2xl font-bold text-neutral-900">
              ¿Listo para reservar?
            </h2>
            <p className="mt-2 text-neutral-600 max-w-xl mx-auto">
              Busca tu vuelo o auto, solicita la reserva y paga con el método que prefieras.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={ROUTES.FLIGHTS}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow hover:bg-brand-700 transition-colors"
              >
                <Plane className="h-5 w-5" /> Buscar vuelos
              </Link>
              <Link
                href={ROUTES.CARS}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-brand-700 border border-brand-200 shadow hover:bg-brand-50 transition-colors"
              >
                <Car className="h-5 w-5" /> Rentar auto en Cuba
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white py-12">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-6">
              Preguntas frecuentes sobre métodos de pago
            </h2>
            <div className="space-y-4">
              {FAQS.map((faq, i) => (
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
      </main>
      <Footer />
    </>
  );
}
