# My Personal Portfolio

Questo è il repository del mio portfolio personale, creato dopo aver completato il mio primo progetto (www.pizzabakery.biz). Il portfolio è stato sviluppato per mostrare i miei progetti e le mie competenze.

## Portfolio con area admin (online dal 10/11/2026)

Il sito statico è stato sostituito da un portfolio con **area admin**, per gestire i progetti senza toccare il codice. È online su **https://mdfdev.net** (dall'11/11/2026; prima `mdfdev.xyz`, che ora rimanda qui).

- **Stack:** Node 24 + Express 5 + EJS, PostgreSQL 17 (istanza condivisa sul server), Prisma 7, Docker Compose
- **Admin (`/admin`, link "Accesso admin" nel footer):** progetti (logo, titolo, descrizione, link, anno, tag, screenshot, bozza/pubblicato, ordine), testi della homepage, immagine della prima schermata, CV, social, competenze, cambio password
- **Lingue:** italiano su `/` e inglese su `/en/`, con traduzione automatica (DeepL) correggibile dall'admin
- **Grafica:** costruita con tasteskill, con il logo e i suoi colori ([DESIGN.md](docs/rifacimento/DESIGN.md))
- **SEO e GEO:** dati strutturati schema.org, sitemap, robots.txt e llms.txt generati dal database
- **Deploy:** `git pull && docker compose up -d --build` (dettagli in [docs/infra/SERVER.md](docs/infra/SERVER.md))

Il piano completo, con fasi e criteri di verifica, è in [docs/rifacimento/PIANO.md](docs/rifacimento/PIANO.md).

### Sviluppo locale

Requisiti: Node 22 o superiore (in produzione Node 24) e un PostgreSQL locale (su Mac: `brew services start postgresql@15`).

```bash
createdb portfolio_dev
cp .env.example .env          # imposta DATABASE_URL, es. postgresql://<utente-mac>@localhost:5432/portfolio_dev
npm install                   # genera anche il client Prisma
npm run db:migrate            # applica le migrazioni
npm run db:seed               # carica i contenuti del sito attuale (solo se il DB è vuoto)
npm run dev                   # http://localhost:3000
```

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server con ricarica automatica |
| `npm run typecheck` | controllo dei tipi TypeScript |
| `npm run db:migrate` | crea e applica una nuova migrazione dopo una modifica a `prisma/schema.prisma` |
| `npm run db:reset` | cancella il database di sviluppo, riapplica le migrazioni e il seed |
| `npm test` | test automatici (database `portfolio_test`: `createdb portfolio_test` la prima volta) |
| `npm run admin:password` | genera `ADMIN_PASSWORD_HASH` per il `.env` (chiede la password senza mostrarla) |

### Area admin

Indirizzo: `/admin`. Un solo utente, definito nel `.env`:

```bash
npm run admin:password          # scrivi la nuova password, copia la riga ADMIN_PASSWORD_HASH=... nel .env
```

| Sezione | Cosa si gestisce |
|---|---|
| Progetti | titolo, descrizione, link, anno, tecnologie, logo, screenshot, visibile/bozza, ordine (frecce ↑ ↓) |
| Testi e CV | titolo e frase della homepage, testo "Chi sono", email di contatto (IT/EN), caricamento del CV in PDF |
| Social | LinkedIn, GitHub, Instagram, email... con ordine |
| Competenze | nome e icona delle tecnologie, con ordine |

### Password dell'admin

- **Cambio da loggato:** pulsante **Cambia password** in alto nell'admin. Chiede la password attuale e una nuova di almeno 12 caratteri, salva il nuovo hash nel database (tabella `admin_credentials`) e chiude le sessioni aperte su altri browser o dispositivi.
- **Password dimenticata:** dal server, `docker compose exec portfolio npm run admin:reset-password` chiede una nuova password. Con `-- --random` la genera, con `-- --env` torna a valere quella del `.env`. In tutti i casi chiude tutte le sessioni.
- La password del `.env` (`ADMIN_PASSWORD_HASH`) vale finché non la cambi dal pannello.
- Nel sito, il pulsante **Accesso admin** è nel footer, sotto il nome.

