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
import { Textarea } from '@/components/ui/textarea';
import { dayjs } from '@/lib/format';
import { SUPPORTED_CURRENCIES } from '@/lib/money';
import { createDebtAction } from '../actions';
import { type DebtInput, debtInputSchema } from '../schema';

interface Props {
  defaultCurrency: string;
  onSuccess?: () => void;
}

export function DebtForm({ defaultCurrency, onSuccess }: Props) {
  const form = useForm<z.input<typeof debtInputSchema>, unknown, DebtInput>({
    resolver: zodResolver(debtInputSchema),
    defaultValues: {
      name: '',
      initialAmount: 0,
      currentBalance: 0,
      currency: defaultCurrency,
      interestRateAnnual: undefined,
      monthlyPayment: 0,
      startDate: dayjs().format('YYYY-MM-DD'),
      endDate: undefined,
      paidInstallments: 0,
      notes: '',
    },
  });

  const { execute, isPending } = useAction(createDebtAction, {
    onSuccess: () => {
      toast.success('Deuda registrada');
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
                <Input placeholder="Crédito moto, Tarjeta..." autoFocus {...field} />
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
            name="initialAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monto inicial</FormLabel>
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
            name="currentBalance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Saldo actual</FormLabel>
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

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="monthlyPayment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cuota mensual</FormLabel>
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
            name="interestRateAnnual"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tasa anual (%)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    className="tabular-nums"
                    placeholder="22.5"
                    value={(field.value ?? '') as string | number}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                    }
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
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fin (opcional)</FormLabel>
                <FormControl>
                  <DatePicker
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Sin fecha fin"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas (opcional)</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} size="lg" className="mt-2">
          {isPending ? 'Guardando…' : 'Registrar deuda'}
        </Button>
      </form>
    </Form>
  );
}
