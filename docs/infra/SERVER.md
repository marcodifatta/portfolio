# Server — note operative

VPS Hetzner Cloud (`marco-vps`), Ubuntu, Docker. Ogni progetto vive nella sua cartella `~/<progetto>` con il proprio container; Nginx Proxy Manager (stack `~/portainer`) gestisce HTTPS e smista i sottodomini di `mdfdev.xyz`.

## Firewall (Hetzner Cloud, dal 09/11/2026)

Firewall `marco-vps-web` applicato al server dalla console Hetzner. In entrata è aperto solo:

| Protocollo | Porta | Uso |
|---|---|---|
| TCP | 22 | SSH |
| TCP | 80 | HTTP (rinnovo certificati Let's Encrypt) |
| TCP | 443 | HTTPS (tutti i siti) |
| UDP | 41641 | Tailscale (connessioni dirette) |
| ICMP | – | ping |

In uscita è tutto consentito (nessuna regola outbound).

Le porte pubblicate dai container (`-p 3000:3000` e simili) **non sono più raggiungibili da internet**: Nginx Proxy Manager le raggiunge dall'interno del server, quindi i sottodomini funzionano come prima. Per tornare indietro basta staccare il firewall dal server nella console.

> Nota: `ufw` sul server non basta da solo, perché Docker scrive le proprie regole iptables e le porte dei container lo scavalcano. Per questo il filtro è sul firewall del provider.

## Accesso ai database da TablePlus / DBeaver

I database non sono esposti: ci si collega con un **tunnel SSH**.

- **Over SSH:** host del server, utente `marco`, chiave SSH
- **Database:** host `127.0.0.1`, porta del container (es. `5433` per scadenze, `5432` per l'istanza condivisa del portfolio), utente e password del database

## Postgres condiviso (dal 09/11/2026)

Container `pg-shared` in `~/infra/postgres`, rete Docker `db-net`, porta `127.0.0.1:5432`, backup notturno in `~/backups/postgres`. Ospita il database `portfolio`. `scadenze-db` resta separato e non è stato toccato. Guida completa: [infra/postgres/README.md](../../infra/postgres/README.md).

## Portfolio: deploy attuale (sito statico)

```bash
cd ~/portfolio
git pull
docker build -t mdf-website .
docker rm -f mdf-website-container
docker run -d --name mdf-website-container --network portainer_marco-network \
  -p 8080:80 --restart unless-stopped mdf-website
```

Il `.dockerignore` tiene fuori dall'immagine `.git`, README, Dockerfile e documentazione. Questo deploy sarà sostituito da `docker compose up -d --build` con il rifacimento (vedi [../rifacimento/PIANO.md](../rifacimento/PIANO.md)).

### Rollback della Fase 0 (fino al 16/11/2026)
Il container precedente è conservato fermo come `mdf-website-old` (immagine `mdf-website:pre-fase0`). Dopo il 16/11 si possono rimuovere:

```bash
docker rm mdf-website-old && docker rmi mdf-website:pre-fase0
```
