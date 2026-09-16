# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v7.3] - 2026-09-15

### Added
- **Suivi du temps :**
  - Modèle Prisma **`TimeEntry`** (mode `TIMER`/`MANUAL`, `startedAt`/`endedAt`, `minutes`, note,
    rattachement tâche + projet, organisation) avec index de performance.
  - API **`GET/POST /api/time-entries`** (liste + agrégats par tâche et par projet, chrono en cours
    via `?running=1`), **`DELETE /api/time-entries/[id]`**, **`POST /api/time-entries/[id]/stop`**
    (arrêt du chrono avec calcul de durée). Un seul chrono actif par utilisateur.
  - Onglet **« Suivi du temps »** (`src/app/time-tracking-panel.tsx`) : chrono en direct, saisie
    manuelle, totaux par tâche/projet, historique ; vue équipe pour les administrateurs.
- **Fil d'activité :**
  - Modèle Prisma **`ActivityEvent`** (acteur, action, entité, résumé, projet) + helper
    **`recordActivity()`** (`src/lib/activity.ts`) branché sur tâches, temps, notes et livrables.
  - API **`GET /api/activity-feed`** avec polling incrémental (`?since=`, `?project=`).
  - Onglet **« Fil d'activité »** (`src/app/activity-feed-panel.tsx`) : rafraîchissement
    automatique toutes les 15 s, déduplication, tri chronologique.
- **Notes collaboratives de réunion (comptes-rendus) :**
  - Modèle Prisma **`MeetingNote`** lié à une réunion planifiée et/ou une salle Jitsi (`roomName`)
    et/ou un projet, avec auteur et **dernier éditeur**.
  - API **`GET/POST /api/meeting-notes`** et **`GET/PATCH/DELETE /api/meeting-notes/[id]`**
    (édition partagée, suppression auteur/admin).
  - Onglet **« Notes de réunion »** (`src/app/meeting-notes-panel.tsx`) : création liée aux
    réunions Jitsi, éditeur partagé re-synchronisé toutes les 10 s.
- **Documents & livrables :**
  - Modèle Prisma **`ProjectDocument`** (lien ou fichier, description, projet, tâche optionnelle).
  - API **`GET/POST /api/project-documents`** (filtre par projet) et
    **`DELETE /api/project-documents/[id]`** (auteur/admin).
  - Onglet **« Livrables »** (`src/app/documents-panel.tsx`) : partage, filtres par projet, ouverture.
- **Pages dédiées** accessibles par URL directe : `/o/<slug>/temps`, `/activite`, `/notes`,
  `/livrables` (garde `requireOrgMember` + redirection sur le slug actif).
- Onglets ajoutés dans `AppLayout` pour les quatre modules (visibles par tous les membres).

### Notes
- **Base : `npx prisma db push` appliqué** (tables `TimeEntry`, `ActivityEvent`, `MeetingNote`,
  `ProjectDocument` + relations) — opération purement additive, aucune donnée impactée.

### Validation
- `npx prisma validate` + `prisma generate` + `prisma db push` : OK.
- Type-check `tsc --noEmit` : 0 erreur ; `npm run build` : succès (8 nouvelles routes API).

## [v7.2] - 2026-09-15

### Added
- **Visioconférence native (Jitsi Meet) :**
  - Composant réutilisable **`<VideoMeeting />`** (`src/app/video-meeting.tsx`) : API Iframe chargée à
    la demande (`external_api.js`, sans dépendance npm), scène responsive (16/9 en desktop, hauteur
    confortable en mobile), thème sombre, écouteurs d'événements (connexion, participants, micro/caméra,
    `readyToClose`, erreurs), `dispose()` garanti au démontage, actions rejoindre / couper le micro /
    couper la caméra / copier le lien / nouvel onglet / quitter.
  - Typages dédiés (`src/types/jitsi.d.ts`) et utilitaires partagés (`src/lib/jitsi.ts` :
    domaine, validation et URL de salle, chargeur singleton du script).
  - Onglet **« Visioconférence »** dans la barre latérale (`src/app/meeting-rooms-panel.tsx`) +
    **page dédiée** `/o/<slug>/reunions?room=<salle>` : le lien est partageable et rejoint
    directement la salle demandée.
  - Modèle Prisma **`MeetingRoom`** (nom, identifiant Jitsi unique, domaine, salle par défaut,
    organisation, projet/équipe optionnel, créateur) et rattachement optionnel `Meeting.roomId`
    (`meetingLink` reste supporté).
  - API **`GET/POST /api/org/meeting-rooms`** et **`PATCH/DELETE /api/org/meeting-rooms/[id]`** :
    lecture par tout membre, création/modification/suppression réservées à l'administrateur
    d'organisation ; identifiant de salle généré côté serveur (unique et non devinable) ; audit.
  - Les **réunions planifiées** dont le lien est une salle Jitsi sont rejoignables en un clic
    depuis l'onglet (administrateurs).
  - Le formulaire **« Planifier une réunion »** (calendrier) permet de choisir une salle Jitsi :
    le lien et `Meeting.roomId` sont renseignés automatiquement (le lien visio libre reste possible).
  - `NEXT_PUBLIC_JITSI_DOMAIN` documenté dans `.env.example` pour un Jitsi auto-hébergé.
