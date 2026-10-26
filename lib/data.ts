import raw from "../data/polls.json";
import type { Dataset } from "./types";

export const dataset = raw as unknown as Dataset;
