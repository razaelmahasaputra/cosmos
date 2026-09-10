# Cosmos — Website Design Specification

> A design blueprint for the official **Cosmos WhatsApp Bot** website.

---

## 1. Brand Identity

### Name & Tagline
- **Name**: Cosmos
- **Tagline**: *"Your universe, in one chat."*
- **Sub-tagline**: A powerful WhatsApp bot with an economy system, jobs, and a living virtual world — all inside your group chat.

### Color Palette

> Source: `Cosmos-by-RazaelFox-ColorPalette.md`  
> Usage ratio: **80% Space Black · 15% Star White · 5% Nebula Blue**

#### Core Brand Tokens
| Token | Name | Hex | Usage |
|---|---|---|---|
| `--color-bg` | Space Black | `#0B0D10` | Primary page background (80%) |
| `--color-surface` | Cosmic Gray | `#2A2F36` | Cards, secondary surfaces |
| `--color-text-primary` | Star White | `#F5F7FA` | Text, icons (15%) |
| `--color-accent` | Nebula Blue | `#4F8CFF` | Primary CTA, highlights, links (5%) |
| `--color-accent-alt` | Cosmic Purple | `#8B5CF6` | Alternative accent, hover states |

#### Extended UI Tokens (derived from brand palette)
| Token | Hex | Derived From | Usage |
|---|---|---|---|
| `--color-surface-raised` | `#353B44` | Cosmic Gray + lightened | Elevated cards, modals |
| `--color-border` | `#1E2228` | Space Black + lightened | Subtle dividers |
| `--color-text-secondary` | `#8B93A0` | Star White muted | Subtitles, meta info |
| `--color-text-muted` | `#444C57` | Midpoint BG/surface | Disabled, placeholders |
| `--color-success` | `#10b981` | Standard green | Active badges, free tier |
| `--color-warning` | `#f59e0b` | Standard amber | Highlighted badges |

#### Monochrome Fallbacks (for icons, watermarks)
| Name | Hex | Usage |
|---|---|---|
| Black | `#000000` | Logo on light backgrounds |
| Dark Gray | `#1A1A1A` | Watermark, dark icon version |
| Medium Gray | `#666666` | Secondary text (light mode only) |
| Light Gray | `#D9D9D9` | Light backgrounds (light mode only) |
| White | `#FFFFFF` | Logo negative version |


### Typography
| Role | Font | Weight | Size |
|---|---|---|---|
| Display / Hero | `Space Grotesk` | 700 | `clamp(2.5rem, 6vw, 5rem)` |
| Section Headings | `Space Grotesk` | 600 | `clamp(1.75rem, 3vw, 2.5rem)` |
| Body | `Inter` | 400 | `1rem / 1.125rem` |
| Code / Monospace | `JetBrains Mono` | 400 | `0.875rem` |
| Labels / Badges | `Inter` | 600 | `0.75rem` |

### Iconography & Decorative Style
- **Icons**: Lucide Icons (consistent stroke-based style)
- **Decoration**: Subtle starfield/particle canvas in the hero background; soft radial glows behind CTAs and plan cards
- **Imagery**: WhatsApp chat mockups (cropped phone frames), no stock photography
- **Motion**: Framer Motion or CSS transitions — entrance animations (fade-up), hover lifts, glow pulsing on CTAs

---

## 2. Layout System

- **Max width**: `1200px`, centered with `auto` horizontal margins
- **Column grid**: 12-column CSS Grid with `gap: 1.5rem`
- **Section padding**: `padding-block: clamp(4rem, 10vw, 8rem)`
- **Breakpoints**:
  - Mobile: `< 640px`
  - Tablet: `640px – 1024px`
  - Desktop: `> 1024px`

---

## 3. Page Sections

---

### 3.1 — Navigation Bar

**Layout**: Fixed top bar, `backdrop-filter: blur(12px)`, background `rgba(10,10,15,0.85)`.

