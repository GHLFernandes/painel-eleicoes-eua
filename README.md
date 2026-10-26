# Painel Eleições EUA 2026

Painel das eleições de meio de mandato dos EUA (3/11/2026): média de pesquisas por estado para **Senado** e **Governador**, voto genérico para a Câmara e busca de **local de votação** por endereço.

- Next.js 16 (App Router), sem banco de dados: os dados ficam em `data/polls.json` e as páginas são geradas estaticamente.
- Uma GitHub Action roda todo dia, coleta as pesquisas, faz commit do JSON e a Vercel publica sozinha.
- Mapa em SVG puro (us-atlas + d3-geo, paths gerados no servidor), tema claro/escuro, filtros salvos na URL.

## Fontes

| Dado | Fonte | Atualização |
|---|---|---|
| Pesquisas por disputa | Tabelas "Polling → General election" das páginas da Wikipedia em inglês (API `action=parse`) | Diária (Action) |
| Voto genérico | "Opinion polling for the 2026 United States House of Representatives elections" (Wikipedia) | Diária |
| Locais de votação | Google Civic Information API (`voterInfoQuery`) | Em tempo real, por endereço |

O conteúdo da Wikipedia é CC BY-SA 4.0 — a atribuição já aparece no rodapé. A lista de disputas fica em `lib/races.ts`.

## Rodar localmente

```bash
npm install
npm test               # testes do parser (offline)
npm run update-data    # coleta as pesquisas -> data/polls.json
cp .env.example .env.local   # e coloque sua GOOGLE_CIVIC_API_KEY
npm run dev
```

## Deploy na Vercel

1. Suba o projeto para um repositório no GitHub.
2. Na Vercel: **Add New → Project**, importe o repositório (framework detectado: Next.js, sem configuração extra).
3. Em **Settings → Environment Variables**, adicione `GOOGLE_CIVIC_API_KEY`
   (Google Cloud Console → ative "Google Civic Information API" → crie uma API key; restrinja a key a essa API).
4. No GitHub: **Settings → Actions → General → Workflow permissions → Read and write**.
5. Rode a Action **Atualizar dados** uma vez manualmente (aba Actions → Run workflow). Depois ela roda sozinha às 06:17 (Brasília).

Cada commit da Action em `data/` dispara um novo deploy na Vercel. Se a coleta de uma disputa falhar, o último dado bom é mantido e a página mostra um aviso.

## Como a média é calculada (`lib/average.ts`)

- Filtra pela janela (14/30/60 dias ou todas) e pelo tipo de amostra (LV/RV).
- Mantém uma pesquisa por instituto: a mais recente; no mesmo campo, prefere prováveis eleitores (LV).
- Peso = 0,5^(idade/14 dias) × √(amostra/600), com amostra limitada a 3.000.
- Classificação pela margem: < 3 empate técnico · 3–8 competitivo · 8–15 favorito · 15+ folgado.

## Próximos passos sugeridos

- **Resultados por condado/precinct na apuração**: criar adaptadores em `scripts/` para os portais oficiais (ex.: dados abertos de King County via Socrata, arquivos por precinct da Flórida, feeds Clarity dos condados) gravando `data/results/*.json`; usar `counties-albers-10m.json` do us-atlas para o mapa por condado. Para cobertura nacional confiável na noite da eleição, só feeds pagos (AP, Decision Desk HQ).
- **Câmara (435 distritos)**: mesmo parser, com páginas "2026 United States House of Representatives elections in <Estado>" e shapes de distrito do Census.
- **Fonte secundária de pesquisas** para cruzar com a Wikipedia (ex.: CSV de médias que você tenha licença para usar).
