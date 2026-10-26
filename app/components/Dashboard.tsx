"use client";
import { useEffect, useMemo, useState } from "react";
import { averageRace, RATING_LABEL, ratingOf, type PopulationFilter, type RaceAverage, type Rating } from "@/lib/average";
import { OFFICE_LABEL, RACES, STATE_BY_CODE, type Office, type Race } from "@/lib/races";
import type { Dataset } from "@/lib/types";
import type { StateShape } from "@/lib/geo";
import { barWidthPct, fmtMargin, fmtPct, partyColor } from "@/lib/ui";
import { UsMap } from "./UsMap";

export interface RaceView {
  race: Race;
  avg: RaceAverage;
  rating: Rating;
}

const WINDOWS: { label: string; value: number | null }[] = [
  { label: "14 dias", value: 14 },
  { label: "30 dias", value: 30 },
  { label: "60 dias", value: 60 },
  { label: "Todas", value: null },
];
const RATINGS: Rating[] = ["tossup", "lean", "likely", "safe", "none"];

interface Filters {
  office: Office;
  windowDays: number | null;
  population: PopulationFilter;
  ratings: Rating[];
  q: string;
}
const DEFAULTS: Filters = { office: "senate", windowDays: 30, population: "all", ratings: [], q: "" };

function readUrl(): Filters {
  const p = new URLSearchParams(window.location.search);
  const w = p.get("janela");
  return {
    office: p.get("cargo") === "governador" ? "governor" : "senate",
    windowDays: w === "todas" ? null : w ? Number(w) || DEFAULTS.windowDays : DEFAULTS.windowDays,
    population: (["LV", "RV"].includes(p.get("amostra") ?? "") ? p.get("amostra") : "all") as PopulationFilter,
    ratings: (p.get("comp")?.split(",").filter((r) => RATINGS.includes(r as Rating)) as Rating[]) ?? [],
    q: p.get("q") ?? "",
  };
}

