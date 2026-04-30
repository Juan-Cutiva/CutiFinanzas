import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CutiFinanzas — Finanzas personales',
    short_name: 'CutiFinanzas',
    description:
      'Controla tus finanzas personales: ingresos, gastos, presupuestos, deudas y metas.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#1A1320',
    theme_color: '#1A1320',
    lang: 'es-CO',
    dir: 'ltr',
    categories: ['finance', 'productivity', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Agregar transacción',
        short_name: 'Agregar',
        url: '/transacciones?nuevo=1',
        description: 'Registra rápidamente un ingreso o gasto',
      },
      {
        name: 'Ver presupuestos',
        short_name: 'Presupuestos',
        url: '/presupuestos',
        description: 'Revisa tus presupuestos del mes',
      },
    ],
  };
}