### SEO e GEO

Il sito si fa trovare dai motori di ricerca classici (SEO) e da quelli generativi come ChatGPT, Perplexity, Claude e le risposte AI di Google (GEO). Tutto è generato dal database, quindi resta aggiornato a ogni modifica fatta dall'admin.

| Cosa | Dove | A cosa serve |
|---|---|---|
| Dati strutturati schema.org (JSON-LD) | in ogni pagina | dicono ai motori chi sei (Person: nome, lavoro, competenze, profili social), cos'è il sito e quali progetti hai (WebApplication), in italiano o in inglese |
| `title`, `description`, `canonical`, `hreflang` | in ogni pagina | risultato di ricerca corretto nelle due lingue |
| Open Graph e Twitter | in ogni pagina | anteprima con immagine quando si condivide il link (LinkedIn, WhatsApp, X…) |
| `/sitemap.xml` | generata | le due pagine con lingua e data dell'ultima modifica |
| `/robots.txt` | generato | sito aperto ai motori e ai crawler AI (GPTBot, ClaudeBot, PerplexityBot…), admin chiuso |
| `/llms.txt` | generato | il portfolio in Markdown, pensato per i modelli linguistici (standard llmstxt.org) |

Dopo la messa online conviene aggiungere il sito a Google Search Console e a Bing Webmaster Tools, inviando `https://mdfdev.net/sitemap.xml`.

### Lingue

- `/` è in italiano e `/en/` in inglese. Alla prima visita di `/`, un browser che preferisce l'inglese (e non ha l'italiano tra le lingue) viene mandato su `/en/`. Il selettore di lingua (`/lang/it`, `/lang/en`) salva la scelta in un cookie per un anno, e la scelta vince sulla lingua del browser.
- I testi fissi dell'interfaccia stanno in `src/i18n/it.ts` e `src/i18n/en.ts`.
- Progetti e testi della homepage hanno i campi in italiano e in inglese. Con `DEEPL_API_KEY` impostata (account gratuito su deepl.com, "API Free"), al salvataggio l'inglese viene generato quando l'italiano cambia o quando l'inglese manca. Se spunti "inglese corretto a mano", il testo inglese non viene più sovrascritto. Senza traduzione, `/en/` mostra il testo italiano.
- Nelle pagine ci sono `hreflang`, `canonical` e `Content-Language`, per i motori di ricerca.

Sicurezza: password con hash scrypt; sessione salvata in Postgres, cookie `HttpOnly` e `SameSite=Lax` (`Secure` in produzione), durata 7 giorni; protezione CSRF su ogni form; 5 tentativi di login sbagliati ogni 15 minuti per IP; pagine admin mai in cache e non indicizzate. Le immagini caricate vengono sempre ricodificate in WebP: un file che non è un'immagine viene rifiutato, e un SVG con script diventa un'immagine innocua. I CV vengono accettati solo se sono veri PDF.

Struttura:

```
src/
  server.ts          avvio del server e chiusura ordinata
  app.ts             applicazione Express (rotte, file statici, errori)
  config.ts          variabili d'ambiente validate all'avvio
  db.ts              client Prisma con driver pg
  routes/public.ts   pagine pubbliche
  views/             template EJS
prisma/
  schema.prisma      tabelle: projects, skills, socials, settings
  migrations/        migrazioni SQL versionate
  seed.ts            contenuti iniziali presi dal sito statico
infra/postgres/      stack del Postgres condiviso sul server
```

I file caricati (loghi, screenshot, CV) finiscono in `UPLOAD_DIR` (`./data/uploads` in sviluppo, il volume `portfolio_uploads` in produzione), che non è versionata. `photo/` e `docs/cv/` contengono il materiale iniziale usato dal seed. Il vecchio sito statico è nella cronologia di git, fino al commit `23a0d05`.

## 📝 Changelog

### Novembre 2026

