'use client';

import { useEffect, useState } from 'react';

/**
 * Cloche push dans la barre d'app (aucun popup automatique).
 * - Affiche une cloche discrète 🔔 dès que le push est supporté et configuré.
 * - 1er clic : demande la permission puis s'abonne (POST /api/push).
 * - Clic suivant : désinscription locale + serveur (DELETE /api/push).
 * Rend `null` si le navigateur ne supporte pas le push ou sans clés VAPID.
 */
export default function PushNotifications() {
  const [state, setState] = useState<'hidden' | 'bell'>('hidden');
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/push');
        const { publicKey } = await res.json();
        if (!publicKey) return;
        const reg = await navigator.serviceWorker.register('/sw.js');
        const existing = await reg.pushManager.getSubscription();
        if (existing) { await syncSubscription(existing); setSubscribed(true); setState('bell'); return; }
        if (Notification.permission === 'default' || Notification.permission === 'granted') setState('bell');
      } catch { /* push indisponible : on reste caché */ }
    })();
  }, []);

  async function syncSubscription(sub: globalThis.PushSubscription) {
    const raw = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: raw.endpoint,
        keys: { p256dh: raw.keys?.p256dh ?? '', auth: raw.keys?.auth ?? '' },
      }),
    });
  }

  async function toggle() {
    try {
      const res = await fetch('/api/push');
      const { publicKey } = await res.json();
      if (!publicKey) return;
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const current = await reg.pushManager.getSubscription();
      if (current) {
        await current.unsubscribe().catch(() => undefined);
        await fetch('/api/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: current.endpoint }),
        }).catch(() => undefined);
        setSubscribed(false);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await syncSubscription(sub);
      setSubscribed(true);
    } catch { /* échec silencieux */ }
  }

  if (state !== 'bell') return null;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={subscribed}
      title={subscribed ? 'Notifications push activées — cliquer pour désactiver' : 'Recevoir les notifications même application fermée'}
      style={{
        border: '1px solid var(--border, #ccc)', borderRadius: 999,
        padding: '6px 10px', cursor: 'pointer', background: subscribed ? 'var(--accent, #e8f0ff)' : 'var(--card, #fff)',
        fontSize: 13, lineHeight: 1,
      }}
    >
      {subscribed ? '🔔✓' : '🔔'}
    </button>
  );
}

/** Convertit la clé VAPID base64url en ArrayBuffer attendu par pushManager. */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
}
