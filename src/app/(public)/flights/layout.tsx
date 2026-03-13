import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vuelos Baratos a Cuba y el Mundo — Compara 60+ Aerolíneas',
  description: 'Busca vuelos baratos a Cuba, Miami, Panamá, Madrid y más de 100 destinos. Compara precios de 60+ aerolíneas. Paga con Zelle, PIX o SPEI.',
  alternates: { canonical: '/flights' },
  openGraph: {
    title: 'Vuelos Baratos a Cuba y el Mundo',
    description: 'Busca vuelos baratos a Cuba, Miami, Panamá, Madrid y más de 100 destinos. Compara precios de 60+ aerolíneas. Paga con Zelle, PIX o SPEI.',
    url: '/flights',
  },
};

export default function FlightsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
