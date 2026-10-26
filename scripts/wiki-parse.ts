// Parser das tabelas de pesquisa das páginas de eleição da Wikipedia (HTML do action=parse).
// Funções puras: recebem HTML e devolvem dados normalizados, para poderem ser testadas offline.
import * as cheerio from "cheerio";
import type { Candidate, Party, Poll, Population } from "../lib/types";

type $Root = cheerio.CheerioAPI;
type Cell = { text: string; isHeader: boolean; style: string; html: string };

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

// Cores usadas pela Wikipedia nas barras de partido.
const PARTY_COLORS: Record<string, Party> = {
  "3333ff": "D", "0015bc": "D", "e81b23": "R", "ff0000": "R",
  "fed105": "L", "17aa5c": "G", "dcdcdc": "I",
};

export function clean(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, "") // notas de rodapé [a] [12]
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeParty(text: string): Party | null {
  const t = text.toLowerCase();
  if (/\(d\)|democrat/.test(t)) return "D";
  if (/\(r\)|republican/.test(t)) return "R";
  if (/\(l\)|libertarian/.test(t)) return "L";
  if (/\(g\)|green/.test(t)) return "G";
  if (/\(i\)|independent/.test(t)) return "I";
  return null;
}

function partyFromStyle(style: string): Party | null {
  const m = style.match(/background(?:-color)?\s*:\s*#?([0-9a-f]{6})/i);
  return m ? PARTY_COLORS[m[1].toLowerCase()] ?? null : null;
}

export function parsePercent(text: string): number | null {
  const t = clean(text);
  if (!t || /^[–—-]+$/.test(t)) return null;
  const m = t.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return v >= 0 && v <= 100 ? v : null;
}

export function parseSample(text: string): { size: number | null; population: Population } {
  const t = clean(text);
  const size = t.match(/(\d[\d,]*)/);
  const pop = t.match(/\b(LV|RV|A|V)\b/);
  return {
    size: size ? parseInt(size[1].replace(/,/g, ""), 10) : null,
    population: (pop?.[1] as Population) ?? null,
  };
}

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function findMonth(s: string): number | null {
  const m = s.toLowerCase().match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?/);
  return m ? MONTHS[m[1]] : null;
}

function findDay(s: string): number | null {
  const nums = [...s.matchAll(/\b(\d{1,2})\b/g)].map((m) => parseInt(m[1], 10));
  return nums.find((n) => n >= 1 && n <= 31) ?? null;
}

/** "September 28 – October 2, 2026", "Oct 3–5, 2026", "October 5, 2026" */
export function parseDateRange(text: string, fallbackYear: number): { start: string | null; end: string | null } {
  const t = clean(text).replace(/[‐-―−-]/g, "–");
  const years = [...t.matchAll(/\b(20\d\d)\b/g)].map((m) => parseInt(m[1], 10));
  const endYear = years.at(-1) ?? fallbackYear;
  const noYears = t.replace(/\b20\d\d\b/g, "");
  const parts = noYears.split(/\s*–\s*/).filter(Boolean);
  if (!parts.length) return { start: null, end: null };

  const first = parts[0];
  const last = parts.at(-1)!;
  const endMonth = findMonth(last) ?? findMonth(first);
  const endDay = findDay(last);
  if (!endMonth || !endDay) return { start: null, end: null };
  const end = iso(endYear, endMonth, endDay);
  if (parts.length === 1) return { start: end, end };

  const startMonth = findMonth(first) ?? endMonth;
  const startDay = findDay(first);
  if (!startDay) return { start: null, end };
  const startYear = years.length > 1 ? years[0] : startMonth > endMonth ? endYear - 1 : endYear;
  return { start: iso(startYear, startMonth, startDay), end };
}

/** Expande rowspan/colspan em uma grade retangular. */
export function tableGrid($: $Root, table: cheerio.Cheerio<any>): Cell[][] {
  const grid: Cell[][] = [];
  const rows = table.children("tbody, thead").children("tr").toArray();
  const directRows = table.children("tr").toArray();
  rows.push(...directRows);
  rows.forEach((tr, r) => {
    grid[r] ??= [];
    let c = 0;
    $(tr)
      .children("th, td")
      .each((_, el) => {
        while (grid[r][c]) c++;
        const $el = $(el);
        $el.find("br").replaceWith(" ");
        $el.find("style, .sortkey, .reference").remove();
        const cell: Cell = {
          text: clean($el.text()),
          isHeader: el.tagName === "th",
          style: $el.attr("style") ?? "",
          html: $el.html() ?? "",
        };
        const rs = Math.min(parseInt($el.attr("rowspan") ?? "1", 10) || 1, 50);
        const cs = Math.min(parseInt($el.attr("colspan") ?? "1", 10) || 1, 50);
        for (let i = 0; i < rs; i++) {
          grid[r + i] ??= [];
          for (let j = 0; j < cs; j++) grid[r + i][c + j] = cell;
        }
        c += cs;
      });
  });
  return grid;
}

