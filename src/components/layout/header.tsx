'use client';

import { UserButton } from '@clerk/nextjs';
import { Suspense } from 'react';
import { MonthSwitcher } from './month-switcher';
import { ThemeToggle } from './theme-toggle';

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-3 backdrop-blur md:h-16 md:px-6">
      <div className="flex items-center gap-3">
        <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold md:hidden">
          CF
        </div>
        <Suspense fallback={null}>
          <MonthSwitcher />
        </Suspense>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'size-8 ring-1 ring-border',
            },
          }}
        />
      </div>
    </header>
  );
}
