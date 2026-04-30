'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SHORTCUTS = [
  { keys: 'g d', label: 'Ir al Dashboard' },
  { keys: 'g t', label: 'Ir a Transacciones' },
  { keys: 'g i', label: 'Ir a Ingresos' },
  { keys: 'g c', label: 'Ir a Cuentas' },
  { keys: 'g p', label: 'Ir a Presupuestos' },
  { keys: 'g r', label: 'Ir a Reportes' },
  { keys: 'g s', label: 'Ir a Ajustes' },
  { keys: '?', label: 'Mostrar atajos' },
];

const ROUTE_MAP: Record<string, string> = {
  d: '/dashboard',
  t: '/transacciones',
  i: '/ingresos',
  c: '/cuentas',
  p: '/presupuestos',
  r: '/reportes',
  s: '/ajustes',
  a: '/ahorros',
};

export function KeyboardShortcuts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let lastG = 0;
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const now = Date.now();
      if (e.key === 'g') {
        lastG = now;
        return;
      }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (now - lastG < 1500) {
        const target = ROUTE_MAP[e.key.toLowerCase()];
        if (target) {
          e.preventDefault();
          router.push(target);
          lastG = 0;
        }
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atajos de teclado</DialogTitle>
          <DialogDescription>Navega rápido sin tocar el mouse.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2 text-sm">
          {SHORTCUTS.map((s) => (
            <li
              key={s.keys}
              className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2"
            >
              <span>{s.label}</span>
              <kbd className="rounded bg-background px-2 py-1 font-mono text-xs border border-border">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
