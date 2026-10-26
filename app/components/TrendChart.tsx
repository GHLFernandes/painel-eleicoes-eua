"use client";
import { useMemo, useRef, useState } from "react";
import { trendSeries, type PopulationFilter } from "@/lib/average";
import type { RaceData } from "@/lib/types";
import { fmtDate, fmtPct, partyColor } from "@/lib/ui";

const W = 760;
const H = 280;
const M = { top: 12, right: 120, bottom: 28, left: 36 };

export function TrendChart({ data, population, names }: { data: RaceData; population: PopulationFilter; names: string[] }) {
  const series = useMemo(() => trendSeries(data, population, names), [data, population, names]);
  const polls = data.polls.filter((p) => population === "all" || p.population === population);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hi, setHi] = useState<number | null>(null);

  if (series.length < 2) return <div className="empty">Pesquisas insuficientes para traçar a tendência.</div>;

  const t = (d: string) => new Date(d + "T12:00:00Z").getTime();
  const t0 = t(series[0].date);
  const t1 = t(series.at(-1)!.date);
  const allVals = polls.flatMap((p) => names.map((n) => p.results[n]).filter((v): v is number => v !== undefined));
  const yMin = Math.max(0, Math.floor((Math.min(...allVals) - 2) / 5) * 5);
  const yMax = Math.min(100, Math.ceil((Math.max(...allVals) + 2) / 5) * 5);
  const x = (d: string) => M.left + ((t(d) - t0) / Math.max(1, t1 - t0)) * (W - M.left - M.right);
  const y = (v: number) => M.top + (1 - (v - yMin) / (yMax - yMin)) * (H - M.top - M.bottom);
  const yTicks = Array.from({ length: Math.floor((yMax - yMin) / 5) + 1 }, (_, i) => yMin + i * 5);
  const partyOf = (n: string) => data.candidates.find((c) => c.name === n)?.party ?? null;

  // Rótulos de mês no eixo x
  const months: string[] = [];
  for (let d = new Date(t0); d.getTime() <= t1; d.setUTCMonth(d.getUTCMonth() + 1, 1)) {
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
    if (t(iso) >= t0) months.push(iso);
  }
  const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  function onMove(e: React.PointerEvent) {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    series.forEach((s, i) => {
      if (Math.abs(x(s.date) - px) < Math.abs(x(series[best].date) - px)) best = i;
    });
    setHi(best);
  }

  const last = series.at(-1)!;
  const point = hi !== null ? series[hi] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} onPointerLeave={() => setHi(null)} role="img"
        aria-label={`Tendência da média: ${names.map((n) => `${n} ${fmtPct(last.values[n])}`).join(", ")}`}>
        <g className="grid">
          {yTicks.map((v) => <line key={v} x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} />)}
        </g>
        <g className="axis">
          {yTicks.map((v) => <text key={v} x={M.left - 6} y={y(v)} textAnchor="end" dominantBaseline="middle">{v}%</text>)}
          {months.map((m) => (
            <text key={m} x={x(m)} y={H - 8} textAnchor="middle">{MES[Number(m.slice(5, 7)) - 1]}</text>
          ))}
        </g>
        {names.map((n) =>
          polls.map((p, i) =>
            p.results[n] !== undefined ? (
              <circle key={`${n}-${i}`} className="dotpoll" cx={x(p.end)} cy={y(p.results[n])} r={3} fill={partyColor(partyOf(n))} />
            ) : null,
          ),
        )}
        {names.map((n) => {
          const pts = series.filter((s) => s.values[n] !== null);
          if (pts.length < 2) return null;
          const d = pts.map((s, i) => `${i ? "L" : "M"}${x(s.date).toFixed(1)},${y(s.values[n]!).toFixed(1)}`).join("");
          const end = pts.at(-1)!;
          return (
            <g key={n}>
              <path d={d} fill="none" stroke={partyColor(partyOf(n))} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(end.date)} cy={y(end.values[n]!)} r={4} fill={partyColor(partyOf(n))} stroke="var(--surface-1)" strokeWidth={2} />
              <text x={x(end.date) + 8} y={y(end.values[n]!)} dominantBaseline="middle" fontSize={12} fill="var(--text-primary)">
                {n.split(" ").at(-1)} {fmtPct(end.values[n])}
              </text>
            </g>
          );
        })}
        {point && (
          <line x1={x(point.date)} x2={x(point.date)} y1={M.top} y2={H - M.bottom} stroke="var(--text-muted)" strokeWidth={1} />
        )}
      </svg>
      {point && (
        <div className="tooltip" style={{ left: `min(${(x(point.date) / W) * 100}% + 12px, calc(100% - 220px))`, top: 8 }}>
          <div className="muted">Média até {fmtDate(point.date)}</div>
          {names.map((n) => (
            <div key={n} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span className="party"><span className="dot" style={{ background: partyColor(partyOf(n)) }} />{n}</span>
              <strong>{fmtPct(point.values[n])}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="legend">
        {names.map((n) => (
          <span key={n}><i className="swatch" style={{ background: partyColor(partyOf(n)) }} />{n}{partyOf(n) ? ` (${partyOf(n)})` : ""}</span>
        ))}
        <span className="muted">Pontos: pesquisas individuais · Linha: média de 45 dias</span>
      </div>
    </div>
  );
}
