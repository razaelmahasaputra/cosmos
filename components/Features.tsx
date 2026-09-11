import {
  Briefcase,
  Store,
  TrendingUp,
  IdCard,
  Handshake,
  ClipboardList,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
          <Card className="reveal">
            <CardHeader>
              <div className="icon"><Briefcase size={20} /></div>
              <CardTitle>Job System</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                6 jobs with dynamic IDR-based salaries. Daily shifts, gig work
                &amp; weekly dividends.
              </p>
              <a href="/jobs" className="card-link">
                Explore jobs →
              </a>
            </CardContent>
          </Card>
          <Card className="reveal">
            <CardHeader>
              <div className="icon"><Store size={20} /></div>
              <CardTitle>Item Shop</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                Buy Pickaxes, MacBooks &amp; licenses that unlock higher-paying
                career paths.
              </p>
            </CardContent>
          </Card>
          <Card className="reveal">
            <CardHeader>
              <div className="icon"><TrendingUp size={20} /></div>
              <CardTitle>Live Economy</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                Salaries fluctuate with real USD/IDR rates via{" "}
                <code>EconomyMultiplier</code>.
              </p>
            </CardContent>
          </Card>
          <Card className="reveal">
            <CardHeader>
              <div className="icon"><IdCard size={20} /></div>
              <CardTitle>Virtual ID Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                Required for all economy actions. No ID, no work — fair and
                bot-proof.
              </p>
            </CardContent>
          </Card>
          <Card className="reveal">
            <CardHeader>
              <div className="icon"><Handshake size={20} /></div>
              <CardTitle>Sub-Bot Pairing</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                Run multiple bots under one subscription. Shared DB, zero
                duplicate cost.
              </p>
              <a href="/#subbots" className="card-link">
                How pairing works →
              </a>
            </CardContent>
          </Card>
          <Card className="reveal">
            <CardHeader>
              <div className="icon"><ClipboardList size={20} /></div>
              <CardTitle>Changelog</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                Always up-to-date feature history, auto-pulled from GitHub
                Releases.
              </p>
              <a href="/changelog" className="card-link">
                What&apos;s new →
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
