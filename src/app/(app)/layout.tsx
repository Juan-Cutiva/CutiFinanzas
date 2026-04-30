import { type ReactNode, Suspense } from 'react';
import { BottomNav } from '@/components/layout/bottom-nav';
import { Header } from '@/components/layout/header';
import { KeyboardShortcuts } from '@/components/layout/keyboard-shortcuts';
import { QuickAddFAB } from '@/components/layout/quick-add-fab';
import { Sidebar } from '@/components/layout/sidebar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-8">{children}</main>
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <QuickAddFAB />
      </Suspense>
      <KeyboardShortcuts />
    </div>
  );
}
