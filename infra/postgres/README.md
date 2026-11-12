# Postgres condiviso (`pg-shared`)

Un'unica istanza PostgreSQL 17 per i progetti sul server: **un database e un utente per ogni progetto**, ogni app nel proprio container. Sul server vive in `~/infra/postgres`, indipendente dai progetti.

> **Dal 12/11/2026 la sorgente è il repository [`mdf-infra`](https://github.com/marcodifatta/mdf-infra) (cartella `postgres/`).** Questa copia resta per riferimento storico: le modifiche vanno fatte lì.

| Cosa | Valore |
|---|---|
| Container | `pg-shared` (`postgres:17-alpine`), `restart: unless-stopped` |
| Rete Docker | `db-net`: le app la dichiarano `external` e usano l'host `pg-shared:5432` |
| Porta sull'host | `127.0.0.1:5432`: solo dal server stesso (tunnel SSH), chiusa verso internet |
| Dati | volume `pg_shared_data` |
| Memoria | limite 256 MB (`shared_buffers=64MB`, `max_connections=50`) |
| Accesso | password obbligatoria su ogni connessione di rete (`pg_hba.conf`); senza password solo via `docker exec` |
| Backup | ogni notte alle 03:30 (ora del server, UTC) in `~/backups/postgres`, ultimi 7 giorni |

## File

- `docker-compose.yml`: lo stack
- `pg_hba.conf`: regole di accesso
- `.env.example`: password del superutente (il `.env` vero sta solo sul server, `chmod 600`)
- `scripts/new-project-db.sh`: crea database e utente di un progetto
- `scripts/backup.sh`: dump completo con controllo di integrità e rotazione

## Prima installazione (già fatta il 09/11/2026)

```bash
mkdir -p ~/infra/postgres
rsync -a --exclude credentials --exclude .env ~/portfolio/infra/postgres/ ~/infra/postgres/
cd ~/infra/postgres
umask 077; printf "POSTGRES_SUPERUSER=postgres\nPOSTGRES_SUPERUSER_PASSWORD=%s\n" "$(openssl rand -hex 32)" > .env
docker compose up -d
```

## Aggiornare lo stack dopo una modifica nel repo

```bash
cd ~/portfolio && git pull
rsync -a --exclude credentials --exclude .env ~/portfolio/infra/postgres/ ~/infra/postgres/
cd ~/infra/postgres && docker compose up -d
```

## Nuovo progetto

```bash
cd ~/infra/postgres
./scripts/new-project-db.sh nomeprogetto
```

Crea l'utente e il database `nomeprogetto`, con una password casuale. Nessun altro utente può collegarsi a quel database, e gli utenti di progetto non possono collegarsi al database di sistema `postgres`. Le credenziali **non vengono stampate**: finiscono in `credentials/nomeprogetto.env` (`chmod 600`), da cui si copia `DATABASE_URL` nel `.env` del progetto. Nel `docker-compose.yml` del progetto:

```yaml
services:
  app:
    networks: [default, db-net]
    environment:
      DATABASE_URL: ${DATABASE_URL}   # postgresql://nome:pw@pg-shared:5432/nome
networks:
  db-net:
    external: true
```

## Collegarsi da TablePlus (Mac) o DBeaver (Windows)

Nuova connessione PostgreSQL:

- **Over SSH**: attivo · host `mdfdev.net` (o l'IP del server) · porta `22` · utente `marco` · autenticazione con la tua chiave SSH
- **Database**: host `127.0.0.1` · porta `5432` · utente e password del progetto (da `credentials/<nome>.env`) · database `<nome>`

Per amministrare tutto si usa l'utente `postgres`, con la password nel `.env` dello stack. In DBeaver la scheda si chiama "SSH" e i campi sono gli stessi.

## Backup e ripristino

```bash
./scripts/backup.sh                       # backup manuale
tail ~/backups/postgres/backup.log        # esito dei backup notturni
```

Ripristino completo (sovrascrive i database presenti nel dump):

```bash
gzip -dc ~/backups/postgres/pg-shared-AAAAMMGG-HHMM.sql.gz | docker exec -i pg-shared psql -U postgres -d postgres
```

Il 09/11/2026 il ripristino è stato provato in un container temporaneo: tabelle, dati e utenti tornano come prima. Sono attesi solo 2 errori sull'utente `postgres`, che esiste già nel container.

> I backup restano sullo stesso server. Copiarli altrove (sul Mac o su uno storage esterno) è un passo successivo.
