import { cookies } from 'next/headers';
import { type AppLanguage, LANGUAGE_COOKIE_KEY, isAppLanguage } from './translations';

export function getServerLanguage(): AppLanguage {
  const language = cookies().get(LANGUAGE_COOKIE_KEY)?.value;
  return isAppLanguage(language) ? language : 'es';
}
