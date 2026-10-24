# OpenLibrary

Plateforme académique de lecture de documents PDF avec **traduction à la demande dans le lecteur**.

> Parcours produit : **Recherche → Ouverture du document → Choix de la langue → Traduction à la demande → Lecture.**
> La langue cible se choisit *après* l'ouverture, depuis le bouton « 🌐 Lire dans une autre langue » du lecteur. Le PDF original n'est jamais modifié.

---

## Sommaire

1. [Présentation](#1-présentation)
2. [Vision pédagogique](#2-vision-pédagogique)
3. [Acteurs et rôles](#3-acteurs-et-rôles)
4. [Parcours utilisateurs](#4-parcours-utilisateurs)
5. [Fonctionnalités](#5-fonctionnalités)
6. [Architecture](#6-architecture)
7. [Stack technique et justification](#7-stack-technique-et-justification)
8. [Arborescence du projet](#8-arborescence-du-projet)
9. [Schéma de données](#9-schéma-de-données)
10. [API](#10-api)
11. [Le lecteur PDF](#11-le-lecteur-pdf)
12. [Stratégie d'extraction et de traduction](#12-stratégie-dextraction-et-de-traduction)
13. [Cache de traduction](#13-cache-de-traduction)
14. [Résumés par IA](#14-résumés-par-ia)
15. [Sécurité](#15-sécurité)
16. [Licences et droits de diffusion](#16-licences-et-droits-de-diffusion)
17. [Variables d'environnement](#17-variables-denvironnement)
18. [Installation](#18-installation)
19. [Préparation de la base de données](#19-préparation-de-la-base-de-données)
20. [Lancer l'application](#20-lancer-lapplication)
21. [Lancer les tests](#21-lancer-les-tests)
22. [Création sécurisée du premier administrateur](#22-création-sécurisée-du-premier-administrateur)
23. [Données d'exemple](#23-données-dexemple)
24. [Déploiement](#24-déploiement)
25. [Configuration des fournisseurs externes](#25-configuration-des-fournisseurs-externes)
26. [Limites connues](#26-limites-connues)
27. [État réel d'avancement](#27-état-réel-davancement)
28. [Ce qui a été vérifié et comment](#28-ce-qui-a-été-vérifié-et-comment)
29. [Fonctionnalités restantes](#29-fonctionnalités-restantes)
30. [Feuille de route](#30-feuille-de-route)

---

## 1. Présentation

OpenLibrary est une bibliothèque numérique académique. Les responsables y déposent des documents PDF (cours, articles, ouvrages) dont les droits de diffusion ont été vérifiés. Les étudiants recherchent, ouvrent et lisent ces documents dans un lecteur intégré, puis, **s'ils le souhaitent**, affichent une traduction page par page dans la langue de leur choix, demandent un résumé de chapitre, gardent un historique et des favoris, et peuvent demander l'ajout de nouveaux documents.

## 2. Vision pédagogique

- **L'original d'abord.** Le document s'ouvre toujours dans sa langue d'origine. La traduction est une *couche de compréhension*, affichée en regard, jamais une substitution du fichier.
- **À la demande, et seulement ce qui est lu.** Seule la page affichée est traduite, au moment où l'étudiant le demande. Le résultat est mis en cache et partagé entre tous les étudiants : la deuxième lecture ne coûte rien.
- **Honnêteté du système.** Si un PDF est numérisé sans couche texte, si le fournisseur n'est pas configuré ou s'il échoue, l'interface le dit explicitement. Aucune traduction ou résumé n'est jamais simulé.
- **Respect des licences.** Un document n'est publié qu'après vérification de sa licence et approbation de sa diffusion par un administrateur.

## 3. Acteurs et rôles

| Acteur | Session | Ce qu'il peut faire |
|---|---|---|
| **Visiteur** | aucune | Voir l'accueil et le catalogue (métadonnées uniquement). Ne peut ni ouvrir, ni télécharger, ni traduire. |
| **Étudiant** (`student`) | oui | Tout ce qui précède + ouvrir et lire les PDF, traduire, résumer, favoris, historique, demandes de documents, signaler une traduction, gérer son profil et supprimer son compte. |
| **Contributeur** (`contributor`) | oui | Tout ce qu'un étudiant peut faire + accéder à l'administration, ajouter des documents (brouillons), modifier ses propres documents, traiter les demandes et les signalements, consulter l'état des services. |
| **Administrateur** (`admin`) | oui | Toutes les permissions : approuver/refuser la diffusion, publier/archiver/retirer n'importe quel document, gérer langues, utilisateurs, cache, journal d'audit. |

Les permissions sont centralisées dans `src/lib/authz/permissions.ts` et appliquées **côté serveur** sur chaque route protégée (`protectedRoute(permission, …)`) et chaque page (`requirePermission`). L'inscription publique crée toujours un `student` ; le champ `role` est ignoré s'il est envoyé. Un compte `admin`/`contributor` ne se crée que par la CLI (§22).

## 4. Parcours utilisateurs

**Étudiant**
1. Recherche dans le catalogue (texte, domaine, niveau, langue d'origine, auteur, tri).
2. Ouvre la fiche puis « Ouvrir » → `/read/:id`. Le serveur vérifie la session, enregistre l'ouverture dans l'historique, renvoie l'URL du flux PDF privé et la liste des langues actives.
3. Le PDF s'affiche dans sa langue d'origine (pdf.js).
4. Depuis la barre d'outils, « 🌐 Lire dans une autre langue » → liste des langues actives (la langue source est grisée, la langue préférée est marquée ★).
5. La page courante est extraite côté serveur, segmentée, traduite (ou servie depuis le cache) et affichée dans un panneau latéral (ou en onglet sur mobile). Les segments arabes sont rendus en RTL sans retourner l'interface.
6. À tout moment : changer de langue, revenir à l'original, comparer original/traduction, signaler un segment, demander « Résumer ce chapitre » (plage de pages, langue du résumé).
7. Position de lecture et langue sont mémorisées dans l'historique ; la reprise rouvre à la bonne page.

**Administrateur / contributeur**
1. `/admin/documents/new` : dépôt d'un PDF + métadonnées + licence. Le fichier est validé (type, taille, contenu PDF, doublon par empreinte), inspecté (pages, couche texte) et stocké en privé. Statut : `draft`, diffusion : `pending_review`.
2. `/admin/documents/:id` : l'administrateur approuve ou refuse la diffusion, puis publie. La publication exige une diffusion approuvée **et** une licence distribuable. Toute modification de licence rouvre la vérification.
3. Traitement des demandes de documents et des signalements, gestion des langues, des utilisateurs, invalidation du cache, consultation de l'audit et de l'état des services externes.

## 5. Fonctionnalités

Implémentées et testées (voir §27 pour l'état détaillé) :

- Catalogue public avec recherche plein-texte simple (ILIKE titre/auteur/description/sous-titre + mots-clés), facettes réelles, pagination, états vide/erreur.
- Inscription / connexion / déconnexion par cookie de session HttpOnly ; profil, préférences (langue d'interface FR/EN, langue de lecture préférée, langue des résumés, disposition du lecteur), changement de mot de passe, suppression de compte (anonymisation).
- Lecteur PDF intégré : navigation, zoom, ajustement largeur, plein écran, recherche dans le texte, raccourcis clavier, mode mobile avec onglets PDF / panneau.
- Traduction par page et par segment, cache serveur partagé, single-flight, limites d'usage, bascule de langue sans rechargement, retour à l'original, RTL, comparaison, signalement.
- Résumé d'une plage de pages (≤ 30) via fournisseur IA configurable, mis en cache, avec consigne explicite de ne rien inventer.
- Historique, favoris, demandes de documents (plafond de 10 demandes en attente).
- Administration : tableau de bord à partir des données réelles, documents (CRUD métadonnées, cycle de vie), demandes, signalements, langues, utilisateurs (suspension, rôle), cache (listing, invalidation ciblée ou globale), journal d'audit, état des services externes (sans secret).
- Deux langues d'interface (FR/EN), indépendantes de la langue de lecture.

## 6. Architecture

```
Navigateur ──(HTTPS, cookie HttpOnly)──► Next.js App Router
   │  pages serveur (RSC) + composants client (lecteur, formulaires)
   │
   ├─ /api/**  route handlers ──► src/lib/http (validation, erreurs, CSRF, rôles)
   │                                   │
   │                                   ▼
   │                           src/lib/services/*  (logique métier)
   │                              │        │        │
   │                       Drizzle ORM   providers  pdf/extract
   │                              │     (traduction, IA, OCR, stockage)
   │                              ▼
   │                PostgreSQL  (PGlite embarqué en dev/test, node-postgres en prod)
   └─ /api/documents/:id/file  ──► flux PDF privé (Range) après contrôle d'accès
```

Principes :
- Toute logique métier vit dans `src/lib/services`, appelée par les routes API **et** par les pages serveur ; aucune règle d'autorisation n'est dupliquée dans le client.
- Les fournisseurs externes sont des adaptateurs derrière une interface (`providers/*`). L'application démarre sans aucune clé ; la fonctionnalité concernée renvoie alors une erreur `not_configured` (HTTP 503) affichée clairement.
- Le fichier PDF est servi uniquement par `/api/documents/:id/file` après vérification de session et de statut ; le dossier de stockage n'est jamais exposé.

## 7. Stack technique et justification

| Choix | Pourquoi |
|---|---|
| **Next.js 16 (App Router) + React 19 + TypeScript strict** | Une seule base de code pour le rendu serveur, les API et le client ; typage de bout en bout. |
| **Tailwind CSS 4** | Design cohérent et responsive sans feuille de style ad hoc. |
| **PostgreSQL via Drizzle ORM** | Requêtes paramétrées, migrations SQL versionnées, schéma typé. |
| **PGlite** (PostgreSQL compilé en WASM) en dev/test | Zéro installation locale, même moteur SQL et mêmes migrations qu'en production ; tests isolés en mémoire. |
| **Sessions opaques en cookie HttpOnly** (pas de JWT) | Révocation immédiate côté serveur, rien de sensible dans le navigateur. |
| **scrypt** (Node natif) | Hachage de mots de passe robuste sans dépendance supplémentaire. |
| **pdf.js** (pdfjs-dist) | Rendu fidèle côté client ; extraction du texte côté serveur avec la même bibliothèque. |
| **Zod** | Validation serveur de toutes les entrées. |
| **Vitest** | Tests d'intégration rapides sur les handlers réels avec base PGlite en mémoire. |

## 8. Arborescence du projet

```
.
├── drizzle/                     migrations SQL (0000_init, 0001_seed_languages) + méta
├── scripts/
│   ├── migrate.ts               applique les migrations (PostgreSQL)
│   ├── create-admin.ts          provisionnement sécurisé admin/contributeur
│   ├── seed.ts                  documents d'exemple (dev)
│   └── copy-pdf-worker.mjs      copie le worker pdf.js dans public/
├── src/
│   ├── app/
│   │   ├── (site)/              pages publiques, étudiant, admin (layout commun)
│   │   ├── read/[id]/           lecteur (plein écran, sans layout du site)
│   │   └── api/                 route handlers
│   ├── components/              UI (ui/, layout/, reader/, admin/, auth/, …)
│   └── lib/
│       ├── auth/                mots de passe, sessions, gardes de pages
│       ├── authz/               permissions centralisées
│       ├── db/                  schéma Drizzle, client dual PGlite/pg
│       ├── http/                wrappers de routes, erreurs, CSRF, sérialiseurs
│       ├── i18n/                dictionnaires FR/EN, locale d'interface
│       ├── pdf/                 extraction et segmentation, générateur de PDF de test
│       ├── providers/           translation/, ai/, ocr/, storage/
│       ├── services/            logique métier
│       ├── validation/          schémas Zod
│       ├── env.ts               configuration validée
│       └── rate-limit.ts        limiteur à fenêtre glissante
├── tests/                       Vitest (setup, helpers, 5 suites)
├── .env.example
├── CLAUDE.md
└── README.md
```

## 9. Schéma de données

Tables (`src/lib/db/schema.ts`) :

| Table | Rôle |
|---|---|
| `users` | compte, rôle (`student`/`contributor`/`admin`), statut, préférences JSON, acceptation des CGU |
| `sessions` | id = SHA-256 du jeton opaque, expiration glissante (14 j), IP / user-agent |
| `languages` | langues de lecture (`code`, nom, nom natif, `direction` ltr/rtl, `isActive`, ordre) |
| `documents` | métadonnées, licence, `status` (draft/published/archived/removed), `distributionStatus` (pending_review/approved/refused), clé de stockage privée, empreinte SHA-256, nb pages, `hasTextLayer`, compteurs |
| `document_page_texts` | cache d'extraction par page (texte, version de l'extracteur) |
| `document_requests` | demandes d'ajout (statut, réponse du personnel) |
| `reading_history` | dernière page, langue de lecture, nb d'ouvertures |
| `favorites` | favoris (unique utilisateur × document) |
| `translation_cache` | segment traduit, clé (hash source, langue source, langue cible, fournisseur, version moteur), compteur de hits, expiration, invalidation |
| `translation_reports` | signalements de traduction (segment, raison, statut) |
| `summaries` | résumés par (document, plage, langue, hash du texte source) |
| `usage_events` | événements traduction/résumé (cache_hit, provider_success, provider_error, rate_limited, no_text, not_configured) pour les statistiques |
| `audit_logs` | journal des opérations sensibles |

## 10. API

Toutes les routes valident leurs entrées (Zod), renvoient des erreurs normalisées `{ error: { code, message } }` et ne divulguent jamais de détails internes. Les mutations exigent un en-tête `Origin` identique à `APP_URL` (protection CSRF).

**Public**
- `GET /api/documents` (recherche, filtres, pagination) · `GET /api/documents/facets` · `GET /api/documents/:id` · `GET /api/languages`
- `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout`

**Étudiant (session requise)**
- `GET|PATCH|DELETE /api/me` · `POST /api/me/password`
- `POST /api/documents/:id/open` → document, `fileUrl`, `canDownload`, langues actives, position de reprise
- `GET /api/documents/:id/file` (flux PDF avec `Range` ; `?download=1` si autorisé)
- `POST /api/translations` `{ documentId, pageNumber, targetLanguage }`
- `POST /api/summaries` `{ documentId, startPage, endPage, language }`
- `GET /api/me/history` · `PATCH|DELETE /api/me/history/:documentId`
- `GET|POST /api/me/favorites` · `DELETE /api/me/favorites/:documentId`
- `GET|POST /api/document-requests` · `POST /api/translation-reports`

**Administration (permission requise)**
- `GET /api/admin/dashboard` · `GET /api/admin/settings` · `GET /api/admin/audit`
- `GET|POST /api/admin/documents` · `GET|PATCH /api/admin/documents/:id` · `POST …/:id/status` · `POST …/:id/distribution`
- `GET /api/admin/requests` · `PATCH /api/admin/requests/:id`
- `GET /api/admin/reports` · `PATCH /api/admin/reports/:id`
- `GET|POST /api/admin/languages` · `PATCH /api/admin/languages/:code`
- `GET /api/admin/users` · `PATCH /api/admin/users/:id`
- `GET /api/admin/translation-cache` · `POST /api/admin/translation-cache/invalidate`

## 11. Le lecteur PDF

`src/components/reader/PdfReader.tsx` (client) :

1. `POST /api/documents/:id/open` → si 401, invitation à se connecter ; si 403/404, message explicite.
2. Chargement pdf.js (worker servi depuis `/pdf.worker.min.mjs`, copié automatiquement dans `public/`), barre de progression, rendu canvas tenant compte du `devicePixelRatio`.
3. Barre d'outils : page précédente/suivante, saisie de page, zoom, ajustement largeur, recherche, **🌐 langue**, résumé, plein écran.
4. Sélection d'une langue → panneau de traduction (états : chargement, succès avec origine cache/nouveau, texte non extractible, OCR nécessaire, fournisseur non configuré, erreur fournisseur, limite atteinte, tronqué). Cache client par (page, langue) + `AbortController` pour les changements rapides de page.
5. La position et la langue sont envoyées en `PATCH /api/me/history/:id` (debounce).
6. Mobile : onglets « PDF » / « Page traduite » ; desktop : panneau latéral ou sous le document selon la préférence.

## 12. Stratégie d'extraction et de traduction

- **Extraction** (`src/lib/pdf/extract.ts`) : pdf.js côté serveur, reconstruction des lignes et paragraphes à partir des positions des items, recollage des césures, cache en base (`document_page_texts`) versionné par `EXTRACTOR_VERSION`.
- **Segmentation** : par paragraphe ; les paragraphes trop longs sont découpés par phrase. Les segments sans texte lisible (< 20 lettres) ne sont pas envoyés au fournisseur.
- **Traduction** (`src/lib/services/translation.ts`) :
  1. autorisation + document ouvrable + langue cible active et ≠ langue source ;
  2. extraction (ou cache) ; si aucune couche texte → `no_text` (ou tentative OCR si configuré) ;
  3. recherche cache par hash de segment ;
  4. seulement s'il reste des segments : vérification de la limite d'usage, budget de caractères (`TRANSLATION_MAX_CHARS`, drapeau `truncated`), appel du fournisseur ;
  5. écriture du cache, journalisation `usage_events`, réponse.
- Les requêtes identiques simultanées sont fusionnées (single-flight en mémoire).

## 13. Cache de traduction

Clé : `(hash SHA-256 du segment normalisé, langue source, langue cible, fournisseur, version moteur)`. Partagé entre tous les utilisateurs. Compteur de hits, expiration optionnelle, invalidation par document et/ou langue (`/admin/cache`). Le changement de fournisseur crée naturellement de nouvelles entrées sans effacer les anciennes.

## 14. Résumés par IA

`src/lib/services/summary.ts` : plage ≤ 30 pages, texte source concaténé, tronqué à `SUMMARY_MAX_INPUT_CHARS` (indiqué à l'utilisateur), prompt imposant de ne résumer que le contenu fourni et de lister les limites, cache par hash du texte source. Fournisseurs : API compatible OpenAI, Anthropic Messages, mock (tests).

## 15. Sécurité

- Validation Zod de toutes les entrées ; requêtes paramétrées (Drizzle).
- Cookie de session `ol_session` : HttpOnly, SameSite=Lax, Secure en production ; jeton opaque aléatoire, stocké haché ; renouvellement glissant ; révocation à la déconnexion, au changement de mot de passe, à la suspension, au changement de rôle.
- Aucun jeton ni secret dans `localStorage`/`sessionStorage`.
- Mots de passe : scrypt (N = 2¹⁷), politique ≥ 10 caractères avec lettre et chiffre, comparaison à temps constant, message d'erreur générique.
- Limitation des tentatives de connexion (par IP et par e-mail), des traductions et des résumés (fenêtre glissante).
- CSRF : vérification de l'en-tête `Origin` sur toutes les mutations.
- Rôles vérifiés côté serveur sur chaque route et page protégée ; impossibilité de s'auto-attribuer un rôle.
- PDF : type MIME, signature `%PDF`, taille maximale, ouverture effective par pdf.js, détection de doublon ; stockage privé hors `public/`, protection contre la traversée de chemin, flux servi après contrôle d'accès.
- En-têtes de sécurité (`next.config.ts`) ; erreurs 500 sans détail ; secrets uniquement en variables d'environnement ; la page « services externes » n'affiche que présence/absence des clés.
- Journal d'audit des opérations sensibles.
- Aucun mot de passe par défaut : l'administrateur est créé via la CLI avec saisie masquée ou variable d'environnement (§22).

## 16. Licences et droits de diffusion

Licences proposées : `src/lib/validation/documents.ts` (`LICENSES`). Seules celles de `DISTRIBUTABLE_LICENSES` (domaine public, Creative Commons, autorisation explicite de l'ayant droit…) permettent la publication. Chaque document affiche sa licence et ses notes ; le téléchargement est activable par document (`allowDownload`). L'approbation de diffusion est tracée (qui, quand, note).

## 17. Variables d'environnement

Voir `.env.example` (sans secret). Résumé :

| Variable | Rôle | Défaut |
|---|---|---|
| `APP_URL` | URL publique (CSRF, cookies) | `http://localhost:3000` |
| `DATABASE_URL` | `pglite://./.data/pglite`, `pglite://memory` ou `postgres://…` | PGlite fichier |
| `AUTH_SECRET` | secret serveur (≥ 32 car. en prod, obligatoire) | valeur de dev refusée en prod |
| `STORAGE_PROVIDER`, `STORAGE_LOCAL_DIR`, `MAX_UPLOAD_BYTES` | stockage privé | `local`, `./storage/documents`, 50 Mo |
| `TRANSLATION_PROVIDER` | `none` · `deepl` · `libretranslate` · `openai` · `gemini` · `mock` (tests) | `none` |
| `TRANSLATION_API_KEY`, `TRANSLATION_API_URL`, `TRANSLATION_MAX_CHARS`, `TRANSLATION_TIMEOUT_MS` | paramètres du fournisseur | |
| `AI_PROVIDER` | `none` · `openai` · `anthropic` · `gemini` · `mock` | `none` |
| `AI_API_KEY`, `AI_API_URL`, `AI_MODEL`, `SUMMARY_MAX_INPUT_CHARS`, `AI_TIMEOUT_MS` | paramètres IA | |
| `OCR_PROVIDER`, `OCR_API_KEY` | `none` · `ocrspace` | `none` |
| `RATE_LIMIT_TRANSLATIONS_PER_HOUR`, `RATE_LIMIT_SUMMARIES_PER_HOUR`, `RATE_LIMIT_LOGIN_PER_15MIN` | limites | 120 / 20 / 10 |

En production (`NODE_ENV=production`), le démarrage échoue si `AUTH_SECRET` est absent ou faible, ou si un fournisseur `mock` est sélectionné.

## 18. Installation

Prérequis : Node.js ≥ 20 (vérifié avec Node 24), npm.

```bash
npm install                      # copie aussi le worker pdf.js dans public/
cp .env.example .env.local       # Windows : copy .env.example .env.local
# Générer un secret et le coller dans AUTH_SECRET :
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 19. Préparation de la base de données

- **Développement (PGlite, défaut)** : rien à installer. La base est créée dans `.data/pglite` et migrée automatiquement au premier démarrage.
  ⚠️ PGlite n'est pas conçu pour résister à un arrêt brutal du processus (`kill`, crash) : la base peut alors refuser de s'ouvrir (« could not locate a valid checkpoint record », remonté par l'application avec un message explicite). Dans ce cas, renommer ou supprimer `.data/pglite`, puis relancer `npm run admin:create` et `npm run db:seed`. Ne pas lancer `npm run build` pendant que `npm run dev` tourne : les deux partagent `.next/` et le serveur de développement s'arrête brutalement.
- **PostgreSQL** : définir `DATABASE_URL=postgres://user:pass@host:5432/openlibrary` puis `npm run db:migrate`.
- Modifier le schéma : éditer `src/lib/db/schema.ts`, puis `npm run db:generate` (nouvelle migration dans `drizzle/`).

## 20. Lancer l'application

```bash
npm run dev          # http://localhost:3000
npm run build && npm start   # production
```

## 21. Lancer les tests

```bash
npm test             # vitest run
npm run typecheck    # tsc --noEmit
```

Les tests utilisent une base PGlite **en mémoire**, un dossier de stockage temporaire et des fournisseurs mock : ils n'exigent aucune clé ni service externe.

## 22. Création sécurisée du premier administrateur

Aucun compte administrateur n'existe par défaut et aucun mot de passe n'est codé en dur.

```bash
npm run admin:create -- --email admin@exemple.org --name "Prénom Nom"
# → saisie masquée du mot de passe (≥ 10 caractères, lettres + chiffres), avec confirmation
```

En CI ou dans un conteneur : fournir `ADMIN_PASSWORD` dans l'environnement du processus (jamais dans un fichier versionné). `--role contributor` crée un contributeur. Relancer la commande sur un e-mail existant **réinitialise** son mot de passe et son rôle. L'opération est journalisée (`user.provisioned`, via `cli`).

## 23. Données d'exemple

```bash
npm run db:seed
```

Génère localement trois PDF texte sous licences libres (contenu d'exemple rédigé pour le projet, pas des ouvrages tiers) et les publie via le flux normal au nom du premier administrateur trouvé. Idempotent (doublons ignorés par empreinte).

## 24. Déploiement

1. PostgreSQL managé ; `DATABASE_URL` en `postgres://`.
2. `AUTH_SECRET` fort, `APP_URL` = URL HTTPS publique, `NODE_ENV=production`.
3. Volume persistant pour `STORAGE_LOCAL_DIR` (ou implémenter un adaptateur objet, voir §29).
4. `npm ci && npm run build && npm run db:migrate && npm start`.
5. Créer l'administrateur (§22).
6. Derrière un reverse proxy, transmettre `X-Forwarded-For` (limiteur de connexion) et servir en HTTPS (cookie `Secure`).

Le limiteur d'usage est en mémoire : avec plusieurs instances, prévoir un stockage partagé (Redis) — voir §26.

## 25. Configuration des fournisseurs externes

| Fournisseur | Variables | Remarques |
|---|---|---|
| DeepL | `TRANSLATION_PROVIDER=deepl`, `TRANSLATION_API_KEY` | URL Free/Pro déduite du suffixe `:fx` de la clé ; `TRANSLATION_API_URL` pour forcer. |
| LibreTranslate | `TRANSLATION_PROVIDER=libretranslate`, `TRANSLATION_API_URL`, `TRANSLATION_API_KEY` si requis | Instance auto-hébergée possible. |
| LLM compatible OpenAI (traduction) | `TRANSLATION_PROVIDER=openai`, `TRANSLATION_API_KEY` (ou `AI_API_KEY`), `TRANSLATION_API_URL`/`AI_API_URL`, `AI_MODEL` | Réponse JSON structurée, segments renvoyés dans l'ordre. |
| Résumés OpenAI-compatible | `AI_PROVIDER=openai`, `AI_API_KEY`, `AI_API_URL` (optionnel), `AI_MODEL` | Fonctionne avec OpenAI, Mistral, Groq, Ollama… |
| Résumés Anthropic | `AI_PROVIDER=anthropic`, `AI_API_KEY`, `AI_MODEL` | API Messages. |
| Google Gemini (traduction et résumés) | `AI_PROVIDER=gemini` et/ou `TRANSLATION_PROVIDER=gemini`, `AI_API_KEY` (ou `TRANSLATION_API_KEY`), `AI_MODEL` (défaut `gemini-2.5-flash`) | API `generateContent`, clé dans l'en-tête `x-goog-api-key`. La traduction réutilise `AI_API_KEY`/`AI_MODEL` seulement si `AI_PROVIDER=gemini`. |
| OCR.space | `OCR_PROVIDER=ocrspace`, `OCR_API_KEY` | Utilisé seulement si un PDF n'a pas de couche texte. |

**Important :** ces adaptateurs ont été écrits d'après la documentation publique de chaque API et testés uniquement contre des mocks. Ils n'ont **pas** été exécutés avec de vraies clés dans ce dépôt. À la première utilisation réelle, vérifier les réponses dans `/admin/settings` et le journal du serveur.

## 26. Limites connues

- Limiteur d'usage et single-flight **en mémoire** : par instance, remis à zéro au redémarrage.
- PGlite (dev uniquement) n'est pas tolérant aux arrêts brutaux (voir §19) ; utiliser PostgreSQL dès qu'il y a des données à conserver.
- Extraction de texte heuristique : les PDF à colonnes multiples, tableaux ou formules peuvent produire des segments mal ordonnés.
- Pas d'OCR embarqué : les PDF numérisés nécessitent un fournisseur OCR externe, sinon message explicite.
- Recherche catalogue par `ILIKE` (pas d'index plein-texte ni de pertinence).
- Stockage local uniquement (`STORAGE_PROVIDER=local`).
- Pas d'envoi d'e-mail (pas de vérification d'adresse ni de réinitialisation de mot de passe).
- Pas de tests end-to-end navigateur automatisés (Playwright) ; la vérification navigateur a été manuelle (§28).
- Langues d'interface : FR et EN uniquement.
- La traduction est affichée en regard du PDF, pas superposée dans la page.

## 27. État réel d'avancement

| Domaine | État |
|---|---|
| Authentification, sessions, profil, suppression de compte | ✅ implémenté, testé |
| Rôles et permissions serveur | ✅ implémenté, testé |
| Catalogue, facettes, fiche document, accès fichier (Range, téléchargement) | ✅ implémenté, testé |
| Dépôt, validation PDF, cycle de vie, licences, doublons | ✅ implémenté, testé |
| Lecteur PDF (rendu, navigation, zoom, recherche, plein écran, mobile) | ✅ implémenté, vérifié manuellement dans le navigateur |
| Traduction à la demande, cache, single-flight, limites, RTL, signalement | ✅ implémenté, testé (mock) ; vérifié dans le navigateur avec le fournisseur mock |
| Résumés IA | ✅ implémenté, testé (mock) |
| Historique, favoris, demandes | ✅ implémenté, testé |
| Administration (dashboard, documents, demandes, signalements, langues, utilisateurs, cache, audit, services) | ✅ API testée ; pages rendues sans erreur au build ; parcours UI admin vérifié partiellement (voir §28) |
| Adaptateurs DeepL / LibreTranslate / OpenAI / Anthropic / OCR.space | ⚠️ écrits, **non testés avec de vraies clés** |
| Interface FR/EN | ✅ |
| Déploiement multi-instances (limites partagées), stockage objet, e-mails, tests e2e | ❌ non réalisé |

## 28. Ce qui a été vérifié et comment

- `npm run typecheck` : 0 erreur.
- `npm run build` : succès (Next.js 16, Turbopack).
- `npm test` : **59 tests, 59 réussis** (5 suites : `auth`, `library`, `translation`, `admin`, `unit`), base PGlite en mémoire, fournisseurs mock.
- Navigateur (dev, fournisseurs mock, PGlite fichier) : accueil avec données réelles, catalogue et facettes, inscription → tableau de bord, ouverture du lecteur, menu « Lire dans une autre langue » (langue source grisée), traduction de la page 1 en français (3 segments « nouvellement traduits »), lien profond `?page=2&lang=ar`, résumé pages 1–3, accès `/admin/*` refusé pour un étudiant (403).
- Non vérifié manuellement dans le navigateur : les pages d'administration avec un compte admin (leur API l'est par les tests), et l'affichage sur très petit écran (< 400 px).

## 29. Fonctionnalités restantes

- Adaptateur de stockage objet (S3-compatible) et limiteur partagé (Redis).
- Vérification d'e-mail et réinitialisation de mot de passe.
- Tests end-to-end navigateur (Playwright) sur le parcours lecture/traduction et l'administration.
- Recherche plein-texte PostgreSQL (`tsvector`) avec pertinence.
- Export/suppression RGPD complète des données utilisateur (actuellement : anonymisation du compte).
- Tableaux de bord : séries temporelles (actuellement : agrégats sur 30 jours).

## 30. Feuille de route

1. Valider les adaptateurs de traduction/IA avec de vraies clés en préproduction ; ajuster les formats de réponse si nécessaire.
2. Tests e2e Playwright + CI (typecheck, tests, build).
3. Stockage objet + limites partagées pour un déploiement horizontal.
4. Amélioration de l'extraction (colonnes, tableaux) et surlignage du segment traduit dans le PDF.
5. OCR local optionnel (p. ex. Tesseract) pour réduire la dépendance externe.
6. Notifications e-mail (demandes traitées, signalements).