- **11/11** - Dominio spostato da `mdfdev.xyz` a `mdfdev.net`:
  - Produzione: `PUBLIC_URL` già su `https://mdfdev.net` (canonical, hreflang, sitemap, dati strutturati, anteprime social); link di QRator, ShoppyList e MDK Manager aggiornati nel database
  - `www.mdfdev.net` rimanda con un 301 a `mdfdev.net` (un solo indirizzo per i motori di ricerca); `mdfdev.xyz` rimanda già a `mdfdev.net` da Cloudflare
  - Codice, seed, test e documentazione aggiornati

- **11/11** - Email di contatto cambiata in `mdfdev08@gmail.com`, come negli altri progetti: Zoho Mail (`contact@mdfdev.xyz`) è stato dismesso. Aggiornati il database di produzione (email di contatto e link email), il seed e i test

- **10/11** - "Accesso admin" diventa un pulsante visibile (con lucchetto) nel footer, sotto il nome; prima era un link grigio nella riga del copyright

- **10/11** - Fasi 6 e 7: il nuovo portfolio è online
  - Container Docker `portfolio` (migrazioni e seed all'avvio, healthcheck) al posto del sito statico; Nginx Proxy Manager invariato
  - Login dietro Cloudflare: lo schema https letto da `CF-Visitor` (Cloudflare è in SSL "Flexible")
  - Email non più offuscata da Cloudflare (`email_off`): il pulsante "Scrivimi una email" funziona anche senza JavaScript
  - Backup notturno dei file caricati (03:40) accanto a quello del database (03:30), con ripristino provato
  - Verifica finale indipendente: pagine, SEO/GEO, sicurezza, prestazioni (circa 470 KB), server e repository tutti PASS

- **10/11** - SEO, GEO, accesso e password:
  - Dati strutturati schema.org (persona, sito, pagina profilo, progetti), Open Graph e Twitter completi
  - `/sitemap.xml`, `/robots.txt` (aperto ai crawler AI, admin chiuso) e `/llms.txt`, generati dal database
  - Link "Accesso admin" nel footer; pagina **Cambia password** nell'admin; script `admin:reset-password` per la password dimenticata
  - Limite ai tentativi di login sull'IP reale del visitatore (il sito passa da Cloudflare) e limite globale
  - Verificata l'email `contact@mdfdev.xyz`: MX, SPF e DKIM di Zoho corretti; manca DMARC
  - 52 test automatici; controllo finale di tasteskill superato

- **10/11** - Fase 5, correzione per le finestre reali del browser:
  - Su un Mac (finestre 1512×780, 1366×620) il nome grande del footer copriva i link e le card dei progetti finivano sotto la sezione dopo
  - Ora le sezioni sono alte almeno uno schermo e crescono con il contenuto; nome, screenshot e prima schermata si adattano anche all'altezza
  - Verificato su 18 dimensioni, dai telefoni da 320px ai monitor da 2560px; controllo finale di tasteskill ancora superato

- **09/11** - Fase 5, nuova homepage con tasteskill (in revisione):
  - Tre bozze grafiche (`docs/rifacimento/mockup-*.jpg`), scelta la A "caldo editoriale" con i colori del logo
  - Homepage costruita sul sistema di tasteskill: prima schermata con il lavoro vero, griglia dei progetti con screenshot, "Chi sono" su fascia scura con il ritratto, chiusura con il pulsante email
  - Font ospitati in locale, compressione gzip, immagini in WebP con versioni ridotte: 366 KiB in tutto
  - Admin: scelta dell'immagine della prima schermata e del progetto citato; titolo al massimo 45 caratteri
  - Seed: testi nuovi in italiano e inglese, screenshot reali, icone ufficiali delle tecnologie (aggiunto PostgreSQL), MDK Manager in bozza
  - Controllo finale di tasteskill superato (GATE: PASS); dettagli in `docs/rifacimento/DESIGN.md`
- **09/11** - Fase 4, italiano e inglese:
  - Homepage su `/` (IT) e `/en/` (EN), scelta automatica dalla lingua del browser e selettore che la ricorda
  - Testi fissi in `src/i18n`, contenuti dal DB con ripiego sull'italiano quando manca l'inglese
  - Traduzione DeepL al salvataggio di progetti e testi; l'inglese corretto a mano non viene sovrascritto
  - `hreflang`, `canonical`, `Content-Language`; pagina 404 nella lingua giusta
  - 41 test automatici
- **09/11** - Fase 3, area admin:
  - Login con utente e password (hash scrypt), sessioni in Postgres, CSRF, limite ai tentativi, header di sicurezza con helmet
  - Gestione progetti: creazione, modifica, bozza/pubblicato, riordino, eliminazione con conferma, caricamento di logo e screenshot (convertiti in WebP)
  - Gestione di testi della homepage, CV in PDF, social e competenze
  - Servizio di traduzione automatica DeepL già collegato al salvataggio (si attiva con `DEEPL_API_KEY`)
  - Logo e favicon esportati in versioni leggere (`public/assets/brand`, 2-12 KB invece di circa 700 KB)
  - 31 test automatici (`npm test`): accesso, CSRF, progetti, upload, riordino, contenuti, sicurezza, traduzione
- **09/11** - Fase 2, scheletro dell'app:
  - Progetto Node + TypeScript con Express 5, EJS, Prisma 7 (driver `pg`) e validazione della configurazione con zod
  - Schema del database e migrazione iniziale: progetti (con bozza/pubblicato, ordine, anno, tag, screenshot, testi IT/EN), competenze, social, impostazioni
  - Seed con i 4 progetti, le competenze, i social, i testi e il CV del sito attuale; loghi PNG convertiti in WebP da 256px
  - Pagina provvisoria che legge i dati dal database, `/healthz` per il controllo di salute, pagine 404 e 500
- **09/11** - Fase 1, Postgres condiviso:
  - Nuovo stack `infra/postgres` (PostgreSQL 17, container `pg-shared`, rete `db-net`), raggiungibile solo dal server e via tunnel SSH
  - Script `new-project-db.sh` per creare database e utente di ogni progetto, isolati tra loro
  - Creato il database `portfolio`
  - Backup notturno con controllo di integrità e conservazione di 7 giorni; ripristino provato
- **09/11** - Fase 0, messa in sicurezza del sito attuale:
  - Aggiunto `.dockerignore`: nell'immagine nginx finiscono solo i file del sito, non più `.git`, README e Dockerfile
  - Container ridistribuito con riavvio automatico (`--restart unless-stopped`)
  - Attivato il firewall Hetzner Cloud: in entrata solo SSH, HTTP, HTTPS e Tailscale
  - Documentazione del server in `docs/infra/SERVER.md`
- **09/11** - Pianificazione del rifacimento:
  - Analisi del sito attuale e del server
  - Definiti requisiti, architettura e fasi in `docs/rifacimento/PIANO.md`
  - Aggiunto `.gitignore` (stato locale degli strumenti, `node_modules`, `.env`)

### Febbraio 2026

- **27/02** - Aggiunto nuovo progetto: MDKManager

### Marzo 2025

- **19/03** - Aggiunto nuovo progetto: ShoppyList

### Novembre 2024

- **27/11** - Aggiunto nuovo progetto: QRator
- **14/11** - Fix media query per la sezione Progetti e vari altri miglioramenti
- **13/11** - Aggiunto logo, CV, link social ed email. Implementato Dockerfile
- **12/11** - Aggiornamento UI/UX:
  - Sistemato il CSS
  - Aggiunto effetto typing
  - Aggiunte icone nella cartella dedicata
  - Abbozzato il sito
- **12/11** - Ristrutturazione del sito:
  - Creata struttura cartelle
  - Revisionato HTML e CSS

### Ottobre 2024

- **27/10** - Creata base del portfolio:
  - Aggiunta immagine
  - Implementata base del CSS
- **26/10** - Pianificazione iniziale:
  - Definizione colori per il portfolio
  - Progettazione su Excalidraw
- **16/10** - Creazione repository e primo commit

---
