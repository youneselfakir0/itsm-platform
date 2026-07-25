# k8s/_archive — manifests expérimentaux / orphelins

Ce dossier contient des manifests Kubernetes **non utilisés par le déploiement
actif** (`k8s/deploy.sh` n'applique que `00-config`, `10-api`, `20-web`,
`30-nginx`, `40-ingress`, et la variante `onprem/` correspondante).

Ils sont conservés à titre de traçabilité (expérimentations de lab) mais ne sont
**pas maintenus** et ne doivent pas être appliqués tels quels en production.

| Fichier                    | Origine / rôle                                                        | Statut |
|----------------------------|-----------------------------------------------------------------------|--------|
| `10b-ingress-ui.yaml`      | Ingress alternatif exposant l'UI via le service `itsm-web-ext`        | expérimental (remplacé par `40-ingress`) |
| `11-web-ext.yaml`          | Service+Endpoints exposant la maquette UI Vite (DC 192.168.0.20:4000) | expérimental |
| `11b-web-ext-slice.yaml`   | EndpointSlice (K8s v1.33+) pour l'UI hors cluster                     | expérimental |
| `backup-itsm-ingress.yaml` | Dump de l'état réel de l'Ingress `itsm-ingress` (nettoyé des champs d'état) | sauvegarde, pas un manifest à apply |

Pour réactiver l'un d'eux, le déplacer à la racine `k8s/` et l'ajouter à
`deploy.sh`, puis l'adapter à l'image de prod (`registry.twisterlab.local/...`).
