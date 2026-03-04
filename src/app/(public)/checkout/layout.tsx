import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Checkout — Confirmar Reserva',
  description: 'Completa tu reserva de vuelo de forma segura. Pago con tarjeta de crédito/débito o Zelle.',
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