type ColRole = "pollster" | "date" | "sample" | "moe" | "other" | "undecided" | "lead" | "candidate";

export interface ParsedTable {
  columns: { name: string; role: ColRole; party: Party | null }[];
  polls: Poll[];
}

function roleOf(name: string): ColRole {
  const n = name.toLowerCase();
  if (/^(poll source|pollster)/.test(n)) return "pollster";
  if (/^dates?\b|^date\(s\)|^fieldwork/.test(n)) return "date";
  if (/^sample/.test(n)) return "sample";
  if (/^margin of error|^moe\b/.test(n)) return "moe";
  if (/^other|^others/.test(n)) return "other";
  if (/undecided|unsure|don.t know|no opinion/.test(n)) return "undecided";
  if (/^(lead|margin)$/.test(n)) return "lead";
  return "candidate";
}

export function candidateLabel(name: string): string {
  return clean(name.replace(/\((D|R|I|L|G|DFL|Ind\.?)\)/gi, ""));
}

export function parsePollTable($: $Root, table: cheerio.Cheerio<any>, fallbackYear: number): ParsedTable | null {
  const grid = tableGrid($, table);
  const headerIdx = grid.findIndex((row) => row?.some((c) => c?.isHeader && /poll source|pollster/i.test(c.text)));
  if (headerIdx < 0) return null;

  // Linhas de cabeçalho consecutivas (a segunda costuma trazer a barra de cor do partido).
  let end = headerIdx;
  while (grid[end + 1] && grid[end + 1].every((c) => !c || c.isHeader)) end++;
  const width = Math.max(...grid.slice(headerIdx, end + 1).map((r) => r.length));

  const columns = Array.from({ length: width }, (_, c) => {
    const cells = grid.slice(headerIdx, end + 1).map((r) => r[c]).filter(Boolean);
    const uniq = [...new Set(cells)];
    const name = uniq.map((x) => x.text).filter(Boolean).join(" ").trim();
    let party: Party | null = normalizeParty(name);
    for (const cell of uniq) party ??= partyFromStyle(cell.style);
    const role = roleOf(name);
    return { name: role === "candidate" ? candidateLabel(name) : name, role, party };
  });

  const idx = (role: ColRole) => columns.findIndex((c) => c.role === role);
  const iPollster = idx("pollster");
  const iDate = idx("date");
  if (iPollster < 0 || iDate < 0) return null;
  const iSample = idx("sample");
  const iMoe = idx("moe");
  const iOther = idx("other");
  const iUnd = idx("undecided");
  const candCols = columns.map((c, i) => ({ ...c, i })).filter((c) => c.role === "candidate" && c.name);

  const polls: Poll[] = [];
  for (const row of grid.slice(end + 1)) {
    if (!row || row.every((c) => !c || c.isHeader)) continue;
    const pollster = row[iPollster]?.text;
    if (!pollster) continue;
    // Linha de nota que ocupa a tabela toda
    if (new Set(row).size <= 2) continue;
    const { start, end: endDate } = parseDateRange(row[iDate]?.text ?? "", fallbackYear);
    if (!endDate) continue;
    const results: Record<string, number> = {};
    for (const c of candCols) {
      const v = parsePercent(row[c.i]?.text ?? "");
      if (v !== null) results[c.name] = v;
    }
    if (Object.keys(results).length < 2) continue;
    const sample = iSample >= 0 ? parseSample(row[iSample]?.text ?? "") : { size: null, population: null };
    polls.push({
      pollster,
      start,
      end: endDate,
      sampleSize: sample.size,
      population: sample.population,
      moe: iMoe >= 0 ? parsePercent(row[iMoe]?.text ?? "") : null,
      results,
      other: iOther >= 0 ? parsePercent(row[iOther]?.text ?? "") : null,
      undecided: iUnd >= 0 ? parsePercent(row[iUnd]?.text ?? "") : null,
    });
  }
  return { columns, polls };
}

