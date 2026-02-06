/**
 * @fileoverview Root layout — loads fonts, global styles, providers.
 * @module app/layout
 */
import type { Metadata } from 'next';
import { Roboto_Condensed, Open_Sans, Dancing_Script } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import ToastProvider from '@/components/providers/ToastProvider';

const heading = Roboto_Condensed({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
  weight: ['400', '700'],
});

const body = Open_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['400', '600', '700'],
});

const script = Dancing_Script({
  subsets: ['latin'],
  variable: '--font-script',
  display: 'swap',
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'Global Solutions Travel — Vuelos y Renta de Autos',
    template: '%s | Global Solutions Travel',
  },
  description:
    'Reserva vuelos internacionales y renta de autos con los mejores precios. Seguridad bancaria, atención personalizada y ofertas exclusivas.',
  keywords: ['vuelos', 'renta de autos', 'viajes', 'Cuba', 'Estambul', 'agencia de viajes'],
  openGraph: {
    type: 'website',
    siteName: 'Global Solutions Travel',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${heading.variable} ${body.variable} ${script.variable}`}>
      <body className="font-body">
        <AuthProvider>
          {children}
          <ToastProvider />
        </AuthProvider>
      </body>
    </html>
  );
}
