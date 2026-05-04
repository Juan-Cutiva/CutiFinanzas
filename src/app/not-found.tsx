import { Compass } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Página no encontrada' };

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Compass className="size-8" aria-hidden />
        </div>
        <p className="mt-6 font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Error 404
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          Esta página no existe
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          La dirección que buscas se movió, ya no existe o nunca estuvo aquí. Vuelve al inicio y
          sigue gestionando tus finanzas.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <Button asChild>
            <Link href="/dashboard">Ir al dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/transacciones">Ver transacciones</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
