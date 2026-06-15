import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { normalizeLanguage, type SupportedLanguage } from './i18n';
import { languageMetadata, supportedLanguages } from './resources';

interface LanguageSwitcherProps {
  className?: string;
  compact?: boolean;
}

export function LanguageSwitcher({ className, compact = false }: LanguageSwitcherProps) {
  const id = React.useId();
  const { i18n, t } = useTranslation();
  const currentLanguage = normalizeLanguage(i18n.language);

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    void i18n.changeLanguage(event.target.value as SupportedLanguage);
  };

  return (
    <div className={cn('flex items-center gap-2 text-sm text-slate-600', className)}>
      <label className={cn('font-semibold', compact ? 'sr-only' : '')} htmlFor={id}>
        {t('language.label')}
      </label>
      <select
        id={id}
        aria-label={compact ? t('language.label') : undefined}
        className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={currentLanguage}
        onChange={handleLanguageChange}
      >
        {supportedLanguages.map((language) => (
          <option key={language} value={language}>
            {languageMetadata[language].nativeLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
