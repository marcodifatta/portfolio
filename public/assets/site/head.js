// Righe richieste dal kit tasteskill prima del primo disegno (in un file: la CSP non permette script inline).
// m-enter: l'entrata della prima schermata; mo-js: i "moments" (picture-develops). Se uno script tarda,
// i timer mostrano comunque tutto.
document.documentElement.classList.add("m-enter", "mo-js");
setTimeout(() => document.documentElement.classList.add("m-enter-done"), 700);
setTimeout(() => document.documentElement.classList.add("mo-safe"), 2500);
