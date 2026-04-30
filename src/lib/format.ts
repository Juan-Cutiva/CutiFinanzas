import dayjs from 'dayjs';
import 'dayjs/locale/es';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import { type CurrencyCode, type Money, moneyCurrency, moneyToMajor } from './money';

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);
dayjs.extend(customParseFormat);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.locale('es');

const MINUS_SIGN = '−';

export interface FormatMoneyOptions {
  locale?: string;
  showCents?: boolean;
  signDisplay?: 'auto' | 'always' | 'exceptZero' | 'negative';
  compact?: boolean;
}

export function formatMoney(m: Money, options: FormatMoneyOptions = {}): string {
  const code = moneyCurrency(m);
  return formatAmount(moneyToMajor(m), code, options);
}

export function formatAmount(
  amount: number,
  currency: CurrencyCode,
  options: FormatMoneyOptions = {},
): string {
  const {
    locale = 'es-CO',
    showCents = currency !== 'COP' && currency !== 'CLP',
    signDisplay = 'auto',
    compact = false,
  } = options;

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
    signDisplay,
    notation: compact ? 'compact' : 'standard',
  });

  return formatter.format(amount).replace(/-/g, MINUS_SIGN);
}

export function formatNumber(n: number, locale = 'es-CO'): string {
  return new Intl.NumberFormat(locale).format(n);
}

export function formatPercent(n: number, locale = 'es-CO', digits = 1): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatDate(date: Date | string | number, format = 'D MMM YYYY'): string {
  return dayjs(date).format(format);
}

export function formatDateLong(date: Date | string | number): string {
  return dayjs(date).format('DD [de] MMMM [de] YYYY');
}

export function formatRelative(date: Date | string | number): string {
  return dayjs(date).fromNow();
}

export function formatMonthYear(date: Date | string | number): string {
  return dayjs(date).format('MMMM YYYY');
}

export function getQuincena(date: Date | string | number): 1 | 2 {
  const day = dayjs(date).date();
  return day <= 15 ? 1 : 2;
}

export { dayjs };
