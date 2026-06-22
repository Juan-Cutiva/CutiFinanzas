import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/card';
import { getOrCreateUser } from '@/db/queries/users';
import { CurrencyCalculator } from '@/features/exchange/components/currency-calculator';
import type { CurrencyCode } from '@/lib/money';

export const metadata: Metadata = { title: 'Divisas' };
export const dynamic = 'force-dynamic';

export default async function DivisasPage() {
  const user = await getOrCreateUser();
  const base = user.defaultCurrency as CurrencyCode;

  // El render NO bloquea con la API externa: solo necesita la moneda del usuario.
  // La calculadora trae las tasas en cliente (con loading/error/retry).
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Divisas</h2>
        <p className="text-sm text-muted-foreground">
          Calculadora de conversión con tasas actualizadas a diario.
        </p>
      </header>

      <Card>
        <CardContent className="p-5">
          <CurrencyCalculator base={base} />
        </CardContent>
      </Card>
    </div>
  );
}
