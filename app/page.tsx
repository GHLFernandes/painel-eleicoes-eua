import { dataset } from "@/lib/data";
import { stateShapes } from "@/lib/geo";
import { Dashboard } from "./components/Dashboard";

export default function Home() {
  return <Dashboard dataset={dataset} shapes={stateShapes()} />;
}
