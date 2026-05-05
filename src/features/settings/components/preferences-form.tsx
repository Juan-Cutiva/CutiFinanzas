'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useAction } from 'next-safe-action/hooks';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
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

interface Props {
  defaults: {
    name: string | null;
    defaultCurrency: string;
    locale: string;
    timezone: string;
    payAnchorDates: number[];
  };
}

export function PreferencesForm({ defaults }: Props) {
  const [anchorsRaw, setAnchorsRaw] = React.useState(
    (defaults.payAnchorDates ?? [6, 21]).join(', '),
  );

  const form = useForm<UpdateUserPreferencesInput>({
    resolver: zodResolver(updateUserPreferencesSchema),
    defaultValues: {
      name: defaults.name ?? '',
      defaultCurrency: defaults.defaultCurrency,
      locale: defaults.locale,
      timezone: defaults.timezone,
      payAnchorDates: defaults.payAnchorDates ?? [6, 21],
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
    execute({ ...data, payAnchorDates: anchors });
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
          <FormDescription>
            Días del mes en que cobras (separados por coma). Determinan los cortes de quincena. Ej:{' '}
            <code>6, 21</code> para cobro día 6 y día 21.
          </FormDescription>
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