- `scripts/backup.mjs` : la sauvegarde JSON inclut désormais la table `meetingRooms`.

### Notes
- **Migration base requise avant mise en ligne : `npx prisma db push`** (nouvelle table
  `MeetingRoom` + colonne `Meeting.roomId`), déjà couvert par le `preDeployCommand` Render.

### Validation
- `npx prisma validate` : schéma valide ; `npx prisma generate` : client régénéré.
- Type-check `tsc --noEmit` : 0 erreur.

## [v7.1] - 2026-09-13

### Added
- **« Plan & licence » dans les Paramètres** : l'admin consulte son palier, son tarif,
  ses membres occupés et la date d'expiration, voit sa période d'essai (jours restants),
  et peut saisir un **code de licence** pour activer ou mettre à niveau son abonnement
  (+ bouton « Re-vérifier la licence » et grille tarifaire avec palier courant en surbrillance).
- **Relance par e-mail avant/après expiration** (`scripts/notify-expiry.ts`) : le workflow
  quotidien envoie aux admins d'organisation un e-mail de relance dans les 5 jours précédant
  l'échéance et dès l'expiration, avec palier/tarif et lien d'action. Déduplication via
  `SystemSetting` (une relance par échéance, pas par jour). Désactivable si SMTP absent,
  seuil paramétrable (`EXPIRY_WARNING_DAYS`), lien via `APP_URL`.
- `.env.example` documente `MAIL_FROM`, `APP_URL`, `EXPIRY_WARNING_DAYS` et les secrets
  de workflow requis.

### Changed
- `src/lib/mailer.ts` : l'expéditeur honore désormais `MAIL_FROM` puis `SMTP_FROM`
  (repli cohérent avec `.env.example`).

### Validation
- Type-check app (`tsc --noEmit`) : 0 erreur ; type-check du script : 0 erreur.
- Exécution `npx tsx scripts/notify-expiry.ts` sans SMTP : dégradation douce (sortie 0).

## [v7] - 2026-09-11

### Added
- **Système de monétisation par paliers & codes de licence d'activation :**
  - Modèle `LicenseCode` (code unique, palier, stock de sièges, statut UNUSED/USED/REVOKED) + champs de facturation sur `Organization` (`planTier`, `planStatus`, `planExpiresAt`, `licenseCodeId`)
  - Grille tarifaire : T1 1-3 (5 000 F), T2 4-10 (10 000 F), T3 11-20 (15 000 F), T4 20+ (20 000 F) — constante partagée `src/lib/plans.ts` (sûre client)
  - `GET /api/org/plan` : état d'abonnement en temps réel (verrouillage auto si expiration ou dépassement de palier compté sièges = membres + invitations en attente)
  - `POST /api/org/activate` : saisie d'un code d'activation par l'admin pour débloquer (ou mettre à niveau)
  - **Écran de verrouillage** (`plan-lock.tsx`) affiché dans l'app quand l'organisation est verrouillée, avec grille tarifaire
  - **Blocage des invitations en cas de dépassement de palier** : le POST `/api/invitations` refuse un nouveau membre qui ferait basculer l'équipe au palier supérieur (erreur 402 + palier requis) ; alerte claire dans le panneau Invitations
  - Console super-admin : génération, listing, copie et révocation des codes (`GET/POST /api/platform/licenses`, `POST .../revoke`) + colonne « Palier » dans la vue organisations
- **Réinitialisation sécurisée de mot de passe (zéro-connaissance) :**
  - Modèle `PasswordReset` (jeton haché, usage unique, expire en 24 h) — le mot de passe n'est jamais stocké en clair
  - `POST /api/auth/forgot`, `GET|POST /api/auth/reset`, pages `/forgot` et `/reset` + lien « Mot de passe oublié ? » sur la page de connexion
