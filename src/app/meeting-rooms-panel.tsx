'use client';

/**
 * Onglet « Visioconférence » — salles Jitsi de l'organisation.
 *
 * Liste les salles persistées (`MeetingRoom`), permet de lancer/rejoindre une
 * salle directement dans la page (via <VideoMeeting />), de copier le lien de
 * partage, et — pour les administrateurs — de créer, renommer, définir par
 * défaut ou supprimer une salle rattachée (ou non) à un projet/équipe.
 *
 * L'onglet est aussi accessible par lien profond :
 *   /o/<slug>/reunions?room=<identifiant-de-salle>
 */

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  Copy, ExternalLink, Link2, Pencil, Plus, RefreshCw, Trash2, Users, Video, X,
} from './ui-icons';
import { safeDateTime, safeFullName, safeStr, asArray } from '../lib/render-safe';
import { isJitsiRoomName, jitsiDomain, jitsiRoomUrl, roomNameFromUrl } from '../lib/jitsi';
import VideoMeeting from './video-meeting';

type Room = {
  id: string;
  name: string;
  roomName: string;
  domain: string;
  isDefault: boolean;
  createdAt: string;
  department: { id: string; name: string } | null;
  createdBy: { firstName: string | null; lastName: string | null } | null;
  _count?: { meetings: number };
};

/** Cible d'appel : une salle persistée ou une salle issue d'une réunion planifiée. */
type JoinTarget = { roomName: string; name: string; domain: string };

type ScheduledMeeting = {
  id: string; title: string; startAt: string; endAt: string; meetingLink: string | null;
};

type PanelUser = { id: string; firstName: string | null; lastName: string | null; email: string };

