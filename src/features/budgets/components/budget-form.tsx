'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useAction } from 'next-safe-action/hooks';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { MoneyInput } from '@/components/ui/money-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { upsertBudgetAction } from '../actions';
import { type BudgetInput, budgetInputSchema, PERIOD_LABELS } from '../schema';

interface CategoryOption {
  id: string;
  name: string;
}

interface Props {
  categories: CategoryOption[];
  year: number;
  month: number;
  defaultCurrency: string;
  onSuccess?: () => void;
}

export function BudgetForm({ categories, year, month, defaultCurrency, onSuccess }: Props) {
  const form = useForm<z.input<typeof budgetInputSchema>, unknown, BudgetInput>({
    resolver: zodResolver(budgetInputSchema),
    defaultValues: {
      categoryId: categories[0]?.id ?? '',
      year,
      month,
      period: 'monthly',
      amount: 0,
      currency: defaultCurrency,
    },
  });

  const { execute, isPending } = useAction(upsertBudgetAction, {
    onSuccess: () => {
      toast.success('Presupuesto guardado');
      form.reset();
      onSuccess?.();
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Error'),
  });

  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Primero crea categorías en Ajustes para asignar presupuestos.
      </p>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => execute(data))} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoría</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
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
          name="period"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Periodo</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(PERIOD_LABELS).map(([k, label]) => (
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
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monto</FormLabel>
              <FormControl>
                <MoneyInput
                  className="font-mono tabular-nums"
                  autoFocus
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

        <Button type="submit" disabled={isPending} size="lg" className="mt-2">
          {isPending ? 'Guardando…' : 'Guardar presupuesto'}
        </Button>
      </form>
    </Form>
  );
}
