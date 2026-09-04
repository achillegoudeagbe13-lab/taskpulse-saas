# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
