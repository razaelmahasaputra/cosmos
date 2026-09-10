import type { Metadata } from "next";
import Pricing from "@/components/Pricing";

export const metadata: Metadata = {
  title: "Pricing — Cosmos",
  description:
    "Pick your orbit. Full economy features on every tier — upgrade for more groups and sub-bots.",
};

export default function PricingPage() {
  return <Pricing />;
}
