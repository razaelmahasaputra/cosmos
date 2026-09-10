"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gamepad2, GitBranch, Heart, MessageCircle, Sparkles } from "lucide-react";
import { WA_LINKS } from "@/lib/data";
import { formatRupiah } from "@/lib/format";

export default function Footer() {
  const [rate, setRate] = useState(16240);

  // Gentle live simulation (real feed: EODHD USDIDR — plug API key here).
  useEffect(() => {
    const id = setInterval(() => {
      setRate((r) =>
        Math.max(15000, Math.min(17500, r + (Math.random() - 0.5) * 24))
      );
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Link href="/" className="logo">
            <span className="logo-star"><Sparkles size={18} /></span> Cosmos
          </Link>
          <p className="muted">Your universe, in one chat.</p>
          <div className="socials">
            <a
              href={WA_LINKS.bare}
              aria-label="WhatsApp"
              target="_blank"
              rel="noopener"
            >
              <MessageCircle size={16} />
            </a>
            <a href="#" aria-label="Discord">
              <Gamepad2 size={16} />
            </a>
            <a href="#" aria-label="GitHub">
              <GitBranch size={16} />
            </a>
          </div>
        </div>
        <div>
          <h4>Product</h4>
          <Link href="/pricing">Pricing</Link>
          <Link href="/changelog">Changelog</Link>
          <Link href="/docs">Docs</Link>
        </div>
        <div>
          <h4>Community</h4>
          <a href="#">Discord</a>
          <a href="#">GitHub</a>
          <a href="#">Twitter</a>
        </div>
        <div>
          <h4>Legal</h4>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Contact</a>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 Cosmos. Made with <Heart size={12} fill="currentColor" /> in Indonesia.</span>
        <span className="ticker">
          Current USD/IDR: <strong id="idrTicker">{formatRupiah(rate)}</strong>{" "}
          <span className="live-dot"></span>
        </span>
      </div>
    </footer>
  );
}
