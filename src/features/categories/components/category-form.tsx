'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useAction } from 'next-safe-action/hooks';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { createCategoryAction } from '../actions';
import { type CategoryInput, categoryInputSchema } from '../schema';

const PALETTE = [
  'oklch(0.610 0.190 318)',
  'oklch(0.620 0.170 155)',
  'oklch(0.580 0.220 25)',
  'oklch(0.700 0.135 230)',
  'oklch(0.720 0.155 75)',
  'oklch(0.760 0.170 350)',
  'oklch(0.700 0.180 350)',
  'oklch(0.480 0.020 318)',
];

export function CategoryForm({ onSuccess }: { onSuccess?: () => void }) {
  const form = useForm<z.input<typeof categoryInputSchema>, unknown, CategoryInput>({
    resolver: zodResolver(categoryInputSchema),
    defaultValues: {
      name: '',
      icon: 'Tag',
      color: PALETTE[0],
      sortOrder: 0,
    },
  });

  const { execute, isPending } = useAction(createCategoryAction, {
    onSuccess: () => {
      toast.success('Categoría creada');
      form.reset({ name: '', icon: 'Tag', color: PALETTE[0], sortOrder: 0 });
      onSuccess?.();
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Error'),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => execute(data))} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input placeholder="Educación, Mascotas..." autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Color</FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-2">
                  {PALETTE.map((c) => {
                    const active = field.value === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Color ${c}`}
                        aria-pressed={active}
                        className={`size-8 rounded-full border-2 transition-transform ${
                          active ? 'scale-110 border-foreground' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={() => field.onChange(c)}
                      />
                    );
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} size="lg" className="mt-2">
          {isPending ? 'Guardando…' : 'Crear categoría'}
        </Button>
      </form>
    </Form>
  );
}
