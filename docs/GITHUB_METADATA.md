# Métadonnées GitHub (à appliquer une fois le repo créé)

Le dépôt n'a pas encore de remote GitHub configuré (`git remote -v` vide).
Une fois le repo créé (`gh repo create` ou import), appliquez :

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
