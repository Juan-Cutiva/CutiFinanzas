'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useAction } from 'next-safe-action/hooks';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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
  PAY_FREQUENCY_LABELS,
  type UpdateUserPreferencesInput,
  updateUserPreferencesSchema,
} from '../schema';

interface Props {
  defaults: {
    name: string | null;
    defaultCurrency: string;
    locale: string;
    timezone: string;
    payFrequency: 'weekly' | 'biweekly' | 'monthly';
  };
}

export function PreferencesForm({ defaults }: Props) {
  const form = useForm<UpdateUserPreferencesInput>({
    resolver: zodResolver(updateUserPreferencesSchema),
    defaultValues: {
      name: defaults.name ?? '',
      defaultCurrency: defaults.defaultCurrency,
      locale: defaults.locale,
      timezone: defaults.timezone,
      payFrequency: defaults.payFrequency,
    },
  });

  const { execute, isPending } = useAction(updateUserPreferencesAction, {
    onSuccess: () => toast.success('Preferencias actualizadas'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Error'),
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => execute(data))}
        className="grid gap-4 md:grid-cols-2"
      >
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

        <FormField
          control={form.control}
          name="payFrequency"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Frecuencia de pago</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(PAY_FREQUENCY_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
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
