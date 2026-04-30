import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImportForm } from '@/features/import/components/import-form';

export const metadata: Metadata = { title: 'Importar Excel' };

export default function ImportarPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Importar desde Excel</h2>
        <p className="text-sm text-muted-foreground">
          Sube tu archivo de Cuentas (.xlsx) y CutiFinanzas creará categorías, gastos fijos y
          variables, ingresos, presupuestos, deudas y metas automáticamente.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Cómo funciona</CardTitle>
          <CardDescription>
            El parser entiende las hojas: Gastos Fijos, Gastos Variables, Ingresos, Presupuesto
            Automático, Control de Deudas y Ahorros y Metas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              • Si no tienes una cuenta creada, se creará una llamada{' '}
              <strong>“Cuenta principal (importada)”</strong>.
            </li>
            <li>• Las categorías nuevas se agregan; las existentes se respetan.</li>
            <li>• Los presupuestos se aplican al mes en curso.</li>
            <li>• Recomendado: hacerlo solo una vez al inicio.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sube tu archivo</CardTitle>
        </CardHeader>
        <CardContent>
          <ImportForm />
        </CardContent>
      </Card>
    </div>
  );
}
