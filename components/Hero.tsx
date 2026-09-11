"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, Sparkles } from "lucide-react";
import Starfield from "./Starfield";
import { WA_LINKS } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

export default function Hero() {
  const tiltRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const [groups, setGroups] = useState("500+");

  // Animated hero counter (500+ groups)
  useEffect(() => {
    const target = 500;
    let raf = 0;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / 1400);
      setGroups(`${Math.floor(target * (1 - Math.pow(1 - p, 3)))}+`);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (window.innerWidth <= 640) return;
    const tilt = tiltRef.current;
    const phone = phoneRef.current;
    if (!tilt || !phone) return;
    const r = tilt.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    phone.style.transform = `rotateY(${-14 + dx * 16}deg) rotateX(${4 - dy * 12}deg)`;
  };

  const handleMouseLeave = () => {
    if (phoneRef.current) phoneRef.current.style.transform = "";
  };

  return (
    <section className="hero" id="top">
      <Starfield />
      <div className="hero-glow hero-glow-a"></div>
      <div className="hero-glow hero-glow-b"></div>
      <div className="container hero-inner">
        <div className="hero-copy reveal">
          <Badge variant="secondary" className="badge-pill mb-5">
            <span className="pulse-dot"></span> <Sparkles size={12} /> Now with Economy System &amp;
            Jobs
          </Badge>
          <h1>
            Your Universe,
            <br />
            <span className="grad">In One Chat.</span>
          </h1>
          <p className="subtitle">
            Cosmos is a feature-rich WhatsApp bot with a living economy, jobs,
            item shops, and more — powered by real IDR exchange rates.
          </p>
          <div className="cta-row">
            <Button asChild className="btn-glow">
              <a href={WA_LINKS.add} target="_blank" rel="noopener">
                Add to WhatsApp
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="/jobs">View Demo</a>
            </Button>
          </div>
          <p className="social-proof">
            Trusted by <strong>500+ groups</strong> ·{" "}
            <strong>10,000+ users</strong>
          </p>
          <div className="hero-stats">
            <div>
              <strong id="statGroups">{groups}</strong>
              <span>groups</span>
            </div>
            <div>
              <strong>10k+</strong>
              <span>users</span>
            </div>
            <div>
              <strong>6+</strong>
              <span>jobs</span>
            </div>
          </div>
        </div>
        <div className="hero-visual reveal">
          <div
            className="phone-wrap"
            id="phoneTilt"
            ref={tiltRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <div className="phone-glow"></div>
            <div className="phone" ref={phoneRef}>
              <div className="phone-notch"></div>
              <Card className="phone-screen border-0 bg-[#0c0c0e] shadow-none">
                <div className="chat-header">
                  <Avatar className="chat-avatar h-8 w-8">
                    <AvatarFallback>
                      <Bot size={16} />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <strong>Cosmos Bot</strong>
                    <small>
                      <Badge variant="outline" className="border-0 bg-transparent p-0 text-[0.7rem] text-[#10b981]">
                        ● online
                      </Badge>
                    </small>
                  </div>
                </div>
                <CardContent className="chat-body p-[0.85rem]">
                  <div className="bubble out">.work</div>
                  <div className="bubble in">
                    <div className="report-title"><Check size={13} /> Work Report</div>
                    <div className="report-row">
                      <span>Job</span>
                      <b>Office Work</b>
                    </div>
                    <div className="report-row">
                      <span>Earned</span>
                      <b className="green">Rp250.000</b>
                    </div>
                    <div className="report-row">
                      <span>Next shift</span>
                      <b>24 hours</b>
                    </div>
                    <div className="report-row">
                      <span>Balance</span>
                      <b>Rp1.250.000</b>
                    </div>
                  </div>
                  <div className="bubble out">.job list</div>
                </CardContent>
                <div className="chat-input">
                  <span>Type a message…</span>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
