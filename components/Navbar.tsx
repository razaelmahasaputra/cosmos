"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { WA_LINKS } from "@/lib/data";

const LINKS = [
  { href: "/features", label: "Features" },
  { href: "/jobs", label: "Jobs" },
  { href: "/pricing", label: "Pricing" },
  { href: "/changelog", label: "Changelog" },
  { href: "/docs", label: "Docs" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="nav" id="nav">
      <div className="container nav-inner">
        <Link href="/" className="logo">
          <span className="logo-star"><Sparkles size={18} /></span> Cosmos
        </Link>
        <nav className="nav-links" id="navLinks">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname === l.href ? "active" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="nav-right">
          <a
            href={WA_LINKS.add}
            target="_blank"
            rel="noopener"
            className="btn btn-primary btn-sm"
          >
            Add to WhatsApp
          </a>
          <button
            className="hamburger"
            id="hamburger"
            aria-label="Menu"
            aria-expanded={open ? "true" : "false"}
            onClick={() => setOpen((v) => !v)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
      <div className={`mobile-menu${open ? " open" : ""}`} id="mobileMenu">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setOpen(false)}
            className={pathname === l.href ? "active" : undefined}
          >
            {l.label}
          </Link>
        ))}
        <a
          href={WA_LINKS.bare}
          target="_blank"
          rel="noopener"
          className="btn btn-primary btn-sm"
        >
          Add to WhatsApp
        </a>
      </div>
    </header>
  );
}
