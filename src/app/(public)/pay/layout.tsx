import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pago Seguro',
  description: 'Procesa tu pago de forma segura. Aceptamos Stripe, PayPal y Zelle.',
};

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
