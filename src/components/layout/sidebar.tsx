'use client';

import {
  BarChart3,
  CreditCard,
  Home,
  ListOrdered,
  PiggyBank,
  Settings,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const SECTIONS = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard', label: 'Resumen', icon: Home },
      { href: '/transacciones', label: 'Transacciones', icon: ListOrdered },
      { href: '/ingresos', label: 'Ingresos', icon: TrendingUp },
      { href: '/cuentas', label: 'Cuentas', icon: Wallet },
    ],
  },
  {
    label: 'Planeación',
    items: [
      { href: '/presupuestos', label: 'Presupuestos', icon: Target },
      { href: '/deudas', label: 'Deudas', icon: CreditCard },
      { href: '/ahorros', label: 'Metas de ahorro', icon: PiggyBank },
    ],
  },
  {
    label: 'Análisis',
    items: [
      { href: '/reportes', label: 'Reportes', icon: BarChart3 },
      { href: '/ajustes', label: 'Ajustes', icon: Settings },
    ],
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-border/60 md:bg-card/40',
        'sticky top-0 h-dvh',
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b border-border/60 px-6">
        <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
          CF
        </div>
        <span className="text-sm font-semibold tracking-tight">CutiFinanzas</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {SECTIONS.map((section) => (
          <div key={section.label} className="mb-6">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                      <span>{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
