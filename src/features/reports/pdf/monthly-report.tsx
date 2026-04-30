import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatAmount } from '@/lib/format';
import type { CurrencyCode } from '@/lib/money';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1320',
  },
  header: { marginBottom: 16, borderBottom: '2 solid #572364', paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: 700, color: '#572364', letterSpacing: -0.5 },
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottom: '1 solid #eee',
  },
  rowEmphasis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    backgroundColor: '#572364',
    color: '#fff',
    paddingHorizontal: 6,
  },
  rowLabel: { fontSize: 10 },
  rowValue: { fontSize: 10, fontWeight: 700 },
  table: { marginTop: 4 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1eaf3',
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontWeight: 700,
  },
  tableCell: { flex: 1, fontSize: 9 },
  tableCellRight: { flex: 1, fontSize: 9, textAlign: 'right' },
  footer: { marginTop: 30, fontSize: 8, color: '#999', textAlign: 'center' },
});

export interface MonthlyReportData {
  monthLabel: string;
  generatedAt: string;
  currency: CurrencyCode;
  totals: {
    income: number;
    expenseFixed: number;
    expenseVariable: number;
    debtPayment: number;
    savingsContribution: number;
  };
  byCategory: Array<{ name: string; planned: number; spent: number }>;
  observations?: string;
}

export function MonthlyReportPDF({ data }: { data: MonthlyReportData }) {
  const totalExpense =
    data.totals.expenseFixed +
    data.totals.expenseVariable +
    data.totals.debtPayment +
    data.totals.savingsContribution;
  const balance = data.totals.income - totalExpense;
  const fmt = (n: number) => formatAmount(n, data.currency);

  return (
    <Document title={`Reporte ${data.monthLabel}`} author="CutiFinanzas" creator="CutiFinanzas">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Resumen financiero mensual</Text>
          <Text style={styles.subtitle}>
            {data.monthLabel} · Generado el {data.generatedAt}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Resumen general</Text>
        <View>
          <Row label="Total ingresos (+)" value={fmt(data.totals.income)} />
          <Row label="Gastos fijos (−)" value={fmt(data.totals.expenseFixed)} />
          <Row label="Gastos variables (−)" value={fmt(data.totals.expenseVariable)} />
          <Row label="Pagos de deuda (−)" value={fmt(data.totals.debtPayment)} />
          <Row label="Aportes a ahorro (−)" value={fmt(data.totals.savingsContribution)} />
          <View style={styles.rowEmphasis}>
            <Text style={styles.rowLabel}>Balance neto (=)</Text>
            <Text style={styles.rowValue}>{fmt(balance)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Desglose por categoría</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableCell}>Categoría</Text>
            <Text style={styles.tableCellRight}>Presupuestado</Text>
            <Text style={styles.tableCellRight}>Ejecutado</Text>
          </View>
          {data.byCategory.length === 0 ? (
            <View style={{ paddingVertical: 8, paddingHorizontal: 6 }}>
              <Text>Sin movimientos en este periodo.</Text>
            </View>
          ) : (
            data.byCategory.map((c) => (
              <View key={c.name} style={styles.row}>
                <Text style={styles.tableCell}>{c.name}</Text>
                <Text style={styles.tableCellRight}>{fmt(c.planned)}</Text>
                <Text style={styles.tableCellRight}>{fmt(c.spent)}</Text>
              </View>
            ))
          )}
        </View>

        {data.observations ? (
          <>
            <Text style={styles.sectionTitle}>Observaciones</Text>
            <Text>{data.observations}</Text>
          </>
        ) : null}

        <Text style={styles.footer}>CutiFinanzas · cuti-finanzas.vercel.app</Text>
      </Page>
    </Document>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}
