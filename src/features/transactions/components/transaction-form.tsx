'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useAction } from 'next-safe-action/hooks';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { DayOfMonthPicker, nextDateForDayOfMonth } from '@/components/ui/day-of-month-picker';
import { FileUpload } from '@/components/ui/file-upload';
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
import { MoneyInput } from '@/components/ui/money-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { dayjs, formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import { createTransactionAction } from '../actions';
import { type TransactionInput, TX_KIND_LABELS, transactionInputSchema } from '../schema';

interface AccountOption {
  id: string;
  name: string;
  currency: string;
  type: string;
  balanceMinor: string;
  creditLimitMinor: string | null;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface DebtOption {
  id: string;
  name: string;
  currency: string;
  currentBalanceMinor: string;
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

  const assetAccounts = React.useMemo(
    () => accounts.filter((a) => a.type !== 'credit_card' && a.type !== 'loan'),
    [accounts],
  );
  const creditCardAccounts = React.useMemo(
    () => accounts.filter((a) => a.type === 'credit_card'),
    [accounts],
  );
  const hasCreditCard = creditCardAccounts.length > 0;

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
  const watchedTransferAccountId = form.watch('transferAccountId');
  const watchedDebtId = form.watch('debtId');
  const watchedAmount = form.watch('amount');
  const selectedAccount = accounts.find((a) => a.id === watchedAccountId);
  const selectedTransferAccount = accounts.find((a) => a.id === watchedTransferAccountId);
  const selectedDebt = debts.find((d) => d.id === watchedDebtId);

  const isFixed = watchedKind === 'income_fixed' || watchedKind === 'expense_fixed';
  const isTransfer = watchedKind === 'transfer';
  const isCreditCardPayment = watchedKind === 'credit_card_payment';
  const isExpense = watchedKind === 'expense_fixed' || watchedKind === 'expense_variable';
  const isDebtPayment = watchedKind === 'debt_payment';
  const isSavingsContribution = watchedKind === 'savings_contribution';
  const accountIsCreditCard = selectedAccount?.type === 'credit_card';

  const accountsForOrigin = isCreditCardPayment ? assetAccounts : accounts;
  const accountsForDestination = isCreditCardPayment
    ? creditCardAccounts
    : accounts.filter((a) => a.id !== watchedAccountId);

  const accountBalanceMajor = selectedAccount
    ? Number(BigInt(selectedAccount.balanceMinor)) / 100
    : 0;
  const accountCreditLimitMajor = selectedAccount?.creditLimitMinor
    ? Number(BigInt(selectedAccount.creditLimitMinor)) / 100
    : 0;
  const availableMajor = accountIsCreditCard
    ? Math.max(0, accountCreditLimitMajor - accountBalanceMajor)
    : accountBalanceMajor;

  const reducesAccount =
    isExpense || isTransfer || isCreditCardPayment || isDebtPayment || isSavingsContribution;
  const overspending =
    !!selectedAccount &&
    reducesAccount &&
    Number(watchedAmount ?? 0) > 0 &&
    Number(watchedAmount) > availableMajor;

  const destinationDebtMajor =
    isCreditCardPayment && selectedTransferAccount
      ? Number(BigInt(selectedTransferAccount.balanceMinor)) / 100
      : 0;
  const overpayingCard =
    isCreditCardPayment &&
    !!selectedTransferAccount &&
    Number(watchedAmount ?? 0) > 0 &&
    Number(watchedAmount) > destinationDebtMajor;

  const debtBalanceMajor = selectedDebt
    ? Number(BigInt(selectedDebt.currentBalanceMinor)) / 100
    : 0;
  const overpayingDebt =
    isDebtPayment &&
    !!selectedDebt &&
    Number(watchedAmount ?? 0) > 0 &&
    Number(watchedAmount) > debtBalanceMajor;

  React.useEffect(() => {
    if (isExpense) {
      const current = form.getValues('categoryId');
      if (!current && categories[0]) form.setValue('categoryId', categories[0].id);
    } else {
      form.setValue('categoryId', null);
    }
    if (!isTransfer && !isCreditCardPayment) form.setValue('transferAccountId', null);
    if (!isDebtPayment) form.setValue('debtId', null);
    if (!isSavingsContribution) form.setValue('savingsGoalId', null);

    if (isCreditCardPayment) {
      const currentAccount = form.getValues('accountId');
      if (!assetAccounts.find((a) => a.id === currentAccount) && assetAccounts[0]) {
        form.setValue('accountId', assetAccounts[0].id);
        form.setValue('currency', assetAccounts[0].currency);
      }
      const currentDest = form.getValues('transferAccountId');
      if (!creditCardAccounts.find((a) => a.id === currentDest) && creditCardAccounts[0]) {
        form.setValue('transferAccountId', creditCardAccounts[0].id);
      }
    }
  }, [
    watchedKind,
    isExpense,
    isTransfer,
    isCreditCardPayment,
    isDebtPayment,
    isSavingsContribution,
    assetAccounts,
    creditCardAccounts,
    categories,
    form,
  ]);

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

  const visibleKinds = (Object.keys(TX_KIND_LABELS) as Array<keyof typeof TX_KIND_LABELS>).filter(
    (k) => k !== 'credit_card_payment' || hasCreditCard,
  );

  function setOccurredAtFromDayOfMonth(day: number) {
    form.setValue('occurredAt', nextDateForDayOfMonth(day));
  }

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
                  {visibleKinds.map((k) => (
                    <SelectItem key={k} value={k}>
                      {TX_KIND_LABELS[k]}
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
              <FormLabel>
                {isCreditCardPayment
                  ? 'Pago desde la cuenta'
                  : isTransfer
                    ? 'Desde la cuenta'
                    : 'Cuenta'}
              </FormLabel>
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
                  {accountsForOrigin.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {a.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAccount ? (
                <FormDescription>
                  {accountIsCreditCard ? (
                    <>
                      Cupo disponible{' '}
                      <span className="font-mono tabular-nums font-semibold text-foreground">
                        {formatAmount(availableMajor, selectedAccount.currency as CurrencyCode)}
                      </span>{' '}
                      · deuda actual{' '}
                      {formatAmount(accountBalanceMajor, selectedAccount.currency as CurrencyCode)}
                    </>
                  ) : (
                    <>
                      Saldo disponible{' '}
                      <span
                        className={`font-mono tabular-nums font-semibold ${
                          accountBalanceMajor >= 0 ? 'text-amount-positive' : 'text-amount-negative'
                        }`}
                      >
                        {formatAmount(
                          accountBalanceMajor,
                          selectedAccount.currency as CurrencyCode,
                        )}
                      </span>
                    </>
                  )}
                </FormDescription>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />

        {overspending ? (
          <p className="rounded-md border border-(--expense)/40 bg-(--expense)/10 px-3 py-2 text-xs text-expense">
            {accountIsCreditCard
              ? `Excedes el cupo disponible (${formatAmount(availableMajor, (selectedAccount?.currency ?? 'COP') as CurrencyCode)}).`
              : `No tienes saldo suficiente. Disponible: ${formatAmount(availableMajor, (selectedAccount?.currency ?? 'COP') as CurrencyCode)}.`}
          </p>
        ) : null}

        {accountIsCreditCard &&
        (watchedKind === 'income_fixed' || watchedKind === 'income_variable') ? (
          <p className="rounded-md border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 px-3 py-2 text-xs text-[color:var(--warning)]">
            Tip: si estás abonando a tu tarjeta, usa <strong>Pago de tarjeta de crédito</strong> con
            la cuenta de origen real (débito/ahorro). Aquí estarías sumando saldo a la tarjeta
            misma.
          </p>
        ) : null}

        {isTransfer || isCreditCardPayment ? (
          <FormField
            control={form.control}
            name="transferAccountId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {isCreditCardPayment ? 'Tarjeta a la que pagas' : 'A la cuenta'}
                </FormLabel>
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona destino" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {accountsForDestination.length === 0 ? (
                      <SelectItem value="-" disabled>
                        {isCreditCardPayment
                          ? 'Sin tarjetas registradas'
                          : 'Sin cuentas disponibles'}
                      </SelectItem>
                    ) : (
                      accountsForDestination.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} · {a.currency}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {isCreditCardPayment && selectedTransferAccount ? (
                  <FormDescription>
                    Deuda actual{' '}
                    <span
                      className={`font-mono tabular-nums font-semibold ${
                        destinationDebtMajor > 0 ? 'text-amount-negative' : 'text-foreground'
                      }`}
                    >
                      {formatAmount(
                        destinationDebtMajor,
                        selectedTransferAccount.currency as CurrencyCode,
                      )}
                    </span>
                    {selectedTransferAccount.creditLimitMinor ? (
                      <>
                        {' '}
                        · cupo total{' '}
                        {formatAmount(
                          Number(BigInt(selectedTransferAccount.creditLimitMinor)) / 100,
                          selectedTransferAccount.currency as CurrencyCode,
                        )}
                      </>
                    ) : null}
                  </FormDescription>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {overpayingCard && selectedTransferAccount ? (
          <p className="rounded-md border border-(--expense)/40 bg-(--expense)/10 px-3 py-2 text-xs text-expense">
            El pago supera la deuda actual de la tarjeta (
            {formatAmount(destinationDebtMajor, selectedTransferAccount.currency as CurrencyCode)}
            ).
          </p>
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
                {selectedDebt ? (
                  <FormDescription>
                    Saldo restante{' '}
                    <span
                      className={`font-mono tabular-nums font-semibold ${
                        debtBalanceMajor > 0 ? 'text-amount-negative' : 'text-foreground'
                      }`}
                    >
                      {formatAmount(debtBalanceMajor, selectedDebt.currency as CurrencyCode)}
                    </span>
                  </FormDescription>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {overpayingDebt && selectedDebt ? (
          <p className="rounded-md border border-(--expense)/40 bg-(--expense)/10 px-3 py-2 text-xs text-expense">
            El pago supera el saldo restante de la deuda (
            {formatAmount(debtBalanceMajor, selectedDebt.currency as CurrencyCode)}
            ).
          </p>
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

        {isFixed ? (
          <FormField
            control={form.control}
            name="occurredAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Día del mes en que se repite</FormLabel>
                <FormControl>
                  <DayOfMonthPicker
                    value={Number.parseInt((field.value || today).slice(8, 10), 10)}
                    onChange={(d) => setOccurredAtFromDayOfMonth(d)}
                  />
                </FormControl>
                <FormDescription>
                  La primera ocurrencia será el día {field.value?.slice(8, 10)} del mes en curso (o
                  el siguiente si ya pasó). Cada mes se repetirá automáticamente en ese día.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
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
        )}

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción {isFixed ? '' : '(opcional)'}</FormLabel>
              <FormControl>
                <Input
                  placeholder={
                    isFixed ? 'Ej. Salario quincenal, Spotify…' : 'Mercado, gasolina, salario...'
                  }
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

        {isFixed || isTransfer || isCreditCardPayment ? null : (
          <FormField
            control={form.control}
            name="receiptUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Comprobante (opcional)</FormLabel>
                <FormControl>
                  <FileUpload value={field.value ?? undefined} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button
          type="submit"
          disabled={isPending || overspending || overpayingCard || overpayingDebt}
          size="lg"
          className="mt-2"
        >
          {isPending ? 'Guardando…' : 'Registrar'}
        </Button>
      </form>
    </Form>
  );
}