**Contents (left to right)**:
1. **Logo** — `✦ Cosmos` wordmark in `Space Grotesk 700`, accent-colored star
2. **Nav Links** — `Features · Pricing · Changelog · Docs`
3. **CTA Button** — `Add to WhatsApp` (accent filled, rounded pill)
4. **Hamburger** — Mobile only, collapses to a slide-down menu

---

### 3.2 — Hero / Landing Section

**Goal**: Immediately communicate value, create visual impact, prompt action.

**Layout**: Full-viewport-height, centered column, starfield canvas background.

**Structure**:
- Badge pill: "✦ Now with Economy System & Jobs"
- H1 Display: "Your Universe, In One Chat."
- Subtitle: "Cosmos is a feature-rich WhatsApp bot with a living economy, jobs, item shops, and more — powered by real IDR exchange rates."
- CTA Row: `[Add to WhatsApp]` and `[View Demo]`
- Social Proof: "Trusted by 500+ groups · 10,000+ users"
- Hero Visual: Animated phone mockup showing a sample `.work` command reply

**Hero Visual Details**:
- A 3D-tilted phone frame (CSS `perspective` + `rotateY`) displaying a WhatsApp chat bubble
- Chat bubble content (monospace style):
  ```
  Work Report
  Job       : Office Work
  Earned    : Rp250.000
  Next shift: 24 hours
  Balance   : Rp1.250.000
  ```
- Soft violet glow radiating from behind the phone

---

### 3.3 — Features Strip (Below Hero)

A 3x2 icon-card grid showcasing key features.

| Icon | Feature | Description |
|---|---|---|
| 💼 | **Job System** | 6 jobs with dynamic IDR-based salaries |
| 🏪 | **Item Shop** | Buy tools that unlock higher-paying jobs |
| 📈 | **Live Economy** | Salaries fluctuate with real USD/IDR rates |
| 🪪 | **Virtual ID Card** | Required for all economy actions |
| 🤝 | **Sub-Bot Pairing** | Run multiple bots under one subscription |
| 📋 | **Changelog** | Always up-to-date feature history |

---

### 3.4 — Pricing Section

**Goal**: Present tier options clearly; make the upgrade decision easy.

**Layout**: `1fr 1fr 1fr` card grid on desktop, stacked on mobile. Center card (`Subsidized`) is visually elevated with a glow border and a `Most Popular` badge.

#### Plans

| | Free | Subsidized | Partner |
|---|---|---|---|
| **Price** | Rp0/month | Rp10.000/month | Rp32.000/month |
| **Groups** | 5 | 10 | 25 |
| **Sub-Bots** | 2 | 5 | 12 |
| **Economy Features** | Full | Full | Full |
| **Live IDR Economy** | Yes | Yes | Yes |
| **Priority Support** | Low-level | Medium-level | High-level |
| **Custom Prefix** | No | Yes | Yes |
| **Early Access to Updates** | No | No | Yes |
| **CTA** | Get Started | Subscribe | Become a Partner |

#### Card Anatomy
Each card displays: plan name, price, feature checklist, and a CTA button.

#### Visual Treatment
- **Free**: Flat surface card, `--color-surface` background, dashed border
- **Subsidized**: Elevated, `--color-surface-raised`, solid `--color-accent` (Nebula Blue) glow border, `Most Popular` badge at top
- **Partner**: Distinguished with `--color-accent-alt` (Cosmic Purple) border, subtle star/sparkle accent to convey exclusivity


---

### 3.5 — Sub-Bot Pairing Section

**Goal**: Explain the multi-bot architecture simply; inspire trust in scalability.

**Layout**: Two-column on desktop (text left, visual right), stacked on mobile.

#### Left Column — Explanation
- Section label: "Multi-Bot Architecture"
- H2: "One Subscription. Multiple Bots."
- Body: "Pair secondary WhatsApp numbers as sub-bots under your primary Cosmos account. All bots share the same group economy, user database, and subscription — no duplicate costs."
- Feature list:
  - Shared economy & user database
  - Centralized admin dashboard
  - Independent bot prefixes per number
  - Sub-bots inherit primary's subscription tier
- CTA: "Pair a Sub-Bot"

