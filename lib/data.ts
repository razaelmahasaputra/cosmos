import type { LucideIcon } from "lucide-react";
import {
  Shovel,
  Pickaxe,
  Coins,
  Gem,
  Laptop,
  CarTaxiFront,
  ChefHat,
  Bike,
  Rocket,
} from "lucide-react";

export type RiskClass = "low" | "med" | "high";

export interface Job {
  icon: LucideIcon;
  name: string;
  base: number;
  cooldown: string;
  req: string;
  desc: string;
  risk: string;
  riskCls: RiskClass;
}

export const JOBS: Job[] = [
  { icon: Shovel, name: "Coal Miner", base: 233333, cooldown: "24 hours", req: "Pickaxe", desc: "Daily shift in the Coal Mine. Steady ore, steady pay.", risk: "High variance", riskCls: "med" },
  { icon: Pickaxe, name: "Iron Miner", base: 166666, cooldown: "24 hours", req: "Pickaxe", desc: "Daily shift. Lower base, reliable veins.", risk: "Medium", riskCls: "med" },
  { icon: Coins, name: "Gold Miner", base: 333333, cooldown: "24 hours", req: "Pickaxe", desc: "Daily shift. Rich veins, higher competition.", risk: "High variance", riskCls: "high" },
  { icon: Gem, name: "Diamond Miner", base: 666666, cooldown: "24 hours", req: "Pickaxe", desc: "Diamond Cave expedition. Highest mining payout.", risk: "Very high risk", riskCls: "high" },
  { icon: Laptop, name: "Office Work", base: 250000, cooldown: "24 hours", req: "MacBook", desc: "Stable daily salary. The reliable 9-to-5 path.", risk: "Low risk", riskCls: "low" },
  { icon: CarTaxiFront, name: "Taxi Driving", base: 133333, cooldown: "24 hours", req: "Driver's License", desc: "Daily shift ferrying passengers across town.", risk: "Low risk", riskCls: "low" },
  { icon: ChefHat, name: "Cooking", base: 150000, cooldown: "24 hours", req: "No item", desc: "Daily kitchen shift. No tools required.", risk: "Low risk", riskCls: "low" },
  { icon: Bike, name: "Gojek", base: 2500, cooldown: "1 hour (gig)", req: "No item", desc: "Gig economy: ~Rp2.500/hour, claim every hour (~Rp60.000/day).", risk: "Flexible", riskCls: "low" },
  { icon: Rocket, name: "Entrepreneurship", base: 1250000, cooldown: "7 days (weekly)", req: "Investment + MacBook/iPhone", desc: "Weekly dividends. Huge upside, chance to fail or lose.", risk: "Very high risk", riskCls: "high" },
];

export const DEMO_JOB_NAMES = [
  "Coal Miner",
  "Iron Miner",
  "Gold Miner",
  "Diamond Miner",
  "Office Work",
  "Taxi Driving",
  "Cooking",
  "Gojek",
  "Entrepreneurship",
] as const;

export interface ChangelogEntry {
  date: string;
  ver: string;
  cats: string[];
  title: string;
  desc: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  { date: "Sep 2026", ver: "v2.4.0", cats: ["Economy"], title: "Job & Salary System", desc: "Alternative non-gambling income: 6 jobs with dynamic IDR-based payouts.", changes: ["+ .job list / .job join / .work commands", "+ JobCatalog model + EconomyMultiplier payout", "~ Salaries track USD/IDR via ExchangeRateLog"] },
  { date: "Sep 2026", ver: "v2.3.1", cats: ["Bug Fixes"], title: "Work cooldown hotfix", desc: "Cooldown edge-cases around midnight shifts resolved.", changes: ["fix lastWorkedAt timezone comparison", "perf cache ExchangeRateLog lookups"] },
  { date: "Aug 2026", ver: "v2.3.0", cats: ["Commands"], title: "Virtual ID Card", desc: "ID cards now gate every economy action.", changes: ["+ IdCard registration flow", "~ .work requires ID card"] },
  { date: "Aug 2026", ver: "v2.2.0", cats: ["Economy"], title: "Live IDR economy feed", desc: "EODHD USD/IDR integration with inflation multiplier.", changes: ["+ services/inflation.ts + ExchangeRateLog", "+ formatRupiah currency utility"] },
  { date: "Jul 2026", ver: "v2.1.0", cats: ["Infrastructure"], title: "Sub-bot pairing", desc: "Multiple numbers, one shared economy database.", changes: ["+ OTP linking for secondary numbers", "+ per-number custom prefixes"] },
  { date: "Jul 2026", ver: "v2.0.0", cats: ["Commands"], title: "Item shop launch", desc: "Pickaxes, MacBooks and licenses unlock careers.", changes: ["+ UserInventory + shop commands", "- legacy giveaway command"] },
  { date: "Jun 2026", ver: "v1.9.2", cats: ["Bug Fixes"], title: "Balance precision fix", desc: "BigInt balances no longer lose precision.", changes: ["fix BigInt serialization in replies"] },
  { date: "Jun 2026", ver: "v1.9.0", cats: ["Infrastructure"], title: "Prismausmigrate baseline", desc: "Production-safe migration pipeline.", changes: ["~ migrate dev → db push per env", "perf connection pooling"] },
];

export const CHANGELOG_FILTERS = [
  "All",
  "Economy",
  "Commands",
  "Bug Fixes",
  "Infrastructure",
] as const;

export const WA_NUMBER = "6281234567890";
export const WA_LINKS = {
  add: `https://wa.me/${WA_NUMBER}?text=Hi%20Cosmos!%20I%20want%20to%20add%20you%20to%20my%20group.`,
  bare: `https://wa.me/${WA_NUMBER}`,
  subsidized: `https://wa.me/${WA_NUMBER}?text=I%20want%20Cosmos%20Subsidized`,
  partner: `https://wa.me/${WA_NUMBER}?text=I%20want%20to%20become%20a%20Cosmos%20Partner`,
  subbot: `https://wa.me/${WA_NUMBER}?text=How%20do%20I%20pair%20a%20sub-bot?`,
} as const;
