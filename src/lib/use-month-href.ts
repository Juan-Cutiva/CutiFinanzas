'use client';

import { useSearchParams } from 'next/navigation';

export function useMonthQuery(): string {
  const search = useSearchParams();
  const params = new URLSearchParams();
  const y = search?.get('y');
  const m = search?.get('m');
  if (y) params.set('y', y);
  if (m) params.set('m', m);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function withMonth(href: string, qs: string): string {
  if (!qs) return href;
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}${qs.slice(1)}`;
}
