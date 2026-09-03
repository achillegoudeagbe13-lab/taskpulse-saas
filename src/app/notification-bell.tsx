'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from './ui-icons';

type Notif = { id: string; title: string; content: string; readAt: string | null; createdAt: string };

/** Convertit n'importe quelle valeur en chaîne sûre pour le rendu React (évite l'erreur #130). */
function safeStr(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    try {
      const asDate = new Date(value as any);
      if (!isNaN(asDate.getTime())) return asDate.toISOString();
    } catch { /* ignore */ }
    try { return String(value); } catch { return fallback; }
  }
  return String(value);
}

/** Date locale sûre pour l'affichage d'horodatage. */
function safeDateTime(value: unknown): string {
  if (value === null || value === undefined) return '';
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return '';
  try { return d.toLocaleString('fr-FR'); } catch { return ''; }
}

/**
 * Cloche de notifications « temps réel » :
 * - polling léger toutes les 20 s sur /api/notifications
 * - badge du nombre de non-lues
 * - dropdown avec les dernières notifications + action "tout marquer lu"
 */
export default function NotificationBell({ onOpenAll }: { onOpenAll?: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      /* silencieux : le polling retentera */
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  // Fermeture au clic extérieur
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function markAll() {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) });
    load();
  }

  async function markOne(id: string) {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
  }

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        className="icon-button"
        aria-label={unread > 0 ? `${unread} notification(s) non lue(s)` : 'Notifications'}
        title="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={19} />
        {unread > 0 && <i>{unread > 99 ? '99+' : unread}</i>}
      </button>

      {open && (
        <div className="notif-pop" role="dialog" aria-label="Notifications récentes">
          <div className="notif-head">
            <strong>Notifications</strong>
            <button onClick={markAll} title="Marquer toutes comme lues" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CheckCheck size={14} /> Tout marquer lu
            </button>
            <button className="notif-close" onClick={() => setOpen(false)} aria-label="Fermer les notifications" title="Fermer">×</button>
          </div>
          <div className="notif-list">
            {items.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12.5, padding: '26px 0' }}>
                Aucune notification pour le moment.
              </p>
            ) : (
              items.slice(0, 6).map((n) => (
                <button
                  key={safeStr(n.id)}
                  className={'notification-row' + (n.readAt ? ' read' : '')}
                  style={{ padding: '11px 0' }}
                  onClick={() => markOne(n.id)}
                >
                  <span className="notification-icon"><Bell size={15} /></span>
                  <span>
                    <strong>{safeStr(n.title, 'Notification')}</strong>
                    <small>{safeStr(n.content)}</small>
                    <time>{safeDateTime(n.createdAt)}</time>
                  </span>
                  {!n.readAt && <i />}
                </button>
              ))
            )}
          </div>
          {onOpenAll && (
            <div className="notif-foot">
              <button onClick={() => { setOpen(false); onOpenAll(); }}>Voir toutes les notifications</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}