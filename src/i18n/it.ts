// Testi fissi dell'interfaccia in italiano. I contenuti (titolo, presentazione, progetti) arrivano dal DB.
// {n} e {year} vengono sostituiti con i numeri reali (progetti pubblicati, anno del primo).
export const it = {
  htmlLang: "it",
  locale: "it_IT",
  skip: "Vai al contenuto",
  siteTitle: "Marco Di Fatta: web app su misura per piccole attività",
  metaDescription:
    "Il portfolio di Marco Di Fatta, sviluppatore web: le web app che ho progettato e messo online, ognuna da aprire e provare.",
  nav: { label: "Menu principale", projects: "Progetti", about: "Chi sono", menu: "Menu" },
  hero: {
    notice: "{n} web app online dal {year}",
    noticeOne: "1 web app online dal {year}",
    floatLabel: "Online",
    cv: "Scarica il CV",
  },
  mainAction: "Scrivimi una email",
  projects: {
    title: "Progetti online.",
    titleMuted: "Ognuno si apre nel sito vero.",
    open: "Apri {name} in una nuova scheda",
    empty: "Il primo progetto arriva a breve.",
  },
  about: { title: "Chi sono", skills: "Tecnologie che uso", linkedin: "Il mio profilo su LinkedIn" },
  close: {
    title: "Una web app per la tua attività",
    line: "Scrivimi cosa ti serve: rispondo all'indirizzo {email}.",
  },
  footer: {
    lede: "Web app su misura, dall'idea alla messa online.",
    site: "Sito",
    social: "Social",
    documents: "Documenti",
    language: "Lingua",
    rights: "Tutti i diritti riservati.",
    admin: "Accesso admin",
    iconsCredit: "Loghi delle tecnologie: SVG Logos e VSCode Icons. I nomi sono marchi dei rispettivi proprietari.",
  },
  langSwitch: { label: "English", href: "/lang/en", hreflang: "en", aria: "Read this site in English" },
  notFound: { title: "Pagina non trovata", body: "Questa pagina non esiste.", back: "Torna alla homepage" },
};

type Deep<T> = { [K in keyof T]: T[K] extends string ? string : Deep<T[K]> };
export type Messages = Deep<typeof it>;
