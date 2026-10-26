// Testes offline do parser com HTML no formato das páginas da Wikipedia.
// Os nomes e números abaixo são fictícios (fixture de teste).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDateRange, parseGenericBallotPage, parseRacePage, parseSample } from "./wiki-parse";

const RACE_HTML = `
<div class="mw-parser-output">
<table class="infobox vevent"><tbody>
  <tr><th>Nominee</th><td><b>Alice Example</b></td><td><b>Bob Sample</b></td></tr>
  <tr><th>Party</th><td>Democratic</td><td>Republican</td></tr>
</tbody></table>
<div class="mw-heading mw-heading2"><h2 id="Republican_primary">Republican primary</h2></div>
<div class="mw-heading mw-heading3"><h3 id="Polling">Polling</h3></div>
<table class="wikitable"><tbody>
  <tr><th>Poll source</th><th>Date(s) administered</th><th>Sample size</th><th>Bob Sample</th><th>Carl Primary</th></tr>
  <tr><td>Primary Poll</td><td>May 1–3, 2026</td><td>500 (LV)</td><td>40%</td><td>30%</td></tr>
</tbody></table>
<div class="mw-heading mw-heading2"><h2 id="General_election">General election</h2></div>
<div class="mw-heading mw-heading3"><h3 id="Polling_2">Polling</h3></div>
<table class="wikitable"><tbody>
  <tr><th rowspan="2">Poll source</th><th rowspan="2">Date(s)<br/>administered</th><th rowspan="2">Sample<br/>size<sup>[a]</sup></th><th rowspan="2">Margin<br/>of error</th>
      <th>Alice<br/>Example (D)</th><th>Bob<br/>Sample (R)</th><th rowspan="2">Other</th><th rowspan="2">Undecided</th></tr>
  <tr><th style="background:#3333FF"></th><th style="background:#E81B23"></th></tr>
  <tr><td rowspan="2">Pollster One</td><td rowspan="2">September 28 – October 2, 2026</td><td>1,000 (LV)</td><td>± 3.1%</td><td><b>48%</b></td><td>45%</td><td>2%</td><td>5%</td></tr>
  <tr><td>1,200 (RV)</td><td>± 2.8%</td><td><b>47%</b></td><td>44%</td><td>3%</td><td>6%</td></tr>
  <tr><td>Pollster Two (R)</td><td>Oct 10–12, 2026</td><td>800 (LV)</td><td>± 3.5%</td><td>46%</td><td><b>47%</b></td><td>–</td><td>7%</td></tr>
  <tr><td colspan="8">Hypothetical polling</td></tr>
</tbody></table>
<table class="wikitable"><tbody>
  <tr><th>Poll source</th><th>Date(s) administered</th><th>Sample size</th><th>Someone Else</th><th>Bob Sample</th></tr>
  <tr><td>Old Poll</td><td>March 3, 2026</td><td>600 (RV)</td><td>40%</td><td>44%</td></tr>
</tbody></table>
</div>`;

test("datas", () => {
  assert.deepEqual(parseDateRange("September 28 – October 2, 2026", 2026), { start: "2026-09-28", end: "2026-10-02" });
  assert.deepEqual(parseDateRange("Oct 10–12, 2026", 2026), { start: "2026-10-10", end: "2026-10-12" });
  assert.deepEqual(parseDateRange("October 5, 2026", 2026), { start: "2026-10-05", end: "2026-10-05" });
  assert.deepEqual(parseDateRange("December 28, 2025 – January 3, 2026", 2026), { start: "2025-12-28", end: "2026-01-03" });
  assert.deepEqual(parseDateRange("Dec 28 – Jan 3, 2026", 2026), { start: "2025-12-28", end: "2026-01-03" });
});

test("amostra", () => {
  assert.deepEqual(parseSample("1,000 (LV)"), { size: 1000, population: "LV" });
  assert.deepEqual(parseSample("750 (RV)[b]"), { size: 750, population: "RV" });
});

test("página de disputa: pega a tabela da eleição geral e ignora primária", () => {
  const r = parseRacePage(RACE_HTML);
  assert.deepEqual(r.candidates, [
    { name: "Alice Example", party: "D" },
    { name: "Bob Sample", party: "R" },
  ]);
  assert.equal(r.polls.length, 3);
  const [a, b, c] = r.polls;
  assert.equal(a.pollster, "Pollster One");
  assert.equal(a.population, "LV");
  assert.equal(b.population, "RV"); // rowspan do instituto/data
  assert.equal(b.end, "2026-10-02");
  assert.deepEqual(a.results, { "Alice Example": 48, "Bob Sample": 45 });
  assert.equal(a.moe, 3.1);
  assert.equal(c.other, null);
  assert.equal(c.undecided, 7);
});

test("voto genérico", () => {
  const html = `<table class="wikitable"><tbody>
    <tr><th>Poll source</th><th>Date(s) administered</th><th>Sample size</th><th>Democratic</th><th>Republican</th><th>Lead</th></tr>
    <tr><td>Pollster X</td><td>Oct 1–3, 2026</td><td>1,500 (RV)</td><td>47%</td><td>42%</td><td>+5</td></tr>
  </tbody></table>`;
  const r = parseGenericBallotPage(html);
  assert.equal(r.polls.length, 1);
  assert.deepEqual(r.polls[0].results, { Democratas: 47, Republicanos: 42 });
});
