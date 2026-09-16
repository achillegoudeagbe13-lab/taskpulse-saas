/**
 * Déclarations TypeScript pour l'API Iframe de Jitsi Meet (`external_api.js`).
 *
 * Le script externe est chargé à la demande côté client par `src/lib/jitsi.ts`
 * puis expose le constructeur global `JitsiMeetExternalAPI`. Comme le paquet
 * npm officiel n'est pas une dépendance du projet, on décrit ici le strict
 * nécessaire (constructeur, écouteurs d'événements, commandes et méthodes
 * utilisées par `src/app/video-meeting.tsx`).
 *
 * Référence : https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe
 */

/** Options acceptées par le constructeur `new JitsiMeetExternalAPI(domain, options)`. */
declare global {
  interface JitsiMeetExternalAPIOptions {
    /** Nom de la salle (forme l'URL `https://<domain>/<roomName>`). */
    roomName: string;
    /** Élément DOM dans lequel l'iframe est insérée. */
    parentNode?: HTMLElement;
    width?: number | string;
    height?: number | string;
    /** Surcharges de `config.js` (ex. `startWithAudioMuted`, `prejoinConfig`). */
    configOverwrite?: Record<string, unknown>;
    /** Surcharges de `interface_config.js` (ex. `DARK_MODE`, `TOOLBAR_BUTTONS`). */
    interfaceConfigOverwrite?: Record<string, unknown>;
    /** Identité affichée aux autres participants. */
    userInfo?: { displayName?: string; email?: string };
    /** Langue par défaut de l'interface. */
    lang?: string;
    /** Jeton JWT (déploiements authentifiés / JaaS). */
    jwt?: string;
    /** Périphériques initiaux (libellés). */
    devices?: { audioInput?: string; audioOutput?: string; videoInput?: string };
    /** Callback appelé lorsque l'iframe est chargée. */
    onload?: () => void;
  }

  /** Écouteur d'événement Jitsi (charge utile variable selon l'événement). */
  type JitsiEventListener = (payload: any) => void;

  /** Instance retournée par `new JitsiMeetExternalAPI(...)`. */
  interface JitsiMeetExternalAPIInstance {
    /** Ferme la conférence et retire l'iframe du DOM. */
    dispose: () => void;
    /** Exécute une commande (`toggleAudio`, `toggleVideo`, `hangup`, …). */
    executeCommand: (command: string, ...args: unknown[]) => void;
    /** Abonne un écouteur à un événement (`videoConferenceJoined`, …). */
    addListener: (event: string, listener: JitsiEventListener) => void;
    /** Retire un écouteur d'événement. */
    removeListener: (event: string, listener: JitsiEventListener) => void;
    /** Nombre de participants connectés (peut lever si l'iframe n'est pas prête). */
    getNumberOfParticipants: () => number;
    isAudioMuted: () => Promise<boolean>;
    isVideoMuted: () => Promise<boolean>;
    getIFrame: () => HTMLIFrameElement;
  }

  /**
   * Constructeur global installé par `external_api.js`. Il est accessible via
   * `window.JitsiMeetExternalAPI` (les variables globales déclarées ici sont
   * fusionnées dans `Window & typeof globalThis`).
   */
  var JitsiMeetExternalAPI:
    | (new (domain: string, options: JitsiMeetExternalAPIOptions) => JitsiMeetExternalAPIInstance)
    | undefined;
}

export {};