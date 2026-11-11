# Design della homepage (Fase 5, tasteskill)

La homepage è costruita con [tasteskill](https://tasteskill.dev): un sistema di regole e controlli per siti professionali. Questa pagina riassume le scelte, così chi modifica la pagina sa cosa tenere.

## Il piano

| Riga | Valore |
|---|---|
| Tipo | `service` (un professionista che si assume), site-kind `other`: niente effetti 3D, conta il lavoro vero |
| Prima schermata | `split`: testo a sinistra (5 colonne), immagine a destra (6 colonne) con una scheda "Online · anno · progetto" |
| Palette | dai colori del logo (`start.mjs brand`): fondo crema `#f7f2ef`, inchiostro marrone `#2a0b08`, azione `#5a1a12` |
| Font | Instrument Serif per i titoli e Instrument Sans per il testo, ospitati in locale (`public/assets/fonts`) |
| Menu | `nav-split`: parole a sinistra, logo e nome al centro, lingua e pulsante a destra |
| Ritmo | una fascia scura (`dark-band`) per "Chi sono" |
| Pulsanti | `tonal` |
| Chiusura | `close-word`: titolo e pulsante, poi il nome scritto in grande |
| Footer | `footer-columns`: Sito, Social, Documenti, Lingua |
| Momento | `picture-develops` (look "film"): il ritratto si sviluppa come una stampa entrando nello schermo |

Ri-distribuiti per regola: `footer-visit` (richiede un indirizzo) e la chiusura `close-photo` (richiede una seconda fotografia).

## Le sezioni

1. **Prima schermata.** Titolo e frase arrivano dall'admin (Testi e CV). L'immagine si sceglie nell'admin (Prima schermata); senza immagine c'è lo screenshot del primo progetto. La riga "N web app online dal ANNO" si calcola dai progetti pubblicati.
2. **Progetti.** Una card per ogni progetto pubblicato, con screenshot, logo, nome, descrizione, anno e tecnologie, che apre il sito vero. Sono 3 per riga, 4 per riga con 4, 7 o 8 progetti; oltre una riga la sezione occupa due schermate.
3. **Chi sono.** Il testo dall'admin, il link a LinkedIn, le icone ufficiali delle tecnologie (SVG Logos e VSCode Icons) e il ritratto.
4. **Contatti e footer.** Pulsante email, nome in grande, link, CV, lingua.

## Voce dei testi

Tecnica e asciutta, in prima persona ("progetto, sviluppo e metto online"), con fatti veri al posto degli aggettivi: anni, nomi dei progetti, cosa fanno. Niente slogan e niente cifre inventate.

## Regole da rispettare quando si modifica

- **Titolo della prima schermata: massimo 45 caratteri** (l'admin lo impone), altrimenti va su quattro righe.
- **Ogni sezione è alta una o due schermate quando il contenuto ci sta**, e cresce quando la finestra è più bassa. Non tornare ad altezze fisse: vedi "Finestre reali" qui sotto. Le regole sono in `public/assets/site/site.css`.
- **Screenshot dei progetti in orizzontale (16:10).** L'admin crea anche una versione ridotta per telefono e griglia.
- **Il kit sta in `public/assets/kit`.** Non va modificato: le correzioni vanno in `site.css`.

## Finestre reali (correzione del 10/11/2026)

Tasteskill progetta su 1440×900, ma nel browser di un Mac la finestra è più bassa. A 1512×780 e a 1366×620 il nome grande del footer finiva sopra i link, e a 1366×620 le card dei progetti finivano sotto "Chi sono". Ora:

- Da 1280px in su **ogni sezione è alta almeno uno schermo e cresce con il contenuto**, come il kit fa già sotto i 1280px. A 1440×900 non cambia nulla.
- **Il nome grande del footer** ha una dimensione calcolata su larghezza e altezza della finestra, e la sua riga non si comprime mai sotto il contenuto.
- **Gli screenshot dei progetti si abbassano** nelle finestre basse.
- **La prima schermata cresce** nelle finestre basse e nel telefono in orizzontale, così i pulsanti restano interi.

Verificato con uno script che misura ogni elemento contro la sua sezione: nessun elemento fuori sezione, nome mai sopra i link, nessuno scorrimento orizzontale. Lo script è stato verificato a sua volta: con la vecchia regola trova il difetto. Dimensioni provate:

- desktop: 1280×560, 1280×650, 1366×620, 1440×760, 1440×900, 1512×780, 1728×1000, 1920×940, 2560×1300;
- tablet: 1180×820, 1024×640, 1024×768, 820×1180, 768×1024 (anche in inglese);
- telefono: 844×390, 390×844, 360×640, 320×568.

## Controlli (09-10/11/2026)

| Controllo | Esito |
|---|---|
| `gate.mjs` (controllo finale) | **GATE: PASS** |
| `copy-lint` IT e EN | 0 FAIL, 0 WARN |
| `layout/check.mjs` (1440, 1024, 820x1180, 768x1024, 390) | nessuna segnalazione |
| `perf.mjs` | 0 FAIL: 366 KiB in tutto (prima circa 1,5 MB), layout shift 0 |

WARN tenuti, con il motivo:
- `copy-buttons`: "Scrivimi una email" e "Scarica il CV" sono verbi italiani, ma il controllo conosce solo quelli inglesi.
- `copy-headings` sui nomi dei progetti (QRator): è il nome del prodotto, e la descrizione dice cosa fa.
- `photo-set`: gli screenshot sono interfacce reali, con chiari e scuri diversi.
- `button-contrast` sul pulsante secondario: è lo stile `tonal` del kit.
- `scroll-reveal` sul ritratto: è il momento previsto.
- `action-repeat`: il pulsante del menu e quello della prima schermata, ammessi dal kit.
- `section-gaps`: gli spazi tra le sezioni variano un po' tra fondo chiaro e fascia scura.

## Da fare per Marco

- **Tag delle tecnologie di ogni progetto:** dall'admin. Non li ho inventati.
- **Screenshot più rappresentativi di ShoppyList e QRator:** quelli attuali mostrano solo le pagine iniziali.
- **MDK Manager** è in bozza finché `mdkmanager.mdfdev.net` non torna online (il 09/11/2026 il DNS non risolveva).