export default function MeetingRoomsPanel({
  admin, orgSlug, user, defaultRoom,
}: {
  admin: boolean;
  orgSlug: string;
  user: PanelUser;
  defaultRoom?: string | null;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [active, setActive] = useState<JoinTarget | null>(null);
  const [copiedId, setCopiedId] = useState('');
  const [confirmId, setConfirmId] = useState('');

  // Modale de création / renommage.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [autoStart, setAutoStart] = useState(false);

  const deepLinkApplied = useRef(false);

  const displayName = [safeStr(user.firstName), safeStr(user.lastName)].filter(Boolean).join(' ') || safeStr(user.email);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/org/meeting-rooms', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Impossible de charger les salles.');
      setRooms(asArray<Room>(result.rooms));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger les salles.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Les réunions planifiées sont réservées aux administrateurs (contrat de GET /api/org/meetings).
  const loadMeetings = useCallback(async () => {
    if (!admin) return;
    try {
      const response = await fetch('/api/org/meetings', { cache: 'no-store' });
      if (!response.ok) return;
      const result = await response.json();
      setMeetings(asArray<ScheduledMeeting>(result.meetings));
    } catch { /* section optionnelle : échec silencieux */ }
  }, [admin]);

  useEffect(() => { void load(); void loadMeetings(); }, [load, loadMeetings]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  /**
   * Rejoint une salle. `autoStart` (par défaut true) indique que l'appel doit
   * démarrer immédiatement : c'est le cas d'un clic volontaire sur une salle.
   * Un lien profond (?room=…) sélectionne la salle sans lancer le média, afin de
   * respecter les règles navigateur (micro/caméra sur geste utilisateur).
   */
  const join = useCallback((target: JoinTarget, options?: { scroll?: boolean; autoStart?: boolean }) => {
    setActive(target);
    setAutoStart(options?.autoStart !== false);
    setNotice('');
    if (options?.scroll !== false) {
      setTimeout(() => document.getElementById('video-meeting-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
  }, []);

  /** Quitte la salle : retire le paramètre `?room=` de l'URL. */
  const leave = useCallback(() => {
    setActive(null);
    try { window.history.replaceState(null, '', `${window.location.pathname}`); } catch { /* no-op */ }
  }, []);

  // Lien profond (?room=…) : sélectionne la salle demandée dès que la liste est chargée.
  useEffect(() => {
    if (deepLinkApplied.current || loading || !defaultRoom) return;
    if (!isJitsiRoomName(defaultRoom)) { deepLinkApplied.current = true; return; }
    deepLinkApplied.current = true;
    const known = rooms.find((room) => room.roomName === defaultRoom);
    if (known) { join({ roomName: known.roomName, name: known.name, domain: known.domain }, { autoStart: false }); return; }
    join({ roomName: defaultRoom, name: 'Salle partagée', domain: jitsiDomain() }, { autoStart: false });
  }, [loading, defaultRoom, rooms, join]);

  // Synchronise l'URL (?room=…) avec la salle active : le lien devient partageable.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Tant que le lien profond (?room=…) n'a pas été appliqué, on ne réécrit pas
    // l'URL : cela préserverait la salle demandée si la page est rechargée.
    if (defaultRoom && !deepLinkApplied.current) return;
    const base = `${window.location.origin}/o/${orgSlug}/reunions`;
    try {
      window.history.replaceState(null, '', active ? `${base}?room=${encodeURIComponent(active.roomName)}` : base);
    } catch { /* no-op */ }
  }, [active, orgSlug, defaultRoom]);

  async function copyRoom(room: Room | JoinTarget) {
    try {
      await navigator.clipboard.writeText(jitsiRoomUrl(room.roomName, room.domain));
      setCopiedId('id' in room ? room.id : room.roomName);
      setNotice('Lien de la salle copié dans le presse-papiers.');
      setTimeout(() => setCopiedId(''), 2200);
    } catch {
      setError('Copie impossible : sélectionnez le lien manuellement.');
    }
  }

  /** Crée une salle ou applique un renommage (administrateurs). */
  async function saveRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setFormError('');
    setSaving(true);
    try {
      const editingValue = editing;
      const response = await fetch(editingValue ? `/api/org/meeting-rooms/${editingValue.id}` : '/api/org/meeting-rooms', {
        method: editingValue ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: safeStr(data.name).trim(),
          departmentName: safeStr(data.departmentName).trim() || (editingValue ? null : undefined),
          isDefault: !editingValue && data.isDefault === 'on' ? true : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Enregistrement impossible.');
      setFormOpen(false);
      setEditing(null);
      setNotice(editingValue ? 'Salle mise à jour.' : 'Salle de visioconférence créée.');
      await load();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  /** Action rapide administrateur : définir la salle par défaut. */
  async function setDefault(room: Room) {
    setError('');
    try {
      const response = await fetch(`/api/org/meeting-rooms/${room.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Mise à jour impossible.');
      setNotice(`« ${room.name} » est désormais la salle par défaut.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Mise à jour impossible.');
    }
  }

  /** Supprime une salle (administrateurs), hors salle en cours d'utilisation. */
  async function removeRoom(room: Room) {
    if (active?.roomName === room.roomName) { setError('Quittez la salle avant de la supprimer.'); return; }
    setError('');
    setConfirmId('');
    try {
      const response = await fetch(`/api/org/meeting-rooms/${room.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Suppression impossible.');
      setNotice(result.message ?? 'Salle supprimée.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Suppression impossible.');
    }
  }

  const upcoming = meetings
    .filter((meeting) => roomNameFromUrl(meeting.meetingLink) && new Date(meeting.endAt).getTime() >= Date.now())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 6);

  return (
    <div className="section-page meeting-rooms-panel">
      <div className="page-heading">
        <div>
          <p className="eyebrow">TRAVAIL COLLABORATIF</p>
          <h1>Visioconférence</h1>
          <p className="muted">Lancez ou rejoignez une salle de réunion Jitsi depuis l’espace de travail.</p>
        </div>
        <div className="page-actions">
          <button className="outline-button" type="button" onClick={() => void load()} title="Rafraîchir la liste">
            <RefreshCw size={16} /> Rafraîchir
          </button>
          {admin && (
            <button
              className="primary-button"
              type="button"
              onClick={() => { setEditing(null); setFormError(''); setFormOpen(true); }}
            >
              <Plus size={17} /> Créer une salle
            </button>
          )}
        </div>
      </div>

      {error && <div className="notice error">{error}<button type="button" onClick={() => { setError(''); void load(); }}><RefreshCw size={15} /> Réessayer</button></div>}
      {notice && <div className="notice success">{notice}</div>}

      {active && (
        <div className="meeting-stage" id="video-meeting-anchor">
          <VideoMeeting
            key={active.roomName}
            roomName={active.roomName}
            subject={active.name}
            domain={active.domain || jitsiDomain()}
            displayName={displayName}
            email={safeStr(user.email)}
            autoJoin={autoStart}
            onLeft={leave}
          />
        </div>
      )}

      <section className="meeting-rooms-section">
        <h2 className="meeting-section-title">
          <Users size={16} /> Salles de l’organisation
          <span className="muted">· {rooms.length}</span>
        </h2>

        {loading ? (
          <div className="loading-state"><span className="spinner" /> Chargement des salles…</div>
        ) : rooms.length === 0 ? (
          <div className="empty-state">
            <Video size={24} />
            <h3>Aucune salle de visioconférence</h3>
            <p className="muted">
              {admin ? 'Créez une salle permanente et partagez son lien à toute l’équipe.' : 'Aucune salle n’a encore été créée par un administrateur.'}
            </p>
          </div>
        ) : (
          <div className="room-grid">
            {rooms.map((room) => {
              const isActive = active?.roomName === room.roomName;
              return (
                <article className={'room-card panel' + (isActive ? ' active' : '')} key={safeStr(room.id)}>
                  <div className="room-head">
                    <span className="room-icon"><Video size={18} /></span>
                    <div className="room-title">
                      <strong>{safeStr(room.name)}</strong>
                      <small className="muted">
                        {room.department?.name ? `Projet · ${safeStr(room.department.name)}` : 'Toute l’équipe'}
                      </small>
                    </div>
                    {room.isDefault && <span className="table-badge">Par défaut</span>}
                  </div>

                  <p className="room-id"><Link2 size={14} /> {safeStr(room.roomName)}</p>

                  <div className="room-meta">
                    <span>Créée le {safeDateTime(room.createdAt)}</span>
                    {room.createdBy && <span>· {safeFullName(room.createdBy)}</span>}
                    {room._count?.meetings ? <span>· {room._count.meetings} réunion(s)</span> : null}
                  </div>

                  <div className="room-actions">
                    <button
                      className="primary-button"
                      type="button"
                      disabled={isActive}
                      onClick={() => join({ roomName: room.roomName, name: room.name, domain: room.domain })}
                    >
                      <Video size={16} /> {isActive ? 'En cours' : 'Rejoindre'}
                    </button>
                    <button className="outline-button" type="button" onClick={() => void copyRoom(room)}>
                      <Copy size={15} /> {copiedId === room.id ? 'Lien copié' : 'Copier le lien'}
                    </button>
                    <a className="outline-button" href={jitsiRoomUrl(room.roomName, room.domain)} target="_blank" rel="noreferrer">
                      <ExternalLink size={15} /> Ouvrir
                    </a>
                    {admin && (
                      <>
                        <button className="outline-button" type="button" onClick={() => { setEditing(room); setFormError(''); setFormOpen(true); }}>
                          <Pencil size={15} /> Renommer
                        </button>
                        {!room.isDefault && (
                          <button className="outline-button" type="button" onClick={() => void setDefault(room)}>
                            Par défaut
                          </button>
                        )}
                        {confirmId === room.id ? (
                          <button className="outline-button danger" type="button" onClick={() => void removeRoom(room)}>
                            Confirmer la suppression
                          </button>
                        ) : (
                          <button className="outline-button danger" type="button" onClick={() => setConfirmId(room.id)}>
                            <Trash2 size={15} /> Supprimer
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {admin && upcoming.length > 0 && (
        <section className="meeting-rooms-section">
          <h2 className="meeting-section-title">
            <Video size={16} /> Réunions planifiées à venir
            <span className="muted">· {upcoming.length}</span>
          </h2>
          <div className="meeting-list">
            {upcoming.map((meeting) => {
              const target = roomNameFromUrl(meeting.meetingLink);
              return (
                <div className="meeting-row" key={safeStr(meeting.id)}>
                  <div className="meeting-row-title">
                    <strong>{safeStr(meeting.title)}</strong>
                    <small className="muted">{safeDateTime(meeting.startAt)}</small>
                  </div>
                  {target ? (
                    <button
                      className="outline-button"
                      type="button"
                      onClick={() => join({ roomName: target, name: meeting.title, domain: jitsiDomain() })}
                    >
                      <Video size={15} /> Rejoindre
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {formOpen && (
        <div
          className="modal-overlay"
          onClick={(event) => { if (event.target === event.currentTarget) { setFormOpen(false); setEditing(null); } }}
        >
          <form className="modal" style={{ maxWidth: 520 }} key={editing?.id ?? 'new'} onSubmit={saveRoom}>
            <div className="modal-header">
              <h2>{editing ? 'Modifier la salle' : 'Créer une salle de réunion'}</h2>
              <button className="icon-button" type="button" onClick={() => { setFormOpen(false); setEditing(null); }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p className="muted" style={{ marginTop: 0 }}>
                L’identifiant technique de la salle est généré automatiquement : il est unique et non devinable,
                ce qui évite qu’un tiers rejoigne la réunion par hasard.
              </p>
              <div className="form-row">
                <label>Nom de la salle *</label>
                <input name="name" required maxLength={80} defaultValue={editing?.name ?? ''} placeholder="Ex. Point hebdomadaire équipe" />
              </div>
              <div className="form-row">
                <label>Projet / équipe (optionnel)</label>
                <input
                  name="departmentName"
                  maxLength={60}
                  defaultValue={editing?.department?.name ?? ''}
                  placeholder="Ex. Projet Alpha"
                />
              </div>
              {!editing && (
                <div className="form-row">
                  <label>
                    <input type="checkbox" name="isDefault" /> Définir comme salle par défaut de l’organisation
                  </label>
                </div>
              )}
              {formError && <div className="notice error">{formError}</div>}
            </div>
            <div className="modal-footer">
              <button className="secondary-button" type="button" onClick={() => { setFormOpen(false); setEditing(null); }}>
                Annuler
              </button>
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer la salle'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}