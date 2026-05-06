/**
 * Skeleton genérico para cualquier ruta bajo (app). Aparece instantáneamente
 * (es parte del shell estático) mientras el page hace stream de los datos.
 *
 * Mantiene la altura aproximada del header + KPI cards para minimizar CLS.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-muted/40" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-muted/30" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
        <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
        <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
        <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-muted/20" />
    </div>
  );
}
