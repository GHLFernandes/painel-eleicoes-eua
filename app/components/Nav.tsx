"use client";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Mapa" },
  { href: "/onde-votar", label: "Onde votar" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      {LINKS.map((l) => (
        <a key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined}>
          {l.label}
        </a>
      ))}
    </nav>
  );
}
