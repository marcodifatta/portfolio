# My Personal Portfolio

Questo è il repository del mio portfolio personale, creato dopo aver completato il mio primo progetto (www.pizzabakery.biz). Il portfolio è stato sviluppato per mostrare i miei progetti e le mie competenze.

## 🚧 Rifacimento in corso (novembre 2026)

Il sito statico attuale sta per essere sostituito da un portfolio con **area admin** per gestire i progetti senza toccare il codice.

- **Stack:** Node 22 + Express + EJS, PostgreSQL (istanza condivisa sul server), Prisma, Docker Compose
- **Admin (`/admin`):** login con username e password; gestione di progetti (logo, titolo, descrizione, link, anno, tag, screenshot, bozza/pubblicato, ordine), testo Chi sono, CV, social e competenze
- **Lingue:** italiano su `/` e inglese su `/en/`, con traduzione automatica (DeepL) correggibile dall'admin
- **Grafica:** costruita con tasteskill, mantenendo il logo attuale e i suoi colori
- **Deploy:** `git pull && docker compose up -d --build`

Il piano completo, con fasi e criteri di verifica, è in [docs/rifacimento/PIANO.md](docs/rifacimento/PIANO.md).

## 📝 Changelog

### Novembre 2026

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
