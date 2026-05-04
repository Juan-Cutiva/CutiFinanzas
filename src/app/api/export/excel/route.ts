import dayjs from 'dayjs';
import { eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { getOrCreateUser } from '@/db/queries/users';
import {
  accounts,
  budgets,
  categories,
  debts,
  recurringRules,
  savingsGoals,
  transactions,
} from '@/db/schema';
import { type AccountType, classifyAccount } from '@/features/accounts/domain';
import { ACCOUNT_TYPE_LABELS } from '@/features/accounts/schema';
import { TX_KIND_LABELS } from '@/features/transactions/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF572364' },
};
const HEADER_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true };
const MONEY_FORMAT = '#,##0';
const DATE_FORMAT = 'yyyy-mm-dd';

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF572364' } },
    };
  });
  row.height = 22;
}

function autoSizeColumns(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 50);
  });
}

export async function GET(_req: NextRequest) {
  const user = await getOrCreateUser();
  const userId = user.id;

  const [accs, cats, txs, bgs, dbs, sgs, rrs] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
    db.select().from(budgets).where(eq(budgets.userId, userId)),
    db.select().from(debts).where(eq(debts.userId, userId)),
    db.select().from(savingsGoals).where(eq(savingsGoals.userId, userId)),
    db.select().from(recurringRules).where(eq(recurringRules.userId, userId)),
  ]);

  const accountsById = new Map(accs.map((a) => [a.id, a]));
  const categoriesById = new Map(cats.map((c) => [c.id, c]));
  const debtsById = new Map(dbs.map((d) => [d.id, d]));
  const goalsById = new Map(sgs.map((g) => [g.id, g]));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CutiFinanzas';
  wb.created = new Date();

  // Resumen
  const summary = wb.addWorksheet('Resumen', { properties: { tabColor: { argb: 'FF572364' } } });
  summary.columns = [
    { header: 'Métrica', key: 'metric', width: 32 },
    { header: 'Valor', key: 'value', width: 24 },
  ];
  styleHeader(summary.getRow(1));

  const totalIncomeMinor = txs
    .filter((t) => ['income', 'income_fixed', 'income_variable', 'refund'].includes(t.kind))
    .reduce((acc, t) => acc + Number(t.amountMinor), 0);
  const totalExpenseMinor = txs
    .filter((t) =>
      ['expense_fixed', 'expense_variable', 'debt_payment', 'savings_contribution'].includes(
        t.kind,
      ),
    )
    .reduce((acc, t) => acc + Number(t.amountMinor), 0);

  summary.addRows([
    { metric: 'Usuario', value: user.name ?? user.email ?? user.id },
    { metric: 'Moneda principal', value: user.defaultCurrency },
    { metric: 'Frecuencia de pago', value: user.payFrequency },
    { metric: 'Exportado el', value: dayjs().format('YYYY-MM-DD HH:mm') },
    { metric: '', value: '' },
    { metric: 'Cuentas registradas', value: accs.length },
    { metric: 'Categorías', value: cats.length },
    { metric: 'Transacciones', value: txs.length },
    { metric: 'Pagos fijos / recurrentes', value: rrs.length },
    { metric: 'Deudas', value: dbs.length },
    { metric: 'Metas de ahorro', value: sgs.length },
    { metric: 'Presupuestos', value: bgs.length },
    { metric: '', value: '' },
    { metric: 'Total ingresos histórico', value: totalIncomeMinor / 100 },
    { metric: 'Total gastos histórico', value: totalExpenseMinor / 100 },
    { metric: 'Balance neto', value: (totalIncomeMinor - totalExpenseMinor) / 100 },
  ]);
  for (let i = 14; i <= 16; i++) {
    summary.getCell(`B${i}`).numFmt = MONEY_FORMAT;
  }

  // Cuentas
  const accountsSheet = wb.addWorksheet('Cuentas');
  accountsSheet.columns = [
    { header: 'Nombre', key: 'name', width: 28 },
    { header: 'Tipo', key: 'type', width: 18 },
    { header: 'Clasificación', key: 'classification', width: 14 },
    { header: 'Moneda', key: 'currency', width: 10 },
    { header: 'Saldo inicial', key: 'initial', width: 16 },
    { header: 'Cupo (TC)', key: 'limit', width: 14 },
    { header: 'Institución', key: 'institution', width: 22 },
    { header: 'Día corte', key: 'statementDay', width: 10 },
    { header: 'Día pago', key: 'paymentDueDay', width: 10 },
  ];
  styleHeader(accountsSheet.getRow(1));
  for (const a of accs) {
    accountsSheet.addRow({
      name: a.name,
      type: ACCOUNT_TYPE_LABELS[a.type as keyof typeof ACCOUNT_TYPE_LABELS] ?? a.type,
      classification: classifyAccount(a.type as AccountType) === 'asset' ? 'Activo' : 'Pasivo',
      currency: a.currency,
      initial: Number(a.initialBalanceMinor) / 100,
      limit: a.creditLimitMinor ? Number(a.creditLimitMinor) / 100 : '',
      institution: a.institution ?? '',
      statementDay: a.statementDay ?? '',
      paymentDueDay: a.paymentDueDay ?? '',
    });
  }
  accountsSheet.getColumn('initial').numFmt = MONEY_FORMAT;
  accountsSheet.getColumn('limit').numFmt = MONEY_FORMAT;

  // Categorías
  const categoriesSheet = wb.addWorksheet('Categorías');
  categoriesSheet.columns = [
    { header: 'Nombre', key: 'name', width: 30 },
    { header: 'Color', key: 'color', width: 14 },
    { header: 'Icono', key: 'icon', width: 14 },
    { header: 'Padre', key: 'parent', width: 24 },
    { header: 'Archivada', key: 'archived', width: 12 },
  ];
  styleHeader(categoriesSheet.getRow(1));
  for (const c of cats) {
    categoriesSheet.addRow({
      name: c.name,
      color: c.color,
      icon: c.icon,
      parent: c.parentId ? (categoriesById.get(c.parentId)?.name ?? '') : '',
      archived: c.archivedAt ? 'Sí' : 'No',
    });
  }

  // Transacciones
  const txSheet = wb.addWorksheet('Transacciones');
  txSheet.columns = [
    { header: 'Fecha', key: 'date', width: 12 },
    { header: 'Tipo', key: 'kind', width: 28 },
    { header: 'Descripción', key: 'description', width: 32 },
    { header: 'Cuenta origen', key: 'account', width: 22 },
    { header: 'Cuenta destino', key: 'transferAccount', width: 22 },
    { header: 'Categoría', key: 'category', width: 22 },
    { header: 'Deuda', key: 'debt', width: 22 },
    { header: 'Meta de ahorro', key: 'goal', width: 22 },
    { header: 'Monto', key: 'amount', width: 14 },
    { header: 'Moneda', key: 'currency', width: 10 },
    { header: 'Pagado', key: 'isPaid', width: 10 },
    { header: 'Recurrente', key: 'isRecurring', width: 12 },
    { header: 'Notas', key: 'notes', width: 32 },
  ];
  styleHeader(txSheet.getRow(1));
  txSheet.views = [{ state: 'frozen', ySplit: 1 }];
  txSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 13 },
  };
  const sortedTxs = [...txs].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
  for (const t of sortedTxs) {
    txSheet.addRow({
      date: t.occurredAt,
      kind: TX_KIND_LABELS[t.kind as keyof typeof TX_KIND_LABELS] ?? t.kind,
      description: t.description ?? '',
      account: t.accountId ? (accountsById.get(t.accountId)?.name ?? '') : '',
      transferAccount: t.transferAccountId
        ? (accountsById.get(t.transferAccountId)?.name ?? '')
        : '',
      category: t.categoryId ? (categoriesById.get(t.categoryId)?.name ?? '') : '',
      debt: t.debtId ? (debtsById.get(t.debtId)?.name ?? '') : '',
      goal: t.savingsGoalId ? (goalsById.get(t.savingsGoalId)?.name ?? '') : '',
      amount: Number(t.amountMinor) / 100,
      currency: t.currency,
      isPaid: t.isPaid ? 'Sí' : 'No',
      isRecurring: t.isRecurring ? 'Sí' : 'No',
      notes: t.notes ?? '',
    });
  }
  txSheet.getColumn('date').numFmt = DATE_FORMAT;
  txSheet.getColumn('amount').numFmt = MONEY_FORMAT;

  // Recurring rules
  if (rrs.length > 0) {
    const rrSheet = wb.addWorksheet('Recurrentes');
    rrSheet.columns = [
      { header: 'Nombre', key: 'name', width: 30 },
      { header: 'Tipo', key: 'kind', width: 28 },
      { header: 'Cuenta', key: 'account', width: 22 },
      { header: 'Categoría', key: 'category', width: 22 },
      { header: 'Monto', key: 'amount', width: 14 },
      { header: 'Moneda', key: 'currency', width: 10 },
      { header: 'Frecuencia', key: 'frequency', width: 14 },
      { header: 'Día del mes', key: 'dayOfMonth', width: 12 },
      { header: 'Inicio', key: 'startDate', width: 12 },
      { header: 'Fin', key: 'endDate', width: 12 },
      { header: 'Próximo', key: 'nextOccurrenceDate', width: 12 },
      { header: 'Activa', key: 'isActive', width: 10 },
    ];
    styleHeader(rrSheet.getRow(1));
    for (const r of rrs) {
      rrSheet.addRow({
        name: r.name,
        kind: TX_KIND_LABELS[r.kind as keyof typeof TX_KIND_LABELS] ?? r.kind,
        account: accountsById.get(r.accountId)?.name ?? '',
        category: r.categoryId ? (categoriesById.get(r.categoryId)?.name ?? '') : '',
        amount: Number(r.amountMinor) / 100,
        currency: r.currency,
        frequency: r.frequency,
        dayOfMonth: r.dayOfMonth ?? '',
        startDate: r.startDate,
        endDate: r.endDate ?? '',
        nextOccurrenceDate: r.nextOccurrenceDate,
        isActive: r.isActive ? 'Sí' : 'No',
      });
    }
    rrSheet.getColumn('amount').numFmt = MONEY_FORMAT;
    rrSheet.getColumn('startDate').numFmt = DATE_FORMAT;
    rrSheet.getColumn('endDate').numFmt = DATE_FORMAT;
    rrSheet.getColumn('nextOccurrenceDate').numFmt = DATE_FORMAT;
  }

  // Deudas
  if (dbs.length > 0) {
    const debtsSheet = wb.addWorksheet('Deudas');
    debtsSheet.columns = [
      { header: 'Nombre', key: 'name', width: 30 },
      { header: 'Saldo inicial', key: 'initial', width: 14 },
      { header: 'Saldo actual', key: 'current', width: 14 },
      { header: 'Moneda', key: 'currency', width: 10 },
      { header: 'Tasa anual %', key: 'rate', width: 12 },
      { header: 'Cuota mensual', key: 'monthly', width: 14 },
      { header: 'Cuotas pagadas', key: 'paid', width: 14 },
      { header: 'Cuotas totales', key: 'total', width: 14 },
      { header: 'Inicio', key: 'start', width: 12 },
      { header: 'Fin', key: 'end', width: 12 },
      { header: 'Estado', key: 'status', width: 12 },
    ];
    styleHeader(debtsSheet.getRow(1));
    for (const d of dbs) {
      debtsSheet.addRow({
        name: d.name,
        initial: Number(d.initialAmountMinor) / 100,
        current: Number(d.currentBalanceMinor) / 100,
        currency: d.currency,
        rate: d.interestRateAnnual ? Number(d.interestRateAnnual) : '',
        monthly: Number(d.monthlyPaymentMinor) / 100,
        paid: d.paidInstallments,
        total: d.totalInstallments ?? '',
        start: d.startDate,
        end: d.endDate ?? '',
        status: d.status,
      });
    }
    debtsSheet.getColumn('initial').numFmt = MONEY_FORMAT;
    debtsSheet.getColumn('current').numFmt = MONEY_FORMAT;
    debtsSheet.getColumn('monthly').numFmt = MONEY_FORMAT;
    debtsSheet.getColumn('start').numFmt = DATE_FORMAT;
    debtsSheet.getColumn('end').numFmt = DATE_FORMAT;
  }

  // Metas de ahorro
  if (sgs.length > 0) {
    const goalsSheet = wb.addWorksheet('Metas de ahorro');
    goalsSheet.columns = [
      { header: 'Nombre', key: 'name', width: 30 },
      { header: 'Meta', key: 'target', width: 14 },
      { header: 'Acumulado', key: 'current', width: 14 },
      { header: '% logrado', key: 'pct', width: 12 },
      { header: 'Moneda', key: 'currency', width: 10 },
      { header: 'Aporte mensual', key: 'monthly', width: 14 },
      { header: 'Inicio', key: 'start', width: 12 },
      { header: 'Fecha objetivo', key: 'target_date', width: 14 },
      { header: 'Estado', key: 'status', width: 12 },
    ];
    styleHeader(goalsSheet.getRow(1));
    for (const g of sgs) {
      const target = Number(g.targetAmountMinor) / 100;
      const current = Number(g.currentAmountMinor) / 100;
      goalsSheet.addRow({
        name: g.name,
        target,
        current,
        pct: target > 0 ? Math.round((current / target) * 100) / 100 : 0,
        currency: g.currency,
        monthly: Number(g.monthlyContributionMinor) / 100,
        start: g.startDate,
        target_date: g.targetDate ?? '',
        status: g.status,
      });
    }
    goalsSheet.getColumn('target').numFmt = MONEY_FORMAT;
    goalsSheet.getColumn('current').numFmt = MONEY_FORMAT;
    goalsSheet.getColumn('monthly').numFmt = MONEY_FORMAT;
    goalsSheet.getColumn('pct').numFmt = '0%';
    goalsSheet.getColumn('start').numFmt = DATE_FORMAT;
    goalsSheet.getColumn('target_date').numFmt = DATE_FORMAT;
  }

  // Presupuestos
  if (bgs.length > 0) {
    const bgSheet = wb.addWorksheet('Presupuestos');
    bgSheet.columns = [
      { header: 'Año', key: 'year', width: 8 },
      { header: 'Mes', key: 'month', width: 8 },
      { header: 'Categoría', key: 'category', width: 24 },
      { header: 'Monto', key: 'amount', width: 14 },
      { header: 'Moneda', key: 'currency', width: 10 },
      { header: 'Notas', key: 'notes', width: 32 },
    ];
    styleHeader(bgSheet.getRow(1));
    for (const b of bgs) {
      bgSheet.addRow({
        year: b.year,
        month: b.month,
        category: b.categoryId ? (categoriesById.get(b.categoryId)?.name ?? '') : '',
        amount: Number(b.amountMinor) / 100,
        currency: b.currency,
        notes: b.notes ?? '',
      });
    }
    bgSheet.getColumn('amount').numFmt = MONEY_FORMAT;
  }

  for (const sheet of wb.worksheets) autoSizeColumns(sheet);

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `cutifinanzas-${dayjs().format('YYYY-MM-DD')}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
