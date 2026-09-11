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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
              <CardDescription>
                6 jobs with dynamic IDR-based salaries. Daily shifts, gig work
                &amp; weekly dividends.
              </CardDescription>
              <Button asChild variant="link" className="card-link h-auto p-0">
                <a href="/jobs">
                  Explore jobs →
                </a>
              </Button>
            </CardContent>
          </Card>
          <Card className="reveal">
            <CardHeader>
              <div className="icon"><Store size={20} /></div>
              <CardTitle>Item Shop</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Buy Pickaxes, MacBooks &amp; licenses that unlock higher-paying
                career paths.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="reveal">
            <CardHeader>
              <div className="icon"><TrendingUp size={20} /></div>
              <CardTitle>Live Economy</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Salaries fluctuate with real USD/IDR rates via{" "}
                <code>EconomyMultiplier</code>.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="reveal">
            <CardHeader>
              <div className="icon"><IdCard size={20} /></div>
              <CardTitle>Virtual ID Card</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Required for all economy actions. No ID, no work — fair and
                bot-proof.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="reveal">
            <CardHeader>
              <div className="icon"><Handshake size={20} /></div>
              <CardTitle>Sub-Bot Pairing</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Run multiple bots under one subscription. Shared DB, zero
                duplicate cost.
              </CardDescription>
              <Button asChild variant="link" className="card-link h-auto p-0">
                <a href="/#subbots">
                  How pairing works →
                </a>
              </Button>
            </CardContent>
          </Card>
          <Card className="reveal">
            <CardHeader>
              <div className="icon"><ClipboardList size={20} /></div>
              <CardTitle>Changelog</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Always up-to-date feature history, auto-pulled from GitHub
                Releases.
              </CardDescription>
              <Button asChild variant="link" className="card-link h-auto p-0">
                <a href="/changelog">
                  What&apos;s new →
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
