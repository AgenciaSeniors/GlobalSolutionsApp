import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Buscar Vuelos',
  description: 'Busca y reserva vuelos internacionales con los mejores precios. Comparamos cientos de aerolíneas para encontrar tu mejor opción.',
};

export default function FlightsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
