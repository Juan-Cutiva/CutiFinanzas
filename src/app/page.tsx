import { auth } from '@clerk/nextjs/server';
import { ArrowRight, ChartLine, PiggyBank, ShieldCheck, Wallet } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect('/dashboard');

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
            CF
          </div>
          <span className="text-base font-semibold tracking-tight">CutiFinanzas</span>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Ingresar</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-up">Crear cuenta</Link>
          </Button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12 md:px-12">
        <div className="mx-auto w-full max-w-3xl text-center">
          <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Wallet className="size-8" aria-hidden />
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight md:text-6xl">
            Tus finanzas,
            <br />
            <span className="text-primary">bajo control.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-base text-muted-foreground md:text-lg">
            Reemplaza tu Excel mensual por una app que viaja contigo. Registra ingresos y gastos por
            quincena, controla deudas, alcanza metas de ahorro y exporta tu reporte mensual en PDF.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href="/sign-up">
                Empezar gratis
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/sign-in">Ya tengo cuenta</Link>
            </Button>
          </div>

          <div className="mt-16 grid gap-6 text-left sm:grid-cols-3">
            <Feature
              icon={<ChartLine className="size-5 text-primary" aria-hidden />}
              title="Visión clara"
              description="Dashboard con KPIs, alertas y gráficos para entender tus finanzas de un vistazo."
            />
            <Feature
              icon={<PiggyBank className="size-5 text-primary" aria-hidden />}
              title="Metas y ahorros"
              description="Define objetivos, asigna aportes mensuales y mide tu progreso."
            />
            <Feature
              icon={<ShieldCheck className="size-5 text-primary" aria-hidden />}
              title="Privado por diseño"
              description="Tus datos están cifrados y solo tú accedes a ellos."
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        Hecho en Colombia · CutiFinanzas © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5">
      <div className="mb-3 grid size-9 place-items-center rounded-lg bg-primary/10">{icon}</div>
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
