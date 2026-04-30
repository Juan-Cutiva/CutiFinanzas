'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useAction } from 'next-safe-action/hooks';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { dayjs } from '@/lib/format';
import { SUPPORTED_CURRENCIES } from '@/lib/money';
import { createSavingsGoalAction } from '../actions';
import { type SavingsGoalInput, savingsGoalInputSchema } from '../schema';

interface Props {
  defaultCurrency: string;
  onSuccess?: () => void;
}

export function SavingsGoalForm({ defaultCurrency, onSuccess }: Props) {
  const form = useForm<z.input<typeof savingsGoalInputSchema>, unknown, SavingsGoalInput>({
    resolver: zodResolver(savingsGoalInputSchema),
    defaultValues: {
      name: '',
      targetAmount: 0,
      currentAmount: 0,
      monthlyContribution: 0,
      currency: defaultCurrency,
      startDate: dayjs().format('YYYY-MM-DD'),
      targetDate: undefined,
      icon: 'PiggyBank',
      color: 'var(--chart-2)',
      notes: '',
    },
  });

  const { execute, isPending } = useAction(createSavingsGoalAction, {
    onSuccess: () => {
      toast.success('Meta creada');
      form.reset();
      onSuccess?.();
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Error'),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => execute(data))} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input placeholder="Fondo de emergencia, viaje..." autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="currency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Moneda</FormLabel>
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

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="targetAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meta</FormLabel>
                <FormControl>
                  <MoneyInput
                    className="font-mono tabular-nums"
                    value={field.value as number | undefined}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currentAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ya tengo</FormLabel>
                <FormControl>
                  <MoneyInput
                    className="font-mono tabular-nums"
                    value={field.value as number | undefined}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="monthlyContribution"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Aporte mensual</FormLabel>
              <FormControl>
                <MoneyInput
                  className="font-mono tabular-nums"
                  value={field.value as number | undefined}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Inicio</FormLabel>
                <FormControl>
                  <DatePicker value={field.value ?? ''} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="targetDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha meta (opcional)</FormLabel>
                <FormControl>
                  <DatePicker
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Sin fecha meta"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={isPending} size="lg" className="mt-2">
          {isPending ? 'Guardando…' : 'Crear meta'}
        </Button>
      </form>
    </Form>
  );
}
