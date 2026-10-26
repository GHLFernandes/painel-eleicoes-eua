// Média de pesquisas simples e transparente:
// - uma pesquisa por instituto (a mais recente; LV > RV > A)
// - peso = decaimento por idade (meia-vida de 14 dias) × raiz do tamanho da amostra (limitado)
import type { Candidate, Party, Poll, Population, RaceData } from "./types";

export type PopulationFilter = "all" | "LV" | "RV";

export interface AverageOptions {
  windowDays: number | null; // null = todas
  population: PopulationFilter;
  today?: Date;
  halfLifeDays?: number;
}

export interface CandidateAvg {
  name: string;
  party: Party | null;
  pct: number;
}

export interface RaceAverage {
  candidates: CandidateAvg[]; // ordenado do maior para o menor
  leader: CandidateAvg | null;
  margin: number | null; // líder - segundo, em pontos
  pollCount: number;
  lastPoll: string | null;
  pollsUsed: Poll[];
}

const POP_RANK: Record<string, number> = { LV: 0, RV: 1, V: 2, A: 3, null: 4 };

export function daysBetween(a: Date, b: Date) {
  return (a.getTime() - b.getTime()) / 86_400_000;
}

export function filterPolls(polls: Poll[], opts: AverageOptions): Poll[] {
  const today = opts.today ?? new Date();
  return polls.filter((p) => {
    if (opts.population !== "all" && p.population !== opts.population) return false;
    if (opts.windowDays !== null && daysBetween(today, new Date(p.end)) > opts.windowDays) return false;
    return true;
  });
}

/** Uma pesquisa por instituto: a mais recente e, no mesmo campo, a de prováveis eleitores. */
export function latestPerPollster(polls: Poll[]): Poll[] {
  const best = new Map<string, Poll>();
  for (const p of polls) {
    const key = p.pollster.toLowerCase().replace(/\s+/g, " ");
    const cur = best.get(key);
    if (
      !cur ||
      p.end > cur.end ||
      (p.end === cur.end && POP_RANK[String(p.population)] < POP_RANK[String(cur.population)])
    ) {
      best.set(key, p);
    }
  }
  return [...best.values()];
}

export function averageRace(race: RaceData | undefined, opts: AverageOptions): RaceAverage {
  const empty: RaceAverage = { candidates: [], leader: null, margin: null, pollCount: 0, lastPoll: null, pollsUsed: [] };
  if (!race || !race.polls.length) return empty;
  const today = opts.today ?? new Date();
  const halfLife = opts.halfLifeDays ?? 14;
  const used = latestPerPollster(filterPolls(race.polls, opts));
  if (!used.length) return empty;

  const sums = new Map<string, { w: number; v: number }>();
  for (const p of used) {
    const age = Math.max(0, daysBetween(today, new Date(p.end)));
    const n = Math.min(p.sampleSize ?? 600, 3000);
    const w = Math.pow(0.5, age / halfLife) * Math.sqrt(n / 600);
    for (const [name, pct] of Object.entries(p.results)) {
      const s = sums.get(name) ?? { w: 0, v: 0 };
      s.w += w;
      s.v += w * pct;
      sums.set(name, s);
    }
  }
  const partyOf = (name: string) => race.candidates.find((c: Candidate) => c.name === name)?.party ?? null;
  // Só candidatos presentes em pelo menos metade das pesquisas usadas (evita nomes de cenários hipotéticos).
  const counts = new Map<string, number>();
  for (const p of used) for (const k of Object.keys(p.results)) counts.set(k, (counts.get(k) ?? 0) + 1);
  const candidates = [...sums.entries()]
    .filter(([name]) => (counts.get(name) ?? 0) >= Math.ceil(used.length / 2))
    .map(([name, s]) => ({ name, party: partyOf(name), pct: s.v / s.w }))
    .sort((a, b) => b.pct - a.pct);

  const leader = candidates[0] ?? null;
  const margin = candidates.length >= 2 ? candidates[0].pct - candidates[1].pct : null;
  const lastPoll = used.map((p) => p.end).sort().at(-1) ?? null;
  return { candidates, leader, margin, pollCount: used.length, lastPoll, pollsUsed: used };
}

export type Rating = "tossup" | "lean" | "likely" | "safe" | "none";

export const RATING_LABEL: Record<Rating, string> = {
  tossup: "Empate técnico",
  lean: "Competitivo",
  likely: "Favorito",
  safe: "Folgado",
  none: "Sem pesquisas",
};

export function ratingOf(avg: RaceAverage): Rating {
  if (avg.margin === null) return "none";
  if (avg.margin < 3) return "tossup";
  if (avg.margin < 8) return "lean";
  if (avg.margin < 15) return "likely";
  return "safe";
}

/** Margem com sinal: positiva = democrata na frente; negativa = republicano. null se o líder é de outro partido. */
export function signedMargin(avg: RaceAverage): number | null {
  if (!avg.leader || avg.margin === null) return null;
  if (avg.leader.party === "D") return avg.margin;
  if (avg.leader.party === "R") return -avg.margin;
  return null;
}

/** Série temporal: média móvel recalculada a cada pesquisa, para o gráfico de tendência. */
export function trendSeries(race: RaceData, population: PopulationFilter, names: string[]) {
  const polls = race.polls
    .filter((p) => population === "all" || p.population === population)
    .sort((a, b) => a.end.localeCompare(b.end));
  const dates = [...new Set(polls.map((p) => p.end))];
  return dates.map((d) => {
    const at = new Date(d + "T12:00:00Z");
    const avg = averageRace(
      { ...race, polls: polls.filter((p) => p.end <= d) },
      { windowDays: 45, population, today: at },
    );
    const values: Record<string, number | null> = {};
    for (const n of names) values[n] = avg.candidates.find((c) => c.name === n)?.pct ?? null;
    return { date: d, values };
  });
}

export const POPULATION_LABEL: Record<NonNullable<Population>, string> = {
  LV: "Prováveis eleitores",
  RV: "Eleitores registrados",
  A: "Adultos",
  V: "Eleitores",
};
