# Certificats TLS pour le reverse proxy nginx (compose dev uniquement)

En production (K8s), le secret `itsm-tls` est fourni par cert-manager
(cluster-issuer `selfsigned-ca` ou un issuer ACME/Internal-CA).

Pour le dev / compose local, générer un certificat auto-signé :

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tls.key -out tls.crt \
  -subj "/CN=itsm.twisterlab.local"
```

Puis `docker compose up -d` montera `nginx/certs` en lecture seule.
