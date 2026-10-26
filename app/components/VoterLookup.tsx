"use client";
import { useState } from "react";
import { fmtDate } from "@/lib/ui";

interface Loc { name: string | null; address: string; hours: string | null; notes: string | null; start: string | null; end: string | null }
interface Result {
  election: { name?: string; electionDay?: string } | null;
  pollingLocations: Loc[];
  earlyVoteSites: Loc[];
  dropOffLocations: Loc[];
  contests: { office: string; candidates: { name: string; party: string | null }[] }[];
  admin: { name: string | null; infoUrl: string | null; finderUrl: string | null } | null;
}

function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function LocList({ title, items }: { title: string; items: Loc[] }) {
  if (!items.length) return null;
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ marginBottom: 8 }}>{title} ({items.length})</h2>
      <ul className="race-list">
        {items.slice(0, 20).map((l, i) => (
          <li key={i} className="race-row" style={{ gridTemplateColumns: "1fr auto" }}>
            <div>
              <div className="race-name">{l.name ?? l.address}</div>
              {l.name && <div className="subtle">{l.address}</div>}
              {(l.hours || l.start) && (
                <div className="muted">
                  {l.start && <>{fmtDate(l.start)}{l.end && l.end !== l.start ? ` a ${fmtDate(l.end)}` : ""} · </>}
                  {l.hours}
                </div>
              )}
              {l.notes && <div className="muted">{l.notes}</div>}
            </div>
            <a href={mapsUrl(l.address)} target="_blank" rel="noreferrer">Ver no mapa</a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function VoterLookup() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Result | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/voterinfo?address=${encodeURIComponent(address)}`);
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Erro na consulta.");
      else setData(json);
    } catch {
      setError("Falha de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const nothing = data && !data.pollingLocations.length && !data.earlyVoteSites.length && !data.dropOffLocations.length;

  return (
    <>
      <form onSubmit={submit} className="filters">
        <div className="field" style={{ flex: "1 1 320px" }}>
          <label className="field-label" htmlFor="addr">Endereço residencial nos EUA</label>
          <input id="addr" type="text" value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder="Rua, cidade, estado e ZIP" style={{ width: "100%" }} />
        </div>
        <button className="btn" disabled={loading || address.trim().length < 8}>{loading ? "Buscando…" : "Buscar"}</button>
      </form>

      {error && <p className="notice">{error}</p>}

      {data && (
        <>
          {data.election && (
            <p className="subtle">{data.election.name}{data.election.electionDay ? ` · ${fmtDate(data.election.electionDay)}` : ""}</p>
          )}
          {nothing && (
            <p className="notice">
              O condado ainda não publicou os locais para esse endereço.
              {data.admin?.finderUrl && <> Consulte o <a href={data.admin.finderUrl} target="_blank" rel="noreferrer">buscador oficial do estado</a>.</>}
            </p>
          )}
          <LocList title="Local de votação no dia da eleição" items={data.pollingLocations} />
          <LocList title="Votação antecipada" items={data.earlyVoteSites} />
          <LocList title="Urnas para depositar a cédula" items={data.dropOffLocations} />
          {data.contests.length > 0 && (
            <section className="card" style={{ marginBottom: 16 }}>
              <h2 style={{ marginBottom: 8 }}>Na cédula</h2>
              <ul className="race-list">
                {data.contests.map((c, i) => (
                  <li key={i} className="race-row" style={{ gridTemplateColumns: "220px 1fr" }}>
                    <div className="race-name">{c.office}</div>
                    <div className="subtle">{c.candidates.map((x) => `${x.name}${x.party ? ` (${x.party})` : ""}`).join(" · ") || "–"}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {data.admin?.infoUrl && (
            <p className="muted">Informações oficiais: <a href={data.admin.infoUrl} target="_blank" rel="noreferrer">{data.admin.name ?? "órgão eleitoral do estado"}</a></p>
          )}
        </>
      )}
    </>
  );
}
