// Test della traduzione automatica, con DeepL simulato.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createTranslator } from "../src/services/translate";

function fakeDeepl(handler: (texts: string[]) => string[] | Error) {
  const calls: string[][] = [];
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    const texts = (JSON.parse(String(init?.body)) as { text: string[] }).text;
    calls.push(texts);
    const out = handler(texts);
    if (out instanceof Error) return new Response("errore", { status: 503 });
    return Response.json({ translations: out.map((text) => ({ text })) });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const it = { title: "Ciao", description: "Una descrizione" };
const upper = (texts: string[]) => texts.map((t) => `EN:${t}`);

test("traduce i campi quando manca l'inglese", async () => {
  const { fetchImpl, calls } = fakeDeepl(upper);
  const t = createTranslator("chiave:fx", fetchImpl);
  const r = await t.englishFor(it, { title: null, description: null }, { manual: false, previousIt: null });
  assert.deepEqual(r.values, { title: "EN:Ciao", description: "EN:Una descrizione" });
  assert.equal(calls.length, 1);
});

test("inglese corretto a mano: non viene toccato", async () => {
  const { fetchImpl, calls } = fakeDeepl(upper);
  const t = createTranslator("chiave:fx", fetchImpl);
  const r = await t.englishFor(it, { title: "Hello", description: "Mine" }, { manual: true, previousIt: { title: "Vecchio", description: "Vecchia" } });
  assert.deepEqual(r.values, { title: "Hello", description: "Mine" });
  assert.equal(calls.length, 0);
});

test("ritraduce solo il campo italiano cambiato", async () => {
  const { fetchImpl, calls } = fakeDeepl(upper);
  const t = createTranslator("chiave:fx", fetchImpl);
  const r = await t.englishFor(
    { title: "Ciao", description: "Nuova descrizione" },
    { title: "Hello", description: "Old description" },
    { manual: false, previousIt: { title: "Ciao", description: "Vecchia descrizione" } },
  );
  assert.deepEqual(r.values, { title: "Hello", description: "EN:Nuova descrizione" });
  assert.deepEqual(calls, [["Nuova descrizione"]]);
});

test("senza chiave DeepL: salva comunque e avvisa", async () => {
  const t = createTranslator(undefined);
  const r = await t.englishFor(it, { title: null, description: null }, { manual: false, previousIt: null });
  assert.deepEqual(r.values, { title: null, description: null });
  assert.match(r.warning ?? "", /non è configurata/);
});

test("DeepL non risponde: salva comunque e avvisa", async () => {
  const { fetchImpl } = fakeDeepl(() => new Error("giù"));
  const t = createTranslator("chiave:fx", fetchImpl);
  const r = await t.englishFor(it, { title: "Hello", description: null }, { manual: false, previousIt: null });
  assert.deepEqual(r.values, { title: "Hello", description: null });
  assert.match(r.warning ?? "", /non è riuscita/);
});

test("chiave Free usa l'endpoint api-free", async () => {
  let url = "";
  const fetchImpl = (async (u: unknown) => {
    url = String(u);
    return Response.json({ translations: [{ text: "x" }, { text: "y" }] });
  }) as typeof fetch;
  await createTranslator("abc:fx", fetchImpl).englishFor(it, { title: null, description: null }, { manual: false, previousIt: null });
  assert.equal(url, "https://api-free.deepl.com/v2/translate");
});
