'use client';

import { ClerkLoaded, ClerkLoading, UserButton } from '@clerk/nextjs';
import { Suspense } from 'react';
import { MonthSwitcher } from './month-switcher';
import { ThemeToggle } from './theme-toggle';

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-2 backdrop-blur md:h-16 md:gap-3 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground font-bold md:hidden">
          CF
        </div>
        <Suspense fallback={null}>
          <MonthSwitcher />
        </Suspense>
      </div>
      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        <ThemeToggle />
        <ClerkLoading>
          <div
            className="size-8 rounded-full bg-muted ring-1 ring-border"
            aria-hidden
            suppressHydrationWarning
          />
        </ClerkLoading>
        <ClerkLoaded>
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'size-8 ring-1 ring-border',
              },
            }}
          />
        </ClerkLoaded>
      </div>
    </header>
  );
}