- **Photos de profil :** upload depuis l'espace membre (data-URL, 1,5 Mo max) via `/api/profile` ; affichage de la vraie photo (avec fallback sur les initiales) dans la sidebar, le topbar, la gestion des membres, les activités et les annonces
- **Refonte de la page d'accueil :** hero moderne centré, grille de cartes responsive (styles absents auparavant → corrige l'affichage brut / la superposition des icônes), en-tête & pied de page

### Changed
- Inscription d'organisation : démarre automatiquement au palier T1
- `src/lib/billing.ts` ré-factoré : constantes de paliers purs dans `src/lib/plans.ts` + helpers serveur (`getOrgSeatUsage`, `checkInviteSeatCapacity`)
- Renforcement du thème sombre (`landing.css`) : cartes/containers adaptés pour supprimer les flashs lumineux
- `middleware.ts` : `/reset`, `/forgot`, `/rejoindre` désormais publics

### Security
- Le code d'activation brut n'est expirable et mono-organisation ; le jeton de reset est stocké haché

### Validation
- `prisma generate` + `prisma validate` : OK
- Type-check `tsc --noEmit` : 0 erreur
- **Migration base requise avant mise en ligne : `npx prisma db push --skip-generate`** (déjà exécuté comme `preDeployCommand` sur Render)

## [v6.2] - 2026-09-04

