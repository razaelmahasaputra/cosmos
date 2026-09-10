import type { Metadata } from "next";
import Changelog from "@/components/Changelog";

export const metadata: Metadata = {
  title: "Changelog — Cosmos",
  description:
    "Cosmos is actively developed. A running log of every update: economy, commands, bug fixes and infrastructure.",
};

export default function ChangelogPage() {
  return <Changelog />;
}
