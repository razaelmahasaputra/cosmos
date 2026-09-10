import type { Metadata } from "next";
import Docs from "@/components/Docs";

export const metadata: Metadata = {
  title: "Docs — Cosmos",
  description:
    "Command reference for the Cosmos WhatsApp bot: .job list, .job join, .work and the persisted Prisma schema.",
};

export default function DocsPage() {
  return <Docs />;
}
