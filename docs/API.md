# docs/API.md — Référence API TwisterITSM

Toutes les routes sont servies par le monolithe NestJS (`:8080`), préfixe global
`/api`. Auth: `Authorization: Bearer <token>` sauf routes marquées `@Public()`.
Les routes protégées exigent la permission indiquée (`@Permissions(...)`).

> Endpoints générés depuis les controllers réels (`apps/api/src/**/*.controller.ts`).

## auth (`/api/auth`)
| Méthode | Route | Perm | Corps | Notes |
|---|---|---|---|---|
| GET | /api/auth/health | @Public | — | healthcheck |
| POST | /api/auth/register | @Public | `{email, password, displayName}` | rôle `user` par défaut |
| POST | /api/auth/login | @Public | `{email, password}` | → `{accessToken, refreshToken, user}` |
| POST | /api/auth/mfa/verify | @Public | `{email, token}` | 2e facteur si MFA activé |
| POST | /api/auth/refresh | @Public | `{refreshToken}` | → `{accessToken}` |
| GET | /api/auth/mfa/enroll | JWT | — | génère secret + uri otpauth (QR) |
| POST | /api/auth/mfa/confirm | JWT | `{token}` | confirme l'enrôlement TOTP |
| POST | /api/auth/ldap/sync | admin:* | — | sync annuaire AD (résilient, ne plante pas si AD down) |

## ticketing (`/api/tickets`, perm `ticket:*`)
| POST | /api/tickets | `{title, description?, type?, priority?, category?}` |
| GET | /api/tickets?status=&mine=&limit= | liste (les users ne voient que leurs tickets) |
| GET | /api/tickets/:id | + comments + history (audit) |
| PATCH | /api/tickets/:id | `{status?, priority?, assignee_id?, ...}` (assign nécessite `ticket:assign`) |
| POST | /api/tickets/:id/comments | `{body, internal?}` |

## cmdb (`/api/cmdb`, perm `ci:*`)
| GET | /api/cmdb/classes | classes de CI |
| GET | /api/cmdb/cis?class=&status=&attr.<k>=<v> | filtres JSONB (`@>`) |
| POST | /api/cmdb/cis | `{class, name, attributes?, environment?, status?}` |
| GET / PATCH | /api/cmdb/cis/:id | détail (+relations+history) / update |
| POST | /api/cmdb/relations | `{source_id, target_id, relation}` |
| POST | /api/cmdb/discover/ad | discovery LDAP des ordinateurs (audit dans `discovery_runs`) |
| GET | /api/cmdb/discover/runs | historique des runs de discovery |

## catalog (`/api/catalog`, perm `catalog:*`)
| GET | /api/catalog/items | catalogue actif |
| POST | /api/catalog/requests | `{item_id, form_data}` — approbation auto ou pending |
| GET | /api/catalog/requests | ses demandes (ou toutes si `catalog:approve`) |
| POST | /api/catalog/requests/:id/decision | `{decision: approved\|rejected, comment?}` — déclenche le runbook lié |

## automation (`/api/automation`, perm `automation:*`)
| GET | /api/automation/health | healthcheck |
| GET | /api/automation/runbooks | runbooks dispo (ad-reset-password, ad-disable-user, ad-unlock-user, ad-create-user, ad-add-group) |
| POST | /api/automation/jobs | `{runbook, params, dry_run?}` — **dry_run=true par défaut** ; exécution réelle exige `dry_run:false` + env `ALLOW_REAL_AD=1` ; compte `administrator`/`admin`/`krbtgt`/`guest` refusé |
| GET | /api/automation/jobs | liste (100 derniers) |
| GET | /api/automation/jobs/:id | statut + logs + result |

## events (`/api/events`, perm `ticket:read`)
| GET | /api/events/health | healthcheck |
| POST | /api/events/webhook/:source | `{severity, subject, payload, ci_id?}` — clé `x-webhook-key` si `WEBHOOK_KEY` défini ; `critical` → auto-ticket p1 (si `SVC_TOKEN`) |
| GET | /api/events?severity= | liste des événements |
| POST | /api/events/:id/correlate | `{ci_id}` — lie un événement à un CI CMDB |

## workflow (`/api/workflow`, perm `workflow:*` / `catalog:approve`)
| GET | /api/workflow/health | healthcheck |
| GET | /api/workflow/sla-policies | politiques SLA (P1–P4) |
| GET | /api/workflow/definitions | définitions de workflow actives |
| POST | /api/workflow/evaluate-sla | recalcule les statuts SLA + escalade les breaches (idempotent) |
| POST | /api/workflow/requests/:id/approve | `{level, decision: approved\|rejected, comment?}` — avance le workflow de demande |

## reporting (`/api/reports`, perm `report:read`)
| GET | /api/reports/overview | KPIs: tickets, statuts, priorités, MTTR, CMDB, jobs |

## ai (`/api/ai`, perm `ai:use`)
| GET | /api/ai/health | healthcheck |
| GET | /api/ai/engine | info sur le moteur IA (modèle, disponibilité) |
| POST | /api/ai/classify | `{ticket_id?, title, description}` → catégorie/priorité/équipe/confiance. LLM si `AI_API_URL` défini (Ollama), sinon heuristique |
| POST | /api/ai/suggest | `{title, category, description?}` → étapes de résolution |
| POST | /api/ai/script | `{request}` → script PowerShell/Bash |
| POST | /api/ai/analyze-logs | `{logs}` → erreurs/warnings/summary |

## notify (`/api/notify`)
| GET | /api/notify/health | healthcheck |
| POST | /api/notify/test | `@Public` — teste la chaîne (SMTP DRY-RUN si non config, webhook Teams) |

## Variables d'environnement clés
`DATABASE_URL`, `JWT_SECRET`, `AI_API_URL`, `AI_API_KEY`, `AI_MODEL`,
`ALLOW_REAL_AD`, `WEBHOOK_KEY`, `SVC_TOKEN`, `SMTP_HOST/PORT/USER/PASS/FROM`,
`TEAMS_WEBHOOK`. Voir `docs/SECRETS.md` pour la fourniture sécurisée.
