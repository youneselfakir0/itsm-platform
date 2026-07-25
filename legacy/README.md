# Legacy microservices Express (P0–P2)

> ⚠️ **NON MAINTENU** — code historique, conservé uniquement pour référence et
> traçabilité. Ne pas utiliser comme base de développement.

Ces 9 microservices Express + `pg` (`services/*`, `gateway`) ont été **remplacés**
par le Modular Monolith NestJS + Prisma dans `apps/api` au commit **feat(E1)**.
La logique métier et le modèle de données ont été consolidés et réutilisés comme
baseline Prisma (`prisma db pull` depuis `db/migrations/00x_*.sql`).

Pour l'architecture et l'API actuelles, voir `README.md`, `docs/ARCHITECTURE.md`
et `docs/API.md` à la racine.
