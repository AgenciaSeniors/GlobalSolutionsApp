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
                Global Solutions Travel (en adelante &quot;GST&quot;) es una agencia de viajes digital
                que opera como intermediaria entre el cliente y las aerolíneas y otros proveedores
                de servicios turísticos. Al utilizar nuestra plataforma, usted acepta estos términos
                en su totalidad.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">2. Reservas y Pagos</h2>
              <p>
                Las reservas están sujetas a disponibilidad confirmada por la aerolínea o el proveedor final. 
                El pago en nuestra plataforma no garantiza automáticamente la emisión del boleto o voucher; 
                GST se compromete a emitir la confirmación final en un plazo máximo de 24 horas tras la 
                verificación del pago.
              </p>
              <p>
                Los precios mostrados incluyen el costo base del proveedor y el margen de servicio de GST. 
                Las comisiones de pasarelas de pago se desglosan antes de confirmar la compra.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">3. Políticas de Aerolíneas (Vuelos)</h2>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>
                  <strong>Tarifas y Cambios:</strong> Las políticas de equipaje, selección de asientos, cambios de fecha y cancelaciones están regidas estrictamente por las reglas tarifarias de cada aerolínea. GST aplicará un cargo administrativo por la gestión de cualquier cambio permitido.
                </li>
                <li>
                  <strong>Cancelaciones por la Aerolínea:</strong> GST no se hace responsable de reprogramaciones, demoras o cancelaciones de vuelos por causas climáticas, operativas o de fuerza mayor. Gestionaremos el reembolso o reubicación según lo que dicte la aerolínea.
                </li>
                <li>
                  <strong>No-Show (No presentación):</strong> Si el pasajero no se presenta al vuelo a tiempo, la aerolínea puede cancelar el resto del itinerario sin derecho a reembolso.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">4. Documentación del Viajero</h2>
              <p>
                Es responsabilidad exclusiva del cliente contar con pasaporte vigente (mínimo 6 meses de validez), visado correspondiente, tarjeta de turista, seguro médico y cualquier otro documento exigido por las autoridades migratorias o el proveedor de servicios. GST no asume responsabilidad ni emitirá reembolsos si se deniega el embarque o el servicio por documentación deficiente.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">5. Protección de Datos</h2>
              <p>
                Global Solutions Travel cumple con estrictos estándares de protección de datos personales. Documentos sensibles como números de pasaporte se almacenan encriptados (AES-256). Los datos de tarjetas de crédito no se almacenan en nuestros servidores; son procesados de forma segura mediante Stripe, pasarela certificada PCI-DSS.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">6. Ofertas y Programa de Fidelidad</h2>
              <p>
                Las promociones están sujetas a disponibilidad, vigencia y cupos limitados. Los puntos de fidelidad acumulados por compras y reseñas no tienen valor comercial en efectivo, son intransferibles y solo pueden canjearse dentro del ecosistema de GST bajo las condiciones vigentes del programa.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">7. Limitación de Responsabilidad</h2>
              <p>
                GST actúa exclusivamente en calidad de intermediario (agente de reservas). La responsabilidad legal por la ejecución del servicio de transporte aéreo recae de manera total y exclusiva en el proveedor final (aerolínea u operador turístico correspondiente).
              </p>
            </section>

            <p className="text-neutral-400 text-xs mt-8 border-t border-neutral-100 pt-4">
              Última actualización: Marzo 2026
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}