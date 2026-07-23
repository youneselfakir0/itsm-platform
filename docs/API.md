# docs/API.md — Référence API TwisterITSM

Toutes les routes passent par le gateway (`:8080`), préfixe `/api`. Auth: `Authorization: Bearer <JWT>`.

## auth-service
| Méthode | Route | Corps | Notes |
|---|---|---|---|
| POST | /api/auth/register | `{email, password, displayName}` | rôle `user` par défaut |
| POST | /api/auth/login | `{email, password}` | → `{accessToken, refreshToken, user}` |
| POST | /api/auth/refresh | `{refreshToken}` | → `{accessToken}` |

## ticketing-service (perm `ticket:*`)
| POST | /api/tickets | `{title, description?, type?, priority?, category?}` |
| GET | /api/tickets?status=&mine=&limit= | liste (les users ne voient que leurs tickets) |
| GET | /api/tickets/:id | + comments + history |
| PATCH | /api/tickets/:id | `{status?, priority?, assignee_id?, ...}` — assign nécessite `ticket:assign` |
| POST | /api/tickets/:id/comments | `{body, internal?}` |

## cmdb-service (perm `ci:*`)
| GET | /api/cmdb/classes | classes de CI |
| GET | /api/cmdb/cis?class=&status=&attr.<k>=<v> | filtres JSONB (`@>`) |
| POST | /api/cmdb/cis | `{class, name, attributes?, environment?, status?}` |
| GET/PATCH | /api/cmdb/cis/:id | détail (+relations+history) / update |
| POST | /api/cmdb/relations | `{source_id, target_id, relation}` |

## catalog-service (perm `catalog:*`)
| GET | /api/catalog/items | catalogue actif |
| POST | /api/catalog/requests | `{item_id, form_data}` — approbation auto ou pending |
| GET | /api/catalog/requests | ses demandes (ou toutes si `catalog:approve`) |
| POST | /api/catalog/requests/:id/decision | `{decision: approved\|rejected, comment?}` — déclenche le runbook lié |

## automation-service (perm `automation:*`)
| GET | /api/automation/runbooks | runbooks dispo (ad-reset-password, ad-disable-user, ad-unlock-user, smtp-notify) |
| POST | /api/automation/jobs | `{runbook, params, dry_run?}` — **dry_run=true par défaut**; exécution réelle exige `dry_run:false` + env `ALLOW_REAL_AD=1`; compte `Administrator` refusé |
| GET | /api/automation/jobs[/:id] | statut + logs + result |

## events-service
| POST | /api/events/webhook/:source | `{severity, subject, payload, ci_id?}` — clé `x-webhook-key` si `WEBHOOK_KEY` défini; `critical` → auto-ticket p1 (si `SVC_TOKEN`) |
| GET | /api/events?severity= | (JWT, perm `ticket:read`) |

## reporting-service (perm `report:read`)
| GET | /api/reports/overview | KPIs: tickets, statuts, priorités, MTTR, CMDB, jobs |
| GET | /api/reports/tickets-per-day | série 30 jours |

## ai-service (perm `ai:use`)
| POST | /api/ai/classify | `{ticket_id?, title, description}` → catégorie/priorité/équipe/confiance. LLM si `AI_API_URL` défini (OpenAI-compatible, ex Ollama), sinon heuristique |
| POST | /api/ai/suggest | `{title, category, description?}` → étapes de résolution |
| POST | /api/ai/script | `{request}` → script PowerShell/Bash |
| POST | /api/ai/analyze-logs | `{logs}` → erreurs/warnings/summary |
| POST | /api/ai/feedback | `{ticket_id, suggestion, helpful}` |

## Variables d'environnement clés
`DATABASE_URL`, `JWT_SECRET`, `AI_API_URL`, `AI_API_KEY`, `AI_MODEL`, `ALLOW_REAL_AD`, `WEBHOOK_KEY`, `SVC_TOKEN`, `SMTP_HOST/PORT/USER/PASS/FROM`.
