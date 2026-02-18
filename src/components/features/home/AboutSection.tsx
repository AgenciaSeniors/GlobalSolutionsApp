import Link from 'next/link';
import { Globe, Shield, Clock, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/lib/constants/routes';

const FEATURES = [
  { icon: Shield, title: 'Pagos seguros', desc: 'Transacciones protegidas y procesos claros.' },
  { icon: Globe, title: 'Cobertura global', desc: 'Destinos y rutas confiables para tu viaje.' },
  { icon: Clock, title: 'Soporte 24/7', desc: 'Te acompañamos antes, durante y después.' },
];

export default function AboutSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-navy via-brand-900 to-brand-950 py-20 text-white">
      {/* decor */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-coral/20 blur-3xl" />
        <div className="absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-extrabold uppercase tracking-widest text-white/90 backdrop-blur">
            Sobre nosotros
          </span>

          <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight">
            Viajar debería sentirse{' '}
            <span className="text-coral">simple</span>{' '}
            <span className="text-white/70"></span>
          </h2>

          <p className="mt-4 text-base leading-relaxed text-white/80">
            En Global Solutions Travel combinamos atención humana con una experiencia digital
            moderna para que encuentres vuelos, ofertas y servicios sin fricción.
          </p>

          {/* botones (centrados siempre) */}
          <div className="mt-7 flex flex-wrap justify-center gap-4">
            <Link href={ROUTES.ABOUT}>
              <Button className="gap-2">
                Conócenos
              </Button>
            </Link>

           
          </div>
        </div>

        {/* cards */}
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:bg-white/15"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-coral/15 text-coral">
                <f.icon className="h-6 w-6" />
              </div>
              <p className="mt-4 text-lg font-bold text-white">{f.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/75">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
