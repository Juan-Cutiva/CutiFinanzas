import { BarChart3 } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Reportes' };

export default function ReportesPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Reportes</h2>
        <p className="text-sm text-muted-foreground">
          Genera el reporte mensual en PDF y revisa la evolución del año.
        </p>
      </header>

      <Card>
        <CardHeader className="items-center text-center">
          <BarChart3 className="size-10 text-muted-foreground/50" aria-hidden />
          <CardTitle>Aún no hay datos suficientes</CardTitle>
          <CardDescription>
            Cuando registres ingresos y gastos, aparecerán aquí gráficos y el PDF mensual.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
