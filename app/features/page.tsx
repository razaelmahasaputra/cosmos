import type { Metadata } from "next";
import Features from "@/components/Features";

export const metadata: Metadata = {
  title: "Features — Cosmos",
  description:
    "Job system, item shop, live IDR economy, virtual ID cards, sub-bot pairing and more — everything your group chat was missing.",
};

export default function FeaturesPage() {
  return <Features />;
}
