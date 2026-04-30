import { BarChart3, CreditCard, PiggyBank, Settings, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Más' };

const ITEMS = [
  { href: '/cuentas', label: 'Cuentas', icon: Wallet },
  { href: '/deudas', label: 'Deudas', icon: CreditCard },
  { href: '/ahorros', label: 'Metas de ahorro', icon: PiggyBank },
  { href: '/reportes', label: 'Reportes', icon: BarChart3 },
  { href: '/ajustes', label: 'Ajustes', icon: Settings },
] as const;

export default function MasPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Más</h2>
        <p className="text-sm text-muted-foreground">Más secciones de la app.</p>
      </header>

      <Card>
        <ul className="divide-y divide-border">
          {ITEMS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/50"
              >
                <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="flex-1 text-sm font-medium">{label}</span>
                <span aria-hidden className="text-muted-foreground">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
