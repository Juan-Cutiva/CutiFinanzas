import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={cn('mx-auto w-full max-w-md', className)}>
      <CardHeader className="items-center text-center">
        <div className="mb-2 grid size-14 place-items-center rounded-full bg-primary/10">
          <Icon className="size-7 text-primary" aria-hidden />
        </div>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      {action ? (
        <CardContent className="flex justify-center pb-6 pt-0">{action}</CardContent>
      ) : (
        <CardContent />
      )}
    </Card>
  );
}
