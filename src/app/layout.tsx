/**
 * @fileoverview Root layout — loads fonts, global styles, providers.
 * Fonts loaded via <link> to avoid build-time fetch issues with next/font/google.
 * @module app/layout
 */
import type { Metadata, Viewport } from "next";
import "./globals.css";

import { AuthProvider } from "@/components/providers/AuthProvider";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import ToastProvider from "@/components/providers/ToastProvider";
import ChatWidget from "@/components/features/chat/ChatWidget";
import HomeFloatingButton from "@/components/layout/HomeFloatingButton";


export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: {
    default: "Global Solutions Travel — Vuelos y Renta de Autos",
    template: "%s | Global Solutions Travel",
  },
  description:
    "Reserva vuelos internacionales con los mejores precios. Seguridad bancaria, atención personalizada y ofertas exclusivas.",
  keywords: ["vuelos", "viajes internacionales", "agencia de viajes", "vuelos baratos", "Estambul", "ofertas de vuelos", "Cuba", "renta de autos"],
  openGraph: {
    type: "website",
    siteName: "Global Solutions Travel",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
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
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@700&family=Open+Sans:wght@400;600&family=Dancing+Script:wght@400;700&display=swap"
          rel="stylesheet"
        />

      </head>
      <body className="font-sans">
        <AuthProvider>
          <LanguageProvider>
            {children}
            <HomeFloatingButton />
            <ChatWidget />
            <ToastProvider />
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
