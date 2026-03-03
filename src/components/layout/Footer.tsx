'use client';

/**
 * @fileoverview Site footer with quick links, legal info and compliance badges.
 * @module components/layout/Footer
 */
import Link from 'next/link';
import { Globe, Shield } from 'lucide-react';
import { ROUTES } from '@/lib/constants/routes';
import { getServerLanguage } from '@/lib/i18n/serverLanguage';
import { translate } from '@/lib/i18n/translations';

export default function Footer() {
  const lang = getServerLanguage();
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);

  const linkGroups = [
    {
      title: t('footer.services'),
      links: [
        { label: t('nav.flights'), href: ROUTES.FLIGHTS },
        { label: t('footer.rentCars'), href: ROUTES.CARS },
        { label: t('nav.offers'), href: ROUTES.OFFERS },
      ],
    },
    {
      title: t('footer.support'),
      links: [
        { label: t('footer.contact'), href: ROUTES.CONTACT },
        { label: t('footer.aboutUs'), href: ROUTES.ABOUT },
        { label: t('footer.liveChat'), href: '#chat' },
      ],
    },
    {
      title: t('footer.legal'),
      links: [
        { label: t('footer.terms'), href: ROUTES.TERMS },
        { label: t('footer.contact'), href: ROUTES.CONTACT },
      ],
    },
  ] as const;

  return (
    <footer className="bg-navy text-white">
      <div className="mx-auto max-w-7xl px-6 pb-8 pt-16">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 lg:gap-16">
          <div className="col-span-2 sm:col-span-1">
            <Link href={ROUTES.HOME} className="mb-4 flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600">
                <Globe className="h-5 w-5" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-display text-lg font-bold">Global Solutions</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-400">Travel</span>
              </span>
            </Link>
            <p className="mt-4 max-w-[260px] text-sm leading-relaxed text-white/50">{t('footer.description')}</p>
          </div>

          {linkGroups.map((group) => (
            <div key={group.title}>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-white/70">{group.title}</h4>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-white/45 transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
          <p className="text-xs text-white/35">
            © {new Date().getFullYear()} Global Solutions Travel. {t('footer.rights')}
          </p>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
              <Shield className="h-3 w-3" /> PCI-DSS Compliant
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-400/15 px-2.5 py-1 text-[11px] font-bold text-brand-400">SSL Secured</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
