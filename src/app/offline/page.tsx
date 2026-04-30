import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="text-center">
        <WifiOff className="mx-auto size-12 text-muted-foreground" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Sin conexión</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Estás sin internet. Algunas vistas pueden estar disponibles desde el caché.
        </p>
      </div>
    </div>
  );
}
