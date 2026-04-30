'use client';

import { UserButton } from '@clerk/nextjs';
import { ThemeToggle } from './theme-toggle';

export function Header({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur md:h-16 md:px-6">
      <div className="flex items-center gap-3">
        <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold md:hidden">
          CF
        </div>
        {title ? (
          <h1 className="text-base font-semibold tracking-tight md:text-lg">{title}</h1>
        ) : null}
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
