// File: scripts.js

// Seleziona tutti i link della navbar e le sezioni
const navLinks = document.querySelectorAll("#navbar a");
const sections = document.querySelectorAll("section");

// Funzione per attivare il link della navbar in base alla sezione visualizzata
function activateNavLink() {
  let index = sections.length;

  while (--index && window.scrollY + 50 < sections[index].offsetTop) {}

  navLinks.forEach((link) => link.classList.remove("active"));
  navLinks[index].classList.add("active");
}

// Funzione per aprire/chiudere il menu a hamburger
function toggleMenu() {
  const navLinks = document.querySelector("#navbar ul");
  navLinks.classList.toggle("active");
}

// Chiude il menu quando si clicca su un link
function closeMenu() {
  const navLinks = document.querySelector("#navbar ul");
  navLinks.classList.remove("active");
}

// Ascoltatore di eventi per chiudere il menu quando si clicca su un link
document.querySelectorAll("#navbar a").forEach((link) => {
  link.addEventListener("click", closeMenu);
});

// Aggiunge la classe 'active' al link corrispondente
window.addEventListener("scroll", activateNavLink);
