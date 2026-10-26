export type Party = "D" | "R" | "I" | "L" | "G" | "O";
export type Population = "LV" | "RV" | "A" | "V" | null;

export interface Candidate {
  name: string; // como aparece na coluna da tabela de pesquisa
  party: Party | null;
}

export interface Poll {
  pollster: string;
  start: string | null; // ISO yyyy-mm-dd
  end: string; // ISO yyyy-mm-dd
  sampleSize: number | null;
  population: Population;
  moe: number | null;
  results: Record<string, number>; // nome do candidato -> %
  other: number | null;
  undecided: number | null;
}

export interface RaceData {
  candidates: Candidate[];
  polls: Poll[];
  source: string; // URL da página da Wikipedia
  fetchedAt: string;
  error?: string;
}

export interface Dataset {
  generatedAt: string | null;
  license: string;
  races: Record<string, RaceData>;
  genericBallot: RaceData | null;
}
