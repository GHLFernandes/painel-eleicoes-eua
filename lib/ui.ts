import type { Party } from "./types";
import type { RaceAverage, Rating } from "./average";
import { ratingOf } from "./average";

export const PARTY_VAR: Record<string, string> = {
  D: "var(--party-d)",
  R: "var(--party-r)",
  I: "var(--party-i)",
};
export function partyColor(p: Party | null | undefined) {
  return (p && PARTY_VAR[p]) || "var(--party-o)";
}
export const PARTY_SHORT: Record<string, string> = { D: "Dem.", R: "Rep.", I: "Ind.", L: "Lib.", G: "Verde", O: "Outro" };

export function mapFill(avg: RaceAverage | null): { fill: string; hatch: boolean } {
  if (!avg) return { fill: "var(--map-norace)", hatch: false };
  const r: Rating = ratingOf(avg);
  if (r === "none") return { fill: "url(#hatch)", hatch: true };
  if (r === "tossup") return { fill: "var(--map-tossup)", hatch: false };
  const p = avg.leader?.party;
  if (p === "D") return { fill: `var(--map-d-${r})`, hatch: false };
  if (p === "R") return { fill: `var(--map-r-${r})`, hatch: false };
  return { fill: "var(--map-ind)", hatch: false };
}

export function fmtPct(v: number | null | undefined, digits = 1) {
  return v === null || v === undefined ? "–" : `${v.toFixed(digits).replace(".", ",")}%`;
}

/** Largura % com precisão fixa — evita hydration mismatch entre SSR e cliente. */
export function barWidthPct(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${((part / total) * 100).toFixed(4)}%`;
}
export function fmtMargin(avg: RaceAverage) {
  if (!avg.leader || avg.margin === null) return "–";
  const who = avg.leader.party ? avg.leader.party : avg.leader.name.split(" ").at(-1);
  return `${who} +${avg.margin.toFixed(1).replace(".", ",")}`;
}
export function fmtDate(iso: string | null) {
  if (!iso) return "–";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
