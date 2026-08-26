'use client';

import { useEffect, useState } from 'react';
import { Clock3, LogIn, LogOut, RefreshCw, MapPin, MapPinOff } from './ui-icons';

export default function AttendancePanel() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [geo, setGeo] = useState<{ enabled: boolean; radius?: number; lat?: number; lng?: number }>({ enabled: false });
  const [geoStatus, setGeoStatus] = useState<'idle' | 'authorized' | 'denied' | 'unavailable' | 'needed'>('idle');
  const current = records[0];

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/attendance');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setRecords(result.records);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger le pointage.');
    } finally {
      setLoading(false);
    }
  }

  // Charge les paramètres GPS de l'organisation au montage.
  useEffect(() => {
    fetch('/api/admin/settings').then((r) => r.json()).then((j) => {
      const g = j.settings || {};
      setGeo({
        enabled: g.geoEnabled === 'true',
        lat: g.geoLat ? Number(g.geoLat) : undefined,
        lng: g.geoLng ? Number(g.geoLng) : undefined,
        radius: g.geoRadiusMeters ? Number(g.geoRadiusMeters) : undefined,
      });
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, []);

  /* Capture la position GPS (toujours si disponible, requise si contrôle activé). */
  async function clock(action: 'ARRIVEE' | 'DEPART') {
        setGeoStatus('idle'); setError('');
    if (geo.enabled && !('geolocation' in navigator)) {
      setGeoStatus('unavailable'); setError("Votre navigateur ne prend pas en charge la géolocalisation, mais le pointage est contrôlé par votre administrateur."); return;
    }
    const payload: Record<string, unknown> = { action };
    if (geo.enabled) {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, (e: GeolocationPositionError) => {
          setGeoStatus(e.code === 1 ? 'denied' : 'unavailable'); reject(e);
        }, { enableHighAccuracy: true, maximumAge: 8000, timeout: 12000 });
      }).catch(() => null);
      if (!pos) {
        if (navigator.permissions) {
          navigator.permissions.query({ name: 'geolocation' }).then((p) => setGeoStatus(p.state === 'granted' ? 'authorized' : p.state === 'denied' ? 'denied' : 'needed'));
        }
        return;
      }
      setGeoStatus('authorized');
      payload.latitude = pos.coords.latitude; payload.longitude = pos.coords.longitude;
    } else {
      // Contrôle GPS désactivé : on enregistre la position en arrière-plan (audit) si le navigateur le permet.
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => { payload.latitude = pos.coords.latitude; payload.longitude = pos.coords.longitude; },
          () => {}, { enableHighAccuracy: false, maximumAge: 30000, timeout: 5000 },
        );
      }
    }
    const response = await fetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, userAgent: navigator.userAgent || undefined }) });
    const result = await response.json();
    if (!response.ok) setError(result.error);
    else setTimeout(load, 700);
  } return <div className="section-page"><div className="page-heading"><div><p className="eyebrow">SUIVI DU TEMPS</p><h1>Pointage</h1><p className="muted">Enregistrez précisément votre journée de travail.</p></div><Clock3 size={25} className="panel-icon" /></div>{error && <div className="notice error">{error}<button onClick={load}><RefreshCw size={15} /> Réessayer</button></div>}{loading ? <div className="loading-state"><span className="spinner" /> Chargement du pointage…</div> : <><section className="panel attendance-panel standalone"><div className="attendance-clock"><span className={current && !current.clockOut ? 'pulse live' : 'pulse'} /><strong>{current && !current.clockOut ? 'Journée en cours' : 'Pas encore pointé'}</strong><small>{current ? `Arrivée à ${new Date(current.clockIn).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Commencez votre journée'}</small></div><div className="attendance-actions"><button className="primary-button" onClick={() => clock('ARRIVEE')} disabled={Boolean(current && !current.clockOut)}><LogIn size={17} /> Arrivée</button><button className="secondary-button" onClick={() => clock('DEPART')} disabled={!current || Boolean(current.clockOut)}><LogOut size={17} /> Départ</button></div>{geo.enabled && <div className={`geo-hint ${geoStatus}`}>{geoStatus === 'authorized' ? <><MapPin size={14} /> Position autorisée — vous pouvez pointer.</> : geoStatus === 'denied' ? <><MapPinOff size={14} /> Autorisation refusée : activez la localisation pour pointer.</> : geoStatus === 'needed' ? <><MapPinOff size={14} /> Activez la géolocalisation dans votre navigateur pour pointer.</> : <>Vérification de votre position…</>}</div>}</section><section className="panel"><h3>Historique des pointages</h3><div className="responsive-table"><table><thead><tr><th>Date</th><th>Arrivée</th><th>Départ</th><th>Durée</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{new Date(record.clockIn).toLocaleDateString('fr-FR')}</td><td>{new Date(record.clockIn).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td><td>{record.clockOut ? new Date(record.clockOut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'En cours'}</td><td>{record.clockOut ? `${Math.round((new Date(record.clockOut).getTime() - new Date(record.clockIn).getTime()) / 60000)} min` : '—'}</td></tr>)}</tbody></table></div></section></>}</div>; }