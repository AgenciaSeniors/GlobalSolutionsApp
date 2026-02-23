/**
 * @fileoverview Legal — Privacy Policy page.
 * Per spec §7.3: "Visible sections for trust generation."
 * @module app/(public)/legal/privacy/page
 */
import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Política de Privacidad — Global Solutions Travel',
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white pt-[72px]">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="font-display text-3xl font-bold text-brand-950 mb-8">
            Política de Privacidad
          </h1>

          <div className="prose prose-neutral max-w-none space-y-6 text-sm leading-relaxed text-neutral-700">

            <section>
              <h2 className="text-lg font-bold text-brand-900">1. Responsable del Tratamiento</h2>
              <p>
                Global Solutions Travel (en adelante &quot;GST&quot;) es el responsable del tratamiento
                de los datos personales recopilados a través de esta plataforma digital. Para cualquier
                consulta relacionada con el uso de sus datos, puede contactarnos a través de nuestro
                formulario de contacto o escribirnos directamente al correo de soporte disponible
                en la sección &quot;Contacto&quot; de nuestra plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">2. Datos que Recopilamos</h2>
              <p>
                Para prestar nuestros servicios de reserva de vuelos, renta de autos y otros productos
                turísticos, recopilamos los siguientes datos personales:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>
                  <strong>Datos de identificación:</strong> nombre completo, fecha de nacimiento,
                  nacionalidad, número y fecha de expiración del pasaporte.
                </li>
                <li>
                  <strong>Datos de contacto:</strong> dirección de correo electrónico,
                  número de teléfono.
                </li>
                <li>
                  <strong>Datos de reserva:</strong> itinerario de vuelo, destinos, fechas de viaje,
                  preferencias de asiento, información de pasajeros adicionales que viajan
                  bajo su reserva.
                </li>
                <li>
                  <strong>Datos técnicos:</strong> dirección IP (utilizada exclusivamente para
                  la protección contra fraude y la limitación de solicitudes automatizadas),
                  tipo de navegador y sistema operativo.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">3. Finalidad del Tratamiento</h2>
              <p>Sus datos personales son utilizados exclusivamente para:</p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>Procesar y confirmar reservas de vuelos, renta de autos y otros servicios.</li>
                <li>Emitir boletos aéreos, vouchers y documentos de viaje.</li>
                <li>Comunicar el estado de su reserva, incluyendo confirmaciones, cambios o
                    cancelaciones por parte de los proveedores.</li>
                <li>Gestionar su cuenta de usuario y el programa de fidelidad de GST
                    (acumulación y canje de puntos).</li>
                <li>Prevenir el fraude y garantizar la seguridad de las transacciones.</li>
                <li>Cumplir con obligaciones legales y reglamentarias aplicables.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">4. Base Legal del Tratamiento</h2>
              <p>El tratamiento de sus datos personales se basa en:</p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>
                  <strong>Ejecución de un contrato:</strong> el tratamiento es necesario para
                  llevar a cabo la reserva que usted ha solicitado.
                </li>
                <li>
                  <strong>Consentimiento:</strong> para el envío de comunicaciones promocionales
                  u ofertas especiales, solicitamos su consentimiento explícito.
                </li>
                <li>
                  <strong>Interés legítimo:</strong> para la prevención del fraude y la seguridad
                  de la plataforma.
                </li>
                <li>
                  <strong>Obligación legal:</strong> para el cumplimiento de normativas fiscales
                  y migratorias.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">5. Terceros con quienes Compartimos sus Datos</h2>
              <p>
                Para la correcta prestación de los servicios, GST comparte sus datos únicamente
                con los proveedores directamente involucrados en su reserva:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>
                  <strong>Aerolíneas:</strong> Copa Airlines, American Airlines, Iberia, JetBlue,
                  Aeromexico, Wingo, Cubana de Aviación y otras aerolíneas operadoras del vuelo
                  reservado. Los datos transmitidos son los requeridos para la emisión del boleto
                  (nombre, pasaporte, nacionalidad).
                </li>
                <li>
                  <strong>Transtur (renta de autos en Cuba):</strong> para la gestión de contratos
                  de arrendamiento, se transmite información del conductor principal conforme a los
                  requisitos del proveedor.
                </li>
                <li>
                  <strong>Pasarelas de pago:</strong> Stripe y PayPal procesan los datos de pago
                  bajo sus propias políticas de privacidad y con certificación PCI-DSS. GST no
                  recibe ni almacena los datos completos de su tarjeta bancaria.
                </li>
              </ul>
              <p className="mt-2">
                No vendemos, alquilamos ni cedemos sus datos a terceros para fines de marketing
                o publicidad sin su consentimiento explícito.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">6. Seguridad de los Datos</h2>
              <p>
                GST implementa medidas técnicas y organizativas para proteger sus datos personales:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>
                  <strong>Encriptación AES-256:</strong> los datos sensibles de pasaporte almacenados
                  en nuestra base de datos están protegidos con encriptación de grado militar.
                </li>
                <li>
                  <strong>No almacenamiento de tarjetas:</strong> los datos de tarjetas de crédito
                  o débito nunca son almacenados en nuestros servidores. El procesamiento se realiza
                  íntegramente a través de pasarelas certificadas PCI-DSS.
                </li>
                <li>
                  <strong>Acceso restringido:</strong> solo el personal autorizado de GST tiene
                  acceso a los datos de reservas, bajo estrictos controles de autenticación.
                </li>
                <li>
                  <strong>Transmisión segura:</strong> todas las comunicaciones entre su navegador
                  y nuestra plataforma utilizan protocolo HTTPS con cifrado TLS.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">7. Sus Derechos</h2>
              <p>
                Usted tiene derecho a ejercer en cualquier momento los siguientes derechos sobre
                sus datos personales:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li><strong>Acceso:</strong> solicitar una copia de los datos que conservamos sobre usted.</li>
                <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
                <li><strong>Supresión:</strong> solicitar la eliminación de sus datos cuando ya no sean
                    necesarios para la finalidad que motivó su recopilación.</li>
                <li><strong>Oposición y limitación:</strong> oponerse al tratamiento de sus datos
                    o solicitar que se limite su uso en determinadas circunstancias.</li>
                <li><strong>Portabilidad:</strong> recibir sus datos en un formato estructurado y
                    legible por máquina.</li>
              </ul>
              <p className="mt-2">
                Para ejercer cualquiera de estos derechos, escríbanos a través del formulario de
                contacto disponible en nuestra plataforma. Atenderemos su solicitud en un plazo
                máximo de 30 días hábiles.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">8. Cookies y Sesiones</h2>
              <p>
                Nuestra plataforma utiliza únicamente las cookies estrictamente necesarias para
                el funcionamiento de la autenticación y la sesión de usuario. No utilizamos
                cookies de rastreo publicitario ni compartimos información de navegación con
                redes de publicidad de terceros. Las cookies de sesión se eliminan automáticamente
                al cerrar su navegador o al cerrar sesión en la plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">9. Retención de Datos</h2>
              <p>
                Los datos personales asociados a una reserva se conservan durante el período en que
                usted mantenga una relación comercial activa con GST. Una vez finalizada dicha
                relación, los datos se retienen por un período adicional de <strong>5 años</strong>,
                en cumplimiento de las obligaciones fiscales, contables y legales aplicables. Tras
                ese período, los datos son eliminados de forma segura de nuestros sistemas.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">10. Modificaciones a esta Política</h2>
              <p>
                Global Solutions Travel se reserva el derecho de actualizar esta Política de
                Privacidad en cualquier momento para reflejar cambios legales, operativos o de
                seguridad. Le notificaremos cualquier modificación relevante a través del correo
                electrónico registrado en su cuenta o mediante un aviso visible en la plataforma.
                La versión actualizada entrará en vigor desde la fecha indicada al pie de este documento.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-brand-900">11. Contacto</h2>
              <p>
                Si tiene preguntas, inquietudes o desea ejercer sus derechos en materia de protección
                de datos, puede contactar a nuestro equipo a través de la sección{' '}
                <a href="/legal/contact" className="text-brand-600 underline hover:text-brand-700">
                  Contacto
                </a>{' '}
                de nuestra plataforma. Nos comprometemos a responder toda consulta de privacidad en
                un plazo máximo de 5 días hábiles.
              </p>
            </section>

            <p className="text-neutral-400 text-xs mt-8 border-t border-neutral-100 pt-4">
              Última actualización: Febrero 2026
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
