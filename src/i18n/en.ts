// Fixed interface copy in English. Content (title, intro, projects) comes from the database.
import type { Messages } from "./it";

export const en: Messages = {
  htmlLang: "en",
  locale: "en_GB",
  skip: "Skip to content",
  siteTitle: "Marco Di Fatta: custom web apps for small businesses",
  metaDescription:
    "The portfolio of Marco Di Fatta, web developer: the web apps I designed and put online, each one ready to open and try.",
  nav: { label: "Main menu", projects: "Projects", about: "About", menu: "Menu" },
  hero: {
    notice: "{n} web apps live since {year}",
    noticeOne: "1 web app live since {year}",
    floatLabel: "Live",
    cv: "Download my CV",
  },
  mainAction: "Email me",
  projects: {
    title: "Projects online.",
    titleMuted: "Each one opens the real site.",
    open: "Open {name} in a new tab",
    empty: "The first project is on its way.",
  },
  about: { title: "About me", skills: "Tools I use", linkedin: "My LinkedIn profile" },
  close: {
    title: "A web app for your business",
    line: "Tell me what you need: I reply from {email}.",
  },
  footer: {
    lede: "Custom web apps, from the idea to going live.",
    site: "Site",
    social: "Social",
    documents: "Documents",
    language: "Language",
    rights: "All rights reserved.",
    admin: "Admin login",
    iconsCredit: "Technology logos: SVG Logos and VSCode Icons. Names are trademarks of their owners.",
  },
  langSwitch: { label: "Italiano", href: "/lang/it", hreflang: "it", aria: "Leggi il sito in italiano" },
  notFound: { title: "Page not found", body: "This page doesn't exist.", back: "Back to the homepage" },
};
