'use client';

import Link from 'next/link';
import { Globe, Shield, Clock } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/lib/constants/routes';
import { useLanguage } from '@/components/providers/LanguageProvider';

const FEATURES = [
  { icon: Shield, titleKey: 'about.feature.securePayments.title', descKey: 'about.feature.securePayments.desc' },
  { icon: Globe, titleKey: 'about.feature.globalCoverage.title', descKey: 'about.feature.globalCoverage.desc' },
  { icon: Clock, titleKey: 'about.feature.support.title', descKey: 'about.feature.support.desc' },
] as const;

export default function AboutSection() {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-navy via-brand-900 to-brand-950 py-20 text-white"><div className="pointer-events-none absolute inset-0"><div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-coral/20 blur-3xl" /><div className="absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" /></div><div className="relative mx-auto max-w-7xl px-6"><div className="mx-auto max-w-3xl text-center"><span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-extrabold uppercase tracking-widest text-white/90 backdrop-blur">{t('about.badge')}</span><h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight">{t('about.title')} <span className="text-coral">{t('about.titleAccent')}</span></h2><p className="mt-4 text-base leading-relaxed text-white/80">{t('about.subtitle')}</p><div className="mt-7 flex flex-wrap justify-center gap-4"><Link href={ROUTES.ABOUT}><Button className="gap-2">{t('about.cta')}</Button></Link></div></div><div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">{FEATURES.map((f) => <div key={f.titleKey} className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:bg-white/15"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-coral/15 text-coral"><f.icon className="h-6 w-6" /></div><p className="mt-4 text-lg font-bold text-white">{t(f.titleKey)}</p><p className="mt-2 text-sm leading-relaxed text-white/75">{t(f.descKey)}</p></div>)}</div></div></section>
  );
}