/** Indicados e partidos a partir do infobox da eleição. */
export function parseInfobox($: $Root): Candidate[] {
  const box = $("table.infobox").first();
  if (!box.length) return [];
  let names: string[] = [];
  let parties: string[] = [];
  box.find("tr").each((_, tr) => {
    const th = clean($(tr).children("th").first().text()).toLowerCase();
    const tds = $(tr).children("td").toArray().map((td) => clean($(td).text()));
    if (!tds.length) return;
    if (!names.length && /^(nominee|candidate)s?$/.test(th)) names = tds;
    if (!parties.length && /^party$/.test(th)) parties = tds;
  });
  return names
    .map((name, i) => ({ name, party: normalizeParty(parties[i] ?? "") ?? (parties[i] ? ("O" as Party) : null) }))
    .filter((c) => c.name);
}

function lastName(full: string) {
  const parts = full.replace(/,?\s+(jr\.?|sr\.?|ii|iii|iv)$/i, "").split(/\s+/);
  return (parts.at(-1) ?? "").toLowerCase();
}

/** Tabelas de pesquisa na seção de eleição geral (ignora primárias). */
export function generalElectionTables($: $Root): cheerio.Cheerio<any>[] {
  const stack: { level: number; text: string }[] = [];
  const out: cheerio.Cheerio<any>[] = [];
  $("h2, h3, h4, h5, table.wikitable").each((_, el) => {
    const tag = el.tagName.toLowerCase();
    if (/^h\d$/.test(tag)) {
      const level = parseInt(tag[1], 10);
      while (stack.length && stack.at(-1)!.level >= level) stack.pop();
      stack.push({ level, text: clean($(el).text()).toLowerCase() });
      return;
    }
    const ctx = stack.map((h) => h.text);
    const general = ctx.some((t) => t.includes("general election"));
    const primary = ctx.some((t) => /primary|caucus|convention|runoff|jungle/.test(t) && !t.includes("general"));
    if (general && !primary) out.push($(el));
  });
  return out;
}

export interface RaceParse {
  candidates: Candidate[];
  polls: Poll[];
}

export function parseRacePage(html: string, year = 2026): RaceParse {
  const $ = cheerio.load(html);
  const nominees = parseInfobox($);
  const tables = generalElectionTables($)
    .map((t) => parsePollTable($, t, year))
    .filter((t): t is ParsedTable => !!t && t.polls.length > 0);
  if (!tables.length) return { candidates: nominees, polls: [] };

  const nomineeLasts = nominees.map((n) => lastName(n.name)).filter(Boolean);
  const score = (t: ParsedTable) =>
    t.columns.filter((c) => c.role === "candidate" && nomineeLasts.some((l) => c.name.toLowerCase().includes(l))).length;

  let best = tables[0];
  for (const t of tables) if (score(t) > score(best)) best = t;

  const candidates: Candidate[] = best.columns
    .filter((c) => c.role === "candidate" && c.name)
    .map((c) => {
      const match = nominees.find((n) => c.name.toLowerCase().includes(lastName(n.name)));
      return { name: c.name, party: c.party ?? match?.party ?? null };
    });
  return { candidates, polls: best.polls };
}

/** Voto genérico: tabelas com colunas Democratic/Republican. */
export function parseGenericBallotPage(html: string, year = 2026): RaceParse {
  const $ = cheerio.load(html);
  const polls: Poll[] = [];
  $("table.wikitable").each((_, el) => {
    const t = parsePollTable($, $(el), year);
    if (!t) return;
    const names = t.columns.map((c) => c.name.toLowerCase());
    if (!names.some((n) => n.startsWith("democratic")) || !names.some((n) => n.startsWith("republican"))) return;
    for (const p of t.polls) {
      const results: Record<string, number> = {};
      for (const [k, v] of Object.entries(p.results)) {
        if (/^democratic/i.test(k)) results["Democratas"] = v;
        else if (/^republican/i.test(k)) results["Republicanos"] = v;
      }
      if (Object.keys(results).length === 2) polls.push({ ...p, results });
    }
  });
  return {
    candidates: [
      { name: "Democratas", party: "D" },
      { name: "Republicanos", party: "R" },
    ],
    polls,
  };
}
