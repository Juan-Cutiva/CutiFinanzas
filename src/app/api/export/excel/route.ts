import dayjs from 'dayjs';
import { desc, eq } from 'drizzle-orm';
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
import { ACCOUNT_TYPE_LABELS, type AccountTypeCode } from '@/features/accounts/schema';
import { isAsset, KIND_LABELS, type TransactionKind } from '@/lib/accounting/shared';

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
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF572364' } } };
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

// Cap defensivo: evita cargar más de TX_LIMIT transacciones en memoria al
// generar el Excel. Para usuarios con historiales muy largos preferimos truncar
// (mostrar las más recientes) antes que reventar el server con OOM.
const TX_LIMIT = 10_000;

export async function GET(_req: NextRequest) {
  const user = await getOrCreateUser();
  const userId = user.id;

  const [accs, cats, txs, bgs, dbs, sgs, rrs] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(categories).where(eq(categories.userId, userId)),
    db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt))
      .limit(TX_LIMIT),
    db.select().from(budgets).where(eq(budgets.userId, userId)),
    db.select().from(debts).where(eq(debts.userId, userId)),
    db.select().from(savingsGoals).where(eq(savingsGoals.userId, userId)),
    db.select().from(recurringRules).where(eq(recurringRules.userId, userId)),
  ]);
  const txsTruncated = txs.length === TX_LIMIT;

  const accountsById = new Map(accs.map((a) => [a.id, a]));
  const categoriesById = new Map(cats.map((c) => [c.id, c]));
  const debtsById = new Map(dbs.map((d) => [d.id, d]));
  const goalsById = new Map(sgs.map((g) => [g.id, g]));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CutiFinanzas';
  wb.created = new Date();

  // Resumen
  const summary = wb.addWorksheet('Resumen');
  summary.columns = [
    { header: 'Métrica', key: 'metric', width: 32 },
    { header: 'Valor', key: 'value', width: 24 },
  ];
  styleHeader(summary.getRow(1));
  summary.addRows([
    { metric: 'Usuario', value: user.name ?? user.email ?? user.id },
    { metric: 'Moneda principal', value: user.defaultCurrency },
    { metric: 'Días de cobro', value: (user.payAnchorDates ?? []).join(', ') },
    { metric: 'Exportado el', value: dayjs().format('YYYY-MM-DD HH:mm') },
    { metric: '', value: '' },
    { metric: 'Cuentas registradas', value: accs.length },
    { metric: 'Categorías', value: cats.length },
    {
      metric: 'Transacciones',
      value: txsTruncated
        ? `${txs.length} (limitado a las ${TX_LIMIT.toLocaleString('es-CO')} más recientes)`
        : txs.length,
    },
    { metric: 'Reglas recurrentes', value: rrs.length },
    { metric: 'Préstamos installment', value: dbs.length },
    { metric: 'Metas de ahorro', value: sgs.length },
    { metric: 'Presupuestos', value: bgs.length },
  ]);

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
      type: ACCOUNT_TYPE_LABELS[a.type as AccountTypeCode] ?? a.type,
      classification: isAsset(a.type as AccountTypeCode) ? 'Activo' : 'Pasivo',
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
    { header: 'Archivada', key: 'archived', width: 12 },
  ];
  styleHeader(categoriesSheet.getRow(1));
  for (const c of cats) {
    categoriesSheet.addRow({
      name: c.name,
      color: c.color,
      icon: c.icon,
      archived: c.archivedAt ? 'Sí' : 'No',
    });
  }

  // Transacciones
  const txSheet = wb.addWorksheet('Transacciones');
  txSheet.columns = [
    { header: 'Fecha', key: 'date', width: 12 },
    { header: 'Tipo', key: 'kind', width: 22 },
    { header: 'Descripción', key: 'description', width: 32 },
    { header: 'Cuenta', key: 'account', width: 22 },
    { header: 'Contra-cuenta', key: 'counter', width: 22 },
    { header: 'Categoría', key: 'category', width: 22 },
    { header: 'Préstamo', key: 'debt', width: 22 },
    { header: 'Meta de ahorro', key: 'goal', width: 22 },
    { header: 'Monto', key: 'amount', width: 14 },
    { header: 'Moneda', key: 'currency', width: 10 },
    { header: 'Pagada', key: 'isPaid', width: 10 },
    { header: 'Recurrente', key: 'isRecurring', width: 12 },
    { header: 'Notas', key: 'notes', width: 32 },
  ];
  styleHeader(txSheet.getRow(1));
  txSheet.views = [{ state: 'frozen', ySplit: 1 }];
  const sortedTxs = [...txs].sort((a, b) => (a.transactionDate < b.transactionDate ? 1 : -1));
  for (const t of sortedTxs) {
    txSheet.addRow({
      date: t.transactionDate,
      kind: KIND_LABELS[t.kind as TransactionKind] ?? t.kind,
      description: t.description ?? '',
      account: t.accountId ? (accountsById.get(t.accountId)?.name ?? '') : '',
      counter: t.counterAccountId ? (accountsById.get(t.counterAccountId)?.name ?? '') : '',
      category: t.categoryId ? (categoriesById.get(t.categoryId)?.name ?? '') : '',
      debt: t.debtId ? (debtsById.get(t.debtId)?.name ?? '') : '',
      goal: t.savingsGoalId ? (goalsById.get(t.savingsGoalId)?.name ?? '') : '',
      amount: Number(t.amountMinor) / 100,
      currency: t.currency,
      isPaid: t.isPaid ? 'Sí' : 'No',
      isRecurring: t.recurringRuleId ? 'Sí' : 'No',
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
      { header: 'Tipo', key: 'kind', width: 22 },
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
        kind: KIND_LABELS[r.kind as TransactionKind] ?? r.kind,
        account: r.accountId ? (accountsById.get(r.accountId)?.name ?? '') : '',
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
  }

  // Préstamos
  if (dbs.length > 0) {
    const debtsSheet = wb.addWorksheet('Préstamos');
    debtsSheet.columns = [
      { header: 'Nombre', key: 'name', width: 30 },
      { header: 'Principal', key: 'principal', width: 14 },
      { header: 'Moneda', key: 'currency', width: 10 },
      { header: 'Tasa anual %', key: 'rate', width: 12 },
      { header: 'Cuota mensual', key: 'monthly', width: 14 },
      { header: 'Cuotas totales', key: 'total', width: 14 },
      { header: 'Inicio', key: 'start', width: 12 },
      { header: 'Fin', key: 'end', width: 12 },
      { header: 'Estado', key: 'status', width: 12 },
    ];
    styleHeader(debtsSheet.getRow(1));
    for (const d of dbs) {
      debtsSheet.addRow({
        name: d.name,
        principal: Number(d.principalMinor) / 100,
        currency: d.currency,
        rate: d.interestRateAnnual ? Number(d.interestRateAnnual) : '',
        monthly: Number(d.monthlyPaymentMinor) / 100,
        total: d.totalInstallments ?? '',
        start: d.startDate,
        end: d.endDate ?? '',
        status: d.status,
      });
    }
    debtsSheet.getColumn('principal').numFmt = MONEY_FORMAT;
    debtsSheet.getColumn('monthly').numFmt = MONEY_FORMAT;
  }

  // Metas de ahorro
  if (sgs.length > 0) {
    const goalsSheet = wb.addWorksheet('Metas de ahorro');
    goalsSheet.columns = [
      { header: 'Nombre', key: 'name', width: 30 },
      { header: 'Meta', key: 'target', width: 14 },
      { header: 'Moneda', key: 'currency', width: 10 },
      { header: 'Aporte mensual', key: 'monthly', width: 14 },
      { header: 'Inicio', key: 'start', width: 12 },
      { header: 'Fecha objetivo', key: 'target_date', width: 14 },
      { header: 'Estado', key: 'status', width: 12 },
    ];
    styleHeader(goalsSheet.getRow(1));
    for (const g of sgs) {
      goalsSheet.addRow({
        name: g.name,
        target: Number(g.targetAmountMinor) / 100,
        currency: g.currency,
        monthly: Number(g.monthlyContributionMinor) / 100,
        start: g.startDate,
        target_date: g.targetDate ?? '',
        status: g.status,
      });
    }
    goalsSheet.getColumn('target').numFmt = MONEY_FORMAT;
    goalsSheet.getColumn('monthly').numFmt = MONEY_FORMAT;
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
