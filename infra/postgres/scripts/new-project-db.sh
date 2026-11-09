#!/usr/bin/env bash
# Crea un database e un utente dedicati a un progetto nel Postgres condiviso.
#
#   ./scripts/new-project-db.sh portfolio
#
# Le credenziali NON vengono stampate: finiscono in credentials/<nome>.env (chmod 600),
# da cui si copia DATABASE_URL nel .env del progetto.
set -euo pipefail

CONTAINER="${PG_CONTAINER:-pg-shared}"
SUPERUSER="${POSTGRES_SUPERUSER:-postgres}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
NAME="${1:-}"

if [[ ! "$NAME" =~ ^[a-z][a-z0-9_]{1,30}$ ]]; then
  echo "Uso: $0 <nome>   (minuscole, cifre e _, inizia con una lettera, max 31 caratteri)" >&2
  exit 1
fi

psql_su() { docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$SUPERUSER" -d postgres -qtA "$@"; }

if [[ "$(psql_su -c "SELECT 1 FROM pg_database WHERE datname = '$NAME'")" == "1" ]]; then
  echo "Il database '$NAME' esiste già: non faccio nulla." >&2
  exit 1
fi

PASSWORD="$(openssl rand -hex 24)"

psql_su -v name="$NAME" -v pw="$PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'name', :'pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'name') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'name', :'name') \gexec
-- Nessun altro utente può collegarsi a questo database
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'name') \gexec
-- e nessun utente di progetto può collegarsi al database di sistema
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
SQL

mkdir -p "$DIR/credentials"
chmod 700 "$DIR/credentials"
OUT="$DIR/credentials/$NAME.env"
umask 077
cat > "$OUT" <<EOF
# Creato il $(date '+%Y-%m-%d %H:%M') da new-project-db.sh
DB_NAME=$NAME
DB_USER=$NAME
DB_PASSWORD=$PASSWORD
# Dai container sulla rete db-net:
DATABASE_URL=postgresql://$NAME:$PASSWORD@$CONTAINER:5432/$NAME
# Da TablePlus/DBeaver via tunnel SSH: host 127.0.0.1, porta 5432
EOF
chmod 600 "$OUT"

echo "Creati database e utente '$NAME'. Credenziali in: $OUT"
