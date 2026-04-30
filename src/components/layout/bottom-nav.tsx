'use client';

import { Home, ListOrdered, MoreHorizontal, Target } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMonthQuery, withMonth } from '@/lib/use-month-href';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: Home },
  { href: '/transacciones', label: 'Movimientos', icon: ListOrdered },
  { href: '/presupuestos', label: 'Presupuestos', icon: Target },
  { href: '/mas', label: 'Más', icon: MoreHorizontal },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const monthQs = useMonthQuery();

  return (
    <nav
      aria-label="Navegación principal"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur',
        'pb-[env(safe-area-inset-bottom)] md:hidden',
      )}
    >
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={withMonth(href, monthQs)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
