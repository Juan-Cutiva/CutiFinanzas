import { PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Resumen' };

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Buenos días</h2>
        <p className="text-sm text-muted-foreground">Aquí tienes el resumen de tu mes en curso.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<TrendingUp className="size-4 text-[color:var(--income)]" aria-hidden />}
          label="Ingresos del mes"
          value="$0"
          trend="—"
        />
        <KpiCard
          icon={<TrendingDown className="size-4 text-[color:var(--expense)]" aria-hidden />}
          label="Gastos del mes"
          value="$0"
          trend="—"
        />
        <KpiCard
          icon={<Wallet className="size-4 text-primary" aria-hidden />}
          label="Balance disponible"
          value="$0"
          trend="—"
        />
        <KpiCard
          icon={<PiggyBank className="size-4 text-[color:var(--info)]" aria-hidden />}
          label="Ahorrado este mes"
          value="$0"
          trend="—"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Empieza por aquí</CardTitle>
          <CardDescription>
            Configura tus cuentas, categorías y presupuestos para empezar a controlar tus finanzas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="grid size-6 place-items-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
                1
              </span>
              <span>Crea tus cuentas (efectivo, débito, tarjeta de crédito, ahorro).</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="grid size-6 place-items-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
                2
              </span>
              <span>Define categorías y subcategorías a tu gusto.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="grid size-6 place-items-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
                3
              </span>
              <span>Registra tu primer ingreso y gasto.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="grid size-6 place-items-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
                4
              </span>
              <span>Configura tus presupuestos mensuales.</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between p-5 pb-2">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {label}
        </CardDescription>
        {icon}
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <p className="font-mono tabular-nums text-2xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{trend}</p>
      </CardContent>
    </Card>
  );
}
