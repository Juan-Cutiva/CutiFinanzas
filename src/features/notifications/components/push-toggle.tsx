'use client';

import { Bell, BellOff, Loader2 } from 'lucide-react';
import { useAction } from 'next-safe-action/hooks';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { subscribePushAction, unsubscribePushAction } from '../actions';

interface Props {
  vapidPublicKey: string | null;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(safe);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = 'unsupported' | 'denied' | 'idle' | 'subscribed' | 'busy';

export function PushToggle({ vapidPublicKey }: Props) {
  const [state, setState] = React.useState<State>('idle');
  const [endpoint, setEndpoint] = React.useState<string | null>(null);

  const subscribe = useAction(subscribePushAction, {
    onSuccess: () => {
      setState('subscribed');
      toast.success('Notificaciones activadas');
    },
    onError: ({ error }) => {
      setState('idle');
      toast.error(error.serverError ?? 'No se pudo activar');
    },
  });

  const unsubscribe = useAction(unsubscribePushAction, {
    onSuccess: () => {
      setState('idle');
      setEndpoint(null);
      toast.success('Notificaciones desactivadas');
    },
    onError: ({ error }) => {
      setState('subscribed');
      toast.error(error.serverError ?? 'Error al desactivar');
    },
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setEndpoint(sub.endpoint);
        setState('subscribed');
      }
    });
  }, []);

  if (!vapidPublicKey) {
    return (
      <p className="text-xs text-muted-foreground">
        Las notificaciones aún no están configuradas en este deploy (falta la clave VAPID pública).
      </p>
    );
  }

  if (state === 'unsupported') {
    return (
      <p className="text-xs text-muted-foreground">
        Tu navegador no soporta notificaciones web. En iPhone, instala la app desde Safari primero.
      </p>
    );
  }

  if (state === 'denied') {
    return (
      <p className="text-xs text-destructive">
        Permisos de notificación bloqueados. Habilítalos desde la configuración del navegador.
      </p>
    );
  }

  async function activate() {
    if (!vapidPublicKey) return;
    setState('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'idle');
        toast.warning('No se concedió permiso');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const keyArray = urlBase64ToUint8Array(vapidPublicKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyArray.buffer.slice(
          keyArray.byteOffset,
          keyArray.byteOffset + keyArray.byteLength,
        ) as ArrayBuffer,
      });
      const json = sub.toJSON();
      subscribe.execute({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        authKey: json.keys?.auth ?? '',
        userAgent: navigator.userAgent,
      });
      setEndpoint(sub.endpoint);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
      setState('idle');
    }
  }

  async function deactivate() {
    if (!endpoint) return;
    setState('busy');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      unsubscribe.execute({ endpoint });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
      setState('subscribed');
    }
  }

  if (state === 'busy') {
    return (
      <Button disabled variant="outline">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Procesando…
      </Button>
    );
  }

  if (state === 'subscribed') {
    return (
      <Button variant="outline" onClick={deactivate}>
        <BellOff className="size-4" aria-hidden />
        Desactivar notificaciones
      </Button>
    );
  }

  return (
    <Button onClick={activate}>
      <Bell className="size-4" aria-hidden />
      Activar recordatorios de pago
    </Button>
  );
}
