// Fixed interface copy in English. Phase 5 (design) reviews and completes it.
import type { Messages } from "./it";

export const en: Messages = {
  htmlLang: "en",
  locale: "en_GB",
  siteTitle: "Marco Di Fatta · Web developer",
  metaDescription:
    "Marco Di Fatta's portfolio: web apps built and shipped, from a digital pizzeria menu to a management tool for guesthouses.",
  nav: { projects: "Projects", about: "About", skills: "Skills", contact: "Contact" },
  projects: { title: "Projects", open: "Open the project", empty: "Projects are coming soon." },
  about: { title: "About me" },
  skills: { title: "Skills" },
  contact: { title: "Contact", cv: "Download my CV", email: "Email me" },
  langSwitch: { label: "Italiano", href: "/", hreflang: "it", aria: "Leggi il sito in italiano" },
  footer: "All rights reserved.",
  notFound: { title: "Page not found", body: "This page doesn't exist.", back: "Back to the homepage" },
};
