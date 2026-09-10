import {
  Briefcase,
  Store,
  TrendingUp,
  IdCard,
  Handshake,
  ClipboardList,
} from "lucide-react";

export default function Features() {
  return (
    <section className="section" id="features">
      <div className="container">
        <p className="section-label reveal">Why Cosmos</p>
        <h2 className="reveal">
          Everything your group chat
          <br />
          was missing.
        </h2>
        <p className="section-sub reveal">
          A living virtual world — jobs, shops, inflation and identity — all
          inside WhatsApp.
        </p>
        <div className="grid features-grid">
          <div className="card reveal">
            <div className="icon"><Briefcase size={20} /></div>
            <h3>Job System</h3>
            <p>
              6 jobs with dynamic IDR-based salaries. Daily shifts, gig work
              &amp; weekly dividends.
            </p>
            <a href="/jobs" className="card-link">
              Explore jobs →
            </a>
          </div>
          <div className="card reveal">
            <div className="icon"><Store size={20} /></div>
            <h3>Item Shop</h3>
            <p>
              Buy Pickaxes, MacBooks &amp; licenses that unlock higher-paying
              career paths.
            </p>
          </div>
          <div className="card reveal">
            <div className="icon"><TrendingUp size={20} /></div>
            <h3>Live Economy</h3>
            <p>
              Salaries fluctuate with real USD/IDR rates via{" "}
              <code>EconomyMultiplier</code>.
            </p>
          </div>
          <div className="card reveal">
            <div className="icon"><IdCard size={20} /></div>
            <h3>Virtual ID Card</h3>
            <p>
              Required for all economy actions. No ID, no work — fair and
              bot-proof.
            </p>
          </div>
          <div className="card reveal">
            <div className="icon"><Handshake size={20} /></div>
            <h3>Sub-Bot Pairing</h3>
            <p>
              Run multiple bots under one subscription. Shared DB, zero
              duplicate cost.
            </p>
            <a href="/#subbots" className="card-link">
              How pairing works →
            </a>
          </div>
          <div className="card reveal">
            <div className="icon"><ClipboardList size={20} /></div>
            <h3>Changelog</h3>
            <p>
              Always up-to-date feature history, auto-pulled from GitHub
              Releases.
            </p>
            <a href="/changelog" className="card-link">
              What&apos;s new →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
