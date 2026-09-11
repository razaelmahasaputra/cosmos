import { WA_LINKS } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
              <p className="price-num">
                Rp0<small>/month</small>
              </p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <ul className="check-list">
                <li>
                  <b>5</b> groups
                </li>
                <li>
                  <b>2</b> sub-bots
                </li>
                <li className="yes">Full economy features</li>
                <li className="yes">Live IDR economy</li>
                <li>Low-level priority support</li>
                <li className="no">Custom prefix</li>
                <li className="no">Early access</li>
              </ul>
              <Button asChild variant="outline" className="btn-block">
                <a href={WA_LINKS.bare} target="_blank" rel="noopener">
                  Get Started
                </a>
              </Button>
            </CardContent>
          </Card>
          <Card className="price featured reveal">
            <CardHeader>
              <Badge className="popular w-fit">Most Popular</Badge>
              <CardTitle>Subsidized</CardTitle>
              <p className="price-num">
                Rp10.000<small>/month</small>
              </p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <ul className="check-list">
                <li>
                  <b>10</b> groups
                </li>
                <li>
                  <b>5</b> sub-bots
                </li>
                <li className="yes">Full economy features</li>
                <li className="yes">Live IDR economy</li>
                <li>Medium-level priority support</li>
                <li className="yes">Custom prefix</li>
                <li className="no">Early access</li>
              </ul>
              <Button asChild className="btn-block btn-glow">
                <a href={WA_LINKS.subsidized} target="_blank" rel="noopener">
                  Subscribe
                </a>
              </Button>
            </CardContent>
          </Card>
          <Card className="price partner reveal">
            <CardHeader>
              <CardTitle>Partner</CardTitle>
              <p className="price-num">
                Rp32.000<small>/month</small>
              </p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <ul className="check-list">
                <li>
                  <b>25</b> groups
                </li>
                <li>
                  <b>12</b> sub-bots
                </li>
                <li className="yes">Full economy features</li>
                <li className="yes">Live IDR economy</li>
                <li>High-level priority support</li>
                <li className="yes">Custom prefix</li>
                <li className="yes">Early access to updates</li>
              </ul>
              <Button asChild variant="secondary" className="btn-block">
                <a href={WA_LINKS.partner} target="_blank" rel="noopener">
                  Become a Partner
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
