# CLAUDE.md — guide de travail pour les agents IA sur OpenLibrary

Ce fichier décrit comment travailler sur ce dépôt. Il ne contient aucun secret et ne doit jamais en contenir.

## Mission du projet

OpenLibrary est une plateforme académique : les responsables publient des PDF dont la licence est vérifiée ; les étudiants les lisent dans un lecteur intégré et, **à la demande**, affichent une traduction page par page ou un résumé de chapitre.

Règle produit non négociable : **Recherche → Ouverture → Choix de la langue (dans le lecteur) → Traduction à la demande → Lecture.** La langue cible n'est jamais demandée avant l'ouverture. Le PDF original n'est jamais modifié ni réécrit.

## Contexte technique

- Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind CSS 4.
- PostgreSQL via Drizzle ORM. Dev/test : PGlite (`pglite://./.data/pglite`, `pglite://memory`). Prod : node-postgres (`postgres://`).
- Sessions opaques en cookie HttpOnly `ol_session` ; scrypt pour les mots de passe.
- pdf.js côté client (rendu) et côté serveur (extraction).
- Fournisseurs externes derrière des interfaces : `src/lib/providers/{translation,ai,ocr,storage}`.
- Tests : Vitest, base PGlite en mémoire, `next/headers` mocké, fournisseurs mock.

## Décisions d'architecture (ne pas défaire sans raison documentée)

1. **Toute règle métier et d'autorisation vit côté serveur** dans `src/lib/services` + `src/lib/authz/permissions.ts`. Le client ne décide jamais d'un droit ; il affiche ce que le serveur renvoie (ex. la liste des langues actives vient de `POST /api/documents/:id/open`).
2. **Pas de JWT, pas de secret dans le navigateur.** Session = jeton aléatoire, haché en base, cookie HttpOnly/SameSite=Lax/Secure(prod).
3. **Les fournisseurs sont optionnels.** L'application doit démarrer sans clé. Une fonctionnalité non configurée renvoie `Errors.notConfigured()` (503) et l'UI affiche un message clair. **Ne jamais simuler** une traduction, un résumé ou un OCR.
4. **Cache de traduction par segment** : clé `(hash, source, target, provider, engineVersion)`, partagé entre utilisateurs. La limite d'usage ne s'applique que si un appel fournisseur est nécessaire.
5. **Cycle de vie des documents** : `draft → published` uniquement si `distributionStatus = approved` ET licence ∈ `DISTRIBUTABLE_LICENSES`. Changer la licence rouvre la vérification. Les fichiers sont privés et servis uniquement par `/api/documents/:id/file`.
6. **Drizzle + migrations SQL versionnées** dans `drizzle/`. PGlite auto-migre ; PostgreSQL exige `npm run db:migrate`.
7. **Dual DB sans divergence** : même schéma, mêmes migrations pour PGlite et PostgreSQL. Ne pas écrire de SQL spécifique à l'un des deux.

## Structure du dépôt

```
src/app/(site)/*      pages publiques, étudiant, admin (layout commun, header/footer)
src/app/read/[id]     lecteur plein écran
src/app/api/**        route handlers → wrappers route()/protectedRoute()
src/components/       ui/ (primitives), layout/, reader/, admin/, auth/, requests/, settings/
src/lib/auth          password.ts, session.ts, guards.ts (requireUser / requirePermission)
src/lib/authz         permissions.ts (source unique des rôles)
src/lib/db            schema.ts, client.ts (getDb, getDbHandle, setDbHandleForTests)
src/lib/http          api.ts (json, errorResponse, assertSameOrigin, route, protectedRoute, parseJson, parseQuery), errors.ts, serializers.ts
src/lib/i18n          dictionaries.ts (FR/EN), server.ts (getT, getUiLocale)
src/lib/pdf           extract.ts (inspectPdf, extractPagesText, segmentText), test-pdf.ts
src/lib/providers     translation/{deepl,libretranslate,openai,mock}, ai/, ocr/, storage/
src/lib/services      auth, documents, translation, summary, activity, admin, audit, languages
src/lib/validation    schémas Zod (auth, documents, activity)
scripts/              migrate.ts, create-admin.ts, seed.ts, copy-pdf-worker.mjs
tests/                setup.ts, helpers.ts, *.test.ts
drizzle/              migrations + meta
```

