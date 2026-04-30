import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';

const MONTH_LABELS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1320' },
  header: { marginBottom: 16, borderBottom: '2 solid #572364', paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: 700, color: '#572364' },
  subtitle: { fontSize: 10, color: '#666', marginTop: 2 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#572364',
    marginTop: 18,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  table: { marginTop: 4 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1eaf3',
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontWeight: 700,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottom: '1 solid #eee',
  },
  cell: { flex: 1, fontSize: 9 },
  cellRight: { flex: 1, fontSize: 9, textAlign: 'right' },
  totals: {
    flexDirection: 'row',
    backgroundColor: '#572364',
    color: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontWeight: 700,
  },
  footer: { marginTop: 30, fontSize: 8, color: '#999', textAlign: 'center' },
});

export interface YearlyReportData {
  year: number;
  generatedAt: string;
  currency: CurrencyCode;
  months: Array<{
    month: number;
    incomeMinor: number;
    expenseMinor: number;
    balanceMinor: number;
  }>;
}

export function YearlyReportPDF({ data }: { data: YearlyReportData }) {
  const fmt = (cents: number) => formatAmount(cents / 100, data.currency);
  const totalIncome = data.months.reduce((s, m) => s + m.incomeMinor, 0);
  const totalExpense = data.months.reduce((s, m) => s + m.expenseMinor, 0);
  const totalBalance = totalIncome - totalExpense;

  return (
    <Document title={`Reporte anual ${data.year}`} author="CutiFinanzas">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Reporte anual {data.year}</Text>
          <Text style={styles.subtitle}>Generado el {data.generatedAt}</Text>
        </View>

        <Text style={styles.sectionTitle}>Resumen mes a mes</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.cell}>Mes</Text>
            <Text style={styles.cellRight}>Ingresos</Text>
            <Text style={styles.cellRight}>Gastos</Text>
            <Text style={styles.cellRight}>Balance</Text>
          </View>
          {data.months.map((m) => (
            <View key={m.month} style={styles.row}>
              <Text style={styles.cell}>{MONTH_LABELS[m.month - 1]}</Text>
              <Text style={styles.cellRight}>{fmt(m.incomeMinor)}</Text>
              <Text style={styles.cellRight}>{fmt(m.expenseMinor)}</Text>
              <Text style={styles.cellRight}>{fmt(m.balanceMinor)}</Text>
            </View>
          ))}
          <View style={styles.totals}>
            <Text style={styles.cell}>Total año</Text>
            <Text style={styles.cellRight}>{fmt(totalIncome)}</Text>
            <Text style={styles.cellRight}>{fmt(totalExpense)}</Text>
            <Text style={styles.cellRight}>{fmt(totalBalance)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>CutiFinanzas · cuti-finanzas.vercel.app</Text>
      </Page>
    </Document>
  );
}
