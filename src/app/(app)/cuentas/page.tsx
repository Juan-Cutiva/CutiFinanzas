import { Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Cuentas' };

export default function CuentasPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Cuentas</h2>
        <p className="text-sm text-muted-foreground">
          Tus billeteras: efectivo, débito, ahorros y tarjetas de crédito.
        </p>
      </header>

      <Card>
        <CardHeader className="items-center text-center">
          <Wallet className="size-10 text-muted-foreground/50" aria-hidden />
          <CardTitle>Crea tu primera cuenta</CardTitle>
          <CardDescription>
            Vas a poder asignar cada movimiento a una cuenta y ver saldos en tiempo real.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
