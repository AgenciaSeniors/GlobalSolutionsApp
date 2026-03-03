'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type AppLanguage = 'es' | 'en';

type TranslationKey =
  | 'nav.home'
  | 'nav.flights'
  | 'nav.cars'
  | 'nav.offers'
  | 'nav.about'
  | 'nav.profile'
  | 'nav.login'
  | 'nav.enter'
  | 'nav.openMenu'
  | 'lang.label';

const LANGUAGE_STORAGE_KEY = 'app_language';

const DICTIONARY: Record<AppLanguage, Record<TranslationKey, string>> = {
  es: {
    'nav.home': 'Inicio',
    'nav.flights': 'Vuelos',
    'nav.cars': 'Autos',
    'nav.offers': 'Ofertas',
    'nav.about': 'Nosotros',
    'nav.profile': 'Mi Perfil',
    'nav.login': 'Iniciar Sesión',
    'nav.enter': 'Entrar',
    'nav.openMenu': 'Abrir menú',
    'lang.label': 'Idioma',
  },
  en: {
    'nav.home': 'Home',
    'nav.flights': 'Flights',
    'nav.cars': 'Cars',
    'nav.offers': 'Offers',
    'nav.about': 'About',
    'nav.profile': 'My Profile',
    'nav.login': 'Sign In',
    'nav.enter': 'Enter',
    'nav.openMenu': 'Open menu',
    'lang.label': 'Language',
  },
};

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('es');

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (storedLanguage === 'es' || storedLanguage === 'en') {
      setLanguageState(storedLanguage);
      document.documentElement.lang = storedLanguage;
      return;
    }

    document.documentElement.lang = 'es';
  }, []);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    document.documentElement.lang = nextLanguage;
  }, []);

  const t = useCallback(
    (key: TranslationKey) => DICTIONARY[language][key],
    [language]
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }

  return context;
}
