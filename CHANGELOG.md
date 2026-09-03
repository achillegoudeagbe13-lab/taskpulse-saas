# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v6.1] - 2026-09-03

### Fixed
- Erreur React #130 (« Objects are not valid as a React child ») : nouveau module `src/lib/render-safe.ts` avec helpers sûrs (`safeStr`, `safeDate`, `safeDateTime`, `safeDateLabel`, `safeTimeLabel`, `safeFullName`, `asArray`) appliqués sur l'ensemble des panneaux
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
- Commit : `8185140`


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
