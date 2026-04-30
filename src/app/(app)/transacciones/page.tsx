import { ListOrdered } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Transacciones' };

export default function TransaccionesPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Transacciones</h2>
        <p className="text-sm text-muted-foreground">
          Historial de movimientos: ingresos, gastos, transferencias y pagos.
        </p>
      </header>

      <Card>
        <CardHeader className="items-center text-center">
          <ListOrdered className="size-10 text-muted-foreground/50" aria-hidden />
          <CardTitle>Aún no hay movimientos</CardTitle>
          <CardDescription>
            Toca el botón ＋ para registrar tu primer ingreso o gasto.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
