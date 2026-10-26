import type { Metadata } from "next";
import "./globals.css";
import { dataset } from "@/lib/data";
import { Nav } from "./components/Nav";

export const metadata: Metadata = {
  title: "Painel Eleições EUA 2026",
  description: "Médias de pesquisas para Senado e Governador nas eleições de meio de mandato dos EUA, atualizadas diariamente.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const updated = dataset.generatedAt
    ? new Date(dataset.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })
    : null;
  return (
    <html lang="pt-BR">
      <body>
        <header className="topbar">
          <div className="wrap">
            <a href="/" className="brand">
              <span className="brand-mark" aria-hidden />
              Eleições EUA 2026
            </a>
            <Nav />
          </div>
        </header>
        <main>
          <div className="wrap">{children}</div>
        </main>
        <footer>
          <div className="wrap">
            {updated ? <>Dados atualizados em {updated} (horário de Brasília). </> : <>Dados ainda não coletados. </>}
            {dataset.license} Locais de votação via Google Civic Information API. Médias calculadas por este painel; não
            são previsões.
          </div>
        </footer>
      </body>
    </html>
  );
}
