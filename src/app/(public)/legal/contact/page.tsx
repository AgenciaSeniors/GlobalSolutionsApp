/**
 * @fileoverview Contact page — trust generation.
 * Per spec §7.3: "Visible Contact section for trust."
 * @module app/(public)/legal/contact/page
 */
import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Card from '@/components/ui/Card';
import { Mail, Phone, MapPin, Clock, MessageCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contacto — Global Solutions Travel',
};

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-neutral-50 pt-[72px]">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <div className="text-center mb-12">
            <h1 className="font-display text-3xl font-bold text-brand-950">Contacto</h1>
            <p className="mt-2 text-neutral-600">Estamos aquí para ayudarte con tu próximo viaje</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card variant="bordered" className="flex items-start gap-4">
              <Mail className="h-8 w-8 text-brand-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold">Email</h3>
                <p className="text-sm text-neutral-600 mt-1">info@globalsolutionstravel.com</p>
                <p className="text-xs text-neutral-400 mt-1">Respuesta en menos de 24 horas</p>
              </div>
            </Card>

            <Card variant="bordered" className="flex items-start gap-4">
              <Phone className="h-8 w-8 text-brand-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold">Teléfono</h3>
                <p className="text-sm text-neutral-600 mt-1">+1 (305) 555-0199</p>
                <p className="text-xs text-neutral-400 mt-1">Lunes a Viernes, 9am - 6pm EST</p>
              </div>
            </Card>

            <Card variant="bordered" className="flex items-start gap-4">
              <MapPin className="h-8 w-8 text-brand-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold">Oficina</h3>
                <p className="text-sm text-neutral-600 mt-1">Miami, Florida, USA</p>
                <p className="text-xs text-neutral-400 mt-1">Solo con cita previa</p>
              </div>
            </Card>

            <Card variant="bordered" className="flex items-start gap-4">
              <MessageCircle className="h-8 w-8 text-brand-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold">Chat en Vivo</h3>
                <p className="text-sm text-neutral-600 mt-1">Asistente IA 24/7 + Agentes humanos</p>
                <p className="text-xs text-neutral-400 mt-1">Haz clic en el botón de chat en la esquina</p>
              </div>
            </Card>
          </div>

          <Card variant="bordered" className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="h-5 w-5 text-brand-500" />
              <h3 className="font-bold">Horarios de Atención</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold">Lunes a Viernes</p>
                <p className="text-neutral-600">9:00 AM — 6:00 PM (EST)</p>
              </div>
              <div>
                <p className="font-semibold">Sábados</p>
                <p className="text-neutral-600">10:00 AM — 2:00 PM (EST)</p>
              </div>
              <div>
                <p className="font-semibold">Domingos y Feriados</p>
                <p className="text-neutral-600">Solo emergencias vía chat</p>
              </div>
              <div>
                <p className="font-semibold">Chat IA</p>
                <p className="text-neutral-600">Disponible 24/7</p>
              </div>
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
}
