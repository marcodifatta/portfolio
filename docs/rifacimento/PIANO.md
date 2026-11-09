# Piano — Rifacimento portfolio mdfdev.xyz

**Stato:** Fasi 0, 1 e 2 completate (09/11/2026), Fase 3 da avviare · **Data:** 2026-11-09 · **Modalità:** OMC plan --direct

## 1. Requisiti (dalle 10 domande)

| # | Decisione |
|---|---|
| 1 | Pagina pubblica a **griglia di card** con screenshot (direzione B) |
| 2 | **Node + PostgreSQL** (DB consultabile da TablePlus/DBeaver dal Mac) |
| 3 | Login admin **username + password** (un solo utente) |
| 4 | Progetto: logo, titolo, descrizione, link, **visibile/bozza, ordine manuale, anno, tag tecnologie, screenshot** |
| 5 | **Istanza Postgres condivisa** in uno stack separato, un database e un ruolo per progetto, ogni app nel proprio container |
| 6 | Dall'admin si gestiscono anche: **testo Chi sono, upload CV, social/email, competenze** |
| 7 | Italiano principale + **inglese generato in automatico** (DeepL Free) e correggibile; lingua scelta da `Accept-Language` + selettore, URL `/en/` |
| 8 | Tema **costruito da tasteskill** partendo dai colori del logo (vedi riga 11), kind `service` (un professionista che si assume) |
| 9 | Server: VPS, Docker 27, Nginx Proxy Manager nello stack `~/portainer` |
| 10 | **Nessuna pagina di dettaglio**: la card porta al progetto online |
| 11 | **Il logo resta quello attuale** (ritratto illustrato, `photo/logo-icons/logo1.png` e `logo2.png`): non si ridisegna. Si generano solo versioni ottimizzate (favicon 32/180/512 in PNG + `favicon.ico`, logo per il menu in WebP a 2x) e la **palette del sito parte dai colori del logo** (marrone scuro circa `#2A0000`, crema circa `#F7EFEE` / `#E8E4E1`) tramite `start.mjs brand` di tasteskill, invece del deal casuale |
| 12 | **`gestione-scadenze` resta com'è**: nessun file, container o database di quel progetto viene modificato |

Deploy desiderato sul server: `git pull && docker compose up -d --build`.

## 2. Situazione attuale del server

Problemi trovati e risolti nella Fase 0 (09/11/2026): la cartella `.git` era pubblicata dal sito, il container non aveva riavvio automatico e le porte dei container (database compreso) erano raggiungibili da internet scavalcando il proxy. Dettagli e configurazione attuale in [../infra/SERVER.md](../infra/SERVER.md).

## 3. Architettura proposta

```
                    internet :443
                         │
              ┌──────────▼──────────┐
              │ nginx-proxy-manager │  rete: portainer_marco-network ("proxy")
              └──────────┬──────────┘
                         │ http://portfolio:3000   (nessuna porta pubblicata)
              ┌──────────▼──────────┐
              │ portfolio (Node 22) │──── volume portfolio_uploads (/data/uploads)
              └──────────┬──────────┘
                         │ rete: db-net (interna)
              ┌──────────▼──────────┐
              │ postgres:17-alpine  │──── volume pg_data
              │ db: portfolio, …    │     porta 127.0.0.1:5432 solo per tunnel SSH
              └─────────────────────┘
TablePlus (Mac) ──SSH tunnel <utente>@<IP-VPS>──► 127.0.0.1:5432
```

