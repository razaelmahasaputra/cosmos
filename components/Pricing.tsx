import { WA_LINKS } from "@/lib/data";

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
          <div className="card price reveal">
            <h3>Free</h3>
            <p className="price-num">
              Rp0<small>/month</small>
            </p>
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
            <a
              href={WA_LINKS.bare}
              className="btn btn-ghost btn-block"
              target="_blank"
              rel="noopener"
            >
              Get Started
            </a>
          </div>
          <div className="card price featured reveal">
            <div className="popular">Most Popular</div>
            <h3>Subsidized</h3>
            <p className="price-num">
              Rp10.000<small>/month</small>
            </p>
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
            <a
              href={WA_LINKS.subsidized}
              className="btn btn-primary btn-block btn-glow"
              target="_blank"
              rel="noopener"
            >
              Subscribe
            </a>
          </div>
          <div className="card price partner reveal">
            <h3>Partner</h3>
            <p className="price-num">
              Rp32.000<small>/month</small>
            </p>
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
            <a
              href={WA_LINKS.partner}
              className="btn btn-partner btn-block"
              target="_blank"
              rel="noopener"
            >
              Become a Partner
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
