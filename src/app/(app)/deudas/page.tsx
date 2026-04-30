import { CreditCard } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Deudas' };

export default function DeudasPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Deudas</h2>
        <p className="text-sm text-muted-foreground">
          Lleva el control de cuotas, intereses y plazos restantes.
        </p>
      </header>

      <Card>
        <CardHeader className="items-center text-center">
          <CreditCard className="size-10 text-muted-foreground/50" aria-hidden />
          <CardTitle>Sin deudas registradas</CardTitle>
          <CardDescription>
            ¡Excelente! Si más adelante adquieres una, podrás registrarla aquí.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
