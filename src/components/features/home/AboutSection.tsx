import Link from 'next/link';
import { Globe, Shield, Clock, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/lib/constants/routes';

const FEATURES = [
  { icon: Shield, title: 'Seguridad', desc: 'Pagos protegidos y procesos claros.' },
  { icon: Clock, title: 'Soporte 24/7', desc: 'Te acompañamos antes, durante y después.' },
  { icon: Globe, title: 'Experiencia', desc: 'Destinos, aerolíneas y rutas probadas.' },
];

export default function AboutSection() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="text-sm font-bold uppercase tracking-widest text-brand-500">
            Sobre nosotros
          </span>
          <h2 className="mt-3 font-display text-4xl font-bold text-brand-950">
            Viajar debería sentirse simple (y premium)
          </h2>
          <p className="mt-4 text-neutral-600">
            En Global Solutions Travel combinamos atención humana con una experiencia digital
            moderna para que encuentres vuelos, ofertas y servicios sin fricción.
          </p>

          <div className="mt-7 flex flex-wrap gap-4">
            <Link href={ROUTES.ABOUT}>
              <Button className="gap-2">
                Conócenos <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={ROUTES.QUOTE_REQUEST}>
              <Button variant="outline">Solicitar Cotización</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-neutral-100 bg-neutral-50 p-6 transition hover:-translate-y-1 hover:bg-white hover:shadow-md"
            >
              <f.icon className="h-6 w-6 text-brand-600" />
              <p className="mt-3 font-bold text-brand-950">{f.title}</p>
              <p className="mt-1 text-sm text-neutral-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
