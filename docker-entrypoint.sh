#!/bin/sh
# Avvio del container: migrazioni, seed solo a database vuoto, poi il server.
set -e
echo "Migrazioni del database..."
npx prisma migrate deploy
echo "Seed (salta da solo se il database contiene già dei progetti)..."
npx prisma db seed
echo "Avvio del server..."
exec node --import tsx src/server.ts
