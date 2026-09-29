"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Pokeball from "./Pokeball";

const links = [
  { href: "/", label: "Home" },
  { href: "/collection", label: "My Collection" },
  { href: "/upload", label: "Upload CSV" },
  { href: "/shop", label: "Shop / Share" },
  { href: "/requests", label: "Requests" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [pending, setPending] = useState<number>(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/requests?status=pending")
      .then((r) => r.json())
      .then((d) => setPending(d?.total ?? 0))
      .catch(() => {});
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50">
      <div className="h-2 bg-gradient-to-r from-[#CC0000] via-[#ff5350] to-[#CC0000]" />
      <nav className="bg-[#0f1b33]/95 backdrop-blur border-b-4 border-[#FFCB05]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3 group">
              <span className="relative">
                <Pokeball className="w-10 h-10 transition-transform duration-500 group-hover:rotate-[360deg]" />
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#FFCB05] animate-pulse" />
              </span>
              <span>
                <span className="block text-xl font-black tracking-tight leading-none">
                  <span className="text-[#FFCB05]" style={{ textShadow: "2px 2px 0 #2A75BB" }}>Chaz</span>
                  <span className="text-white">Master</span>
                </span>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-300">
                  Pokémon TCG Vault
                </span>
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {links.map((l) => {
                const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href));
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`relative rounded-full px-4 py-2 text-sm font-bold transition-all ${
                      active
                        ? "bg-[#FFCB05] text-[#0f1b33] shadow-[0_0_20px_rgba(255,203,5,0.5)]"
                        : "text-slate-200 hover:text-[#FFCB05] hover:bg-white/10"
                    }`}
                  >
                    {l.label}
                    {l.href === "/requests" && pending > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#CC0000] px-1 text-[11px] font-black text-white ring-2 ring-[#0f1b33]">
                        {pending}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            <div className="hidden md:flex items-center gap-2">
              <Link
                href="/upload"
                className="rounded-full bg-gradient-to-b from-[#ff5350] to-[#CC0000] px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-red-900/40 border-b-4 border-red-900 hover:brightness-110 active:border-b-0 active:translate-y-0.5 transition-all"
              >
                + Add Cards
              </Link>
            </div>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden rounded-lg p-2 text-white hover:bg-white/10"
              aria-label="menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                {mobileOpen ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#0f1b33] px-4 pb-4 pt-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={`block rounded-xl px-4 py-3 text-sm font-bold ${
                  pathname === l.href ? "bg-[#FFCB05] text-[#0f1b33]" : "text-slate-200 hover:bg-white/10"
                }`}
              >
                {l.label}
                {l.href === "/requests" && pending > 0 && ` (${pending})`}
              </Link>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
}
