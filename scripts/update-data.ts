// Atualiza data/polls.json a partir da API da Wikipedia.
// Uso: npm run update-data   (roda diariamente pela GitHub Action)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { GENERIC_BALLOT_PAGE, RACES, wikiUrl } from "../lib/races";
import type { Dataset, RaceData } from "../lib/types";
import { parseGenericBallotPage, parseRacePage } from "./wiki-parse";

const OUT = path.join(process.cwd(), "data", "polls.json");
// A Wikimedia pede um User-Agent com forma de contato: defina WIKI_CONTACT (URL do repo ou e-mail).
const UA = `painel-eleicoes-eua/0.1 (${process.env.WIKI_CONTACT ?? "sem-contato"})`;
const CONCURRENCY = 4;

async function fetchPageHtml(page: string): Promise<string> {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "parse",
    page,
    prop: "text",
    format: "json",
    formatversion: "2",
    redirects: "1",
    disablelimitreport: "1",
    disableeditsection: "1",
  }).toString();
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Api-User-Agent": UA } });
    if (res.ok) {
      const json = (await res.json()) as { parse?: { text: string }; error?: { info: string } };
      if (json.error) throw new Error(json.error.info);
      return json.parse!.text;
    }
    if (attempt >= 3) throw new Error(`HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
}

async function loadPrevious(): Promise<Dataset | null> {
  try {
    return JSON.parse(await readFile(OUT, "utf8")) as Dataset;
  } catch {
    return null;
  }
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length) await fn(queue.shift()!);
  }));
}

async function main() {
  const prev = await loadPrevious();
  const now = new Date().toISOString();
  const races: Record<string, RaceData> = {};
  let ok = 0;
  let failed = 0;

  await pool(RACES, CONCURRENCY, async (race) => {
    const source = wikiUrl(race.wikiPage);
    try {
      const html = await fetchPageHtml(race.wikiPage);
      const parsed = parseRacePage(html);
      races[race.id] = { ...parsed, source, fetchedAt: now };
      ok++;
      console.log(`✓ ${race.id}: ${parsed.polls.length} pesquisas`);
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`✗ ${race.id}: ${message}`);
      // Mantém o último dado bom em vez de apagar a disputa.
      const old = prev?.races[race.id];
      races[race.id] = old ? { ...old, error: message } : { candidates: [], polls: [], source, fetchedAt: now, error: message };
    }
  });

  let genericBallot = prev?.genericBallot ?? null;
  try {
    const html = await fetchPageHtml(GENERIC_BALLOT_PAGE);
    genericBallot = { ...parseGenericBallotPage(html), source: wikiUrl(GENERIC_BALLOT_PAGE), fetchedAt: now };
    console.log(`✓ voto genérico: ${genericBallot.polls.length} pesquisas`);
  } catch (err) {
    console.warn(`✗ voto genérico: ${err instanceof Error ? err.message : err}`);
  }

  const dataset: Dataset = {
    generatedAt: now,
    license: "Dados de pesquisas extraídos da Wikipedia em inglês (CC BY-SA 4.0).",
    races: Object.fromEntries(Object.entries(races).sort(([a], [b]) => a.localeCompare(b))),
    genericBallot,
  };
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(dataset, null, 1) + "\n");
  console.log(`\n${ok} disputas atualizadas, ${failed} com erro.`);
  // Falha o job só se quase tudo quebrou (ex.: API fora), para não publicar dado vazio.
  if (ok < RACES.length / 2) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
