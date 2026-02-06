/**
 * @fileoverview Root layout — loads fonts, global styles, providers.
 * Fonts loaded via <link> to avoid build-time fetch issues with next/font/google.
 * @module app/layout
 */
import type { Metadata } from 'next';
<<<<<<< HEAD
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import ToastProvider from '@/components/providers/ToastProvider';
import ChatWidget from '@/components/features/chat/ChatWidget';
=======
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
>>>>>>> efb60f8 (ok)

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
<<<<<<< HEAD
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@100..1000&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
=======
    <html lang="es" className={`${heading.variable} ${body.variable} ${script.variable}`}>
      <body className="font-body">
>>>>>>> efb60f8 (ok)
        <AuthProvider>
          {children}
          <ChatWidget />
          <ToastProvider />
        </AuthProvider>
      </body>
    </html>
  );
}
