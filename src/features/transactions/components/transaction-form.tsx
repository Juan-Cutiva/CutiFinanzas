'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useAction } from 'next-safe-action/hooks';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
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
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';
import { createTransactionAction } from '../actions';
import {
  type CreateTransactionInput,
  createTransactionSchema,
  RECURRENCE_FREQUENCIES,
  RECURRENCE_LABELS,
  type RecurrenceFrequency,
  type TransactionKind,
} from '../schema';

interface AccountOption {
  id: string;
  name: string;
  currency: string;
  type: string;
  realMinor?: string;
  creditLimitMinor?: string | null;
}
interface CategoryOption {
  id: string;
  name: string;
}
interface DebtOption {
  id: string;
  name: string;
  currency: string;
  realBalanceMinor?: string;
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
  defaultDate?: string;
  defaultKind?: TransactionKind;
  onSuccess?: () => void;
}

const KIND_LABELS_FORM: Record<TransactionKind, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  refund: 'Devolución',
  transfer: 'Transferencia entre cuentas',
  cc_charge: 'Compra con tarjeta de crédito',
  cc_payment: 'Pago a tarjeta de crédito',
  loan_payment: 'Cuota de préstamo',
  savings_contribution: 'Aporte a meta de ahorro',
};

export function TransactionForm({
  accounts,
  categories,
  debts = [],
  savingsGoals = [],
  defaultCurrency,
  defaultDate,
  defaultKind = 'expense',
  onSuccess,
}: Props) {
  const today = defaultDate ?? new Date().toISOString().slice(0, 10);

  const assetAccounts = React.useMemo(
    () => accounts.filter((a) => a.type !== 'credit_card'),
    [accounts],
  );
  const ccAccounts = React.useMemo(
    () => accounts.filter((a) => a.type === 'credit_card'),
    [accounts],
  );

  const form = useForm<z.input<typeof createTransactionSchema>, unknown, CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: {
      kind: defaultKind,
      accountId: accounts[0]?.id ?? '',
      counterAccountId: null,
      categoryId: null,
      debtId: null,
      savingsGoalId: null,
      amount: 0,
      currency: accounts[0]?.currency ?? defaultCurrency,
      transactionDate: today,
      description: '',
      notes: '',
      recurrence: null,
    },
  });

  const [isRecurring, setIsRecurring] = React.useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] =
    React.useState<RecurrenceFrequency>('monthly');
  const [recurrenceName, setRecurrenceName] = React.useState('');

  const watchedKind = form.watch('kind');
  const watchedAccountId = form.watch('accountId');
  const watchedCounterAccountId = form.watch('counterAccountId');
  const watchedDebtId = form.watch('debtId');
  const watchedAmount = form.watch('amount');

  const selectedAccount = accounts.find((a) => a.id === watchedAccountId);
  const selectedCounterAccount = accounts.find((a) => a.id === watchedCounterAccountId);
  const selectedDebt = debts.find((d) => d.id === watchedDebtId);

  const isExpense = watchedKind === 'expense';
  const isIncome = watchedKind === 'income';
  const isRefund = watchedKind === 'refund';
  const isTransfer = watchedKind === 'transfer';
  const isCcCharge = watchedKind === 'cc_charge';
  const isCcPayment = watchedKind === 'cc_payment';
  const isLoanPayment = watchedKind === 'loan_payment';
  const isSavingsContribution = watchedKind === 'savings_contribution';

  const needsCategory = isExpense || isIncome || isRefund || isCcCharge;
  const supportsRecurring = !isRefund && !isTransfer; // refund y transfer son siempre puntuales

  // Filtrar cuentas según el kind
  const accountsForOrigin: AccountOption[] = React.useMemo(() => {
    if (isCcCharge) return ccAccounts;
    if (isCcPayment) return assetAccounts;
    if (isLoanPayment || isSavingsContribution || isTransfer) return assetAccounts;
    if (isExpense || isIncome || isRefund) return assetAccounts;
    return accounts;
  }, [
    isCcCharge,
    isCcPayment,
    isLoanPayment,
    isSavingsContribution,
    isTransfer,
    isExpense,
    isIncome,
    isRefund,
    accounts,
    assetAccounts,
    ccAccounts,
  ]);

  const accountsForCounter: AccountOption[] = React.useMemo(() => {
    if (isCcPayment) return ccAccounts;
    if (isTransfer) return assetAccounts.filter((a) => a.id !== watchedAccountId);
    return [];
  }, [isCcPayment, isTransfer, assetAccounts, ccAccounts, watchedAccountId]);

  // Limpiar campos al cambiar kind
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo reaccionamos al cambio de kind
  React.useEffect(() => {
    // Reset campos según kind
    if (!needsCategory) form.setValue('categoryId', null);
    if (!isLoanPayment) form.setValue('debtId', null);
    if (!isSavingsContribution) form.setValue('savingsGoalId', null);
    if (!isTransfer && !isCcPayment) form.setValue('counterAccountId', null);

    // Ajusta cuenta a las válidas para este kind
    const valid = accountsForOrigin.find((a) => a.id === form.getValues('accountId'));
    if (!valid && accountsForOrigin[0]) {
      form.setValue('accountId', accountsForOrigin[0].id);
      form.setValue('currency', accountsForOrigin[0].currency);
    }

    // Counter account
    if (isTransfer || isCcPayment) {
      const validCounter = accountsForCounter.find(
        (a) => a.id === form.getValues('counterAccountId'),
      );
      if (!validCounter && accountsForCounter[0]) {
        form.setValue('counterAccountId', accountsForCounter[0].id);
      }
    }

    // Recurrence: si el kind no soporta recurring, apagar
    if (!supportsRecurring) setIsRecurring(false);
  }, [watchedKind]);

  const accountBalanceMajor = selectedAccount?.realMinor
    ? Number(BigInt(selectedAccount.realMinor)) / 100
    : 0;
  const ccLimitMajor = selectedAccount?.creditLimitMinor
    ? Number(BigInt(selectedAccount.creditLimitMinor)) / 100
    : 0;
  const ccAvailable = isCcCharge ? Math.max(0, ccLimitMajor - accountBalanceMajor) : 0;

  const overspending =
    !isCcCharge &&
    !isIncome &&
    !isRefund &&
    !!selectedAccount &&
    Number(watchedAmount ?? 0) > accountBalanceMajor;
  const overCcLimit = isCcCharge && !!selectedAccount && Number(watchedAmount ?? 0) > ccAvailable;

  const counterDebtMajor = selectedCounterAccount?.realMinor
    ? Number(BigInt(selectedCounterAccount.realMinor)) / 100
    : 0;
  const overpayingCC =
    isCcPayment && !!selectedCounterAccount && Number(watchedAmount ?? 0) > counterDebtMajor;

  const debtBalanceMajor = selectedDebt?.realBalanceMinor
    ? Number(BigInt(selectedDebt.realBalanceMinor)) / 100
    : 0;
  const overpayingDebt =
    isLoanPayment &&
    !!selectedDebt &&
    Number(watchedAmount ?? 0) > debtBalanceMajor &&
    debtBalanceMajor > 0;

  const { execute, isPending } = useAction(createTransactionAction, {
    onSuccess: () => {
      toast.success('Movimiento registrado');
      form.reset();
      setIsRecurring(false);
      setRecurrenceName('');
      onSuccess?.();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'No se pudo registrar');
    },
  });

  function onSubmit(data: CreateTransactionInput) {
    const payload: CreateTransactionInput = {
      ...data,
      recurrence:
        isRecurring && supportsRecurring
          ? {
              frequency: recurrenceFrequency,
              name:
                recurrenceName.trim() || data.description?.trim() || KIND_LABELS_FORM[data.kind],
            }
          : null,
    };
    execute(payload);
  }

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

  // Filtrar kinds visibles según contexto
  const allKinds: TransactionKind[] = [
    'expense',
    'income',
    'refund',
    'transfer',
    'cc_charge',
    'cc_payment',
    'loan_payment',
    'savings_contribution',
  ];
  const visibleKinds = allKinds.filter((k) => {
    if ((k === 'cc_charge' || k === 'cc_payment') && ccAccounts.length === 0) return false;
    if (k === 'cc_payment' && assetAccounts.length === 0) return false;
    if (k === 'transfer' && assetAccounts.length < 2) return false;
    if (k === 'loan_payment' && debts.length === 0) return false;
    if (k === 'savings_contribution' && savingsGoals.length === 0) return false;
    return true;
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Tipo de movimiento */}
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
                      {KIND_LABELS_FORM[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Frecuencia */}
        {supportsRecurring ? (
          <div className="flex flex-col gap-2">
            <Label>Frecuencia</Label>
            <Select
              value={isRecurring ? recurrenceFrequency : 'once'}
              onValueChange={(v) => {
                if (v === 'once') {
                  setIsRecurring(false);
                } else {
                  setIsRecurring(true);
                  setRecurrenceFrequency(v as RecurrenceFrequency);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">Único (este movimiento puntual)</SelectItem>
                {RECURRENCE_FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {RECURRENCE_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {isRecurring
                ? 'Se creará una regla recurrente. La primera ocurrencia es la fecha que selecciones; las siguientes se materializan automáticamente.'
                : 'Solo aplica a la fecha que selecciones.'}
            </p>
          </div>
        ) : null}

        {/* Nombre de la regla recurrente */}
        {isRecurring ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="rrname">Nombre de la regla</Label>
            <Input
              id="rrname"
              placeholder="Ej. Spotify, Salario quincenal, Cuota moto…"
              value={recurrenceName}
              onChange={(e) => setRecurrenceName(e.target.value)}
            />
          </div>
        ) : null}

        {/* Monto */}
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

        {/* Cuenta principal */}
        <FormField
          control={form.control}
          name="accountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {isCcCharge
                  ? 'Tarjeta de crédito'
                  : isCcPayment || isTransfer || isLoanPayment || isSavingsContribution
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
                  {isCcCharge ? (
                    <>
                      Cupo disponible{' '}
                      <span className="font-mono tabular-nums font-semibold text-foreground">
                        {formatAmount(ccAvailable, selectedAccount.currency as CurrencyCode)}
                      </span>{' '}
                      · saldo CC{' '}
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
          <p className="rounded-md border border-(--expense)/40 bg-(--expense)/10 px-3 py-2 text-xs text-amount-negative">
            No tienes saldo suficiente. Disponible:{' '}
            {formatAmount(
              accountBalanceMajor,
              (selectedAccount?.currency ?? 'COP') as CurrencyCode,
            )}
          </p>
        ) : null}
        {overCcLimit ? (
          <p className="rounded-md border border-(--expense)/40 bg-(--expense)/10 px-3 py-2 text-xs text-amount-negative">
            Excedes el cupo disponible (
            {formatAmount(ccAvailable, (selectedAccount?.currency ?? 'COP') as CurrencyCode)}
            ).
          </p>
        ) : null}

        {/* Cuenta destino (transfer, cc_payment) */}
        {(isTransfer || isCcPayment) && (
          <FormField
            control={form.control}
            name="counterAccountId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{isCcPayment ? 'Tarjeta a la que pagas' : 'A la cuenta'}</FormLabel>
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona destino" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {accountsForCounter.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} · {a.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isCcPayment && selectedCounterAccount ? (
                  <FormDescription>
                    Saldo a pagar de la tarjeta:{' '}
                    <span className="font-mono tabular-nums font-semibold text-amount-negative">
                      {formatAmount(
                        counterDebtMajor,
                        selectedCounterAccount.currency as CurrencyCode,
                      )}
                    </span>
                  </FormDescription>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {overpayingCC && selectedCounterAccount ? (
          <p className="rounded-md border border-(--expense)/40 bg-(--expense)/10 px-3 py-2 text-xs text-amount-negative">
            El pago excede el saldo de la tarjeta (
            {formatAmount(counterDebtMajor, selectedCounterAccount.currency as CurrencyCode)}
            ).
          </p>
        ) : null}

        {/* Categoría */}
        {needsCategory ? (
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

        {/* Préstamo */}
        {isLoanPayment ? (
          <FormField
            control={form.control}
            name="debtId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Préstamo</FormLabel>
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el préstamo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {debts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} · {d.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedDebt ? (
                  <FormDescription>
                    Saldo restante:{' '}
                    <span className="font-mono tabular-nums font-semibold text-amount-negative">
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
          <p className="rounded-md border border-(--expense)/40 bg-(--expense)/10 px-3 py-2 text-xs text-amount-negative">
            El pago supera el saldo (
            {formatAmount(debtBalanceMajor, selectedDebt.currency as CurrencyCode)}
            ).
          </p>
        ) : null}

        {/* Meta de ahorro */}
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
                    {savingsGoals.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} · {g.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {/* Fecha */}
        <FormField
          control={form.control}
          name="transactionDate"
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

        {/* Descripción */}
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

        {/* Notas */}
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

        {/* Comprobante */}
        {!isTransfer && !isCcPayment && !isRecurring ? (
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
        ) : null}

        <Button
          type="submit"
          disabled={isPending || overspending || overCcLimit || overpayingCC || overpayingDebt}
          size="lg"
          className="mt-2"
        >
          {isPending ? 'Guardando…' : 'Registrar'}
        </Button>
      </form>
    </Form>
  );
}
