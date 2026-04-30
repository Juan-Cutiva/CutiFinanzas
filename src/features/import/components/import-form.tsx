'use client';

import { Upload } from 'lucide-react';
import { useAction } from 'next-safe-action/hooks';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { importExcelAction } from '../import-action';

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function ImportForm() {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [stats, setStats] = React.useState<
    Awaited<ReturnType<typeof importExcelAction>>['data'] | null
  >(null);

  const { execute, isPending } = useAction(importExcelAction, {
    onSuccess: ({ data }) => {
      setStats(data ?? null);
      toast.success('Importación completada');
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Error al importar'),
  });

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    execute({ fileBase64: base64 });
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={onPick}
        disabled={isPending}
      />
      <Button size="lg" disabled={isPending} onClick={() => inputRef.current?.click()}>
        <Upload className="size-4" aria-hidden />
        {isPending ? 'Importando…' : 'Seleccionar archivo .xlsx'}
      </Button>
      {stats ? (
        <div className="rounded-md border border-border/60 bg-muted/30 p-4 text-sm">
          <p className="font-semibold">Resultado:</p>
          <ul className="mt-2 grid gap-1 text-muted-foreground">
            <li>• {stats.transactions} transacciones</li>
            <li>• {stats.budgets} presupuestos</li>
            <li>• {stats.debts} deudas</li>
            <li>• {stats.savingsGoals} metas de ahorro</li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
