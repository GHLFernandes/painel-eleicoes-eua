// Lista estática das disputas estaduais de 2026 (Senado e Governador).
// A eleição geral é em 3 de novembro de 2026.

export type Office = "senate" | "governor";

export interface StateInfo {
  code: string; // USPS
  name: string;
  fips: string; // usado para casar com o us-atlas
}

export const STATES: StateInfo[] = [
  ["AL", "Alabama", "01"], ["AK", "Alaska", "02"], ["AZ", "Arizona", "04"],
  ["AR", "Arkansas", "05"], ["CA", "California", "06"], ["CO", "Colorado", "08"],
  ["CT", "Connecticut", "09"], ["DE", "Delaware", "10"], ["DC", "District of Columbia", "11"],
  ["FL", "Florida", "12"], ["GA", "Georgia", "13"], ["HI", "Hawaii", "15"],
  ["ID", "Idaho", "16"], ["IL", "Illinois", "17"], ["IN", "Indiana", "18"],
  ["IA", "Iowa", "19"], ["KS", "Kansas", "20"], ["KY", "Kentucky", "21"],
  ["LA", "Louisiana", "22"], ["ME", "Maine", "23"], ["MD", "Maryland", "24"],
  ["MA", "Massachusetts", "25"], ["MI", "Michigan", "26"], ["MN", "Minnesota", "27"],
  ["MS", "Mississippi", "28"], ["MO", "Missouri", "29"], ["MT", "Montana", "30"],
  ["NE", "Nebraska", "31"], ["NV", "Nevada", "32"], ["NH", "New Hampshire", "33"],
  ["NJ", "New Jersey", "34"], ["NM", "New Mexico", "35"], ["NY", "New York", "36"],
  ["NC", "North Carolina", "37"], ["ND", "North Dakota", "38"], ["OH", "Ohio", "39"],
  ["OK", "Oklahoma", "40"], ["OR", "Oregon", "41"], ["PA", "Pennsylvania", "42"],
  ["RI", "Rhode Island", "44"], ["SC", "South Carolina", "45"], ["SD", "South Dakota", "46"],
  ["TN", "Tennessee", "47"], ["TX", "Texas", "48"], ["UT", "Utah", "49"],
  ["VT", "Vermont", "50"], ["VA", "Virginia", "51"], ["WA", "Washington", "53"],
  ["WV", "West Virginia", "54"], ["WI", "Wisconsin", "55"], ["WY", "Wyoming", "56"],
].map(([code, name, fips]) => ({ code, name, fips }));

export const STATE_BY_CODE = Object.fromEntries(STATES.map((s) => [s.code, s]));
export const STATE_BY_FIPS = Object.fromEntries(STATES.map((s) => [s.fips, s]));

// Senado classe 2 (33 cadeiras) + especiais de Ohio e Flórida.
const SENATE_REGULAR = [
  "AL", "AK", "AR", "CO", "DE", "GA", "ID", "IL", "IA", "KS", "KY", "LA", "ME",
  "MA", "MI", "MN", "MS", "MT", "NE", "NH", "NJ", "NM", "NC", "OK", "OR", "RI",
  "SC", "SD", "TN", "TX", "VA", "WV", "WY",
];
const SENATE_SPECIAL = ["OH", "FL"];

const GOVERNOR = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "FL", "GA", "HI", "ID", "IL", "IA",
  "KS", "ME", "MD", "MA", "MI", "MN", "NE", "NV", "NH", "NM", "NY", "OH", "OK",
  "OR", "PA", "RI", "SC", "SD", "TN", "TX", "VT", "WI", "WY",
];

export interface Race {
  id: string; // ex.: senate-GA
  office: Office;
  state: string;
  special: boolean;
  wikiPage: string;
}

function senatePage(code: string, special: boolean) {
  const name = STATE_BY_CODE[code].name;
  return special
    ? `2026 United States Senate special election in ${name}`
    : `2026 United States Senate election in ${name}`;
}

export const RACES: Race[] = [
  ...SENATE_REGULAR.map((s) => ({ id: `senate-${s}`, office: "senate" as const, state: s, special: false, wikiPage: senatePage(s, false) })),
  ...SENATE_SPECIAL.map((s) => ({ id: `senate-${s}`, office: "senate" as const, state: s, special: true, wikiPage: senatePage(s, true) })),
  ...GOVERNOR.map((s) => ({
    id: `governor-${s}`,
    office: "governor" as const,
    state: s,
    special: false,
    wikiPage: `2026 ${STATE_BY_CODE[s].name} gubernatorial election`,
  })),
];

export const GENERIC_BALLOT_PAGE =
  "Opinion polling for the 2026 United States House of Representatives elections";

export const OFFICE_LABEL: Record<Office, string> = {
  senate: "Senado",
  governor: "Governador",
};

export function wikiUrl(page: string) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(page.replace(/ /g, "_"))}`;
}
