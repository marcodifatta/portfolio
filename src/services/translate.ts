// Traduzione automatica IT → EN con DeepL (piano gratuito: 500.000 caratteri al mese).
//
// Regole:
// - se l'inglese è segnato "corretto a mano" non viene mai toccato;
// - altrimenti si traduce quando l'italiano è cambiato o quando manca l'inglese;
// - se DeepL non è configurato o non risponde il salvataggio va avanti comunque:
//   l'inglese resta com'era e l'admin vede un avviso.

type Texts = Record<string, string>;
type MaybeTexts<T extends Texts> = { [K in keyof T]: string | null };

export type TranslateResult<T extends Texts> = { values: MaybeTexts<T>; warning?: string };

export interface Translator {
  readonly enabled: boolean;
  englishFor<T extends Texts>(
    it: T,
    currentEn: MaybeTexts<T>,
    opts: { manual: boolean; previousIt: T | null },
  ): Promise<TranslateResult<T>>;
}

type FetchLike = typeof fetch;

export function createTranslator(apiKey: string | undefined, fetchImpl: FetchLike = fetch): Translator {
  const endpoint = apiKey?.endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";

  async function deepl(texts: string[]): Promise<string[]> {
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: texts, source_lang: "IT", target_lang: "EN-GB", preserve_formatting: true }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`DeepL ha risposto ${res.status}`);
    const json = (await res.json()) as { translations?: { text: string }[] };
    if (!json.translations || json.translations.length !== texts.length) throw new Error("Risposta DeepL inattesa");
    return json.translations.map((t) => t.text);
  }

  return {
    enabled: Boolean(apiKey),

    async englishFor(it, currentEn, { manual, previousIt }) {
      if (manual) return { values: currentEn };

      const keys = Object.keys(it) as (keyof typeof it & string)[];
      const toTranslate = keys.filter((k) => {
        const source = it[k] ?? "";
        if (source.trim() === "") return false;
        const changed = !previousIt || previousIt[k] !== source;
        return changed || !currentEn[k];
      });
      if (toTranslate.length === 0) return { values: currentEn };

      if (!apiKey) {
        const missing = toTranslate.some((k) => !currentEn[k]);
        return {
          values: currentEn,
          warning: missing
            ? "Salvato. La traduzione automatica non è configurata (DEEPL_API_KEY): la versione inglese mostrerà l'italiano finché non la scrivi."
            : undefined,
        };
      }

      try {
        const translated = await deepl(toTranslate.map((k) => it[k]!));
        const values = { ...currentEn };
        toTranslate.forEach((k, i) => {
          values[k] = translated[i] ?? null;
        });
        return { values };
      } catch (err) {
        console.error("Traduzione automatica non riuscita:", err);
        return {
          values: currentEn,
          warning: "Salvato, ma la traduzione automatica non è riuscita: controlla o scrivi a mano il testo inglese.",
        };
      }
    },
  };
}
