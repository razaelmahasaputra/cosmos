import type { Metadata } from "next";
import Jobs from "@/components/Jobs";

export const metadata: Metadata = {
  title: "Jobs & Salaries — Cosmos",
  description:
    "Work hard, earn virtual Rupiah. Pick a career, grab the required item, and .work your shift — payouts scale with the live economy.",
};

export default function JobsPage() {
  return <Jobs />;
}
