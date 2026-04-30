import dayjs from 'dayjs';
import { type NextRequest, NextResponse } from 'next/server';
import 'dayjs/locale/es';
import { and, eq, lte } from 'drizzle-orm';
import webpush from 'web-push';
import { db } from '@/db/client';
import { pushSubscriptions, recurringRules } from '@/db/schema';
import { env } from '@/env';

dayjs.locale('es');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

if (env.VAPID_PRIVATE_KEY && env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_SUBJECT) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (env.CRON_SECRET && authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'VAPID no configurado' }, { status: 500 });
  }

  const today = dayjs().format('YYYY-MM-DD');
  const inThreeDays = dayjs().add(3, 'day').format('YYYY-MM-DD');

  const due = await db.query.recurringRules.findMany({
    where: and(
      eq(recurringRules.isActive, true),
      lte(recurringRules.nextOccurrenceDate, inThreeDays),
    ),
  });

  if (due.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: 'Sin pagos próximos' });
  }

  const userIds = [...new Set(due.map((r) => r.userId))];
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userIds[0] ?? ''));

  let sent = 0;
  let failed = 0;

  for (const userId of userIds) {
    const userRules = due.filter((r) => r.userId === userId);
    const userSubs = subs.filter((s) => s.userId === userId);
    if (userSubs.length === 0) continue;

    const upcoming = userRules.filter((r) => r.nextOccurrenceDate >= today);
    const overdue = userRules.filter((r) => r.nextOccurrenceDate < today);

    const payload = JSON.stringify({
      title:
        overdue.length > 0
          ? `${overdue.length} pago(s) atrasado(s)`
          : `${upcoming.length} pago(s) próximo(s)`,
      body: userRules
        .slice(0, 3)
        .map((r) => `${r.name} · ${dayjs(r.nextOccurrenceDate).format('D MMM')}`)
        .join('\n'),
      url: '/dashboard',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    });

    for (const sub of userSubs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.authKey },
          },
          payload,
        );
        sent++;
      } catch (err) {
        failed++;
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        }
      }
    }
  }

  return NextResponse.json({ ok: true, sent, failed, dueCount: due.length });
}
