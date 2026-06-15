import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeLanguage } from './i18n';

interface TenantLocaleOptions {
  currency?: string;
  timezone?: string;
}

export function useLocaleFormat(options: TenantLocaleOptions = {}) {
  const { i18n } = useTranslation();
  const locale = normalizeLanguage(i18n.language);

  return React.useMemo(() => {
    const timeZone = options.timezone || 'UTC';
    const currency = options.currency || 'USD';

    return {
      formatCurrency(value: number, currencyOverride = currency) {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: currencyOverride,
          maximumFractionDigits: 2,
        }).format(value);
      },
      formatNumber(value: number, decimals = 0) {
        return new Intl.NumberFormat(locale, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(value);
      },
      formatDate(value: string | Date, dateOptions: Intl.DateTimeFormatOptions = {}) {
        const date = typeof value === 'string' ? new Date(value) : value;
        return new Intl.DateTimeFormat(locale, {
          timeZone,
          ...dateOptions,
        }).format(date);
      },
    };
  }, [locale, options.currency, options.timezone]);
}
