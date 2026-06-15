import * as React from 'react';
import { I18nextProvider } from 'react-i18next';
import { directionForLanguage, i18n, LANGUAGE_STORAGE_KEY, normalizeLanguage } from './i18n';

function applyDocumentLanguage(language: string) {
  const normalized = normalizeLanguage(language);
  document.documentElement.lang = normalized;
  document.documentElement.dir = directionForLanguage(normalized);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    if (import.meta.env.MODE === 'test' && normalizeLanguage(i18n.language) !== 'en') {
      void i18n.changeLanguage('en');
    }

    applyDocumentLanguage(i18n.language);

    const handleLanguageChanged = (language: string) => {
      applyDocumentLanguage(language);
      if (import.meta.env.MODE !== 'test') {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizeLanguage(language));
      }
    };

    i18n.on('languageChanged', handleLanguageChanged);
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
