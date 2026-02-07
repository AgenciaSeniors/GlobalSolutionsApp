/**
 * @fileoverview Legal — Terms & Conditions page.
 * Per spec §7.3: "Visible sections for trust generation."
 * @module app/(public)/legal/terms/page
 */
import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Términos y Condiciones — Global Solutions Travel',
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white pt-[72px]">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="font-display text-3xl font-bold text-brand-950 mb-8">
            Términos y Condiciones
          </h1>

          <div className="prose prose-neutral max-w-none space-y-6 text-sm leading-relaxed text-neutral-700">
            <section>
              <h2 className="text-lg font-bold text-brand-900">1. Generalidades</h2>
              <p>
                Global Solutions Travel (en adelante "GST") es una agencia de viajes digital
                que opera como intermediaria entre el cliente y las aerolíneas, proveedores de
                renta de autos y servicios turísticos. Al utilizar nuestra plataforma, usted
                acepta estos términos en su totalidad.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">2. Reservas y Pagos</h2>
              <p>
                Las reservas están sujetas a disponibilidad confirmada por la aerolínea o
                proveedor. El pago no garantiza automáticamente la emisión del boleto; GST
                se compromete a emitir en un plazo máximo de 24 horas tras confirmar el pago.
              </p>
              <p>
                Los precios mostrados incluyen: costo base del proveedor + margen de servicio
                de GST. La comisión de la pasarela de pago (Stripe, PayPal) se calcula y muestra
                por separado antes de confirmar la compra.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">3. Cancelaciones y Reembolsos</h2>
              <p>
                Las políticas de cancelación dependen de cada aerolínea y tarifa contratada.
                GST no se hace responsable de cambios en horarios o cancelaciones por parte
                de las aerolíneas. Se aplicará un cargo administrativo por gestión de cancelación.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">4. Documentación del Viajero</h2>
              <p>
                Es responsabilidad exclusiva del viajero contar con pasaporte vigente, visa
                correspondiente y toda documentación requerida por el país de destino. GST
                no se responsabiliza por denegación de embarque por documentación faltante.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">5. Protección de Datos</h2>
              <p>
                GST cumple con estándares de protección de datos personales. Los números de
                pasaporte se almacenan encriptados (AES-256). Los datos de tarjetas de crédito
                nunca se almacenan en nuestros servidores; son procesados directamente por
                Stripe/PayPal conforme a PCI-DSS.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">6. Ofertas y Promociones</h2>
              <p>
                Las ofertas exclusivas están sujetas a disponibilidad y fechas específicas.
                GST se reserva el derecho de modificar o cancelar ofertas sin previo aviso.
                Los precios de oferta aplican únicamente para las fechas indicadas en el
                calendario de la oferta.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">7. Programa de Fidelidad</h2>
              <p>
                Los puntos de fidelidad se acumulan por compras completadas y reseñas verificadas.
                Los puntos no tienen valor monetario y solo pueden canjearse por beneficios
                dentro de la plataforma GST. GST se reserva el derecho de modificar el programa.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">8. Limitación de Responsabilidad</h2>
              <p>
                GST actúa como intermediario. La responsabilidad del servicio de transporte
                recae en la aerolínea operadora. GST no será responsable por retrasos,
                cancelaciones o cambios en los servicios de terceros.
              </p>
            </section>

            <p className="text-neutral-400 text-xs mt-8">
              Última actualización: Febrero 2026
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
