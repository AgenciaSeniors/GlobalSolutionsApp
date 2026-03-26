import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pago Seguro',
  description: 'Procesa tu pago de forma segura. Aceptamos tarjeta de crédito/débito y Zelle.',
  robots: { index: false, follow: false },
};

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