function writeUrl(f: Filters) {
  const p = new URLSearchParams();
  if (f.office === "governor") p.set("cargo", "governador");
  if (f.windowDays !== DEFAULTS.windowDays) p.set("janela", f.windowDays === null ? "todas" : String(f.windowDays));
  if (f.population !== "all") p.set("amostra", f.population);
  if (f.ratings.length) p.set("comp", f.ratings.join(","));
  if (f.q) p.set("q", f.q);
  const qs = p.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

function Seg<T extends string | number | null>({ options, value, onChange, label }: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.value)} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Dashboard({ dataset, shapes }: { dataset: Dataset; shapes: StateShape[] }) {
  const [f, setF] = useState<Filters>(DEFAULTS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setF(readUrl());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) writeUrl(f);
  }, [f, ready]);
  const set = (patch: Partial<Filters>) => setF((cur) => ({ ...cur, ...patch }));

  const views: RaceView[] = useMemo(() => {
    const opts = { windowDays: f.windowDays, population: f.population };
    return RACES.filter((r) => r.office === f.office).map((race) => {
      const avg = averageRace(dataset.races[race.id], opts);
      return { race, avg, rating: ratingOf(avg) };
    });
  }, [dataset, f.office, f.windowDays, f.population]);

  const matches = (v: RaceView) => {
    if (f.ratings.length && !f.ratings.includes(v.rating)) return false;
    if (f.q) {
      const q = f.q.toLowerCase();
      const st = STATE_BY_CODE[v.race.state];
      const hay = [st.name, st.code, ...v.avg.candidates.map((c) => c.name), ...(dataset.races[v.race.id]?.candidates.map((c) => c.name) ?? [])]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };
  const visible = views.filter(matches);
  const sorted = [...visible].sort((a, b) => (a.avg.margin ?? 999) - (b.avg.margin ?? 999));

  const withPolls = views.filter((v) => v.avg.pollCount > 0);
  const tossups = views.filter((v) => v.rating === "tossup").length;
  const dLeads = withPolls.filter((v) => v.rating !== "tossup" && v.avg.leader?.party === "D").length;
  const rLeads = withPolls.filter((v) => v.rating !== "tossup" && v.avg.leader?.party === "R").length;
  const generic = useMemo(
    () => averageRace(dataset.genericBallot ?? undefined, { windowDays: f.windowDays ?? null, population: f.population }),
    [dataset, f.windowDays, f.population],
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Midterms 2026 — {OFFICE_LABEL[f.office]}</h1>
          <p className="subtle" style={{ margin: "4px 0 0" }}>
            Média das pesquisas por estado. Eleição em 3 de novembro de 2026.
          </p>
        </div>
      </div>

      <div className="filters">
        <Seg label="Cargo" value={f.office} onChange={(office) => set({ office })}
          options={[{ label: "Senado", value: "senate" }, { label: "Governador", value: "governor" }]} />
        <Seg label="Janela" value={f.windowDays} onChange={(windowDays) => set({ windowDays })} options={WINDOWS} />
        <Seg label="Amostra" value={f.population} onChange={(population) => set({ population })}
          options={[{ label: "Todas", value: "all" }, { label: "Prováveis (LV)", value: "LV" }, { label: "Registrados (RV)", value: "RV" }]} />
        <div className="field">
          <span className="field-label">Competitividade</span>
          <div className="chips">
            {RATINGS.map((r) => (
              <button key={r} className="chip" aria-pressed={f.ratings.includes(r)}
                onClick={() => set({ ratings: f.ratings.includes(r) ? f.ratings.filter((x) => x !== r) : [...f.ratings, r] })}>
                {RATING_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">Buscar</span>
          <input type="search" placeholder="Estado ou candidato" value={f.q} onChange={(e) => set({ q: e.target.value })} />
        </div>
      </div>

      {!dataset.generatedAt && (
        <p className="notice" style={{ marginBottom: 16 }}>
          Nenhum dado coletado ainda. Rode <code>npm run update-data</code> ou aguarde a primeira execução da rotina diária.
        </p>
      )}

      <div className="grid-main">
        <section className="card">
          <UsMap shapes={shapes} views={views} visibleIds={new Set(visible.map((v) => v.race.id))} />
        </section>
        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card stats">
            <div>
              <div className="stat-label">Disputas com pesquisa</div>
              <div className="stat-value">{withPolls.length}<span className="muted"> / {views.length}</span></div>
            </div>
            <div>
              <div className="stat-label">Empates técnicos (&lt;3 pts)</div>
              <div className="stat-value">{tossups}</div>
            </div>
            <div>
              <div className="stat-label">Democrata na frente</div>
              <div className="stat-value party"><span className="dot" style={{ background: "var(--party-d)" }} />{dLeads}</div>
            </div>
            <div>
              <div className="stat-label">Republicano na frente</div>
              <div className="stat-value party"><span className="dot" style={{ background: "var(--party-r)" }} />{rLeads}</div>
            </div>
          </div>
          <div className="card">
            <div className="stat-label">Voto genérico para a Câmara (média nacional)</div>
            {generic.pollCount ? (
              <>
                <div className="stat-value">{fmtMargin(generic)}</div>
                <div className="cands">
                  {generic.candidates.map((c) => (
                    <span key={c.name} className="party"><span className="dot" style={{ background: partyColor(c.party) }} />{c.name} {fmtPct(c.pct)}</span>
                  ))}
                </div>
                <div className="muted" style={{ marginTop: 6 }}>{generic.pollCount} institutos na janela</div>
              </>
            ) : (
              <div className="muted" style={{ marginTop: 6 }}>Sem pesquisas na janela selecionada.</div>
            )}
          </div>
        </aside>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <h2>Disputas, da mais apertada para a mais folgada</h2>
          <span className="muted">{sorted.length} de {views.length}</span>
        </div>
        {sorted.length === 0 ? (
          <div className="empty">Nenhuma disputa com esses filtros.</div>
        ) : (
          <ul className="race-list">
            {sorted.map((v) => <RaceRow key={v.race.id} v={v} />)}
          </ul>
        )}
      </section>
    </>
  );
}

function RaceRow({ v }: { v: RaceView }) {
  const st = STATE_BY_CODE[v.race.state];
  // Ordem fixa D à esquerda, R à direita, para a barra não "pular" de lado conforme o líder.
  const order = (p: string | null) => (p === "D" ? 0 : p === "R" ? 2 : 1);
  const top = v.avg.candidates.slice(0, 2).sort((a, b) => order(a.party) - order(b.party));
  const total = top.reduce((s, c) => s + c.pct, 0) || 1;
  return (
    <li className="race-row">
      <a href={`/disputa/${v.race.id}`}>
        <div className="race-name">{st.name}</div>
        <div className="muted">{v.race.special ? "Eleição especial" : OFFICE_LABEL[v.race.office]}</div>
      </a>
      <a href={`/disputa/${v.race.id}`} aria-label={`Ver pesquisas de ${st.name}`}>
        {top.length >= 2 ? (
          <>
            <div className="bar" aria-hidden>
              {top.map((c) => (
                <div
                  key={c.name}
                  style={{ width: barWidthPct(c.pct, total), backgroundColor: partyColor(c.party) }}
                />
              ))}
            </div>
            <div className="cands">
              {top.map((c) => (
                <span key={c.name}>{c.name}{c.party ? ` (${c.party})` : ""} <strong>{fmtPct(c.pct)}</strong></span>
              ))}
            </div>
          </>
        ) : (
          <div className="muted">Sem pesquisas na janela selecionada</div>
        )}
      </a>
      <span className="badge" title={v.avg.pollCount ? `${v.avg.pollCount} institutos` : undefined}>
        {v.avg.margin !== null ? fmtMargin(v.avg) : RATING_LABEL[v.rating]}
      </span>
    </li>
  );
}
