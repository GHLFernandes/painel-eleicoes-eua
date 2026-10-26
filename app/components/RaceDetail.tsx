"use client";
import { useMemo, useState } from "react";
import { averageRace, POPULATION_LABEL, RATING_LABEL, ratingOf, type PopulationFilter } from "@/lib/average";
import { OFFICE_LABEL, STATE_BY_CODE, type Race } from "@/lib/races";
import type { RaceData } from "@/lib/types";
import { fmtDate, fmtMargin, fmtPct, partyColor } from "@/lib/ui";
import { TrendChart } from "./TrendChart";

export function RaceDetail({ race, data }: { race: Race; data: RaceData | null }) {
  const [population, setPopulation] = useState<PopulationFilter>("all");
  const [windowDays, setWindowDays] = useState<number | null>(30);
  const st = STATE_BY_CODE[race.state];

  const avg = useMemo(() => averageRace(data ?? undefined, { windowDays, population }), [data, windowDays, population]);
  const polls = useMemo(
    () => (data?.polls ?? []).filter((p) => population === "all" || p.population === population).sort((a, b) => b.end.localeCompare(a.end)),
    [data, population],
  );
  const columns = useMemo(() => {
    const names = data?.candidates.map((c) => c.name) ?? [];
    return names.filter((n) => polls.some((p) => n in p.results));
  }, [data, polls]);
  const partyOf = (n: string) => data?.candidates.find((c) => c.name === n)?.party ?? null;

  return (
    <>
      <p className="muted" style={{ margin: "0 0 8px" }}><a href="/">← Voltar ao mapa</a></p>
      <div className="page-head">
        <div>
          <h1>{st.name} — {OFFICE_LABEL[race.office]}{race.special ? " (especial)" : ""}</h1>
          <p className="subtle" style={{ margin: "4px 0 0" }}>
            {RATING_LABEL[ratingOf(avg)]}
            {avg.margin !== null && <> · {fmtMargin(avg)} na média</>}
            {data?.source && <> · <a href={data.source} target="_blank" rel="noreferrer">fonte das pesquisas</a></>}
          </p>
        </div>
        <div className="filters" style={{ margin: 0 }}>
          <div className="field">
            <span className="field-label">Janela da média</span>
            <div className="seg">
              {[14, 30, 60, null].map((w) => (
                <button key={String(w)} aria-pressed={windowDays === w} onClick={() => setWindowDays(w)}>{w ? `${w} dias` : "Todas"}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">Amostra</span>
            <div className="seg">
              {(["all", "LV", "RV"] as PopulationFilter[]).map((p) => (
                <button key={p} aria-pressed={population === p} onClick={() => setPopulation(p)}>{p === "all" ? "Todas" : p}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {data?.error && <p className="notice">A última coleta desta página falhou ({data.error}); mostrando os dados anteriores.</p>}

      {!data || !data.polls.length ? (
        <div className="card empty">
          Nenhuma pesquisa de eleição geral encontrada para esta disputa ainda.
          {data?.candidates.length ? (
            <div style={{ marginTop: 12 }}>
              Candidatos: {data.candidates.map((c) => `${c.name}${c.party ? ` (${c.party})` : ""}`).join(", ")}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="stats" style={{ gridTemplateColumns: `repeat(${Math.max(2, Math.min(avg.candidates.length, 4))}, 1fr)`, marginBottom: 16 }}>
            {avg.candidates.slice(0, 4).map((c) => (
              <div key={c.name} className="card">
                <div className="stat-label party"><span className="dot" style={{ background: partyColor(c.party) }} />{c.name}{c.party ? ` (${c.party})` : ""}</div>
                <div className="stat-value">{fmtPct(c.pct)}</div>
              </div>
            ))}
          </div>
          {!avg.pollCount && <p className="notice">Nenhuma pesquisa na janela selecionada. Amplie a janela para ver a média.</p>}

          <section className="card chart" style={{ marginBottom: 16 }}>
            <h2 style={{ marginBottom: 8 }}>Tendência da média</h2>
            <TrendChart data={data} population={population} names={columns.slice(0, 3)} />
          </section>

          <section className="card">
            <h2 style={{ marginBottom: 8 }}>Pesquisas ({polls.length})</h2>
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>Instituto</th>
                    <th>Campo</th>
                    <th className="num">Amostra</th>
                    <th className="num">Margem de erro</th>
                    {columns.map((n) => (
                      <th key={n} className="num"><span className="party" style={{ justifyContent: "flex-end" }}><span className="dot" style={{ background: partyColor(partyOf(n)) }} />{n}</span></th>
                    ))}
                    <th className="num">Indecisos</th>
                  </tr>
                </thead>
                <tbody>
                  {polls.map((p, i) => {
                    const max = Math.max(...Object.values(p.results));
                    return (
                      <tr key={i}>
                        <td>{p.pollster}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{p.start && p.start !== p.end ? `${fmtDate(p.start)} – ` : ""}{fmtDate(p.end)}</td>
                        <td className="num" title={p.population ? POPULATION_LABEL[p.population] : undefined}>
                          {p.sampleSize?.toLocaleString("pt-BR") ?? "–"} {p.population ?? ""}
                        </td>
                        <td className="num">{p.moe !== null ? `±${fmtPct(p.moe)}` : "–"}</td>
                        {columns.map((n) => (
                          <td key={n} className={`num ${p.results[n] === max ? "lead-win" : ""}`}>{fmtPct(p.results[n], 0)}</td>
                        ))}
                        <td className="num">{fmtPct(p.undecided, 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              Média: uma pesquisa por instituto (a mais recente, priorizando prováveis eleitores), com peso que cai pela metade a cada 14
              dias e cresce com a raiz do tamanho da amostra.
            </p>
          </section>
        </>
      )}
    </>
  );
}
