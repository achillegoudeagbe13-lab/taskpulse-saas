'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCheck, RefreshCw } from './ui-icons';
import { safeStr, safeDateTime, asArray } from '../lib/render-safe';

export default function NotificationsPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');

  async function load() {
    try {
      const response = await fetch('/api/notifications');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setItems(asArray(result.notifications));
      setUnread(typeof result.unread === 'number' ? result.unread : 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger les notifications.');
    }
  }

  useEffect(() => { load(); }, []);

  async function mark(id?: string) {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(id ? { id } : { all: true }) });
    load();
  }

  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">CENTRE D’ALERTES</p>
          <h1>Notifications</h1>
          <p className="muted">{unread} notification{unread > 1 ? 's' : ''} non lue{unread > 1 ? 's' : ''}.</p>
        </div>
        <button className="outline-button" onClick={() => mark()}><CheckCheck size={17} /> Tout marquer comme lu</button>
      </div>

      {error && <div className="notice error">{error}<button onClick={load}><RefreshCw size={15} /> Réessayer</button></div>}

      <section className="panel notification-list">
        {items.length === 0 ? (
          <div className="empty-state"><Bell size={24} /><h3>Tout est calme</h3><p className="muted">Vous n’avez aucune notification.</p></div>
        ) : items.map((item) => (
          <button className={item.readAt ? 'notification-row read' : 'notification-row'} key={safeStr(item.id)} onClick={() => mark(item.id)}>
            <span className="notification-icon"><Bell size={17} /></span>
            <span>
              <strong>{safeStr(item.title, 'Notification')}</strong>
              <small>{safeStr(item.content)}</small>
              <time>{safeDateTime(item.createdAt)}</time>
            </span>
            {!item.readAt && <i />}
          </button>
        ))}
      </section>
    </div>
  );
}