/**
 * @fileoverview Grid of trust signals displayed on the landing page.
 * @module components/features/home/TrustBanner
 */
import { Shield, Globe, CheckCircle, Users } from 'lucide-react';
import { getServerLanguage } from '@/lib/i18n/serverLanguage';
import { translate } from '@/lib/i18n/translations';

const ITEMS = [
  { icon: Shield, titleKey: 'trust.securePayments.title', descKey: 'trust.securePayments.desc' },
  { icon: Globe, titleKey: 'trust.globalCoverage.title', descKey: 'trust.globalCoverage.desc' },
  { icon: CheckCircle, titleKey: 'trust.priceGuarantee.title', descKey: 'trust.priceGuarantee.desc' },
  { icon: Users, titleKey: 'trust.support.title', descKey: 'trust.support.desc' },
] as const;

export default function TrustBanner() {
  const lang = getServerLanguage();
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);

  return (
    <section className="bg-white py-16">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map(({ icon: Icon, titleKey, descKey }) => (
          <div key={titleKey} className="flex flex-col items-center text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600">
              <Icon className="h-6 w-6" />
            </span>
            <h4 className="text-base font-bold text-neutral-900">{t(titleKey)}</h4>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{t(descKey)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
