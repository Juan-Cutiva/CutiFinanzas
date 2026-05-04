import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { db } from '@/db/client';
import { getOrCreateUser } from '@/db/queries/users';
import { pushSubscriptions } from '@/db/schema';
import { env } from '@/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

if (env.VAPID_PRIVATE_KEY && env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_SUBJECT) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
}

export async function POST() {
  if (!env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'VAPID no configurado' }, { status: 500 });
  }

  const user = await getOrCreateUser();
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, user.id));

  if (subs.length === 0) {
    return NextResponse.json(
      { error: 'No tienes suscripciones activas. Activa primero las notificaciones.' },
      { status: 400 },
    );
  }

  const payload = JSON.stringify({
    title: 'CutiFinanzas',
    body: 'Esta es una notificación de prueba. Si la ves, todo funciona.',
    url: '/dashboard',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'cutifinanzas-test',
  });

  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.authKey } },
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

  return NextResponse.json({ ok: true, sent, failed, total: subs.length });
}
