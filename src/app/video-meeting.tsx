'use client';

/**
 * <VideoMeeting /> — composant réutilisable de visioconférence native (Jitsi Meet).
 *
 * S'appuie sur l'API Iframe de Jitsi (`external_api.js`, chargée à la demande
 * par `src/lib/jitsi.ts`) : la salle vit dans une iframe insérée dans la page,
 * sans dépendance npm supplémentaire. Le composant est :
 *  - responsive : scène 16/9 sur desktop, hauteur confortable sur mobile ;
 *  - compatible thème sombre : habillage applicatif + `DARK_MODE` transmis à Jitsi ;
 *  - sûr : `dispose()` systématique au démontage / changement de salle ;
 *  - autonome : état de chargement, erreur + réessai, quitter, copier le lien.
 *
 * Exemple :
 *   <VideoMeeting roomName="taskpulse-mar-ci-flow-reunion-3f9a2c" displayName="Awa Diop" />
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, ExternalLink, Mic, MicOff, PhoneOff, RefreshCw, Users, Video as VideoIcon, VideoOff } from './ui-icons';
import { isJitsiRoomName, jitsiDomain, jitsiRoomUrl, loadJitsiApi } from '../lib/jitsi';
import { safeStr } from '../lib/render-safe';

type MeetingStatus = 'idle' | 'loading' | 'ready' | 'error';

export type VideoMeetingProps = {
  /** Identifiant de la salle Jitsi (généré par l'API `/api/org/meeting-rooms`). */
  roomName: string;
  /** Nom affiché aux autres participants. */
  displayName?: string;
  /** E-mail transmis à Jitsi (avatar Gravatar, modération). */
  email?: string;
  /** Sujet affiché dans l'interface Jitsi. */
  subject?: string;
  /** Domaine Jitsi (défaut : `NEXT_PUBLIC_JITSI_DOMAIN` ou `meet.jit.si`). */
  domain?: string;
  /** Jeton JWT pour un déploiement Jitsi authentifié (JaaS). */
  jwt?: string;
  /** Rejoint la salle dès le montage (sinon un bouton « Rejoindre » est proposé). */
  autoJoin?: boolean;
  /** Micro coupé à l'arrivée. */
  startAudioMuted?: boolean;
  /** Caméra coupée à l'arrivée. */
  startVideoMuted?: boolean;
  /** Masque la barre d'outils applicative (iframe seule). */
  showToolbar?: boolean;
  className?: string;
  onJoined?: () => void;
  onLeft?: () => void;
};

/**
 * Boutons conservés dans la barre d'outils Jitsi (clés officielles de l'API).
 * On retire le partage social, l'embed et le téléchargement pour garder
 * l'expérience centrée sur la réunion d'équipe.
 */
const TOOLBAR_BUTTONS = [
  'microphone', 'camera', 'desktop', 'chat', 'raisehand',
  'participants-pane', 'tileview', 'fullscreen', 'videoquality', 'settings', 'shortcuts', 'hangup',
];

