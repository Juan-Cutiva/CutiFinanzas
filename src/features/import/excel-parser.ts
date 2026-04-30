import 'server-only';
import ExcelJS from 'exceljs';

export interface ParsedExcel {
  fixedExpenses: Array<{
    category: string;
    description: string;
    amount: number;
    payDay: number;
    notes?: string;
  }>;
  variableExpenses: Array<{
    occurredAt: string;
    category: string;
    subcategory: string;
    amount: number;
    notes?: string;
    quincena: 1 | 2;
  }>;
  income: Array<{
    occurredAt: string;
    type: string;
    amount: number;
    notes?: string;
    quincena: 1 | 2;
  }>;
  budgets: Array<{ category: string; amount: number }>;
  debts: Array<{
    name: string;
    initial: number;
    current: number;
    rateAnnual: number | null;
    monthly: number;
    startDate: string;
    endDate: string | null;
  }>;
  savingsGoals: Array<{
    name: string;
    target: number;
    current: number;
    monthly: number;
    startDate: string;
    targetDate: string | null;
  }>;
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number.parseFloat(v.replace(/[^\d.-]/g, '')) || 0;
  if (
    typeof v === 'object' &&
    v !== null &&
    'result' in v &&
    typeof (v as { result: unknown }).result === 'number'
  ) {
    return (v as { result: number }).result;
  }
  return 0;
}

function toIsoDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (
    typeof v === 'object' &&
    v !== null &&
    'text' in v &&
    typeof (v as { text: unknown }).text === 'string'
  ) {
    return (v as { text: string }).text.trim();
  }
  return String(v).trim();
}

export async function parseExcel(buffer: ArrayBuffer): Promise<ParsedExcel> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const result: ParsedExcel = {
    fixedExpenses: [],
    variableExpenses: [],
    income: [],
    budgets: [],
    debts: [],
    savingsGoals: [],
  };

  const fixed = workbook.getWorksheet('Gastos Fijos');
  if (fixed) {
    fixed.eachRow((row, n) => {
      if (n < 4) return;
      const category = cellToString(row.getCell(1).value);
      const description = cellToString(row.getCell(2).value);
      const amount = toNumber(row.getCell(3).value);
      const payDay = toNumber(row.getCell(4).value);
      if (!category || amount <= 0) return;
      result.fixedExpenses.push({
        category,
        description,
        amount,
        payDay: payDay || 1,
        notes: cellToString(row.getCell(9).value) || undefined,
      });
    });
  }

  const variable = workbook.getWorksheet('Gastos Variables');
  if (variable) {
    variable.eachRow((row, n) => {
      if (n < 5) return;
      const date = row.getCell(1).value;
      if (!date) return;
      const category = cellToString(row.getCell(2).value);
      const subcategory = cellToString(row.getCell(3).value);
      const amount = toNumber(row.getCell(4).value);
      if (!category || amount <= 0) return;
      const iso = toIsoDate(date);
      const day = Number.parseInt(iso.slice(8, 10), 10);
      result.variableExpenses.push({
        occurredAt: iso,
        category,
        subcategory,
        amount,
        notes: cellToString(row.getCell(5).value) || undefined,
        quincena: day <= 15 ? 1 : 2,
      });
    });
  }

  const income = workbook.getWorksheet('Ingresos');
  if (income) {
    income.eachRow((row, n) => {
      if (n < 5) return;
      const date = row.getCell(1).value;
      if (!date) return;
      const type = cellToString(row.getCell(2).value);
      const amount = toNumber(row.getCell(3).value);
      if (!type || amount <= 0) return;
      const iso = toIsoDate(date);
      const day = Number.parseInt(iso.slice(8, 10), 10);
      result.income.push({
        occurredAt: iso,
        type,
        amount,
        notes: cellToString(row.getCell(4).value) || undefined,
        quincena: day <= 15 ? 1 : 2,
      });
    });
  }

  const budget = workbook.getWorksheet('Presupuesto Automático');
  if (budget) {
    budget.eachRow((row, n) => {
      if (n < 5) return;
      const category = cellToString(row.getCell(1).value);
      const amount = toNumber(row.getCell(2).value);
      if (!category || amount <= 0) return;
      result.budgets.push({ category, amount });
    });
  }

  const debts = workbook.getWorksheet('Control de Deudas');
  if (debts) {
    debts.eachRow((row, n) => {
      if (n < 4) return;
      const name = cellToString(row.getCell(1).value);
      const initial = toNumber(row.getCell(2).value);
      const current = toNumber(row.getCell(3).value);
      const rate = toNumber(row.getCell(4).value);
      const monthly = toNumber(row.getCell(5).value);
      if (!name || initial <= 0) return;
      result.debts.push({
        name,
        initial,
        current,
        rateAnnual: rate > 0 ? rate : null,
        monthly,
        startDate: toIsoDate(row.getCell(6).value),
        endDate: row.getCell(7).value ? toIsoDate(row.getCell(7).value) : null,
      });
    });
  }

  const savings = workbook.getWorksheet('Ahorros y Metas');
  if (savings) {
    savings.eachRow((row, n) => {
      if (n < 4) return;
      const name = cellToString(row.getCell(1).value);
      const target = toNumber(row.getCell(2).value);
      if (!name || target <= 0) return;
      result.savingsGoals.push({
        name,
        target,
        current: toNumber(row.getCell(3).value),
        monthly: toNumber(row.getCell(4).value),
        startDate: toIsoDate(row.getCell(5).value),
        targetDate: row.getCell(6).value ? toIsoDate(row.getCell(6).value) : null,
      });
    });
  }

  return result;
}
