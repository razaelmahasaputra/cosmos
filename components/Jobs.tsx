"use client";

import { useMemo, useState } from "react";
import { IdCard, TrendingUp } from "lucide-react";
import { DEMO_JOB_NAMES, JOBS } from "@/lib/data";
import { formatRupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function demoLabel(name: string): string {
  return name === "Taxi Driving" ? "Taxi Driver" : name;
}

function riskVariant(cls: string): "default" | "secondary" | "destructive" | "outline" {
  if (cls === "low") return "secondary";
  if (cls === "med") return "outline";
  return "destructive";
}

export default function Jobs() {
  const [mult, setMult] = useState(1.0);
  const [demoJobName, setDemoJobName] = useState<string>("Office Work");

  const demoReply = useMemo(() => {
    const job = JOBS.find((j) => j.name === demoJobName) ?? JOBS[4];
    return `You have successfully completed your shift as a ${demoLabel(job.name)} and earned ${formatRupiah(job.base * mult)}.`;
  }, [demoJobName, mult]);

  return (
    <section className="section section-alt" id="jobs">
      <div className="container">
        <p className="section-label reveal">Job &amp; Salary System</p>
        <h2 className="reveal">
          Work hard. Earn real
          <br />
          (virtual) Rupiah.
        </h2>
        <p className="section-sub reveal">
          A non-gambling way to earn balance. Pick a career, grab the required
          item, and <code>.work</code> your shift. Payouts scale with the live
          economy.
        </p>

        <Alert className="id-banner reveal mb-6 border-l-[3px] border-l-amber-500">
          <IdCard size={22} />
          <AlertTitle>Global Requirement — Virtual ID Card</AlertTitle>
          <AlertDescription>
            All jobs strictly require a registered virtual{" "}
            <code>IdCard</code>. Users without one cannot apply or work.
          </AlertDescription>
        </Alert>

        <div className="grid jobs-grid" id="jobsGrid">
          {JOBS.map((j) => (
            <Card
              key={j.name}
              className="card job-card reveal visible"
            >
              <CardContent className="flex flex-col gap-2 p-6">
                <div className="job-top">
                  <span className="job-emoji"><j.icon size={20} /></span>
                  <Badge variant="secondary" className="cooldown">{j.cooldown}</Badge>
                </div>
                <CardTitle className="text-[0.95rem]">{j.name}</CardTitle>
                <div className="job-salary" data-base={j.base}>
                  {formatRupiah(j.base * mult)}
                </div>
                <CardDescription className="job-req">
                  Requires: <b>{j.req}</b> + ID Card
                </CardDescription>
                <CardDescription className="job-desc muted">{j.desc}</CardDescription>
                <Badge variant={riskVariant(j.riskCls)} className="risk w-fit">● {j.risk}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="economy-box reveal mt-6">
          <CardContent className="grid gap-6 p-7 md:grid-cols-2">
          <div className="economy-text">
            <CardTitle className="mb-2 flex items-center gap-2 text-base"><TrendingUp size={18} /> Dynamic salary calculation</CardTitle>
            <p>
              <code>Final Salary = Base Salary × EconomyMultiplier</code>
            </p>
            <CardDescription className="muted mt-3">
              The multiplier is updated from the <code>ExchangeRateLog</code>{" "}
              (EODHD USD/IDR feed). Base salaries can be defined in USD and
              converted on the fly. All outputs use <code>formatRupiah</code> →{" "}
              <code>Rp50.000</code>.
            </CardDescription>
            <Label className="slider-label mt-4" htmlFor="multSlider">
              EconomyMultiplier:{" "}
              <strong id="multVal">{mult.toFixed(2)}×</strong>
            </Label>
            <Input
              type="range"
              id="multSlider"
              min={50}
              max={250}
              value={Math.round(mult * 100)}
              onChange={(e) => setMult(Number(e.target.value) / 100)}
              className="h-auto border-0 bg-transparent p-0 shadow-none"
            />
            <CardDescription className="muted small mt-2">
              Drag to simulate inflation / deflation. Job cards above update
              live.
            </CardDescription>
          </div>
          <div className="economy-demo">
            <div className="demo-title">Try it — Formal English reply</div>
            <div className="demo-chat mono" id="demoReply">
              {demoReply}
            </div>
            <div className="demo-row">
              <select
                id="demoJob"
                value={demoJobName}
                onChange={(e) => setDemoJobName(e.target.value)}
                className="flex h-9 w-full flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {DEMO_JOB_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                id="demoWork"
                type="button"
              >
                .work
              </Button>
            </div>
          </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