## Conventions

- Fichiers de route : n'exporter **que** des handlers HTTP (`GET`, `POST`…) ; les schémas/sérialiseurs vont dans `src/lib`.
- Toujours passer par `route()` / `protectedRoute(permission, handler)` ; lever `AppError` via `Errors.*` ; ne jamais renvoyer un message d'exception brut.
- Valider toute entrée avec Zod (`parseJson`, `parseQuery`, `*.safeParse`).
- Pages serveur protégées : `await requireUser(nextPath)` ou `await requirePermission(perm, nextPath)` en première ligne.
- `params` et `searchParams` sont des `Promise` (Next 16) : `const { id } = await params`.
- Textes UI dans `src/lib/i18n/dictionaries.ts` (FR et EN à la fois). Le lecteur reçoit `t` en prop.
- RTL : appliquer `dir="rtl"` sur le conteneur du texte traduit, jamais sur `<html>`.
- Encodage des fichiers : UTF-8 **sans BOM**. Éviter les réécritures de fichiers via PowerShell `Set-Content` (risque de mojibake) ; utiliser les outils d'édition.
- Ne pas committer `.env.local`, `.data/`, `storage/`, `public/pdf.worker.min.mjs` (déjà dans `.gitignore`).

## Règles de sécurité non négociables

- Aucun secret, clé, mot de passe ou jeton dans le code, les tests, le README ou ce fichier. `.env.example` ne contient que des valeurs factices.
- Aucun compte admin par défaut. Provisionnement uniquement via `npm run admin:create` (saisie masquée ou `ADMIN_PASSWORD` dans l'environnement du processus).
- L'inscription publique crée toujours un `student`. Tout champ `role` reçu est ignoré. Un changement de rôle exige `users:manage` et révoque les sessions.
- Chaque route et page protégée vérifie la permission côté serveur. Ajouter une permission = l'ajouter dans `permissions.ts` **et** la tester.
- Toute mutation passe par `assertSameOrigin` (CSRF). Les clients `fetch` internes envoient automatiquement `Origin`.
- Les erreurs renvoyées au client ne contiennent jamais de stack, de SQL ni de chemin.
- Les PDF sont validés (MIME, signature, taille, ouverture pdf.js) et stockés hors de `public/` ; toute lecture passe par `canAccessFile` / `canDownload`.
- Les réponses publiques passent par `toPublicDocument` / `publicUser` (jamais `storageKey`, `checksum`, `passwordHash`).

## Flux de traduction (référence)

`POST /api/translations {documentId, pageNumber, targetLanguage}` → `translatePage()` :
1. permission `translations:use` ; document ouvrable par l'utilisateur ;
2. langue cible active, ≠ langue source (sinon réponse « original ») ;
3. texte de la page via `getPageTexts` (cache `document_page_texts`) ; si vide → OCR si configuré, sinon `Errors.noText()` ;
4. segmentation + hash ; lecture du cache ;
5. s'il reste des segments : `checkRateLimit`, budget `TRANSLATION_MAX_CHARS` (drapeau `truncated`), appel fournisseur sous single-flight ;
6. écriture cache + `usage_events` ; réponse `{ segments: [{ original, translated, fromCache }], direction, truncated, … }`.

## Commandes utiles

```bash
npm install            # + copie du worker pdf.js
npm run dev            # http://localhost:3000
npm run typecheck
npm test               # 59 tests, PGlite en mémoire, aucun service externe requis
npm run build
npm run db:generate    # nouvelle migration après modification du schéma
npm run db:migrate     # PostgreSQL uniquement
npm run admin:create -- --email <email> --name "<nom>" [--role admin|contributor]
npm run db:seed        # 3 PDF d'exemple publiés (nécessite un admin)
```

## Tests obligatoires avant de livrer

1. `npm run typecheck` → 0 erreur.
2. `npm test` → toutes les suites vertes. Toute nouvelle route, permission ou règle métier doit avoir un test (voir `tests/helpers.ts` : `call`, `actAs`, `registerStudent`, `provisionStaff`, `createPublishedDocument`).
3. `npm run build` → succès.
4. Si le lecteur ou l'UI change : vérification manuelle dans le navigateur du parcours ouvrir → 🌐 → traduire → changer de langue → original → résumé, en desktop et en largeur mobile.

## Erreurs connues et pièges

- **`DATABASE_URL` hérité du shell** : une session PowerShell où les tests ont tourné peut conserver `DATABASE_URL=pglite://memory` ; les scripts écrivent alors en mémoire et « perdent » les données. Vérifier l'environnement du shell avant `admin:create` / `db:seed`.
- **Base PGlite corrompue** après un arrêt brutal du serveur de dev (`PANIC: could not locate a valid checkpoint record`, remonté comme « Impossible d'ouvrir la base PGlite locale ») : renommer `.data/pglite` puis `npm run admin:create` + `npm run db:seed`. Cause fréquente : lancer `npm run build` pendant que `npm run dev` tourne (ils partagent `.next/`, le serveur dev est tué). Arrêter le dev avant de builder.
- **Édits perdus** : ne jamais réécrire un fichier source avec PowerShell (`Set-Content`) pendant une session d'édition ; des modifications voisines faites avec l'outil d'édition ont été écrasées de cette façon. Après toute opération shell sur un fichier source, revérifier son contenu (`rg`).
- **Mojibake** (`Â·`, `â€¦`) après une réécriture de fichier par PowerShell : restaurer le caractère et retirer le BOM.
- **pdf.js worker** : chargé depuis `/pdf.worker.min.mjs` (copié par `scripts/copy-pdf-worker.mjs` en `postinstall`/`predev`/`prebuild`). Ne pas revenir à `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` : Turbopack le traite comme externe serveur.
- **pdfjs-dist 6** : `getDocument()` renvoie une tâche ; détruire avec `task.destroy()` (pas `doc.destroy()`).
- **Hydration warning dans le navigateur Cursor** : causé par les attributs `data-cursor-ref` injectés par l'outil, pas par le code.
- **`tsx -e` avec top-level await** échoue (sortie CJS) ; utiliser un fichier `.mts` dans le dépôt (puis le supprimer) ou un script dans `scripts/`.
- Les `usage_events` et le limiteur sont en mémoire/par instance : les tests qui comptent les appels fournisseur utilisent `resetRateLimits()` et un `MockTranslationProvider` dédié.

## Limites actuelles

- Limiteur et single-flight en mémoire (mono-instance).
- Extraction heuristique (colonnes/tableaux imparfaits) ; pas d'OCR local.
- Adaptateurs DeepL / LibreTranslate / OpenAI / Anthropic / OCR.space écrits d'après la documentation publique, **non exécutés avec de vraies clés**.
- Pas d'e-mail, pas de tests e2e navigateur automatisés, stockage local uniquement.

## État d'avancement (à jour)

- Backend complet et testé (59/59). Typecheck et build verts.
- UI publique, étudiant, lecteur et administration implémentées ; parcours étudiant et lecteur vérifiés manuellement ; pages admin vérifiées par leurs API et le build, pas encore parcourues manuellement avec un compte admin.

## Prochaines tâches prioritaires

1. Parcourir manuellement toute l'administration avec un compte admin (dépôt PDF réel, approbation, publication, modération, cache, audit) et corriger les détails d'UI.
2. Brancher une vraie clé de traduction en préproduction et valider l'adaptateur choisi.
3. Ajouter des tests e2e Playwright (lecture/traduction, admin) et une CI (typecheck, tests, build).
4. Stockage objet + limiteur partagé pour le déploiement multi-instances.
5. Recherche plein-texte PostgreSQL.
