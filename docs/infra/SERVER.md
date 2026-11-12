# Server — note operative del portfolio

> **Il server nel suo insieme** (firewall, Nginx Proxy Manager, Postgres condiviso, Komodo, Beszel, Homepage,
> backup, Cloudflare Access) è documentato in un posto solo: il repository privato
> [`mdf-infra`](https://github.com/marcodifatta/mdf-infra), che sul server vive in `~/infra`.
> Qui restano solo le note specifiche del portfolio.

## Il container

Container `portfolio` (immagine `mdf-portfolio`) in `~/portfolio`, gestito con Docker Compose:

- **Indirizzo:** https://mdfdev.net (`www.mdfdev.net` rimanda con un 301; il vecchio dominio rimanda da Cloudflare).
- **Reti:** `portainer_marco-network` (Nginx Proxy Manager) e `db-net` (Postgres condiviso `pg-shared`).
- **Porta:** `8080` dell'host. Da internet è chiusa dal firewall Hetzner.
- **File caricati:** volume `portfolio_uploads`, montato in `/data/uploads` (backup notturno, anche su Google Drive).
- **Configurazione:** `~/portfolio/.env` (`chmod 600`), con `DATABASE_URL` preso da `~/infra/postgres/credentials/portfolio.env`.
- **All'avvio:** migrazioni del database, seed (solo a database vuoto), poi il server. Healthcheck su `/healthz`.

## Aggiornare il sito

In Komodo (https://komodo.mdfdev.net) → stack **portfolio** → **Deploy**: fa `git pull` e poi la build.
Oppure a mano:

```bash
cd ~/portfolio && git pull && docker compose up -d --build
```

## Comandi utili

```bash
docker compose logs -f portfolio                             # log (anche da Komodo)
docker compose exec portfolio npm run admin:reset-password   # password admin dimenticata
docker compose restart portfolio                             # riavvio
```

## Database

Il database `portfolio` sta nel Postgres condiviso: guida in `mdf-infra/postgres/README.md`
(da TablePlus/DBeaver con tunnel SSH: host `127.0.0.1`, porta `5432`).
