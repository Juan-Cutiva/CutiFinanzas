'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useAction } from 'next-safe-action/hooks';
import * as React from 'react';
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
import { createTransactionAction } from '../actions';
import { type TransactionInput, TX_KIND_LABELS, transactionInputSchema } from '../schema';

interface AccountOption {
  id: string;
  name: string;
  currency: string;
  type: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface DebtOption {
  id: string;
  name: string;
  currency: string;
}

interface SavingsOption {
  id: string;
  name: string;
  currency: string;
}

interface Props {
  accounts: AccountOption[];
  categories: CategoryOption[];
  debts?: DebtOption[];
  savingsGoals?: SavingsOption[];
  defaultCurrency: string;
  defaultKind?: TransactionInput['kind'];
  onSuccess?: () => void;
}

export function TransactionForm({
  accounts,
  categories,
  debts = [],
  savingsGoals = [],
  defaultCurrency,
  defaultKind = 'expense_variable',
  onSuccess,
}: Props) {
  const today = dayjs().format('YYYY-MM-DD');

  const form = useForm<z.input<typeof transactionInputSchema>, unknown, TransactionInput>({
    resolver: zodResolver(transactionInputSchema),
    defaultValues: {
      kind: defaultKind,
      accountId: accounts[0]?.id ?? '',
      transferAccountId: null,
      categoryId: null,
      debtId: null,
      savingsGoalId: null,
      amount: 0,
      currency: accounts[0]?.currency ?? defaultCurrency,
      occurredAt: today,
      description: '',
      notes: '',
      isPaid: true,
    },
  });

  const watchedKind = form.watch('kind');
  const watchedAccountId = form.watch('accountId');
  const selectedAccount = accounts.find((a) => a.id === watchedAccountId);

  React.useEffect(() => {
    if (watchedKind === 'expense_fixed' || watchedKind === 'expense_variable') {
      const current = form.getValues('categoryId');
      if (!current && categories[0]) form.setValue('categoryId', categories[0].id);
    } else {
      form.setValue('categoryId', null);
    }
    if (watchedKind !== 'transfer') form.setValue('transferAccountId', null);
    if (watchedKind !== 'debt_payment') form.setValue('debtId', null);
    if (watchedKind !== 'savings_contribution') form.setValue('savingsGoalId', null);
  }, [watchedKind, categories, form]);

  const { execute, isPending } = useAction(createTransactionAction, {
    onSuccess: () => {
      toast.success('Movimiento registrado');
      form.reset({
        kind: defaultKind,
        accountId: accounts[0]?.id ?? '',
        transferAccountId: null,
        categoryId: null,
        debtId: null,
        savingsGoalId: null,
        amount: 0,
        currency: accounts[0]?.currency ?? defaultCurrency,
        occurredAt: today,
        description: '',
        notes: '',
        isPaid: true,
      });
      onSuccess?.();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'No se pudo registrar');
    },
  });

  if (accounts.length === 0) {
    return (
      <div className="space-y-3 py-2">
        <p className="text-sm text-muted-foreground">
          Primero crea al menos una cuenta para registrar movimientos.
        </p>
        <Button asChild>
          <a href="/cuentas">Ir a Cuentas</a>
        </Button>
      </div>
    );
  }

  const isTransfer = watchedKind === 'transfer';
  const isExpense = watchedKind === 'expense_fixed' || watchedKind === 'expense_variable';
  const isDebtPayment = watchedKind === 'debt_payment';
  const isSavingsContribution = watchedKind === 'savings_contribution';
  const accountIsCreditCard = selectedAccount?.type === 'credit_card';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => execute(data))} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(TX_KIND_LABELS).map(([k, label]) => (
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
                  className="font-mono tabular-nums text-lg"
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

        <FormField
          control={form.control}
          name="accountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{isTransfer ? 'Desde la cuenta' : 'Cuenta'}</FormLabel>
              <Select
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v);
                  const acc = accounts.find((a) => a.id === v);
                  if (acc) form.setValue('currency', acc.currency);
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {a.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {accountIsCreditCard && watchedKind.startsWith('income') ? (
          <p className="rounded-md border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 px-3 py-2 text-xs text-[color:var(--warning)]">
            Tip: si estás pagando tu tarjeta, usa <strong>Pago de deuda</strong> y elige la tarjeta
            como deuda. Aquí estarías sumando saldo a la tarjeta misma.
          </p>
        ) : null}

        {isTransfer ? (
          <FormField
            control={form.control}
            name="transferAccountId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>A la cuenta</FormLabel>
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona destino" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {accounts
                      .filter((a) => a.id !== watchedAccountId)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} · {a.currency}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {isExpense ? (
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoría</FormLabel>
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona categoría" />
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
        ) : null}

        {isDebtPayment ? (
          <FormField
            control={form.control}
            name="debtId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deuda</FormLabel>
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona la deuda" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {debts.length === 0 ? (
                      <SelectItem value="-" disabled>
                        Sin deudas activas
                      </SelectItem>
                    ) : (
                      debts.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} · {d.currency}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {isSavingsContribution ? (
          <FormField
            control={form.control}
            name="savingsGoalId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meta de ahorro</FormLabel>
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona la meta" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {savingsGoals.length === 0 ? (
                      <SelectItem value="-" disabled>
                        Sin metas activas
                      </SelectItem>
                    ) : (
                      savingsGoals.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name} · {g.currency}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <FormField
          control={form.control}
          name="occurredAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha</FormLabel>
              <FormControl>
                <DatePicker value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción (opcional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Mercado, gasolina, salario..."
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
          {isPending ? 'Guardando…' : 'Registrar'}
        </Button>
      </form>
    </Form>
  );
}
