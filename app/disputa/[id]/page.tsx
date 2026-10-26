import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { dataset } from "@/lib/data";
import { OFFICE_LABEL, RACES, STATE_BY_CODE } from "@/lib/races";
import { RaceDetail } from "../../components/RaceDetail";

export function generateStaticParams() {
  return RACES.map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const race = RACES.find((r) => r.id === id);
  if (!race) return {};
  return { title: `${OFFICE_LABEL[race.office]} — ${STATE_BY_CODE[race.state].name} | Eleições EUA 2026` };
}

export default async function RacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const race = RACES.find((r) => r.id === id);
  if (!race) notFound();
  return <RaceDetail race={race} data={dataset.races[race.id] ?? null} />;
}
