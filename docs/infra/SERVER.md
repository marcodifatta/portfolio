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

## Portfolio (app Node, dal 10/11/2026)

Container `portfolio` (immagine `mdf-portfolio`) in `~/portfolio`, gestito con Docker Compose:

- **Reti:** `portainer_marco-network` (Nginx Proxy Manager) e `db-net` (`pg-shared`).
- **Porta:** `8080` dell'host, la stessa del sito precedente, quindi Nginx Proxy Manager non è cambiato. Da internet è chiusa dal firewall.
- **File caricati:** volume `portfolio_uploads`, montato in `/data/uploads`.
- **Configurazione:** `~/portfolio/.env` (`chmod 600`), con `DATABASE_URL` preso da `~/infra/postgres/credentials/portfolio.env`.
- **All'avvio:** migrazioni del database, seed (solo a database vuoto), poi il server. Healthcheck su `/healthz`.

### Aggiornare il sito

```bash
cd ~/portfolio
git pull
docker compose up -d --build
```

### Comandi utili

```bash
docker compose logs -f portfolio                         # log
docker compose exec portfolio npm run admin:reset-password   # password admin dimenticata
docker compose restart portfolio                         # riavvio
```

### Primo accesso all'admin

La password iniziale è in `~/portfolio-admin-password.txt` (leggibile solo da `marco`): `cat ~/portfolio-admin-password.txt`. Entra su https://mdfdev.xyz/admin, cambiala con **Cambia password**, poi cancella il file con `rm ~/portfolio-admin-password.txt`.

### Cloudflare

`mdfdev.xyz` passa da Cloudflare (proxy arancione). Il 10/11/2026 la modalità SSL/TLS era **Flexible**: Cloudflare raggiunge il server in `http`, e il traffico tra Cloudflare e il server viaggia in chiaro. L'app legge lo schema reale del visitatore da `CF-Visitor`, così il login funziona anche così, ma conviene passare a **Full (strict)**. Nginx Proxy Manager ha già un certificato Let's Encrypt valido per `mdfdev.xyz`:

1. Cloudflare → il dominio `mdfdev.xyz` → **SSL/TLS** → **Overview**
2. Modalità di cifratura: **Full (strict)**
3. Ricarica https://mdfdev.xyz: deve rispondere come prima

Se dopo il cambio un sottodominio desse errore 526, quel proxy host in NPM non ha un certificato valido: torna a "Full" per quel sito, o crea il certificato in NPM.

### Tornare al sito precedente (fino al 17/11/2026)

Il vecchio sito statico è fermo come `mdf-website-legacy`, sulla stessa porta 8080:

```bash
cd ~/portfolio && docker compose stop portfolio
docker start mdf-website-legacy
```

Dopo il 17/11, se tutto va bene, si può rimuovere con `docker rm mdf-website-legacy mdf-website-old && docker rmi mdf-website mdf-website:pre-fase0`.
