import { Check, X } from "lucide-react";
import { WA_LINKS } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function FeatureItem({ included, children }: { included?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {included === true ? (
        <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" />
      ) : included === false ? (
        <X size={15} className="mt-0.5 shrink-0 opacity-50" />
      ) : (
        <span className="mt-0.5 text-muted-foreground">•</span>
      )}
      <span className={included === false ? "opacity-50" : undefined}>{children}</span>
    </li>
  );
}

export default function Pricing() {
  return (
    <section className="section" id="pricing">
      <div className="container">
        <p className="section-label reveal">Pricing</p>
        <h2 className="reveal">Pick your orbit.</h2>
        <p className="section-sub reveal">
          Full economy features on every tier. Upgrade for more groups and
          sub-bots.
        </p>
        <div className="grid pricing-grid">
          <Card className="price reveal">
            <CardHeader>
              <CardTitle>Free</CardTitle>
              <CardDescription className="price-num">
                Rp0<small>/month</small>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <ul className="check-list">
                <FeatureItem>
                  <b>5</b> groups
                </FeatureItem>
                <FeatureItem>
                  <b>2</b> sub-bots
                </FeatureItem>
                <FeatureItem included>Full economy features</FeatureItem>
                <FeatureItem included>Live IDR economy</FeatureItem>
                <FeatureItem>Low-level priority support</FeatureItem>
                <FeatureItem included={false}>Custom prefix</FeatureItem>
                <FeatureItem included={false}>Early access</FeatureItem>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild variant="outline" className="btn-block mt-0 w-full">
                <a href={WA_LINKS.bare} target="_blank" rel="noopener">
                  Get Started
                </a>
              </Button>
            </CardFooter>
          </Card>
          <Card className="price featured reveal">
            <CardHeader>
              <Badge className="popular w-fit">Most Popular</Badge>
              <CardTitle>Subsidized</CardTitle>
              <CardDescription className="price-num">
                Rp10.000<small>/month</small>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <ul className="check-list">
                <FeatureItem>
                  <b>10</b> groups
                </FeatureItem>
                <FeatureItem>
                  <b>5</b> sub-bots
                </FeatureItem>
                <FeatureItem included>Full economy features</FeatureItem>
                <FeatureItem included>Live IDR economy</FeatureItem>
                <FeatureItem>Medium-level priority support</FeatureItem>
                <FeatureItem included>Custom prefix</FeatureItem>
                <FeatureItem included={false}>Early access</FeatureItem>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className="btn-block btn-glow mt-0 w-full">
                <a href={WA_LINKS.subsidized} target="_blank" rel="noopener">
                  Subscribe
                </a>
              </Button>
            </CardFooter>
          </Card>
          <Card className="price partner reveal">
            <CardHeader>
              <CardTitle>Partner</CardTitle>
              <CardDescription className="price-num">
                Rp32.000<small>/month</small>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <ul className="check-list">
                <FeatureItem>
                  <b>25</b> groups
                </FeatureItem>
                <FeatureItem>
                  <b>12</b> sub-bots
                </FeatureItem>
                <FeatureItem included>Full economy features</FeatureItem>
                <FeatureItem included>Live IDR economy</FeatureItem>
                <FeatureItem>High-level priority support</FeatureItem>
                <FeatureItem included>Custom prefix</FeatureItem>
                <FeatureItem included>Early access to updates</FeatureItem>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild variant="secondary" className="btn-block mt-0 w-full">
                <a href={WA_LINKS.partner} target="_blank" rel="noopener">
                  Become a Partner
                </a>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </section>
  );
}
