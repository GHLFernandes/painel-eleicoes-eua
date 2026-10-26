import type { Metadata } from "next";
import { VoterLookup } from "../components/VoterLookup";

export const metadata: Metadata = { title: "Onde votar | Eleições EUA 2026" };

export default function OndeVotar() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Onde votar</h1>
          <p className="subtle" style={{ margin: "4px 0 0" }}>
            Locais de votação, votação antecipada e urnas de depósito para um endereço nos EUA, com as disputas na cédula.
          </p>
        </div>
      </div>
      <VoterLookup />
    </>
  );
}
