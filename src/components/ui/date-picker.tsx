'use client';

import { CalendarIcon } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { dayjs, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface DatePickerProps {
  value?: string;
  onChange?: (iso: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

function parseIso(iso?: string): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function formatIso(d: Date): string {
  return dayjs(d).format('YYYY-MM-DD');
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Selecciona fecha',
  className,
  disabled,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const date = parseIso(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start font-normal',
            !date && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="size-4" aria-hidden />
          {date ? formatDate(date, 'D MMM YYYY') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            if (d) {
              onChange?.(formatIso(d));
              setOpen(false);
            }
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
