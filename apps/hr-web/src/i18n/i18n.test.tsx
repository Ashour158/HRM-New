import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useTranslation } from 'react-i18next';
import { I18nProvider } from './i18n-provider';
import { LanguageSwitcher } from './language-switcher';
import { useLocaleFormat } from './use-locale-format';

function TranslatedHeading() {
  const { t } = useTranslation();
  const { formatCurrency, formatDate } = useLocaleFormat({
    currency: 'AED',
    timezone: 'Asia/Dubai',
  });

  return (
    <section>
      <h1>{t('app.loading')}</h1>
      <p>{formatCurrency(1234.5)}</p>
      <p>{formatDate('2026-06-15T08:00:00.000Z', { dateStyle: 'medium' })}</p>
      <LanguageSwitcher />
    </section>
  );
}

describe('i18n shell', () => {
  it('switches languages and keeps tenant-aware formatting available', async () => {
    render(
      <I18nProvider>
        <TranslatedHeading />
      </I18nProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Loading...' })).toBeInTheDocument();
    expect(screen.getByText(/AED/)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Language'), 'ar');

    expect(await screen.findByRole('heading', { name: 'جار التحميل...' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });
});
