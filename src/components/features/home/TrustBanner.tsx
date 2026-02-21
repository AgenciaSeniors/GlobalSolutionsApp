/**
 * @fileoverview Grid of trust signals displayed on the landing page.
 * @module components/features/home/TrustBanner
 */
import { Shield, Globe, CheckCircle, Users } from 'lucide-react';

const ITEMS = [
  {
    icon: Shield,
    title: 'Pagos Seguros',
    desc: 'Encriptación bancaria AES-256 para todas tus transacciones',
  },
  {
    icon: Globe,
    title: 'Cobertura Global',
    desc: 'Vuelos a más de 50 destinos con las mejores aerolíneas',
  },
  {
    icon: CheckCircle,
    title: 'Garantía de Precio',
    desc: 'Te garantizamos la mejor tarifa disponible',
  },
  {
    icon: Users,
    title: 'Soporte 24/7',
    desc: 'Equipo dedicado de gestores disponible cuando lo necesites',
  },
] as const;

export default function TrustBanner() {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="flex flex-col items-center text-center"
          >
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600">
              <Icon className="h-6 w-6" />
            </span>
            <h4 className="text-base font-bold text-neutral-900">{title}</h4>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
              {desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
