// Déclarations globales de types.
//
// TypeScript 6+ active `noUncheckedSideEffectImports` par défaut : les imports
// « side-effect » de fichiers non-TS (ex. `import './globals.css'`) doivent
// avoir une déclaration de module. Cette déclaration couvre tous les fichiers
// CSS du projet et reste sans effet (inoffensive) sur TypeScript 5.x.
declare module '*.css';
