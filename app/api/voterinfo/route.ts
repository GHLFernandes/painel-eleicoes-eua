// Proxy para o Google Civic Information API (voterInfoQuery). A chave fica só no servidor.
import { NextResponse } from "next/server";

interface CivicAddress { locationName?: string; line1?: string; line2?: string; city?: string; state?: string; zip?: string }
interface CivicLocation {
  address?: CivicAddress;
  pollingHours?: string;
  notes?: string;
  startDate?: string;
  endDate?: string;
  latitude?: number;
  longitude?: number;
}
interface CivicResponse {
  election?: { name?: string; electionDay?: string };
  pollingLocations?: CivicLocation[];
  earlyVoteSites?: CivicLocation[];
  dropOffLocations?: CivicLocation[];
  contests?: { office?: string; referendumTitle?: string; candidates?: { name?: string; party?: string }[] }[];
  state?: { electionAdministrationBody?: { name?: string; electionInfoUrl?: string; votingLocationFinderUrl?: string } }[];
  error?: { message?: string; code?: number };
}

function loc(l: CivicLocation) {
  const a = l.address ?? {};
  return {
    name: a.locationName ?? null,
    address: [a.line1, a.line2, a.city, a.state, a.zip].filter(Boolean).join(", "),
    hours: l.pollingHours ?? null,
    notes: l.notes ?? null,
    start: l.startDate ?? null,
    end: l.endDate ?? null,
    lat: l.latitude ?? null,
    lng: l.longitude ?? null,
  };
}

export async function GET(req: Request) {
  const key = process.env.GOOGLE_CIVIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Configure a variável GOOGLE_CIVIC_API_KEY na Vercel." }, { status: 500 });
  }
  const address = new URL(req.url).searchParams.get("address")?.trim() ?? "";
  if (address.length < 8 || address.length > 200) {
    return NextResponse.json({ error: "Informe um endereço completo nos EUA (rua, cidade, estado)." }, { status: 400 });
  }

  const url = new URL("https://www.googleapis.com/civicinfo/v2/voterinfo");
  url.search = new URLSearchParams({ key, address }).toString();
  const res = await fetch(url, { next: { revalidate: 3600 } });
  const json = (await res.json()) as CivicResponse;

  if (!res.ok || json.error) {
    const msg = json.error?.message ?? `Erro ${res.status}`;
    const friendly = /election unknown|no address matches|failed to parse/i.test(msg)
      ? "Não há informações de votação para esse endereço (confira se é um endereço residencial nos EUA)."
      : msg;
    return NextResponse.json({ error: friendly }, { status: res.status === 400 ? 404 : 502 });
  }

  const admin = json.state?.[0]?.electionAdministrationBody;
  return NextResponse.json(
    {
      election: json.election ?? null,
      pollingLocations: (json.pollingLocations ?? []).map(loc),
      earlyVoteSites: (json.earlyVoteSites ?? []).map(loc),
      dropOffLocations: (json.dropOffLocations ?? []).map(loc),
      contests: (json.contests ?? []).slice(0, 30).map((c) => ({
        office: c.office ?? c.referendumTitle ?? "Disputa",
        candidates: (c.candidates ?? []).map((x) => ({ name: x.name ?? "", party: x.party ?? null })),
      })),
      admin: admin
        ? { name: admin.name ?? null, infoUrl: admin.electionInfoUrl ?? null, finderUrl: admin.votingLocationFinderUrl ?? null }
        : null,
    },
    { headers: { "Cache-Control": "private, max-age=600" } },
  );
}
