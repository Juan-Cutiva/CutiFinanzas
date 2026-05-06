'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useAction } from 'next-safe-action/hooks';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SUPPORTED_CURRENCIES } from '@/lib/money';
import { updateUserPreferencesAction } from '../actions';
import {
  COMMON_LOCALES,
  COMMON_TIMEZONES,
  type UpdateUserPreferencesInput,
  updateUserPreferencesSchema,
} from '../schema';

interface AccountOpt {
  id: string;
  name: string;
  type: string;
}

interface Props {
  defaults: {
    name: string | null;
    defaultCurrency: string;
    locale: string;
    timezone: string;
    payAnchorDates: number[];
    primaryAccountId: string | null;
    dashboardAccountIds: string[] | null;
  };
  accounts: AccountOpt[];
}

const NONE_VALUE = '__none__';

export function PreferencesForm({ defaults, accounts }: Props) {
  const [anchorsRaw, setAnchorsRaw] = React.useState(
    (defaults.payAnchorDates ?? [6, 21]).join(', '),
  );
  // null en BD = todas visibles. Internamente trabajamos con un Set.
  const [visibleSet, setVisibleSet] = React.useState<Set<string>>(() => {
    if (defaults.dashboardAccountIds && defaults.dashboardAccountIds.length > 0) {
      return new Set(defaults.dashboardAccountIds);
    }
    return new Set(accounts.map((a) => a.id));
  });

  const assetAccounts = React.useMemo(
    () => accounts.filter((a) => a.type !== 'credit_card'),
    [accounts],
  );

  const form = useForm<UpdateUserPreferencesInput>({
    resolver: zodResolver(updateUserPreferencesSchema),
    defaultValues: {
      name: defaults.name ?? '',
      defaultCurrency: defaults.defaultCurrency,
      locale: defaults.locale,
      timezone: defaults.timezone,
      payAnchorDates: defaults.payAnchorDates ?? [6, 21],
      primaryAccountId: defaults.primaryAccountId,
    },
  });

  const { execute, isPending } = useAction(updateUserPreferencesAction, {
    onSuccess: () => toast.success('Preferencias actualizadas'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Error'),
  });

  function onSubmit(data: UpdateUserPreferencesInput) {
    const anchors = anchorsRaw
      .split(',')
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 31);
    // Si todas están seleccionadas, mandamos null (default = mostrar todas).
    const dashboardIds = visibleSet.size === accounts.length ? null : Array.from(visibleSet);
    execute({
      ...data,
      payAnchorDates: anchors,
      dashboardAccountIds: dashboardIds,
    });
  }

  function toggleVisible(id: string) {
    setVisibleSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="defaultCurrency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Moneda predeterminada</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map(({ code, name }) => (
                    <SelectItem key={code} value={code}>
                      {code} — {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="locale"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Idioma / formato</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {COMMON_LOCALES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="md:col-span-2 flex flex-col gap-2">
          <Label htmlFor="anchors">Días de cobro</Label>
          <Input
            id="anchors"
            placeholder="6, 21"
            value={anchorsRaw}
            onChange={(e) => setAnchorsRaw(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Días del mes en que cobras (separados por coma). Determinan los cortes de quincena. Ej:{' '}
            <code>6, 21</code> para cobro día 6 y día 21.
          </p>
        </div>

        <FormField
          control={form.control}
          name="primaryAccountId"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Cuenta principal (recibe la nómina)</FormLabel>
              <Select
                value={field.value ?? NONE_VALUE}
                onValueChange={(v) => field.onChange(v === NONE_VALUE ? null : v)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>— Ninguna (sumar todas las cuentas) —</SelectItem>
                  {assetAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Si la defines, el desglose por quincena en el dashboard solo cuenta los movimientos
                de esta cuenta. Útil para separar tu nómina de tus ahorros.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="md:col-span-2 flex flex-col gap-2">
          <Label>Cuentas visibles en el dashboard</Label>
          <p className="text-xs text-muted-foreground">
            Marca las cuentas que se incluyen en el balance del dashboard. Las que desmarques siguen
            funcionando normalmente, solo se ocultan del KPI principal.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {accounts.map((a) => {
              const id = `dash-acc-${a.id}`;
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                >
                  <Checkbox
                    id={id}
                    checked={visibleSet.has(a.id)}
                    onCheckedChange={() => toggleVisible(a.id)}
                  />
                  <Label htmlFor={id} className="cursor-pointer truncate font-normal">
                    {a.name}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>

        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Zona horaria</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isPending}
          className="md:col-span-2 mt-2 justify-self-start"
        >
          {isPending ? 'Guardando…' : 'Guardar preferencias'}
        </Button>
      </form>
    </Form>
  );
}