#### Right Column — Visual Diagram
An animated SVG diagram showing:
- Primary Bot node (violet) at the top
- Two Sub-Bot nodes (cyan) connected via dashed-line connectors
- "Shared: Economy DB · User records · Subscription" label below
- Node pulse animations on hover

#### Pairing Flow Steps
Below the diagram, a horizontal stepper:
1. **Add Primary Bot** — Add the main number to your group
2. **Open Dashboard** — Log in at `cosmos.bot/dashboard`
3. **Link Sub-Bot** — Enter the secondary number and confirm via OTP
4. **Done!** — Both bots are live and in sync

---

### 3.6 — Changelog Section

**Goal**: Show active development; build trust with transparency.

**Layout**: Single centered column, max-width `720px`, timeline-style list.

#### Header
- H2: "What's New"
- Subtitle: "Cosmos is actively developed. Here's a running log of every update."
- Filter tabs: `All · Economy · Commands · Bug Fixes · Infrastructure`

#### Entry Anatomy
Each entry shows:
- Date badge (e.g. "Sep 2026")
- Version number (e.g. `v2.4.0`) and category tags
- Release title
- Short description
- Bullet list of changes using prefix conventions:

| Prefix | Meaning |
|---|---|
| `+` | New feature / addition |
| `~` | Change or improvement |
| `-` | Removed |
| `fix` | Bug fix |
| `perf` | Performance improvement |

#### Visual Treatment
- Left-side vertical timeline bar in `--color-border`
- Version badge: pill with monospace text
- Category tags: small colored pills (Economy = violet, Commands = cyan, Fixes = green)
- Hover: entry card lifts with subtle shadow

#### Pagination
- Show last **5 entries** by default
- "Load more updates" button reveals older entries

---

### 3.7 — Footer

**Layout**: 4-column grid on desktop, 2-column on tablet, stacked on mobile.

**Columns**:
1. **Brand** — Logo, tagline, social icons (WhatsApp, Discord, GitHub)
2. **Product** — Pricing, Changelog, Docs
3. **Community** — Discord, GitHub, Twitter
4. **Legal** — Privacy, Terms, Contact

**Footer Bottom Bar**:
- Left: `© 2026 Cosmos. Made with ♥ in Indonesia.`
- Right: Live mini-ticker `Current USD/IDR: Rp16.240` (fetched client-side from the EODHD API — a nod to the real-time economy mechanic)

---

## 4. Responsive Behavior Summary

| Section | Mobile | Tablet | Desktop |
|---|---|---|---|
| Navbar | Hamburger + slide drawer | Same as desktop | Full inline |
| Hero | Single column, phone mockup below text | Same | Side-by-side |
| Features | 2-column grid | 3-column grid | 3-column grid |
| Pricing | Stacked cards | 2+1 layout | 3-column grid |
| Sub-Bot | Stacked | Stacked | 2-column |
| Changelog | Single column | Single column | Single column (centered) |
| Footer | Stacked | 2-column | 4-column |

---

## 5. Tech Stack Recommendation

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js 15** (App Router) | SSG for landing/changelog, ISR for live ticker |
| Styling | **Tailwind CSS v4** | Rapid utility-first styling |
| Animation | **Framer Motion** | Entrance animations, layout transitions |
| Icons | **Lucide React** | Consistent stroke icons |
| Fonts | **Google Fonts** (Space Grotesk, Inter, JetBrains Mono) | Free, high-quality |
| Live Data | **EODHD API** (USDIDR) | Powers the footer USD/IDR ticker |
| Deployment | **Vercel** | Zero-config Next.js hosting |

---

## 6. Resolved Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Pricing management | **Hardcoded** in the codebase — no CMS needed |
| 2 | Changelog source | **Auto-pull from GitHub Releases / Git tags** — zero maintenance |
| 3 | Sub-bot pairing dashboard | **No dashboard** — pairing is open to any registered/whitelisted number directly via bot commands |
| 4 | "Add to WhatsApp" CTA | **`wa.me` link** (e.g., `wa.me/628xxx`) — opens WhatsApp chat directly |
| 5 | Brand assets | **Both logo SVG and screenshots available** — to be provided and integrated |
