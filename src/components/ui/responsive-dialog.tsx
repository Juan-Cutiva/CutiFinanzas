'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './drawer';

/**
 * Hook simple para detectar tamaño de pantalla. SSR-safe.
 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
  return isDesktop;
}

interface ResponsiveDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function ResponsiveDialog({ open, onOpenChange, children }: ResponsiveDialogProps) {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children}
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {children}
    </Drawer>
  );
}

interface ResponsiveTriggerProps extends React.ComponentProps<typeof DialogTrigger> {
  asChild?: boolean;
}

export function ResponsiveDialogTrigger({ children, asChild, ...props }: ResponsiveTriggerProps) {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return (
      <DialogTrigger asChild={asChild} {...props}>
        {children}
      </DialogTrigger>
    );
  }
  return (
    <DrawerTrigger asChild={asChild} {...props}>
      {children}
    </DrawerTrigger>
  );
}

interface ResponsiveContentProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveDialogContent({ children, className }: ResponsiveContentProps) {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return <DialogContent className={cn('sm:max-w-lg', className)}>{children}</DialogContent>;
  }
  return <DrawerContent className={className}>{children}</DrawerContent>;
}

interface ResponsiveHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveDialogHeader({ children, className }: ResponsiveHeaderProps) {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return <DialogHeader className={className}>{children}</DialogHeader>;
  }
  return <DrawerHeader className={className}>{children}</DrawerHeader>;
}

interface ResponsiveTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveDialogTitle({ children, className }: ResponsiveTitleProps) {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return <DialogTitle className={className}>{children}</DialogTitle>;
  }
  return <DrawerTitle className={className}>{children}</DrawerTitle>;
}

interface ResponsiveDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveDialogDescription({ children, className }: ResponsiveDescriptionProps) {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return <DialogDescription className={className}>{children}</DialogDescription>;
  }
  return <DrawerDescription className={className}>{children}</DrawerDescription>;
}

interface ResponsiveBodyProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Contenedor del cuerpo del modal con padding/scroll consistentes en ambos modos.
 */
export function ResponsiveDialogBody({ children, className }: ResponsiveBodyProps) {
  return <div className={cn('flex flex-col gap-4 p-4 md:p-0', className)}>{children}</div>;
}
