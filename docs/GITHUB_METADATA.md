# Métadonnées GitHub (à appliquer une fois le repo créé)

Le dépôt `youneselfakir0/itsm-platform` est **créé et poussé**. Description +
topics + homepage sont appliqués via `gh api` (voir plus bas). Le badge CI est
volontairement **retiré** du README/DEMO : l'exécution GitHub Actions est
bloquée par une restriction du compte (jobs en échec en ~4s sans log, même un
simple `echo`), alors qu'en local `npm ci` + build + 23 tests passent.

## Restriction GitHub Actions (à lever)

Symptôme : tous les runs échouent en ~4s avec `steps: []` et `output: null`
(aucun log). Même un workflow minimal `run: echo` échoue → le runner ne
démarre jamais. `gh api .../actions/permissions` confirme `enabled: true,
allowed_actions: all` sur le dépôt — donc ce n'est pas une config repo, mais
une **restriction au niveau du compte GitHub** (souvent anti-abus sur compte
récent / après création de nombreux repos / push de scripts systèmes).

Actions pour débloquer (côté GitHub, pas code) :
1. `Settings` du compte (ou du repo) → `Actions` → vérifier qu'aucun blocage
   manuel n'est actif.
2. Si le compte est en restriction anti-abus, contacter le support GitHub
   (https://support.github.com) — répondre au mail de limitation reçu.
3. Une fois débloqué, le workflow `.github/workflows/ci.yml` passera
   automatiquement (validation locale OK).

Le workflow lui-même est correct et prêt : `npm ci` → build → `npm test`
(Node 20, workspace `@twisteritsm/api`).

## Commandes appliquées (déjà exécutées)


```bash
gh repo edit twisterlab/itsm-platform \
  --description "TwisterITSM — ITSM on-premise (alternative ServiceNow/BMC/Jira SM). Modular monolith NestJS + Prisma + React/Vite, IA locale (Ollama), automation Active Directory, bilinguisme FR/EN, accessible." \
  --homepage "https://itsm.twisterlab.local" \
  --topics itsm,servicenow-alternative,nestjs,prisma,react,vite,on-premise,active-directory,ollama,aiops,mfa,ldap,cmdb,itil,accessibility,i18n,typescript

# Badge CI (à coller en tête de README.md) :
# [![CI](https://github.com/twisterlab/itsm-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/twisterlab/itsm-platform/actions/workflows/ci.yml)
```

## Suggested topics (SEO recruteur / portfolio)
`itsm`, `servicenow-alternative`, `nestjs`, `prisma`, `react`, `vite`,
`on-premise`, `active-directory`, `ollama`, `aiops`, `mfa`, `ldap`, `cmdb`,
`itil`, `accessibility`, `i18n`, `typescript`, `enterprise`, `enterprise-it`,
`incident-management`, `it-service-management`

## Description courte (pour la carte repo)
> TwisterITSM — plateforme ITSM on-premise (alternative à ServiceNow/BMC/Jira
> SM). Monolithe modulaire NestJS + Prisma + React, IA locale (Ollama),
> automation Active Directory, bilinguisme FR/EN, conforme WCAG de base.