export default function VideoMeeting({
  roomName,
  displayName,
  email,
  subject,
  domain,
  jwt,
  autoJoin = true,
  startAudioMuted = false,
  startVideoMuted = false,
  showToolbar = true,
  className,
  onJoined,
  onLeft,
}: VideoMeetingProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<JitsiMeetExternalAPIInstance | null>(null);
  const startingRef = useRef(false);

  const [status, setStatus] = useState<MeetingStatus>('idle');
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);
  const [participants, setParticipants] = useState(0);
  const [audioMuted, setAudioMuted] = useState(startAudioMuted);
  const [videoMuted, setVideoMuted] = useState(startVideoMuted);
  const [copied, setCopied] = useState(false);

  const targetDomain = domain ?? jitsiDomain();
  const roomUrl = jitsiRoomUrl(roomName, targetDomain);

  /** Libère l'instance Jitsi et l'iframe (sans toucher au state React). */
  const disposeApi = useCallback(() => {
    const api = apiRef.current;
    apiRef.current = null;
    startingRef.current = false;
    try { api?.dispose(); } catch { /* l'iframe est déjà détruite */ }
    // Sécurité : retire toute iframe résiduelle (double montage, erreur précoce).
    try { hostRef.current?.replaceChildren(); } catch { /* no-op */ }
  }, []);

  /** Démarre (ou redémarre) la conférence dans le conteneur. */
  const start = useCallback(async () => {
    if (startingRef.current || apiRef.current || !hostRef.current) return;
    if (!isJitsiRoomName(roomName)) {
      setStatus('error');
      setError('Identifiant de salle invalide. Créez une salle depuis l’onglet Visioconférence.');
      return;
    }

    startingRef.current = true;
    setStatus('loading');
    setError('');

    try {
      await loadJitsiApi(targetDomain);
      const Ctor = window.JitsiMeetExternalAPI;
      if (!Ctor || !hostRef.current) throw new Error('API Jitsi Meet indisponible.');

      hostRef.current.replaceChildren();

      const api = new Ctor(targetDomain, {
        roomName,
        parentNode: hostRef.current,
        width: '100%',
        height: '100%',
        lang: 'fr',
        userInfo: { displayName: displayName || undefined, email: email || undefined },
        jwt: jwt || undefined,
        configOverwrite: {
          // On rejoint directement la salle (pas d'écran de pré-jonction intermédiaire).
          prejoinConfig: { enabled: false, hideDisplayName: true },
          startWithAudioMuted: startAudioMuted,
          startWithVideoMuted: startVideoMuted,
          // Empêche le renvoi automatique vers l'application mobile Jitsi.
          disableDeepLinking: true,
          enableWelcomePage: false,
          disableInviteFunctions: true,
          ...(subject ? { subject } : {}),
        },
        interfaceConfigOverwrite: {
          // Thème sombre natif de Jitsi, cohérent avec l'habillage de l'application.
          DARK_MODE: true,
          TOOLBAR_BUTTONS,
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
          MOBILE_APP_PROMO: false,
          SHOW_CHROME_EXTENSION_BANNER: false,
          VERTICAL_FILMSTRIP: true,
          TILE_VIEW_MAX_COLUMNS: 4,
        },
      });

      apiRef.current = api;

      api.addListener('videoConferenceJoined', () => {
        setJoined(true);
        setStatus('ready');
        try { setParticipants(api.getNumberOfParticipants()); } catch { /* pas encore prête */ }
        onJoined?.();
      });
      api.addListener('videoConferenceLeft', () => {
        setJoined(false);
        onLeft?.();
      });
      api.addListener('participantJoined', () => {
        try { setParticipants(api.getNumberOfParticipants()); } catch { /* no-op */ }
      });
      api.addListener('participantLeft', () => {
        try { setParticipants(api.getNumberOfParticipants()); } catch { /* no-op */ }
      });
      api.addListener('audioMuteStatusChanged', (payload: { muted?: boolean }) => setAudioMuted(Boolean(payload?.muted)));
      api.addListener('videoMuteStatusChanged', (payload: { muted?: boolean }) => setVideoMuted(Boolean(payload?.muted)));
      // L'utilisateur a cliqué sur « raccrocher » dans l'interface Jitsi.
      api.addListener('readyToClose', () => {
        disposeApi();
        setJoined(false);
        setStatus('idle');
        onLeft?.();
      });
      api.addListener('errorOccurred', (payload: { errorType?: string; message?: string }) => {
        setStatus('error');
        setError(safeStr(payload?.message) || `Erreur de visioconférence (${safeStr(payload?.errorType) || 'inconnue'}).`);
      });

      setStatus('ready');
    } catch (reason) {
      disposeApi();
      setStatus('error');
      setError(reason instanceof Error ? reason.message : 'Impossible de démarrer la visioconférence.');
    } finally {
      startingRef.current = false;
    }
  }, [roomName, targetDomain, displayName, email, jwt, subject, startAudioMuted, startVideoMuted, disposeApi, onJoined, onLeft]);

  /** Quitte la salle et revient à l'état initial (bouton « Quitter »). */
  const leave = useCallback(() => {
    disposeApi();
    setJoined(false);
    setParticipants(0);
    setStatus('idle');
    onLeft?.();
  }, [disposeApi, onLeft]);

  /** Démarrage automatique au montage / changement de salle + nettoyage garanti. */
  useEffect(() => {
    if (autoJoin) void start();
    return () => { disposeApi(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName, targetDomain, autoJoin]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setError('Copie impossible : sélectionnez le lien manuellement.');
    }
  }

  const label = safeStr(subject) || 'Salle de réunion';

  return (
    <div className={'video-meeting' + (className ? ` ${className}` : '')}>
      {showToolbar && (
        <div className="video-meeting-head">
          <span className={'video-live' + (joined ? ' on' : '')} aria-hidden="true" />
          <div style={{ minWidth: 0 }}>
            <strong>{label}</strong>
            <small className="muted">{roomName}</small>
          </div>
          {joined && <span className="video-chip"><Users size={14} /> {participants || 1} en ligne</span>}
        </div>
      )}

      <div className="video-stage">
        {/* Conteneur dédié à l'iframe : React ne gère aucun enfant ici. */}
        <div className="video-iframe-host" ref={hostRef} />

        {status !== 'ready' && (
          <div className="video-overlay">
            {status === 'loading' && (
              <>
                <span className="spinner" />
                <h3>Connexion à la salle…</h3>
                <p>Chargement de la visioconférence sécurisée.</p>
              </>
            )}
            {status === 'idle' && (
              <>
                <span className="video-overlay-icon"><VideoIcon size={26} /></span>
                <h3>Rejoindre « {label} »</h3>
                <p>Votre navigateur vous demandera l’accès au micro et à la caméra.</p>
                <button className="primary-button" type="button" onClick={() => void start()}>
                  <VideoIcon size={16} /> Rejoindre la salle
                </button>
              </>
            )}
            {status === 'error' && (
              <>
                <span className="video-overlay-icon error"><VideoOff size={26} /></span>
                <h3>Visioconférence indisponible</h3>
                <p>{error}</p>
                <button className="outline-button" type="button" onClick={() => void start()}>
                  <RefreshCw size={15} /> Réessayer
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {showToolbar && status === 'ready' && (
        <div className="video-toolbar">
          <button
            className={'video-control' + (audioMuted ? ' off' : '')}
            type="button"
            title={audioMuted ? 'Activer le micro' : 'Couper le micro'}
            onClick={() => apiRef.current?.executeCommand('toggleAudio')}
          >
            {audioMuted ? <MicOff size={16} /> : <Mic size={16} />}
            <span>{audioMuted ? 'Micro coupé' : 'Micro'}</span>
          </button>
          <button
            className={'video-control' + (videoMuted ? ' off' : '')}
            type="button"
            title={videoMuted ? 'Activer la caméra' : 'Couper la caméra'}
            onClick={() => apiRef.current?.executeCommand('toggleVideo')}
          >
            {videoMuted ? <VideoOff size={16} /> : <VideoIcon size={16} />}
            <span>{videoMuted ? 'Caméra coupée' : 'Caméra'}</span>
          </button>
          <button className="video-control" type="button" onClick={() => void copyLink()}>
            <Copy size={16} />
            <span>{copied ? 'Lien copié' : 'Copier le lien'}</span>
          </button>
          <a className="video-control" href={roomUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={16} />
            <span>Nouvel onglet</span>
          </a>
          <button className="video-control danger" type="button" onClick={leave}>
            <PhoneOff size={16} />
            <span>Quitter</span>
          </button>
        </div>
      )}
    </div>
  );
}