### Stack applicativo
- **Express 5 + EJS** con rendering lato server: la pagina pubblica arriva già pronta in HTML, senza framework frontend e senza build JS.
- **Prisma 7** con driver `@prisma/adapter-pg` per schema e migrazioni (configurazione in `prisma.config.ts`, client generato in `src/generated/prisma`), applicate con `prisma migrate deploy` all'avvio del container.
- TypeScript eseguito con `tsx` anche in produzione: nessuna fase di build, `tsc --noEmit` solo come controllo dei tipi.
- Sessioni con `express-session` + `connect-pg-simple` (tabella `session` nel DB), password con `bcrypt`, `helmet`, `express-rate-limit` sul login, CSRF con `csrf-sync`.
- Upload con `multer` + `sharp`: loghi a 256×256 e screenshot a 1200px di larghezza in WebP, salvati nel volume `/data/uploads` e serviti da `/uploads/…`.
- Traduzione: DeepL API Free (`DEEPL_API_KEY` nel `.env`). Senza chiave, il campo EN resta vuoto e la pagina inglese mostra il testo italiano.

### Modello dati (Prisma)
- `Project`: id, slug, titleIt, titleEn, descriptionIt, descriptionEn, enManual (bool: EN corretto a mano, quindi non va sovrascritto), url, year, tags (text[]), logoPath, screenshotPath, status (`DRAFT`/`PUBLISHED`), position (int), timestamps.
- `Skill`: id, name, iconPath, position.
- `Social`: id, kind (`linkedin`/`instagram`/`github`/`email`…), url, position.
- `Setting`: chiave e valore IT/EN per `hero.title`, `hero.subtitle`, `about.body`, `contact.email` e `cv.path`.
- Credenziali admin solo da `.env` (`ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`), non nel database.

### Struttura del repo
```
portfolio/
├─ docker-compose.yml        # servizio portfolio, reti esterne proxy + db-net
├─ Dockerfile                # multi-stage, node:22-alpine, utente non-root
├─ .dockerignore  .env.example  .gitignore
├─ prisma/schema.prisma  prisma/migrations/  prisma/seed.ts  (4 progetti attuali)
├─ src/
│  ├─ server.ts  config.ts  db.ts
│  ├─ routes/public.ts  routes/admin.ts  routes/auth.ts
│  ├─ services/translate.ts  services/images.ts
│  ├─ i18n/it.json  i18n/en.json
│  └─ views/ (public/*.ejs, admin/*.ejs)
├─ public/assets/            # kit tasteskill copiato + CSS/JS del sito
├─ infra/postgres/           # stack Postgres condiviso (vedi Fase 1)
│  ├─ docker-compose.yml  .env.example  init/  scripts/new-project-db.sh  scripts/backup.sh
└─ docs/DEPLOY.md
```
`infra/postgres` è versionato qui per comodità, ma sul server vive in `~/infra/postgres` come stack indipendente.

## 4. Fasi di lavoro

### Fase 0 — Messa in sicurezza immediata ✅ completata il 09/11/2026
1. Sul sito attuale: aggiungere `.dockerignore` (`.git`, `.omc`, `README.md`, `Dockerfile`, `.DS_Store`), ricostruire l'immagine e rilanciare il container con `--restart unless-stopped`.
2. **`gestione-scadenze` NON si tocca.** Le porte non necessarie si chiudono con il firewall del provider (console web): in entrata restano solo SSH, HTTP e HTTPS. I sottodomini continuano a funzionare perché il proxy raggiunge le app dall'interno del server. Per tornare indietro basta togliere la regola.
- **Fatto quando:** `curl https://mdfdev.xyz/.git/HEAD` → 404; dall'esterno solo le porte 22, 80 e 443 risultano aperte; tutti i sottodomini rispondono come prima.

