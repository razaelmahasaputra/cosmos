"use client";

import { useMemo, useState } from "react";
import { IdCard, TrendingUp } from "lucide-react";
import { DEMO_JOB_NAMES, JOBS } from "@/lib/data";
import { formatRupiah } from "@/lib/format";

function demoLabel(name: string): string {
  return name === "Taxi Driving" ? "Taxi Driver" : name;
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

        <div className="id-banner reveal">
          <span className="id-icon"><IdCard size={22} /></span>
          <div>
            <strong>Global Requirement — Virtual ID Card</strong>
            <p>
              All jobs strictly require a registered virtual{" "}
              <code>IdCard</code>. Users without one cannot apply or work.
            </p>
          </div>
        </div>

        <div className="grid jobs-grid" id="jobsGrid">
          {JOBS.map((j) => (
            <div
              key={j.name}
              className="card job-card reveal visible"
            >
              <div className="job-top">
                <span className="job-emoji"><j.icon size={20} /></span>
                <span className="cooldown">{j.cooldown}</span>
              </div>
              <h3>{j.name}</h3>
              <div className="job-salary" data-base={j.base}>
                {formatRupiah(j.base * mult)}
              </div>
              <div className="job-req">
                Requires: <b>{j.req}</b> + ID Card
              </div>
              <p className="job-desc muted">{j.desc}</p>
              <span className={`risk ${j.riskCls}`}>● {j.risk}</span>
            </div>
          ))}
        </div>

        <div className="economy-box reveal">
          <div className="economy-text">
            <h3><TrendingUp size={18} /> Dynamic salary calculation</h3>
            <p>
              <code>Final Salary = Base Salary × EconomyMultiplier</code>
            </p>
            <p className="muted">
              The multiplier is updated from the <code>ExchangeRateLog</code>{" "}
              (EODHD USD/IDR feed). Base salaries can be defined in USD and
              converted on the fly. All outputs use <code>formatRupiah</code> →{" "}
              <code>Rp50.000</code>.
            </p>
            <label className="slider-label" htmlFor="multSlider">
              EconomyMultiplier:{" "}
              <strong id="multVal">{mult.toFixed(2)}×</strong>
            </label>
            <input
              type="range"
              id="multSlider"
              min={50}
              max={250}
              value={Math.round(mult * 100)}
              onChange={(e) => setMult(Number(e.target.value) / 100)}
            />
            <p className="muted small">
              Drag to simulate inflation / deflation. Job cards above update
              live.
            </p>
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
              >
                {DEMO_JOB_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-primary btn-sm"
                id="demoWork"
                type="button"
              >
                .work
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
