/**
 * @fileoverview Root layout — loads fonts, global styles, providers.
 * @module app/layout
 */
import type { Metadata } from 'next';
import { DM_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import ToastProvider from '@/components/providers/ToastProvider';
import ChatWidget from '@/components/features/chat/ChatWidget';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
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
    <html lang="es" className={`${dmSans.variable} ${playfair.variable}`}>
      <body className="font-sans">
        <AuthProvider>
          {children}
          <ChatWidget />
          <ToastProvider />
        </AuthProvider>
      </body>
    </html>
  );
}