### Fase 1 — Stack Postgres condiviso ✅ completata il 09/11/2026
1. `infra/postgres/docker-compose.yml`: `postgres:17-alpine` (container `pg-shared`), volume `pg_shared_data`, rete `db-net`, porta `127.0.0.1:5432:5432`, healthcheck, `restart: unless-stopped`, limite di memoria a 256 MB.
2. `scripts/new-project-db.sh <nome>`: crea un ruolo e un database `<nome>` con password casuale, `REVOKE ALL ON DATABASE … FROM PUBLIC`, e stampa la `DATABASE_URL`.
3. `scripts/backup.sh`: `pg_dumpall` compresso in `~/backups/postgres/` con 7 giorni di conservazione e una voce cron alle 03:30.
4. Guida in `docs/DEPLOY.md` per collegarsi con TablePlus via tunnel SSH, e con DBeaver su Windows.
- **Fatto quando:** TablePlus dal Mac si collega via tunnel SSH e vede il database `portfolio`; l'utente `portfolio` non può connettersi ad altri database; dall'esterno la porta 5432 risulta chiusa.
- La migrazione di `scadenze-db` nell'istanza condivisa è un **follow-up separato**, non fa parte di questo piano.

### Fase 2 — Scheletro app, schema e seed ✅ completata il 09/11/2026
1. Progetto Node 22+ e TypeScript (`tsx` per eseguire, `tsc --noEmit` per i tipi), Express 5, EJS, Prisma 7.
2. Schema e migrazione iniziale; seed con i 4 progetti attuali (PizzaBakery, QRator, ShoppyList, MDKManager), i loro loghi, i testi di [index.html](../../index.html), social, email e CV.
3. In sviluppo: Postgres di Homebrew sul Mac (database `portfolio_dev`), nessun Docker locale.
- **Fatto quando:** `npm run dev` mostra i 4 progetti letti dal database; `npm run typecheck` passa senza errori.

### Fase 3 — Area admin
1. `/admin/login`: login, logout, sessione di 7 giorni con cookie `HttpOnly; Secure; SameSite=Lax`, 5 tentativi ogni 15 minuti per IP.
2. Progetti: elenco, creazione, modifica ed eliminazione (con conferma), stato bozza/pubblicato, riordino con frecce su/giù (si aggiunge il drag and drop solo se resta semplice), upload di logo e screenshot con anteprima.
3. Contenuti: testo Chi sono (IT/EN), social ed email, competenze con icona, upload del CV in PDF (massimo 5 MB).
4. Validazione lato server con messaggi di errore sotto ogni campo e protezione CSRF su tutti i form.
- **Fatto quando:** senza sessione tutti gli URL `/admin/*` rimandano al login; un progetto creato appare in homepage, una bozza no; il nuovo ordine si vede in homepage; il 6° login sbagliato riceve una risposta 429.

### Fase 4 — Lingua inglese
1. Dizionari `i18n/it.json` e `i18n/en.json` per i testi fissi dell'interfaccia.
2. Route `/` (IT) e `/en/` (EN). Alla prima visita di `/`, un browser con `Accept-Language: en` viene mandato a `/en/` con un 302, a meno che non ci sia già il cookie `lang`. Il selettore IT/EN salva il cookie. Nella pagina ci sono `hreflang` e `<html lang>` corretti.
3. Al salvataggio, se il campo EN è vuoto o non è marcato `enManual`, viene chiamato DeepL e il risultato scritto nel campo EN, sempre modificabile a mano. Se DeepL non risponde il salvataggio va comunque a buon fine e l'admin mostra un avviso.
- **Fatto quando:** `curl -H 'Accept-Language: en-US' -I https://mdfdev.xyz/` → 302 verso `/en/`; un progetto salvato in italiano ha già il testo EN; una correzione EN fatta a mano non viene sovrascritta al salvataggio successivo.