### Fixed
- **Assistant IA Gemini inactif sur Render** (l'assistant se contentait des réponses basiques du guide hors-ligne malgré la clé configurée) :
  - cause principale : variable configurée `gemini_api_key` (minuscules) sur le dashboard Render alors que le code ne lisait que `GEMINI_API_KEY` (Linux/Render est sensible à la casse) — la clé était donc invisible côté serveur
  - la clé est désormais recherchée dans 5 noms de variables : `GEMINI_API_KEY`, `gemini_api_key`, `GEMINI_KEY`, `GOOGLE_API_KEY`, `google_api_key`
  - modèle codé en dur `gemini-1.5-flash` (en cours de retrait de l'API Google → 404 silencieux converti en mode hors-ligne) remplacé par une chaîne de secours : `GEMINI_MODEL` (optionnel) → `gemini-2.0-flash` → `gemini-1.5-flash`, avec mémorisation du modèle qui fonctionne
  - logs serveur explicites (statut HTTP + détail Google, sans jamais exposer la clé) pour diagnostiquer depuis les logs Render
  - erreurs différenciées côté utilisateur : clé refusée (400 `API_KEY_INVALID` / 401 / 403), quota atteint (429), modèles inaccessibles, réseau/timeout, réponse vide/bloquée
  - le message d'erreur réel de Google est désormais inclus dans le warning affiché dans l'interface (tronqué à 160 caractères), rendant la cause visible sans consulter les logs
  - la clé invalide détectée via `API_KEY_INVALID` interrompt immédiatement l'essai des modèles (inutile de tester les autres)
  - **chaîne de modèles obsolète** (404 « models/gemini-2.0-flash / gemini-1.5-flash is not found » — ces modèles ont été retirés de l'API) : ajout de l'alias `gemini-flash-latest` et de `gemini-2.5-flash` en tête de chaîne
  - **auto-résolution dynamique** : si toute la chaîne statique échoue, le serveur interroge `ListModels` (endpoint recommandé par le message d'erreur de Google), filtre les modèles compatibles `generateContent`, les trie par préférence (alias latest > flash récent > pro) et utilise le premier qui répond — le modèle retenu est mémorisé pour les requêtes suivantes
  - en cas d'échec total, la liste réelle des modèles disponibles pour la clé est affichée dans le warning (et loguée côté serveur)

### Changed
- `src/app/ai-assistant.tsx` : l'avertissement serveur (`warning`) est désormais affiché dans la bulle de l'assistant au lieu d'être ignoré

### Validation
- Type-check `tsc --noEmit` : 0 erreur
- Build local complet : `Compiled successfully` + génération des pages, `EXITCODE=0`


## [v6.1] - 2026-09-03

### Fixed
- Erreur React #130 (« Objects are not valid as a React child ») : nouveau module `src/lib/render-safe.ts` avec helpers sûrs (`safeStr`, `safeDate`, `safeDateTime`, `safeDateLabel`, `safeTimeLabel`, `safeFullName`, `asArray`) appliqués sur l'ensemble des panneaux
- **Échec de déploiement Render** (« Type error: Invalid value for '--ignoreDeprecations' ») :
  - suppression de `baseUrl` (déprécié en TypeScript 6 — erreur TS5101) au profit de `paths` relatifs, résolus depuis le tsconfig (TS 5.0+ et Next.js 13.1+)
  - suppression de `ignoreDeprecations` et `noUncheckedSideEffectImports`, dont l'acceptation varie selon la version de TypeScript résolue par Render
  - ajout de `src/types/css.d.ts` (`declare module '*.css'`) pour l'import side-effect de `globals.css`, requis car `noUncheckedSideEffectImports` est actif par défaut en TypeScript 6 (erreur TS2882)
  - épinglage strict de `typescript@6.0.3` dans `package.json` + resynchronisation du `package-lock.json` (suppression de la dérive `^5.6.3` / `^6.0.3`) pour une installation déterministe sur Render
  - ajout de `engines.node >=18.18` (Next.js 14.2)
- Défilement interne des modales amélioré (UX scroll)
- Erreurs TypeScript corrigées (`tsconfig.tsbuildinfo` exclu du repo, options tsconfig ajustées)
- Contrats de routes API alignés (`/api/org/calendar`, `/api/platform/orgs/[id]`)
- Cloche de notifications et panneau notifications : rendu sécurisé contre les valeurs nulles/undefined

### Changed
- `UsersPanel.tsx` extrait dans un composant dédié (`src/app/o/[slug]/users/`) pour alléger la page
- `next.config.js` : alias `@` épinglé via webpack
- `.gitignore` enrichi (logs de build, fichiers temporaires) ; suppression des logs historiques du dépôt

### Validation
- Build local validé : `Compiled successfully` + `Generating static pages (40/40)`
- Type-check validé sur TypeScript 6.0.3 **et** 5.5.4 (compatibilité ascendante)
- Commits : `8185140` (fix rendering/UX) + `517c079` (fix déploiement Render)
- Tag poussé : `v6.1`


## [v6] - 2026-08-23

### Added
- Modales améliorées : scroll interne (`max-h-[90vh]`), footer sticky, lock body via classe `.modal-open`
- Dashboard synthétique : carte statut journée (barre de progression), section "Accès rapide" (Calendrier, Pointage, Notifications), section "Échéances à venir"
- Mode sombre/clair global avec toggle persistant (`localStorage`)
- Export CSV pour les pages Tâches et Rapports
- Navigation centralisée via `onNavigate` dans `AppLayout.tsx`
- Icônes `Sun` et `Moon` ajoutées dans `ui-icons.tsx`

### Changed
- `globals.css` : scope `data-theme="dark"` + palette complète (sidebar, inputs, cards, tables)
- `AppLayout.tsx` + `Dashboard.tsx` : props `onNavigate` centralisées
- `*panel.tsx` : ajout du bouton "Export CSV"

### Security
- `requireOrgAdmin` appliqué sur création de réunions et tâches sensibles
- Supervision admin : accès aux données agrégées sans exposer le contenu privé des messages

### Validation
- Build local validé : `Compiled successfully (39/39 pages)`
- Commit validé : `8573caf`
- Tag poussé : `v6`

## [v5] - 2026-08-22

### Added
- Assistant IA Gemini (mode online + fallback offline)
- Compteur de notifications en temps réel
- Calendrier interactif (Mois/Semaine/Jour) fusionnant tâches, réunions et congés
- Gestion des réunions (création + notifications + RSVP)
- Gestion des congés (demande + approbation + notifications)
- Module de pointage avec géolocalisation (contrôle GPS + zone + rayon de tolérance)
- Section "Aide / Guide" contextuelle (admin / employé)
- Réinitialisation de mot de passe par l'admin

### Security
- RBAC renforcé : création de tâche admin-only, accès audit admin-only
- API `PATCH /api/admin/users/[id]/password` avec hachage bcrypt + invalidation sessions

## [v4] - 2026-08-21

### Added
- Branding "MAR-CI FLOW" appliqué sur toute l'interface
- Sidebar corrigée : lien Calendrier + logo plus grand
- Guide d'utilisation conditionnel (admin / employé)

## [v3] - 2026-08-20

### Added
- Migration PostgreSQL + synchronisation base distante (Render)
- Configuration `next.config.js` + `tsconfig.json` rétablis

## [v2] - 2026-08-19

### Added
- Module de pointage d'heures
- Système de notifications visuelles (cloche + badge)

## [v1] - 2026-08-18

### Added
- Version initiale de l'application
- Authentification par sessions JWT
- Gestion multi-organisations
- Tableaux de bord admin / employé
