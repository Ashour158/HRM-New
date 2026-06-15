import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { languageMetadata, resources, supportedLanguages, type SupportedLanguage } from './resources';

export const LANGUAGE_STORAGE_KEY = 'hrm-nexus-language';

function storedLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'en';
  if (import.meta.env.MODE === 'test') return 'en';
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return supportedLanguages.includes(saved as SupportedLanguage) ? (saved as SupportedLanguage) : 'en';
}

export function normalizeLanguage(language: string | undefined): SupportedLanguage {
  const shortLanguage = language?.split('-')[0] as SupportedLanguage | undefined;
  return shortLanguage && supportedLanguages.includes(shortLanguage) ? shortLanguage : 'en';
}

export function directionForLanguage(language: string | undefined) {
  return languageMetadata[normalizeLanguage(language)].dir;
}

export const i18n = i18next.createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: storedLanguage(),
  fallbackLng: 'en',
  supportedLngs: supportedLanguages,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export type { SupportedLanguage };
