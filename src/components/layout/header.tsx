'use client';

import { UserButton } from '@clerk/nextjs';
import * as React from 'react';
import { MonthSwitcher } from './month-switcher';
import { ThemeToggle } from './theme-toggle';

export function Header() {
  // UserButton de Clerk genera scripts y estructura que difieren entre SSR y client,
  // causando warnings de hidratación. Lo renderizamos solo después de mount para evitar
  // el mismatch — durante SSR mostramos un placeholder del mismo tamaño.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-2 pt-[env(safe-area-inset-top)] backdrop-blur md:h-16 md:gap-3 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground font-bold md:hidden">
          CF
        </div>
        <React.Suspense fallback={null}>
          <MonthSwitcher />
        </React.Suspense>
      </div>
      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        <ThemeToggle />
        {mounted ? (
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'size-8 ring-1 ring-border',
              },
            }}
          />
        ) : (
          <div aria-hidden className="size-8 rounded-full bg-muted ring-1 ring-border" />
        )}
      </div>
    </header>
  );
}
