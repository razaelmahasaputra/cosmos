import { Check, Sparkles } from "lucide-react";
import { WA_LINKS } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

const STEPS = [
  { title: "Add Primary Bot", desc: "Add the main number to your group." },
  { title: "Register Number", desc: "Whitelist it via bot command — no dashboard needed." },
  { title: "Link Sub-Bot", desc: "Confirm the secondary number via OTP." },
  { title: "Done!", desc: "Both bots are live and in sync." },
];

export default function SubBots() {
  return (
    <section className="section section-alt" id="subbots">
      <div className="container subbot-grid">
        <div className="reveal">
          <p className="section-label">Multi-Bot Architecture</p>
          <h2>
            One Subscription.
            <br />
            Multiple Bots.
          </h2>
          <p className="section-sub left">
            Pair secondary WhatsApp numbers as sub-bots under your primary
            Cosmos account. All bots share the same group economy, user
            database, and subscription — no duplicate costs.
          </p>
          <ul className="check-list mb-6">
            {[
              "Shared economy & user database",
              "Centralized admin control",
              "Independent bot prefixes per number",
              "Sub-bots inherit primary's subscription tier",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Button asChild>
            <a
              href={WA_LINKS.subbot}
              target="_blank"
              rel="noopener"
            >
              Pair a Sub-Bot
            </a>
          </Button>
        </div>
        <div className="reveal">
          <Card className="diagram card p-5">
            <CardContent className="p-0">
            <svg viewBox="0 0 360 220" className="topo" aria-hidden="true">
              <line x1="180" y1="62" x2="80" y2="150" className="link" />
              <line x1="180" y1="62" x2="280" y2="150" className="link" />
              <g className="node primary">
                <circle cx="180" cy="48" r="26" />
                <Sparkles x={170} y={38} width={20} height={20} className="node-icon" />
              </g>
              <g className="node sub">
                <circle cx="80" cy="160" r="22" />
                <Sparkles x={72} y={152} width={16} height={16} className="node-icon" />
              </g>
              <g className="node sub">
                <circle cx="280" cy="160" r="22" />
                <Sparkles x={272} y={152} width={16} height={16} className="node-icon" />
              </g>
              <text x="180" y="22" textAnchor="middle" className="svg-label">
                Primary Bot
              </text>
              <text x="80" y="196" textAnchor="middle" className="svg-label">
                Sub-Bot A
              </text>
              <text x="280" y="196" textAnchor="middle" className="svg-label">
                Sub-Bot B
              </text>
            </svg>
            <CardDescription className="muted small center mt-3">
              Shared: Economy DB · User records · Subscription
            </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="container">
        <div className="stepper reveal">
          {STEPS.map((s, i) => (
            <Card className="step" key={s.title}>
              <CardContent className="flex gap-3 p-4">
              <span>{i + 1}</span>
              <div>
                <CardTitle className="text-[0.85rem]">{s.title}</CardTitle>
                <CardDescription className="text-xs">{s.desc}</CardDescription>
              </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
