// Gera os paths SVG dos estados no servidor (us-atlas já vem projetado em Albers, 975×610).
import { geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import states from "us-atlas/states-albers-10m.json";

export interface StateShape {
  fips: string;
  d: string;
  cx: number;
  cy: number;
  area: number;
}

export function stateShapes(): StateShape[] {
  const topo = states as unknown as Topology<{ states: GeometryCollection }>;
  const fc = feature(topo, topo.objects.states);
  const path = geoPath();
  return fc.features.map((f) => {
    const [cx, cy] = path.centroid(f);
    return { fips: String(f.id).padStart(2, "0"), d: path(f) ?? "", cx, cy, area: path.area(f) };
  });
}
