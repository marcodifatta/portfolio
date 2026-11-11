# Portfolio mdfdev.net: app Node (Express + EJS + Prisma) in un solo container.
# Le migrazioni del database e il seed (solo a database vuoto) partono all'avvio: vedi docker-entrypoint.sh.
FROM node:24-alpine

# openssl: richiesto dal motore delle migrazioni di Prisma su Alpine
RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production \
    UPLOAD_DIR=/data/uploads \
    PORT=3000

# Dipendenze (senza quelle di sviluppo). Il postinstall genera il client Prisma in src/generated.
COPY package.json package-lock.json prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --no-fund --no-audit && npm cache clean --force

# Codice, file statici, materiale del seed (loghi in photo/, CV in docs/cv)
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY photo ./photo
COPY docs/cv ./docs/cv
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
 && mkdir -p /data/uploads \
 && chown -R node:node /data /app/src/generated

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
