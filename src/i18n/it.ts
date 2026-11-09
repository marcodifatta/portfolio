// Testi fissi dell'interfaccia in italiano. La Fase 5 (grafica) li rivede e li completa.
export const it = {
  htmlLang: "it",
  locale: "it_IT",
  siteTitle: "Marco Di Fatta · Sviluppatore web",
  metaDescription:
    "Portfolio di Marco Di Fatta: web app costruite e messe online, dal menù digitale per pizzeria al gestionale per strutture ricettive.",
  nav: { projects: "Progetti", about: "Chi sono", skills: "Competenze", contact: "Contatti" },
  projects: { title: "Progetti", open: "Apri il progetto", empty: "I progetti arrivano a breve." },
  about: { title: "Chi sono" },
  skills: { title: "Competenze" },
  contact: { title: "Contatti", cv: "Scarica il CV", email: "Scrivimi" },
  langSwitch: { label: "English", href: "/en/", hreflang: "en", aria: "Read this site in English" },
  footer: "Tutti i diritti riservati.",
  notFound: { title: "Pagina non trovata", body: "Questa pagina non esiste.", back: "Torna alla homepage" },
};

export type Messages = {
  [K in keyof typeof it]: (typeof it)[K] extends string ? string : { [P in keyof (typeof it)[K]]: string };
};
