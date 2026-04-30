'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { es } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { cn } from '@/lib/utils';

export type CalendarProps = DayPickerProps;

export function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={es}
      showOutsideDays
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-2',
        month: 'flex flex-col gap-3',
        month_caption: 'flex justify-center items-center h-9',
        caption_label: 'text-sm font-medium capitalize',
        nav: 'flex items-center gap-1',
        button_previous: cn(
          'inline-flex items-center justify-center size-7 rounded-md',
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
          'absolute left-1 top-1',
        ),
        button_next: cn(
          'inline-flex items-center justify-center size-7 rounded-md',
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
          'absolute right-1 top-1',
        ),
        weekdays: 'flex',
        weekday: 'text-muted-foreground w-9 text-[0.7rem] font-normal capitalize',
        week: 'flex w-full mt-1',
        day: 'size-9 text-center text-sm p-0 relative',
        day_button: cn(
          'inline-flex items-center justify-center size-9 rounded-md p-0 font-normal',
          'hover:bg-accent hover:text-accent-foreground',
          'aria-selected:bg-primary aria-selected:text-primary-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        ),
        selected: 'bg-primary text-primary-foreground',
        today: 'font-semibold underline',
        outside: 'text-muted-foreground/50',
        disabled: 'text-muted-foreground/30 cursor-not-allowed',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === 'right' ? (
            <ChevronRight className="size-4" {...rest} />
          ) : (
            <ChevronLeft className="size-4" {...rest} />
          ),
      }}
      {...props}
    />
  );
}
