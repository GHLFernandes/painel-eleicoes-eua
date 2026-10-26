"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StateShape } from "@/lib/geo";
import { RATING_LABEL } from "@/lib/average";
import { STATE_BY_FIPS } from "@/lib/races";
import { fmtDate, fmtMargin, fmtPct, mapFill, partyColor } from "@/lib/ui";
import type { RaceView } from "./Dashboard";

// Estados pequenos demais para rótulo dentro do mapa
const MIN_LABEL_AREA = 900;

export function UsMap({ shapes, views, visibleIds }: { shapes: StateShape[]; views: RaceView[]; visibleIds: Set<string> }) {
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ fips: string; x: number; y: number } | null>(null);
  const byState = new Map(views.map((v) => [v.race.state, v]));

  const hovered = hover ? STATE_BY_FIPS[hover.fips] : null;
  const hv = hovered ? byState.get(hovered.code) : undefined;

  function move(e: React.PointerEvent, fips: string) {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    setHover({ fips, x: e.clientX - r.left, y: e.clientY - r.top });
  }

  return (
    <div className="map-wrap map" ref={wrap} onPointerLeave={() => setHover(null)}>
      <svg viewBox="0 0 975 610" role="img" aria-label="Mapa dos estados com a média das pesquisas">
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--surface-1)" />
            <rect width="3" height="6" fill="var(--map-nopolls)" />
          </pattern>
        </defs>
        {shapes.map((s) => {
          const st = STATE_BY_FIPS[s.fips];
          const v = st ? byState.get(st.code) : undefined;
          const { fill } = mapFill(v ? v.avg : null);
          const cls = ["state", !v && "norace", v && !visibleIds.has(v.race.id) && "dim", hover?.fips === s.fips && "hover"]
            .filter(Boolean)
            .join(" ");
          return (
            <path
              key={s.fips}
              d={s.d}
              className={cls}
              fill={fill}
              onPointerMove={(e) => move(e, s.fips)}
              onClick={() => v && router.push(`/disputa/${v.race.id}`)}
              tabIndex={v ? 0 : -1}
              aria-label={st ? `${st.name}${v ? `: ${fmtMargin(v.avg)}` : ": sem disputa"}` : undefined}
              onKeyDown={(e) => e.key === "Enter" && v && router.push(`/disputa/${v.race.id}`)}
            />
          );
        })}
        {shapes.filter((s) => s.area > MIN_LABEL_AREA).map((s) => {
          const st = STATE_BY_FIPS[s.fips];
          return st ? <text key={s.fips} x={s.cx} y={s.cy} textAnchor="middle" dominantBaseline="middle">{st.code}</text> : null;
        })}
      </svg>

      {hover && hovered && (
        <div className="tooltip" style={{ left: Math.min(hover.x + 14, (wrap.current?.clientWidth ?? 600) - 230), top: hover.y + 14 }}>
          <h3>{hovered.name}</h3>
          {!hv ? (
            <div className="muted">Sem disputa para este cargo em 2026</div>
          ) : hv.avg.candidates.length ? (
            <>
              {hv.avg.candidates.slice(0, 3).map((c) => (
                <div key={c.name} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span className="party"><span className="dot" style={{ background: partyColor(c.party) }} />{c.name}{c.party ? ` (${c.party})` : ""}</span>
                  <strong>{fmtPct(c.pct)}</strong>
                </div>
              ))}
              <div className="muted" style={{ marginTop: 6 }}>
                {RATING_LABEL[hv.rating]} · {hv.avg.pollCount} institutos · última em {fmtDate(hv.avg.lastPoll)}
              </div>
            </>
          ) : (
            <div className="muted">Sem pesquisas na janela selecionada</div>
          )}
        </div>
      )}

      <div className="legend" aria-label="Legenda">
        <span><i className="swatch" style={{ background: "var(--map-d-safe)" }} />Dem. folgado (15+)</span>
        <span><i className="swatch" style={{ background: "var(--map-d-likely)" }} />Dem. favorito (8–15)</span>
        <span><i className="swatch" style={{ background: "var(--map-d-lean)" }} />Dem. competitivo (3–8)</span>
        <span><i className="swatch" style={{ background: "var(--map-tossup)" }} />Empate técnico (&lt;3)</span>
        <span><i className="swatch" style={{ background: "var(--map-r-lean)" }} />Rep. competitivo</span>
        <span><i className="swatch" style={{ background: "var(--map-r-likely)" }} />Rep. favorito</span>
        <span><i className="swatch" style={{ background: "var(--map-r-safe)" }} />Rep. folgado</span>
        <span><i className="swatch" style={{ background: "var(--map-ind)" }} />Independente na frente</span>
        <span><i className="swatch hatch" />Sem pesquisas</span>
        <span><i className="swatch" style={{ background: "var(--map-norace)", border: "1px solid var(--border)" }} />Sem disputa</span>
      </div>
    </div>
  );
}