### Fase 5 — Pagina pubblica con tasteskill
1. Armare il gate di tasteskill (il suo controllo finale) puntando al server di sviluppo: `gate.mjs --start http://localhost:3000/ --kind service --category "sviluppo web app per piccole attività" --primary "Vedi i progetti"`.
2. Scrivere prima i testi (`copy-voice.md`); poi il deal di hero, palette, font e momenti; costruire le sezioni hero, progetti (griglia di card), chi sono e competenze, CV e contatti, e footer, usando il kit copiato in `public/assets`.
3. Usare le icone vere delle tecnologie (`icons.mjs`); niente violetto; un'animazione al passaggio del mouse sulle card; un layout a colonna unica a 390px.
4. Controlli: `copy-lint`, `consistency`, `check.mjs`, `perf.mjs`, ripetuti finché `gate.mjs` restituisce `GATE: PASS`.
- **Fatto quando:** `GATE: PASS` (oppure `OPEN` con le eccezioni motivate in `.taste-skill/waivers.json`) e il peso delle immagini del primo schermo sotto i 300 KB (oggi i soli loghi pesano circa 1,4 MB).

### Fase 6 — Docker e deploy
1. `Dockerfile` multi-stage (dipendenze, build, runtime come utente `node`), `HEALTHCHECK` su `/healthz`; `.dockerignore`.
2. `docker-compose.yml`: servizio `portfolio` con `container_name: portfolio`, `restart: unless-stopped`, **nessuna `ports:`**, reti esterne `portainer_marco-network` e `db-net`, volume `portfolio_uploads`, variabili da `.env`.
3. Al primo deploy sul server: avviare lo stack Postgres, creare il DB con `new-project-db.sh portfolio`, compilare il `.env`, fare `git pull` e `docker compose up -d --build`. Le migrazioni e il seed (solo con DB vuoto) partono da soli.
4. Cambio senza interruzioni: in NPM l'host `mdfdev.xyz` passa dal vecchio container a `portfolio:3000`. Il vecchio `mdf-website-container` resta fermo ma non eliminato per 7 giorni, così si può tornare indietro al volo.
5. Deploy successivi: `cd ~/portfolio && git pull && docker compose up -d --build`.
- **Fatto quando:** `https://mdfdev.xyz` e `/en/` rispondono 200 dal nuovo container; il sito torna su da solo dopo `sudo reboot`; un riavvio del container non perde progetti né upload.

### Fase 7 — Verifica finale (lane separata: verifier)
- Prova end-to-end: login → creare un progetto con logo e screenshot → pubblicarlo → vederlo in `/` e `/en/` → riordinare → nasconderlo → eliminarlo.
- Sicurezza: niente `/.git`, niente porte dirette dell'app, cookie con `Secure`, admin protetto, upload che accetta solo immagini e PDF entro i limiti.
- Backup: un ripristino di prova del dump in un database temporaneo.

## 5. Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| RAM limitata (circa 2 GB liberi, nessuna swap) | Postgres limitato a 256 MB, app Node circa 100 MB; proposta di aggiungere 1 GB di swap (follow-up) |
| Errore nel cambio su NPM e sito giù | Vecchio container tenuto per 7 giorni; per tornare indietro basta rimettere l'host sul vecchio container e avviarlo |
| Perdita dei dati o degli upload | Volumi nominati, `pg_dumpall` notturno, backup del volume upload nello stesso script |
| Postgres condiviso come punto unico di guasto | `restart: unless-stopped` e healthcheck; le app aspettano il DB con un retry all'avvio |
| DeepL non disponibile o quota esaurita | Il salvataggio non si blocca, l'EN resta vuoto e si mostra l'italiano, l'admin vede un avviso |
| Brute force sul login | Rate limit, bcrypt con cost 12, solo HTTPS, nessun nome utente mostrato negli errori |
| Upload malevoli | Controllo del tipo reale del file con `sharp`/`file-type`, nomi file generati, limiti di dimensione, serviti come statici |

## 6. Fuori da questo piano (follow-up)
- (Facoltativo, solo se Marco lo vorrà) migrare `scadenze-db` nell'istanza Postgres condivisa.
- Fare passare qrator, ShoppyList, scadenze e gli altri dal proxy tramite nome del container, togliendo le porte pubbliche; unificare le due reti `marco-network`.
- Aggiungere la swap sulla VPS.
- Accesso con OAuth GitHub (eventualmente in seguito).
