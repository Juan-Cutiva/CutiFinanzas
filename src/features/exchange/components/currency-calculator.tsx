'use client';

import { ArrowDownUp, RefreshCw } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatAmount } from '@/lib/format';
import { type CurrencyCode, SUPPORTED_CURRENCIES } from '@/lib/money';

interface Props {
  /** Moneda base del usuario (con la que se piden las tasas). */
  base: CurrencyCode;
}

interface RatesTable {
  base: CurrencyCode;
  rates: Record<string, number>;
  updatedAt: string;
}

function pickDefaultTo(base: CurrencyCode): CurrencyCode {
  return base === 'USD' ? 'EUR' : 'USD';
}

export function CurrencyCalculator({ base }: Props) {
  const [amount, setAmount] = React.useState<number | undefined>(100000);
  const [from, setFrom] = React.useState<CurrencyCode>(base);
  const [to, setTo] = React.useState<CurrencyCode>(pickDefaultTo(base));

  const [table, setTable] = React.useState<RatesTable | null>(null);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = React.useState<string>('');

  const loadRates = React.useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/exchange/rates?base=${base}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'No se pudieron cargar las tasas');
      setTable(json as RatesTable);
      setStatus('ready');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error desconocido');
      setStatus('error');
    }
  }, [base]);

  React.useEffect(() => {
    loadRates();
  }, [loadRates]);

  // Solo monedas presentes en la tabla del proveedor (o la base).
  const options = React.useMemo(() => {
    const rates = table?.rates;
    return SUPPORTED_CURRENCIES.filter(
      (c) => c.code === base || (rates ? typeof rates[c.code] === 'number' : true),
    );
  }, [table, base]);

  // Tasa from→to derivada de la base: (base→to) / (base→from).
  const rateFromTo = React.useMemo(() => {
    if (!table) return null;
    const rFrom = from === table.base ? 1 : table.rates[from];
    const rTo = to === table.base ? 1 : table.rates[to];
    if (typeof rFrom !== 'number' || typeof rTo !== 'number' || rFrom === 0) return null;
    return rTo / rFrom;
  }, [table, from, to]);

  const validAmount = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  const result = rateFromTo === null ? null : validAmount * rateFromTo;

  function swap() {
    setFrom(to);
    setTo(from);
  }

  const updatedLabel = table
    ? new Date(table.updatedAt).toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="calc-amount">Monto</Label>
        <MoneyInput
          id="calc-amount"
          className="font-mono tabular-nums text-lg"
          value={amount}
          onChange={setAmount}
          allowDecimals
        />
      </div>

      <div className="flex items-end gap-2">
        <div className="grid flex-1 gap-2">
          <Label htmlFor="calc-from">De</Label>
          <Select value={from} onValueChange={(v) => setFrom(v as CurrencyCode)}>
            <SelectTrigger id="calc-from">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} · {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Invertir monedas"
          className="mb-0.5 shrink-0"
          onClick={swap}
        >
          <ArrowDownUp className="size-4" aria-hidden />
        </Button>

        <div className="grid flex-1 gap-2">
          <Label htmlFor="calc-to">A</Label>
          <Select value={to} onValueChange={(v) => setTo(v as CurrencyCode)}>
            <SelectTrigger id="calc-to">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} · {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Resultado</p>
        {status === 'loading' ? (
          <div className="mt-1 h-8 w-40 animate-pulse rounded bg-muted" aria-hidden />
        ) : status === 'error' ? (
          <div className="mt-1 space-y-2">
            <p className="text-sm text-amount-negative">{errorMsg}</p>
            <Button type="button" variant="outline" size="sm" onClick={loadRates}>
              <RefreshCw className="size-4" aria-hidden /> Reintentar
            </Button>
          </div>
        ) : (
          <>
            <p className="font-mono tabular-nums text-2xl font-semibold tracking-tight md:text-3xl">
              {result === null ? '—' : formatAmount(result, to)}
            </p>
            {rateFromTo !== null ? (
              <p className="mt-1 text-xs text-muted-foreground">
                1 {from} = {formatAmount(rateFromTo, to)} · 1 {to} ={' '}
                {formatAmount(1 / rateFromTo, from)}
              </p>
            ) : null}
          </>
        )}
      </div>

      {status === 'ready' ? (
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <span>Actualizado el {updatedLabel} · Fuente: ExchangeRate-API</span>
          <button
            type="button"
            onClick={loadRates}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-primary hover:bg-accent/50"
            aria-label="Actualizar tasas"
          >
            <RefreshCw className="size-3" aria-hidden /> Actualizar
          </button>
        </div>
      ) : null}
    </div>
  );
}
